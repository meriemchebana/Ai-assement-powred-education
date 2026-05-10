"""Build per-user per-subject RAG index in Supabase."""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

from ..rag.chunker import chunk_json, chunk_pdf
from .embedder import embed_arabic, embed_general, is_arabic
from .store import SupabaseStore

log = logging.getLogger("exam-forge.rag_cloud.indexer")

_PDF_SUBDIRS = ("courses", "td")


class CloudIndexer:
    def __init__(
        self,
        store: SupabaseStore,
        arabert_api_key: str,
        arabert_model: str,
        general_api_key: str,
        general_model: str,
    ) -> None:
        self._store = store
        self._arab_key = arabert_api_key
        self._arab_model = arabert_model
        self._gen_key = general_api_key
        self._gen_model = general_model

    def build(
        self,
        user_id: str,
        subject: str,
        data_dir: Path,
        rebuild: bool = False,
    ) -> int:
        """Chunk all PDFs in data_dir/subject, embed, and store in Supabase.

        Returns the number of chunks stored.
        """
        if rebuild:
            self._store.delete_subject(user_id, subject)

        chunks: list[dict] = []
        subject_dir = data_dir / subject

        for subdir_name in _PDF_SUBDIRS:
            pdf_dir = subject_dir / subdir_name
            if not pdf_dir.is_dir():
                continue
            for pdf_path in sorted(pdf_dir.glob("*.pdf")):
                label = f"{subject}/{subdir_name}/{pdf_path.name}"
                try:
                    file_chunks = chunk_pdf(pdf_path, label)
                except Exception as exc:
                    log.warning("skip %s: %s", pdf_path.name, exc)
                    continue
                for c in file_chunks:
                    c["subject"] = subject
                chunks.extend(file_chunks)

        if not chunks:
            log.warning("no chunks for user=%s subject=%s", user_id, subject)
            return 0

        texts = [c["text"] for c in chunks]
        arabic_ids = [i for i, t in enumerate(texts) if is_arabic(t)]
        general_ids = [i for i, t in enumerate(texts) if not is_arabic(t)]

        arabic_embs: np.ndarray | None = None
        general_embs: np.ndarray | None = None

        if arabic_ids and self._arab_key:
            try:
                arabic_embs = embed_arabic(
                    [texts[i] for i in arabic_ids], self._arab_key, self._arab_model
                )
            except Exception as exc:
                log.warning("Arabic embedding failed: %s", exc)

        if general_ids and self._gen_key:
            try:
                general_embs = embed_general(
                    [texts[i] for i in general_ids], self._gen_key, self._gen_model
                )
            except Exception as exc:
                log.warning("General embedding failed: %s", exc)

        arab_pos = {gid: li for li, gid in enumerate(arabic_ids)}
        gen_pos = {gid: li for li, gid in enumerate(general_ids)}

        rows: list[dict] = []
        for i, c in enumerate(chunks):
            row: dict = {
                "user_id": user_id,
                "subject": subject,
                "source_file": c.get("source", ""),
                "text": c["text"],
                "strategy": c.get("strategy"),
                "passed_parser": False,
            }
            if arabic_embs is not None and i in arab_pos:
                row["emb_arabic"] = arabic_embs[arab_pos[i]].tolist()
            if general_embs is not None and i in gen_pos:
                row["emb_general"] = general_embs[gen_pos[i]].tolist()
            rows.append(row)

        for start in range(0, len(rows), 100):
            self._store.insert_chunks(rows[start : start + 100])

        log.info("user=%s subject=%s stored %d chunks", user_id, subject, len(rows))
        return len(rows)

    def index_file(
        self,
        user_id: str,
        subject: str,
        file_path: Path,
        passed_parser: bool = True,
    ) -> int:
        """Index a single JSON or PDF file for a specific user.

        Called after docParser finishes to immediately make the content
        searchable via cloud RAG without rebuilding the entire subject index.
        """
        label = file_path.name
        if file_path.suffix.lower() == ".json":
            chunks = chunk_json(file_path, label)
        else:
            try:
                chunks = chunk_pdf(file_path, label)
            except Exception as exc:
                log.warning("skip %s: %s", file_path.name, exc)
                return 0

        if not chunks:
            return 0

        for c in chunks:
            c["subject"] = subject

        texts = [c["text"] for c in chunks]
        arabic_ids = [i for i, t in enumerate(texts) if is_arabic(t)]
        general_ids = [i for i, t in enumerate(texts) if not is_arabic(t)]

        arabic_embs: np.ndarray | None = None
        general_embs: np.ndarray | None = None

        if arabic_ids and self._arab_key:
            try:
                arabic_embs = embed_arabic(
                    [texts[i] for i in arabic_ids], self._arab_key, self._arab_model
                )
            except Exception as exc:
                log.warning("Arabic embedding failed: %s", exc)

        if general_ids and self._gen_key:
            try:
                general_embs = embed_general(
                    [texts[i] for i in general_ids], self._gen_key, self._gen_model
                )
            except Exception as exc:
                log.warning("General embedding failed: %s", exc)

        arab_pos = {gid: li for li, gid in enumerate(arabic_ids)}
        gen_pos  = {gid: li for li, gid in enumerate(general_ids)}

        rows: list[dict] = []
        for i, c in enumerate(chunks):
            row: dict = {
                "user_id": user_id,
                "subject": subject,
                "source_file": label,
                "text": c["text"],
                "strategy": c.get("strategy"),
                "passed_parser": passed_parser,
            }
            if arabic_embs is not None and i in arab_pos:
                row["emb_arabic"] = arabic_embs[arab_pos[i]].tolist()
            if general_embs is not None and i in gen_pos:
                row["emb_general"] = general_embs[gen_pos[i]].tolist()
            rows.append(row)

        for start in range(0, len(rows), 100):
            self._store.insert_chunks(rows[start : start + 100])

        log.info("indexed file=%s user=%s subject=%s chunks=%d", label, user_id, subject, len(rows))
        return len(rows)

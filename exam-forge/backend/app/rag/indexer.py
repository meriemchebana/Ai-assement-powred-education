"""Build and manage per-subject hybrid RAG indices.

Index layout:
  <index_dir>/<subject>/
      chunks.json           – all chunks (Arabic + non-Arabic)
      bm25.pkl              – BM25Okapi over ALL chunks
      tfidf.npz             – TF-IDF/LSA FAISS for non-Arabic chunks
      vocab.json            – TF-IDF vocabulary
      faiss.index           – TF-IDF FAISS binary
      arabic_faiss.index    – AraBERT FAISS binary (only if Arabic chunks exist)
      arabic_dim.txt        – AraBERT embedding dimension
      arabic_ids.json       – [global_idx, ...] mapping local→global

Dense routing:
  Arabic query  → arabic_faiss  (AraBERT embeddings via HF API)
  Other query   → faiss.index   (TF-IDF/LSA)
  BM25 covers all chunks in every query.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from .arabic_embedder import ArabicStore, is_arabic
from .bm25_store import BM25Store
from .chunker import chunk_pdf
from .retriever import HybridRetriever
from .tfidf_store import TFIDFStore

log = logging.getLogger("exam-forge.rag")

# #Indexer_PDFDirs — only scan these subdirectories inside each subject folder
_PDF_SUBDIRS = ("courses", "td")


# #Indexer_SubjectIndex — builds/loads one complete hybrid index per subject
class SubjectIndex:
    def __init__(self, subject: str, index_dir: Path, arabert_api_key: str = "", arabert_model: str = "") -> None:
        self.subject = subject
        self._dir = index_dir / subject
        self._arabert_key = arabert_api_key
        self._arabert_model = arabert_model
        self.retriever: HybridRetriever | None = None

    def is_built(self) -> bool:
        return (self._dir / "chunks.json").exists()

    # ── build ─────────────────────────────────────────────────────────────────

    # #Indexer_Build — chunk all PDFs, build BM25+TF-IDF+AraBERT, persist to disk
    def build(self, data_dir: Path) -> None:
        subject_dir = data_dir / self.subject
        chunks: list[dict] = []

        for subdir_name in _PDF_SUBDIRS:
            pdf_dir = subject_dir / subdir_name
            if not pdf_dir.is_dir():
                continue
            for pdf_path in sorted(pdf_dir.glob("*.pdf")):
                label = f"{self.subject}/{subdir_name}/{pdf_path.name}"
                try:
                    file_chunks = chunk_pdf(pdf_path, label)
                except Exception as exc:
                    log.warning("skip %s: %s", pdf_path.name, exc)
                    continue
                for c in file_chunks:
                    c["subject"] = self.subject
                    c["source_type"] = "pdf"
                chunks.extend(file_chunks)

        if not chunks:
            log.warning("no PDF chunks found for subject=%s", self.subject)
            return

        texts = [c["text"] for c in chunks]

        # ── BM25 over all chunks ──────────────────────────────────────────────
        bm25 = BM25Store()
        bm25.build(texts)

        # ── TF-IDF over all chunks (fallback for any non-Arabic query) ────────
        tfidf = TFIDFStore()
        tfidf.build(texts)

        # ── AraBERT for Arabic chunks (if API key is set) ─────────────────────
        arabic_store: ArabicStore | None = None
        arabic_ids: list[int] = []

        if self._arabert_key and self._arabert_model:
            arabic_ids = [i for i, t in enumerate(texts) if is_arabic(t)]
            if arabic_ids:
                log.info("subject=%s  arabic_chunks=%d / %d", self.subject, len(arabic_ids), len(chunks))
                arabic_texts = [texts[i] for i in arabic_ids]
                try:
                    arabic_store = ArabicStore(self._arabert_key, self._arabert_model)
                    arabic_store.build(arabic_texts)
                except Exception as exc:
                    log.warning("AraBERT build failed for %s: %s — Arabic will use TF-IDF fallback", self.subject, exc)
                    arabic_store = None
                    arabic_ids = []
            else:
                log.info("subject=%s  no Arabic chunks detected", self.subject)

        # ── Persist ───────────────────────────────────────────────────────────
        self._dir.mkdir(parents=True, exist_ok=True)
        (self._dir / "chunks.json").write_text(
            json.dumps(chunks, ensure_ascii=False), encoding="utf-8"
        )
        bm25.save(self._dir / "bm25.pkl")
        tfidf.save(self._dir / "tfidf.npz")

        if arabic_store and arabic_ids:
            arabic_store.save(self._dir / "arabic_faiss.index")
            (self._dir / "arabic_ids.json").write_text(json.dumps(arabic_ids))

        self.retriever = HybridRetriever(chunks, bm25, tfidf, arabic_store, arabic_ids)
        log.info("subject=%s  chunks=%d  index ready", self.subject, len(chunks))

    # ── load ──────────────────────────────────────────────────────────────────

    # #Indexer_Load — restore all indices from disk cache (no rebuild)
    def load(self) -> None:
        chunks = json.loads((self._dir / "chunks.json").read_text(encoding="utf-8"))
        bm25 = BM25Store.load(self._dir / "bm25.pkl")
        tfidf = TFIDFStore.load(self._dir / "tfidf.npz")

        arabic_store: ArabicStore | None = None
        arabic_ids: list[int] = []

        arabic_index_path = self._dir / "arabic_faiss.index"
        arabic_ids_path = self._dir / "arabic_ids.json"

        if arabic_index_path.exists() and arabic_ids_path.exists() and self._arabert_key:
            try:
                arabic_store = ArabicStore.load(arabic_index_path, self._arabert_key, self._arabert_model)
                arabic_ids = json.loads(arabic_ids_path.read_text())
                log.info("subject=%s  loaded arabic FAISS (%d chunks)", self.subject, len(arabic_ids))
            except Exception as exc:
                log.warning("could not load Arabic FAISS for %s: %s", self.subject, exc)

        self.retriever = HybridRetriever(chunks, bm25, tfidf, arabic_store, arabic_ids)
        log.info("subject=%s  loaded %d chunks from cache", self.subject, len(chunks))


# #Indexer_RAGIndexer — top-level manager: one SubjectIndex per subject directory
class RAGIndexer:
    """Top-level manager: one SubjectIndex per subject directory."""

    def __init__(
        self,
        data_dir: Path,
        index_dir: Path,
        arabert_api_key: str = "",
        arabert_model: str = "",
    ) -> None:
        self._data_dir = data_dir
        self._index_dir = index_dir
        self._arabert_key = arabert_api_key
        self._arabert_model = arabert_model
        self._indices: dict[str, SubjectIndex] = {}

    # #Indexer_BuildAll — iterate subject dirs: load from cache or build fresh
    def build_all(self) -> None:
        if not self._data_dir.exists():
            log.error("data_dir not found: %s", self._data_dir)
            return
        for subject_dir in sorted(p for p in self._data_dir.iterdir() if p.is_dir()):
            subject = subject_dir.name
            idx = SubjectIndex(subject, self._index_dir, self._arabert_key, self._arabert_model)
            if idx.is_built():
                try:
                    idx.load()
                except Exception as exc:
                    log.warning("failed to load cache for %s: %s — rebuilding", subject, exc)
                    idx.build(self._data_dir)
            else:
                idx.build(self._data_dir)
            self._indices[subject] = idx

    # #Indexer_Query — retrieve top-k chunks for subject, format as text block for LLM
    def query(self, subject: str, query_text: str, top_k: int = 4) -> str:
        idx = self._indices.get(subject)
        if idx is None or idx.retriever is None:
            return ""
        chunks = idx.retriever.query(query_text, top_k)
        if not chunks:
            return ""
        parts = []
        for c in chunks:
            title = c.get("title") or c.get("source", "")
            text = c["text"].strip()
            header = f"[{title}]\n" if title and title not in text[:60] else ""
            parts.append(f"{header}{text}")
        return "\n\n---\n\n".join(parts)

    def subjects(self) -> list[str]:
        return list(self._indices.keys())

"""Query Supabase pgvector with RRF fusion (vector + full-text)."""
from __future__ import annotations

import logging
from collections import Counter

from .embedder import embed_arabic, embed_general, is_arabic
from .store import SupabaseStore

log = logging.getLogger("exam-forge.rag_cloud.retriever")


def _rrf(result_lists: list[list[str]], k: int = 60) -> list[str]:
    """Reciprocal Rank Fusion on lists of chunk IDs."""
    scores: dict[str, float] = {}
    for ranked in result_lists:
        for rank, chunk_id in enumerate(ranked):
            scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores, key=lambda x: scores[x], reverse=True)


class CloudRetriever:
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

    def query(
        self, user_id: str, subject: str, query_text: str, top_k: int = 4
    ) -> str:
        fetch = top_k * 3
        all_lists: list[list[str]] = []
        chunk_map: dict[str, dict] = {}

        # --- vector search ---
        try:
            if is_arabic(query_text) and self._arab_key:
                q_vec = embed_arabic([query_text], self._arab_key, self._arab_model)[0]
                results = self._store.vector_search_arabic(q_vec, user_id, subject, fetch)
            elif self._gen_key:
                q_vec = embed_general([query_text], self._gen_key, self._gen_model)[0]
                results = self._store.vector_search_general(q_vec, user_id, subject, fetch)
            else:
                results = []

            for r in results:
                chunk_map[r["id"]] = r
            all_lists.append([r["id"] for r in results])
        except Exception as exc:
            log.warning("vector search failed: %s", exc)

        # --- full-text search ---
        try:
            fts = self._store.fts_search(query_text, user_id, subject, fetch)
            for r in fts:
                chunk_map[r["id"]] = r
            all_lists.append([r["id"] for r in fts])
        except Exception as exc:
            log.warning("FTS search failed: %s", exc)

        if not chunk_map:
            return ""

        merged = _rrf(all_lists)

        source_counts: Counter[str] = Counter()
        selected: list[dict] = []
        for cid in merged:
            chunk = chunk_map.get(cid)
            if not chunk:
                continue
            src = chunk.get("source_file", "")
            if source_counts[src] < 2:
                selected.append(chunk)
                source_counts[src] += 1
            if len(selected) == top_k:
                break

        if not selected:
            return ""

        parts = []
        for c in selected:
            text = c["text"].strip()
            src = c.get("source_file", "")
            header = f"[{src}]\n" if src and src not in text[:60] else ""
            parts.append(f"{header}{text}")
        return "\n\n---\n\n".join(parts)

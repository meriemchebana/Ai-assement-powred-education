"""Hybrid retriever: BM25 (sparse) + language-aware dense, fused with RRF.

Dense routing:
  Arabic query  → AraBERT FAISS  (indices remapped to global chunk list)
  Other query   → TF-IDF FAISS   (already global)
  Fallback      → TF-IDF if AraBERT unavailable
"""

from __future__ import annotations

from collections import Counter

from .arabic_embedder import ArabicStore, is_arabic
from .bm25_store import BM25Store
from .tfidf_store import TFIDFStore


# #RRF_Algorithm — Reciprocal Rank Fusion: score = sum(1 / (k + rank)) across all lists
def _rrf(
    result_lists: list[list[tuple[int, float]]],
    k: int = 60,
) -> list[tuple[int, float]]:
    scores: dict[int, float] = {}
    for ranked in result_lists:
        for rank, (chunk_id, _) in enumerate(ranked):
            scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)


class HybridRetriever:
    """Subject-scoped retriever. Arabic queries use AraBERT; others use TF-IDF."""

    def __init__(
        self,
        chunks: list[dict],
        bm25: BM25Store,
        tfidf: TFIDFStore,
        arabic_store: ArabicStore | None = None,
        arabic_chunk_ids: list[int] | None = None,
    ) -> None:
        self._chunks = chunks
        self._bm25 = bm25
        self._tfidf = tfidf
        # #RRF_ArabicIDMap — ArabicStore uses local ids [0..n); map back to global chunk ids
        self._arabic = arabic_store
        self._arabic_ids: list[int] = arabic_chunk_ids or []

    def query(self, text: str, top_k: int = 5) -> list[dict]:
        fetch = top_k * 3

        # #RRF_BM25Leg — sparse leg: keyword matching over all chunks
        bm25_res = self._bm25.query(text, fetch)

        # #RRF_DenseLeg — dense leg: AraBERT for Arabic queries, TF-IDF/LSA otherwise
        if self._arabic and self._arabic_ids and is_arabic(text):
            local_res = self._arabic.query(text, fetch)
            dense_res = [
                (self._arabic_ids[i], s)
                for i, s in local_res
                if i < len(self._arabic_ids)
            ]
        else:
            dense_res = self._tfidf.query(text, fetch)

        # #RRF_Merge — fuse both ranked lists into one score via RRF
        merged = _rrf([bm25_res, dense_res])

        # #RRF_Diversity — cap 2 chunks per source file to avoid one document dominating
        source_counts: Counter[str] = Counter()
        diverse: list[int] = []
        for chunk_id, _ in merged:
            if chunk_id >= len(self._chunks):
                continue
            src = self._chunks[chunk_id].get("source", "")
            if source_counts[src] < 2:
                diverse.append(chunk_id)
                source_counts[src] += 1
            if len(diverse) == top_k:
                break

        return [self._chunks[i] for i in diverse]

    @property
    def chunk_count(self) -> int:
        return len(self._chunks)

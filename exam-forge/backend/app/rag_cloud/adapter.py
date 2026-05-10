"""Duck-type adapter so CloudRetriever can be passed wherever RAGIndexer is expected."""
from __future__ import annotations

from .retriever import CloudRetriever


class CloudRAGAdapter:
    """Wraps CloudRetriever + user_id to match the RAGIndexer.query() signature."""

    def __init__(self, retriever: CloudRetriever, user_id: str) -> None:
        self._retriever = retriever
        self._user_id = user_id

    def query(self, subject: str, query_text: str, top_k: int = 4) -> str:
        return self._retriever.query(self._user_id, subject, query_text, top_k)

    def subjects(self) -> list[str]:
        return []

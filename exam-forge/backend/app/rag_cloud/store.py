"""Supabase pgvector CRUD for RAG chunks."""
from __future__ import annotations

import logging

import numpy as np
from supabase import Client, create_client

log = logging.getLogger("exam-forge.rag_cloud.store")

_TABLE = "rag_chunks"


class SupabaseStore:
    def __init__(self, url: str, key: str) -> None:
        self._client: Client = create_client(url, key)

    def insert_chunks(self, rows: list[dict]) -> None:
        self._client.table(_TABLE).insert(rows).execute()
        log.info("Inserted %d chunks", len(rows))

    def delete_subject(self, user_id: str, subject: str) -> None:
        self._client.table(_TABLE)\
            .delete()\
            .eq("user_id", user_id)\
            .eq("subject", subject)\
            .execute()
        log.info("Deleted chunks for user=%s subject=%s", user_id, subject)

    def vector_search_arabic(
        self, query_vec: np.ndarray, user_id: str, subject: str, k: int
    ) -> list[dict]:
        res = self._client.rpc(
            "match_arabic_chunks",
            {"query_vec": query_vec.tolist(), "user_id": user_id,
             "subject": subject, "match_count": k},
        ).execute()
        return res.data or []

    def vector_search_general(
        self, query_vec: np.ndarray, user_id: str, subject: str, k: int
    ) -> list[dict]:
        res = self._client.rpc(
            "match_general_chunks",
            {"query_vec": query_vec.tolist(), "user_id": user_id,
             "subject": subject, "match_count": k},
        ).execute()
        return res.data or []

    def fts_search(
        self, query_text: str, user_id: str, subject: str, k: int
    ) -> list[dict]:
        res = self._client.rpc(
            "search_chunks_fts",
            {"query_text": query_text, "user_id": user_id,
             "subject": subject, "match_count": k},
        ).execute()
        return res.data or []

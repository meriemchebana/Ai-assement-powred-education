"""AraBERT embeddings via HuggingFace Inference API (encoder-only, no local GPU needed).

AraBERT is a BERT-based encoder pre-trained on Arabic text.
It produces contextual token embeddings; we mean-pool them to get a sentence vector.

Two public uses:
  embed_texts(texts, api_key, model)  → np.ndarray  (n, hidden_size)  — for index building
  embed_query(text, api_key, model)   → np.ndarray  (hidden_size,)     — for retrieval

Arabic detection (is_arabic) decides which chunks/queries use this store.
"""

from __future__ import annotations

import logging
import re
import time
from pathlib import Path

import faiss
import numpy as np
import requests

log = logging.getLogger("exam-forge.rag.arabic")

# #Arabic_HF_URL — HuggingFace Inference router endpoint for feature-extraction
_HF_URL = "https://router.huggingface.co/hf-inference/models/{model}/pipeline/feature-extraction"
_BATCH = 8           # #Embed_BATCH — HF inference API handles batches of this size well
_MAX_CHARS = 400     # #Embed_MAX_CHARS — BERT max ~512 tokens; Arabic chars are denser than Latin
_ARABIC_RE = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿ]")


# #Arabic_Detect — >30% Arabic chars in text → treat as Arabic query/chunk
def is_arabic(text: str) -> bool:
    if not text:
        return False
    arabic = len(_ARABIC_RE.findall(text))
    return arabic / len(text) > 0.30


# ── HF API ───────────────────────────────────────────────────────────────────

# #Arabic_HF_Embed — POST to HF API, get per-token vectors, mean-pool → sentence vector
def _hf_embed(texts: list[str], api_key: str, model: str) -> np.ndarray:
    url = _HF_URL.format(model=model)
    headers = {"Authorization": f"Bearer {api_key}"}

    # Truncate to avoid BERT's 512-token limit
    truncated = [t[:_MAX_CHARS] for t in texts]
    payload = {"inputs": truncated if len(truncated) > 1 else truncated[0]}

    wait = 2
    for attempt in range(4):
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=60)

            if resp.status_code == 403:
                raise RuntimeError(
                    "AraBERT: HuggingFace token lacks inference permissions. "
                    "Go to huggingface.co → Settings → Access Tokens, create a new "
                    "'Read' token (not fine-grained), and set it as ARABERT_API_KEY in .env"
                )

            resp.raise_for_status()
            raw = resp.json()

            # #Arabic_MeanPool — average all token vectors → one sentence vector per text
            if isinstance(raw[0][0], list):
                # batch: raw = [[token_vecs, ...], [token_vecs, ...], ...]
                rows = [np.array(item, dtype=np.float32).mean(axis=0) for item in raw]
            else:
                # single: raw = [[float, ...], [float, ...], ...]  → [seq_len, H]
                rows = [np.array(raw, dtype=np.float32).mean(axis=0)]
            return np.stack(rows)  # [N, H]

        except requests.HTTPError as e:
            if resp.status_code == 503:          # model still loading
                # #Arabic_Retry — 503 means model cold-starting on HF, back-off and retry
                log.info("AraBERT loading on HF, waiting %ds …", wait)
                time.sleep(wait)
                wait = min(wait * 2, 30)
                continue
            raise
        except RuntimeError:
            raise
        except Exception as e:
            if attempt == 3:
                raise
            log.warning("HF API error (attempt %d): %s", attempt + 1, e)
            time.sleep(wait)
            wait *= 2

    raise RuntimeError("AraBERT API failed after retries")


# ── Public API ────────────────────────────────────────────────────────────────

# #Arabic_BatchEmbed — split texts into batches of 8, embed each, stack results
def embed_texts(texts: list[str], api_key: str, model: str) -> np.ndarray:
    all_rows: list[np.ndarray] = []
    for i in range(0, len(texts), _BATCH):
        batch = texts[i: i + _BATCH]
        rows = _hf_embed(batch, api_key, model)
        all_rows.append(rows)
        if i + _BATCH < len(texts):
            time.sleep(0.3)   # polite rate limiting
    return np.vstack(all_rows).astype(np.float32)


# #Arabic_QueryEmbed — embed a single query string → (hidden_size,) vector
def embed_query(text: str, api_key: str, model: str) -> np.ndarray:
    return _hf_embed([text], api_key, model)[0]


# ── FAISS store for Arabic chunks ─────────────────────────────────────────────

# #Arabic_Normalize — L2-normalise so IndexFlatIP computes cosine similarity
def _normalize(mat: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    return (mat / norms).astype(np.float32)


class ArabicStore:
    """FAISS IndexFlatIP backed by AraBERT mean-pooled embeddings."""

    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model
        self._index: faiss.IndexFlatIP | None = None
        self._dim: int = 0

    # #Arabic_Build — embed all Arabic chunks and load into FAISS
    def build(self, texts: list[str]) -> None:
        log.info("Embedding %d Arabic chunks with AraBERT …", len(texts))
        embeddings = embed_texts(texts, self._api_key, self._model)
        embeddings = _normalize(embeddings)
        self._dim = embeddings.shape[1]
        self._index = faiss.IndexFlatIP(self._dim)
        self._index.add(embeddings)
        log.info("Arabic FAISS ready: %d chunks, dim=%d", len(texts), self._dim)

    # #Arabic_Query — embed query, search FAISS, return (local_id, score) pairs
    def query(self, text: str, top_k: int) -> list[tuple[int, float]]:
        if self._index is None:
            return []
        try:
            q = embed_query(text, self._api_key, self._model).reshape(1, -1)
            norm = np.linalg.norm(q)
            if norm > 0:
                q /= norm
            scores, idx = self._index.search(q.astype(np.float32), top_k)
            return [(int(i), float(s)) for i, s in zip(idx[0], scores[0]) if i >= 0]
        except Exception as e:
            log.warning("Arabic FAISS query failed: %s", e)
            return []

    # #Arabic_Save — write FAISS index + dimension to disk
    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        faiss.write_index(self._index, str(path))
        (path.parent / "arabic_dim.txt").write_text(str(self._dim))

    # #Arabic_Load — restore FAISS index from disk
    @classmethod
    def load(cls, path: Path, api_key: str, model: str) -> "ArabicStore":
        store = cls(api_key, model)
        store._index = faiss.read_index(str(path))
        store._dim = int((path.parent / "arabic_dim.txt").read_text())
        return store

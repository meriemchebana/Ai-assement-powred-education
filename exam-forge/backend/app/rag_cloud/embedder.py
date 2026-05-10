"""HuggingFace API embeddings for cloud RAG.

Arabic  → AraBERT large   (1024-dim)  — same model as local version
General → multilingual-MiniLM (384-dim) — covers French / English
"""
from __future__ import annotations

import logging
import re
import time

import numpy as np
import requests

log = logging.getLogger("exam-forge.rag_cloud.embedder")

ARABIC_DIM = 1024
GENERAL_DIM = 384

_BATCH = 8
_MAX_CHARS = 400
_ARABIC_RE = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿ]")
_HF_URL = "https://router.huggingface.co/hf-inference/models/{model}/pipeline/feature-extraction"


def is_arabic(text: str) -> bool:
    if not text:
        return False
    return len(_ARABIC_RE.findall(text)) / len(text) > 0.30


def _hf_embed(texts: list[str], api_key: str, model: str) -> np.ndarray:
    url = _HF_URL.format(model=model)
    headers = {"Authorization": f"Bearer {api_key}"}
    truncated = [t[:_MAX_CHARS] for t in texts]
    payload = {"inputs": truncated if len(truncated) > 1 else truncated[0]}

    wait = 2
    for attempt in range(4):
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=60)
            if resp.status_code == 403:
                raise RuntimeError(
                    "HuggingFace token lacks inference permissions. "
                    "Create a 'Read' token at huggingface.co → Settings → Access Tokens."
                )
            resp.raise_for_status()
            raw = resp.json()
            if isinstance(raw[0][0], list):
                rows = [np.array(item, dtype=np.float32).mean(axis=0) for item in raw]
            else:
                rows = [np.array(raw, dtype=np.float32).mean(axis=0)]
            return np.stack(rows)
        except requests.HTTPError:
            if resp.status_code == 503:
                log.info("Model loading on HF, waiting %ds…", wait)
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
    raise RuntimeError("HF API failed after retries")


def _normalize(mat: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    return (mat / np.where(norms == 0, 1.0, norms)).astype(np.float32)


def _batch_embed(texts: list[str], api_key: str, model: str) -> np.ndarray:
    all_rows: list[np.ndarray] = []
    for i in range(0, len(texts), _BATCH):
        rows = _hf_embed(texts[i : i + _BATCH], api_key, model)
        all_rows.append(rows)
        if i + _BATCH < len(texts):
            time.sleep(0.3)
    return _normalize(np.vstack(all_rows).astype(np.float32))


def embed_arabic(texts: list[str], api_key: str, model: str) -> np.ndarray:
    """Returns (n, 1024) normalised AraBERT embeddings."""
    return _batch_embed(texts, api_key, model)


def embed_general(texts: list[str], api_key: str, model: str) -> np.ndarray:
    """Returns (n, 384) normalised multilingual embeddings."""
    return _batch_embed(texts, api_key, model)

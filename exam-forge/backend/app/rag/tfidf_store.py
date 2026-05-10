"""Dense TF-IDF + LSA retrieval backed by FAISS (no torch required).

Pipeline:
  1. Build term vocabulary (top-N by corpus frequency).
  2. Compute TF-IDF matrix (n_docs × vocab_size).
  3. Truncated SVD (LSA) to n_components dimensions — numpy only.
  4. Normalize rows → cosine similarity via FAISS IndexFlatIP.

Saved state: vocab (json), arrays (npz), faiss index (binary).
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

import faiss
import numpy as np

# #TFIDF_MathNorm — same Greek/math normalisation as bm25_store
_MATH_NORM = str.maketrans({
    'μ': 'mu',      'σ': 'sigma',   'θ': 'theta',   'Σ': 'sigma',
    'α': 'alpha',   'β': 'beta',    'λ': 'lambda',   'π': 'pi',
    'ε': 'epsilon', 'δ': 'delta',   'φ': 'phi',      'γ': 'gamma',
    'ρ': 'rho',     'η': 'eta',     'ω': 'omega',    'χ': 'chi',
    '²': '2',       '³': '3',       '₁': '1',        '₂': '2',
    '₃': '3',       '≥': 'gte',     '≤': 'lte',      '≠': 'neq',
})


def _normalize_math(text: str) -> str:
    return text.translate(_MATH_NORM)


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[\w؀-ۿ]+", _normalize_math(text).lower())


class TFIDFStore:
    def __init__(self, vocab_size: int = 8000, n_components: int = 128) -> None:
        self._vocab_size = vocab_size
        self._n_components = n_components
        self._vocab: dict[str, int] = {}
        self._idf: np.ndarray | None = None
        self._Vt: np.ndarray | None = None   # (k × vocab_size) projection
        self._index: faiss.IndexFlatIP | None = None
        self._dim: int = 0

    # ── build ─────────────────────────────────────────────────────────────────

    def build(self, texts: list[str]) -> None:
        tokenized = [_tokenize(t) for t in texts]

        # #TFIDF_Vocab — pick top-8000 terms by corpus frequency
        counts = Counter(w for tokens in tokenized for w in tokens)
        vocab_terms = [w for w, _ in counts.most_common(self._vocab_size)]
        self._vocab = {w: i for i, w in enumerate(vocab_terms)}
        V = len(self._vocab)

        # #TFIDF_TF — term frequency matrix: rows=chunks, cols=vocab
        n = len(texts)
        tf = np.zeros((n, V), dtype=np.float32)
        for i, tokens in enumerate(tokenized):
            for w in tokens:
                if w in self._vocab:
                    tf[i, self._vocab[w]] += 1
            if tokens:
                tf[i] /= len(tokens)

        # #TFIDF_IDF — inverse document frequency: rare words get higher weight
        df = (tf > 0).sum(axis=0).astype(np.float32)
        self._idf = (np.log((n + 1) / (df + 1)) + 1).astype(np.float32)

        # #TFIDF_Matrix — element-wise TF × IDF
        tfidf = tf * self._idf

        # #LSA_SVD — truncated SVD: compress vocab_size → 128 latent dimensions
        k = min(self._n_components, n - 1, V - 1)
        if k < 2:
            # corpus too tiny for LSA; fall back to raw TF-IDF (top-k dims)
            k = min(self._n_components, V)
            self._Vt = np.eye(V, k, dtype=np.float32).T        # identity slice
            embeddings = tfidf[:, :k].astype(np.float32)
        else:
            _, _, Vt = np.linalg.svd(tfidf, full_matrices=False)
            self._Vt = Vt[:k].astype(np.float32)               # (k × V)
            embeddings = (tfidf @ self._Vt.T).astype(np.float32)  # (n × k)

        # #LSA_FAISS — L2-normalise then load into FAISS IndexFlatIP (= cosine sim)
        self._dim = embeddings.shape[1]
        embeddings = self._normalize(embeddings)
        self._index = faiss.IndexFlatIP(self._dim)
        self._index.add(embeddings)

    # ── query ─────────────────────────────────────────────────────────────────

    # #TFIDF_Query — project query into LSA space, search FAISS for nearest chunks
    def query(self, text: str, top_k: int) -> list[tuple[int, float]]:
        if self._index is None or self._idf is None or self._Vt is None:
            return []
        tokens = _tokenize(text)
        V = len(self._vocab)
        tf_q = np.zeros(V, dtype=np.float32)
        for w in tokens:
            if w in self._vocab:
                tf_q[self._vocab[w]] += 1
        if tokens:
            tf_q /= len(tokens)
        tfidf_q = (tf_q * self._idf).astype(np.float32)
        proj = (tfidf_q @ self._Vt.T).reshape(1, -1).astype(np.float32)
        proj = self._normalize(proj)
        scores, idx = self._index.search(proj, top_k)
        return [(int(i), float(s)) for i, s in zip(idx[0], scores[0]) if i >= 0]

    # ── persistence ───────────────────────────────────────────────────────────

    # #TFIDF_Save — write vocab.json + tfidf.npz + faiss.index to disk
    def save(self, base_path: Path) -> None:
        base_path.parent.mkdir(parents=True, exist_ok=True)
        (base_path.parent / "vocab.json").write_text(
            json.dumps(self._vocab, ensure_ascii=False), encoding="utf-8"
        )
        np.savez_compressed(
            str(base_path),
            idf=self._idf,
            Vt=self._Vt,
        )
        faiss.write_index(self._index, str(base_path.parent / "faiss.index"))

    # #TFIDF_Load — restore vocab + arrays + FAISS index from disk
    @classmethod
    def load(cls, base_path: Path) -> "TFIDFStore":
        store = cls()
        store._vocab = json.loads(
            (base_path.parent / "vocab.json").read_text(encoding="utf-8")
        )
        arrs = np.load(str(base_path))
        store._idf = arrs["idf"]
        store._Vt = arrs["Vt"]
        store._index = faiss.read_index(str(base_path.parent / "faiss.index"))
        store._dim = store._Vt.shape[0]
        return store

    # ── helpers ───────────────────────────────────────────────────────────────

    # #TFIDF_Normalize — L2-normalise rows so dot product = cosine similarity
    @staticmethod
    def _normalize(mat: np.ndarray) -> np.ndarray:
        norms = np.linalg.norm(mat, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1.0, norms)
        return (mat / norms).astype(np.float32)

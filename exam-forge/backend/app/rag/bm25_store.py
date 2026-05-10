"""Sparse BM25 retrieval over a fixed chunk corpus."""

from __future__ import annotations

import pickle
import re
from pathlib import Path

import numpy as np
from rank_bm25 import BM25Okapi

# #BM25_MathNorm — Greek/math symbols → ASCII so BM25 can match "sigma" against σ
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


# #BM25_Tokenizer — splits Arabic + Latin + digits, normalises math symbols first
def _tokenize(text: str) -> list[str]:
    return re.findall(r"[\w؀-ۿ]+", _normalize_math(text).lower())


class BM25Store:
    def __init__(self) -> None:
        self._bm25: BM25Okapi | None = None

    # #BM25_Build — tokenise every chunk and build the BM25Okapi index
    def build(self, texts: list[str]) -> None:
        tokenized = [_tokenize(t) for t in texts]
        self._bm25 = BM25Okapi(tokenized)

    # #BM25_Query — score every chunk against query tokens, return top-k (id, score)
    def query(self, query: str, top_k: int) -> list[tuple[int, float]]:
        if self._bm25 is None:
            return []
        tokens = _tokenize(query)
        if not tokens:
            return []
        scores = self._bm25.get_scores(tokens)
        top_idx = np.argsort(scores)[::-1][:top_k]
        return [(int(i), float(scores[i])) for i in top_idx if scores[i] > 0]

    # #BM25_Persist — pickle the BM25Okapi object to disk
    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(self._bm25, f)

    # #BM25_Load — restore BM25Okapi from pickle
    @classmethod
    def load(cls, path: Path) -> "BM25Store":
        store = cls()
        with open(path, "rb") as f:
            store._bm25 = pickle.load(f)
        return store

"""PDF → text chunks, self-contained (no external config imports).

Strategy per document (never mixed within one file):
  title-based  – when bold/larger headings are detectable (≥2 found).
  sentence-based – fallback; sentences are never split across chunks.
"""

from __future__ import annotations

import json
import re
import statistics
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF

# #Chunker_Config — max/min chunk sizes and title detection ratio
_PDF_MAX_CHARS = 1200
_PDF_MIN_CHARS = 80
_PDF_MERGE_MIN = 300      # merge consecutive chunks shorter than this
_TITLE_FONT_RATIO = 1.15

_SENT_RE = re.compile(r"(?<=[.!?؟])\s+")

# #Chunker_Keys — field name sets for multi-schema JSON parsing
QUESTION_KEYS = {"question_text", "question", "q", "سؤال", "text", "prompt"}
ANSWER_KEYS   = {"Solution", "solution", "answer", "a", "إجابة", "حل", "verdict", "response"}
CONTEXT_KEYS  = {"introduction_context", "pseudocode", "semaphore_init_table", "note"}


# ── PDF helpers ───────────────────────────────────────────────────────────────

# #Chunker_Spans — extract all text spans from PDF with font size and bold flag
def _spans(path: Path) -> list[dict]:
    spans: list[dict] = []
    doc = fitz.open(str(path))
    for page_no, page in enumerate(doc, 1):
        for block in page.get_text("dict")["blocks"]:
            if block["type"] != 0:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    t = span["text"].strip()
                    if t:
                        spans.append({"text": t, "size": span["size"],
                                      "bold": "Bold" in span.get("font", ""),
                                      "page": page_no})
    doc.close()
    return spans


# #Chunker_TitleDetect — span is a title if font >= 1.15× median and short text
def _median_size(spans: list[dict]) -> float:
    return statistics.median(s["size"] for s in spans) if spans else 12.0


def _is_title(span: dict, med: float) -> bool:
    t = span["text"]
    return (
        (span["size"] >= med * _TITLE_FONT_RATIO or span["bold"])
        and len(t) < 120
        and not re.fullmatch(r"[\d\s.\-]+", t)
    )


# #Chunker_SentSplit — split text on sentence boundaries (.!?؟)
def _sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENT_RE.split(text) if s.strip()]


# #Chunker_Pack — greedily pack sentences into chunks ≤ max_chars
def _pack(sents: list[str], max_chars: int) -> list[str]:
    chunks, buf, buf_len = [], [], 0
    for s in sents:
        if buf and buf_len + len(s) + 1 > max_chars:
            chunk = " ".join(buf)
            if len(chunk) >= _PDF_MIN_CHARS:
                chunks.append(chunk)
            buf, buf_len = [], 0
        buf.append(s)
        buf_len += len(s) + 1
    if buf:
        chunk = " ".join(buf)
        if len(chunk) >= _PDF_MIN_CHARS:
            chunks.append(chunk)
    return chunks


# #Chunker_TitleStrategy — group spans under detected headings, split oversized sections
def _chunk_by_titles(path: Path, label: str) -> list[dict]:
    spans = _spans(path)
    med = _median_size(spans)
    chunks: list[dict] = []
    title, body = "Introduction", []

    def _flush(t: str, b: list[str]) -> None:
        text = " ".join(b).strip()
        for sub in _pack(_sentences(text), _PDF_MAX_CHARS):
            chunks.append({"text": f"[{t}]\n{sub}", "title": t,
                           "source": label, "strategy": "title-based"})

    for span in spans:
        if _is_title(span, med):
            _flush(title, body)
            title, body = span["text"], []
        else:
            body.append(span["text"])
    _flush(title, body)
    return chunks


# #Chunker_SentStrategy — fallback: flatten all spans then pack by sentences
def _chunk_by_sentences(path: Path, label: str) -> list[dict]:
    spans = _spans(path)
    full = " ".join(s["text"] for s in spans)
    return [{"text": c, "title": None, "source": label, "strategy": "sentence-based"}
            for c in _pack(_sentences(full), _PDF_MAX_CHARS)]


def _has_titles(path: Path) -> bool:
    spans = _spans(path)
    if not spans:
        return False
    med = _median_size(spans)
    return sum(1 for s in spans if _is_title(s, med)) >= 2


# #Chunker_MergeShort — merge consecutive tiny chunks (slide bullets) so each has enough context
def _merge_short_chunks(chunks: list[dict]) -> list[dict]:
    """Merge consecutive chunks that are below _PDF_MERGE_MIN chars.

    Slide-format PDFs produce many tiny sections. Merging them ensures
    the generator receives enough context per retrieved chunk.
    Two chunks are merged only when their combined length fits in _PDF_MAX_CHARS.
    """
    if not chunks:
        return chunks
    merged: list[dict] = []
    i = 0
    while i < len(chunks):
        current = dict(chunks[i])
        while (
            i + 1 < len(chunks)
            and len(current["text"]) < _PDF_MERGE_MIN
            and len(current["text"]) + len(chunks[i + 1]["text"]) + 1 <= _PDF_MAX_CHARS
        ):
            i += 1
            current["text"] = current["text"] + "\n" + chunks[i]["text"]
        merged.append(current)
        i += 1
    return merged


# #Chunker_PDF_Entry — public entry: auto-pick title or sentence strategy then merge short chunks
def chunk_pdf(path: Path, label: str = "") -> list[dict]:
    """Return chunks + populate source/strategy metadata."""
    label = label or path.name
    if _has_titles(path):
        chunks = _chunk_by_titles(path, label)
    else:
        chunks = _chunk_by_sentences(path, label)
    return _merge_short_chunks(chunks)


# ── JSON helpers ──────────────────────────────────────────────────────────────

def _pick(obj: dict, keys: set[str]) -> str:
    for k in keys:
        v = obj.get(k)
        if v in (None, "", []):
            continue
        if isinstance(v, (dict, list)):
            return json.dumps(v, ensure_ascii=False)
        s = str(v).strip()
        if s:
            return s
    return ""


def _qa_text(q: str, a: str, ctx: str = "") -> str:
    parts = []
    if ctx:
        parts.append(f"Context: {ctx}")
    parts.append(f"Question: {q}")
    if a:
        parts.append(f"Solution: {a}")
    return "\n".join(parts)


def _detect_schema(data: Any) -> str:
    if isinstance(data, dict) and "exercises" in data:
        return "A"
    if isinstance(data, list) and data and isinstance(data[0], dict):
        return "B"
    if isinstance(data, dict):
        vals = list(data.values())
        if vals and isinstance(vals[0], dict):
            return "C"
    return "unknown"


def _chunks_a(data: dict, label: str) -> list[dict]:
    chunks: list[dict] = []
    meta = data.get("metadata", {}) or {}
    for ex in data.get("exercises", []) or []:
        if not isinstance(ex, dict):
            continue
        ex_ctx = _pick(ex, CONTEXT_KEYS)
        raw_q = ex.get("Question", [])
        if isinstance(raw_q, dict):
            raw_q = [raw_q]
        for q in (raw_q if isinstance(raw_q, list) else []):
            if not isinstance(q, dict):
                continue
            q_ctx = _pick(q, CONTEXT_KEYS) or ex_ctx
            subs = q.get("subquestions", [])
            if isinstance(subs, list) and subs:
                for sq in subs:
                    if not isinstance(sq, dict):
                        continue
                    stem = _pick(sq, QUESTION_KEYS) or _pick(q, QUESTION_KEYS)
                    if stem:
                        chunks.append({"text": _qa_text(stem, _pick(sq, ANSWER_KEYS), q_ctx),
                                       "source": label, "schema": "A",
                                       "language": str(meta.get("language", ""))})
            else:
                stem = _pick(q, QUESTION_KEYS)
                if stem:
                    chunks.append({"text": _qa_text(stem, _pick(q, ANSWER_KEYS), q_ctx),
                                   "source": label, "schema": "A",
                                   "language": str(meta.get("language", ""))})
    return chunks


def _chunks_b(data: list, label: str) -> list[dict]:
    chunks = []
    for item in data:
        if not isinstance(item, dict):
            continue
        stem = _pick(item, QUESTION_KEYS)
        if stem:
            chunks.append({"text": _qa_text(stem, _pick(item, ANSWER_KEYS), _pick(item, CONTEXT_KEYS)),
                           "source": label, "schema": "B"})
    return chunks


def _chunks_c(data: dict, label: str) -> list[dict]:
    chunks = []
    for item in data.values():
        if not isinstance(item, dict):
            continue
        stem = _pick(item, QUESTION_KEYS)
        if stem:
            chunks.append({"text": _qa_text(stem, _pick(item, ANSWER_KEYS), _pick(item, CONTEXT_KEYS)),
                           "source": label, "schema": "C"})
    return chunks


# #Chunker_JSON_Entry — public entry: detect JSON schema (A/B/C) and parse Q+A pairs
def chunk_json(path: Path, label: str = "") -> list[dict]:
    """Parse a JSON exam file into QA chunks (each Q+A is atomic)."""
    label = label or path.name
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    schema = _detect_schema(data)
    if schema == "A":
        return _chunks_a(data, label)
    if schema == "B":
        return _chunks_b(data, label)
    if schema == "C":
        return _chunks_c(data, label)
    return []

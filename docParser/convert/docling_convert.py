"""Stage 1 — PDF → clean Markdown via Docling.

Docling handles: column order, tables (TableFormer), code blocks,
bold/italic, RTL Arabic, and scanned pages via its built-in OCR.
All the heuristics we built manually in finalParser are replaced here.
"""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path


@dataclass
class ConversionResult:
    markdown: str
    page_count: int
    has_tables: bool
    has_images: bool
    source: str   # "docling" | "fallback"


def _sanitize(md: str) -> str:
    """Fix common distortions Docling introduces when exporting to Markdown."""
    import re

    # Protect code-like sequences that Markdown/HTML parsers misread.
    # <<X>> looks like an HTML tag → escape angle brackets inside code spans.
    md = re.sub(r'<<([^>]+)>>', r'&lt;&lt;\1&gt;&gt;', md)

    # Only escape < > when they form actual HTML-like tags (e.g. <div>, </span>).
    # Leave standalone < > untouched — they appear in regex, math, and formulas.
    md = re.sub(r'<(/?)([a-zA-Z][a-zA-Z0-9]*)(>)', r'&lt;\1\2\3', md)

    # Null bytes and other control characters that break JSON serialization.
    md = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', md)

    # Docling sometimes emits   (non-breaking space) as literal \xa0 → normal space.
    md = md.replace('\xa0', ' ')

    # Stray Unicode replacement character (garbled OCR).
    md = md.replace('�', '?')

    # CJK characters are never legitimate in French/Arabic CS exams.
    # Docling's layout model sometimes misreads Latin glyphs (digits, letters)
    # as CJK codepoints (e.g. '1' → '极'). Replace all of them with '?'
    # so the LLM knows content is missing rather than hallucinating a value.
    md = re.sub(r'[一-鿿㐀-䶿]', '?', md)

    return md


def convert(pdf_path: str, ocr: bool = False) -> ConversionResult:
    """Convert PDF → Markdown.  ocr=True for scanned (image-only) PDFs."""
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.pipeline_options import PdfPipelineOptions

    opts = PdfPipelineOptions()
    opts.do_ocr = ocr
    opts.do_table_structure = True          # TableFormer active
    opts.table_structure_options.do_cell_matching = True

    converter = DocumentConverter(
        format_options={"pdf": PdfFormatOption(pipeline_options=opts)}
    )

    result = converter.convert(pdf_path)
    doc = result.document
    md = _sanitize(doc.export_to_markdown())

    tables = list(doc.tables) if hasattr(doc, "tables") else []
    pictures = list(doc.pictures) if hasattr(doc, "pictures") else []

    return ConversionResult(
        markdown=md,
        page_count=len(list(doc.pages)) if hasattr(doc, "pages") else 0,
        has_tables=len(tables) > 0,
        has_images=len(pictures) > 0,
        source="docling",
    )


def _pymupdf_raw_text(pdf_path: str) -> str:
    """Extract raw text from all pages via PyMuPDF."""
    import fitz
    doc = fitz.open(pdf_path)
    pages = []
    for i, page in enumerate(doc):
        pages.append(f"[Page {i+1}]\n{page.get_text('text')}")
    doc.close()
    return "\n\n".join(pages)


def _hybrid_fill(docling_md: str, pdf_path: str) -> str:
    """
    Replace content inside code blocks and formula placeholders with
    PyMuPDF raw text — Docling distorts symbols, code, and formulas;
    PyMuPDF reads them verbatim.
    """
    import re

    PLACEHOLDER = "<!-- formula-not-decoded -->"
    has_placeholder = PLACEHOLDER in docling_md
    has_code = "```" in docling_md

    if not has_placeholder and not has_code:
        return docling_md

    raw = _pymupdf_raw_text(pdf_path)
    raw_lines = raw.split("\n")

    def find_raw_snippet(anchor_before: str, anchor_after: str) -> str | None:
        """Find text between two anchors in PyMuPDF raw text."""
        anchor_before = anchor_before.strip()[-40:]
        anchor_after = anchor_after.strip()[:40]
        for i, line in enumerate(raw_lines):
            if anchor_before and anchor_before in line:
                snippet_lines = []
                for j in range(i + 1, min(i + 30, len(raw_lines))):
                    if anchor_after and anchor_after in raw_lines[j]:
                        return "\n".join(snippet_lines).strip()
                    snippet_lines.append(raw_lines[j])
        return None

    # Replace <!-- formula-not-decoded --> inline
    if has_placeholder:
        parts = re.split(r'(<!-- formula-not-decoded -->)', docling_md)
        result = []
        for i, part in enumerate(parts):
            if part == PLACEHOLDER:
                before = parts[i - 1] if i > 0 else ""
                after = parts[i + 1] if i < len(parts) - 1 else ""
                snippet = find_raw_snippet(before, after)
                if snippet:
                    result.append(snippet)
                else:
                    # fallback: pass the full raw text so the LLM can find it
                    result.append(
                        f"[UNRECOVERED: search in page raw text below]\n{raw}"
                    )
            else:
                result.append(part)
        docling_md = "".join(result)
        fixed = "<!-- formula-not-decoded -->" not in docling_md
        print(f"[stage1] formulas recovered from PyMuPDF: {'ok' if fixed else 'fallback used'}")

    # Replace content inside ``` code blocks with PyMuPDF raw text
    if has_code:
        def replace_code_block(m: re.Match) -> str:
            lang = m.group(1) or ""
            content = m.group(2)
            before_block = docling_md[:m.start()][-80:]
            after_block = docling_md[m.end():][:80]
            snippet = find_raw_snippet(before_block, after_block)
            raw_content = snippet if snippet else content
            return f"```{lang}\n{raw_content}\n```"

        docling_md = re.sub(
            r'```(\w*)\n(.*?)```',
            replace_code_block,
            docling_md,
            flags=re.DOTALL,
        )
        print("[stage1] code blocks filled from PyMuPDF raw text")

    return docling_md


def convert_with_fallback(pdf_path: str) -> ConversionResult:
    """Try Docling; if it fails fall back to PyMuPDF raw text.
    If Docling succeeds but has undecodable formulas, appends PyMuPDF raw
    text as an appendix so the LLM can recover the missing content.
    """
    try:
        result = convert(pdf_path)
        result.markdown = _hybrid_fill(result.markdown, pdf_path)
        return result
    except Exception as e:
        print(f"[WARN] Docling failed ({e}), using PyMuPDF fallback")
        return _pymupdf_fallback(pdf_path)


def _pymupdf_fallback(pdf_path: str) -> ConversionResult:
    import fitz
    doc = fitz.open(pdf_path)
    pages_md = []
    for i, page in enumerate(doc):
        text = page.get_text("text")
        pages_md.append(f"## Page {i+1}\n\n{text}")
    doc.close()
    md = _sanitize("\n\n---\n\n".join(pages_md))
    return ConversionResult(
        markdown=md,
        page_count=len(doc),
        has_tables=False,
        has_images=False,
        source="fallback",
    )

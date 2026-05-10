"""CLI entry point.

Usage:
  python -m docParser.parse path/to/exam.pdf
  python -m docParser.parse path/to/exam.pdf --output-dir ./output
  python -m docParser.parse path/to/exam.pdf --markdown-only
"""
from __future__ import annotations
import argparse, json, sys
from docParser.pipeline import parse_pdf, parse_pdf_to_markdown_only


def main():
    p = argparse.ArgumentParser(description="docParser — PDF exam → structured JSON")
    p.add_argument("pdf", help="Path to the PDF file")
    p.add_argument("--output-dir", "-o", default="docParser/output",
                   help="Directory to write the JSON output (default: docParser/output)")
    p.add_argument("--markdown-only", action="store_true",
                   help="Only run Stage 1 (PDF→Markdown) and print the result")
    args = p.parse_args()

    if args.markdown_only:
        md = parse_pdf_to_markdown_only(args.pdf)
        print(md)
        return

    exam = parse_pdf(args.pdf, output_dir=args.output_dir)
    print(json.dumps(exam.model_dump(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

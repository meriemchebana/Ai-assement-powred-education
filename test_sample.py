"""
اختبار آمن: parser + RAG بدون تعديل أي بيانات رئيسية.

الاستخدام:
  python test_sample.py --exam   /path/to/exam.pdf
  python test_sample.py --lecture /path/to/lecture.pdf
  python test_sample.py --exam /path/to/exam.pdf --lecture /path/to/lecture.pdf --query "ما هو البرمجة الكائنية"
"""
from __future__ import annotations
import argparse, json, sys, shutil, tempfile
from pathlib import Path

ROOT = Path(__file__).parent

# ── 1. Parser test ────────────────────────────────────────────────────────────
def test_parser(pdf_path: str) -> None:
    print("\n" + "="*60)
    print("🔍 اختبار Parser")
    print("="*60)

    pdf = Path(pdf_path)
    if not pdf.exists():
        print(f"❌ الملف غير موجود: {pdf_path}")
        return

    out_dir = Path(tempfile.mkdtemp(prefix="test_parse_"))
    print(f"📂 مجلد المخرجات (مؤقت): {out_dir}")

    sys.path.insert(0, str(ROOT))
    try:
        from docParser.pipeline import parse_pdf
        exam = parse_pdf(str(pdf), output_dir=str(out_dir))
        data = exam.model_dump()

        print(f"\n✅ نجح Parser!")
        print(f"   عدد التمارين   : {len(data.get('exercises', []))}")
        total_q = sum(len(ex.get('questions', [])) for ex in data.get('exercises', []))
        print(f"   عدد الأسئلة    : {total_q}")
        lang = data.get('metadata', {}).get('language', 'unknown')
        print(f"   اللغة المكتشفة : {lang}")

        # عرض أول سؤال كعينة
        exs = data.get('exercises', [])
        if exs and exs[0].get('questions'):
            q0 = exs[0]['questions'][0]
            stem = q0.get('question_text') or q0.get('stem') or ''
            print(f"\n   عينة — أول سؤال:\n   {stem[:200]}")

        out_file = out_dir / "result.json"
        out_file.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        print(f"\n   النتيجة كاملة في: {out_file}")

    except Exception as e:
        print(f"❌ فشل Parser: {e}")
        import traceback; traceback.print_exc()

# ── 2. RAG test ───────────────────────────────────────────────────────────────
def test_rag(pdf_path: str, query: str) -> None:
    print("\n" + "="*60)
    print("🔍 اختبار RAG")
    print("="*60)

    pdf = Path(pdf_path)
    if not pdf.exists():
        print(f"❌ الملف غير موجود: {pdf_path}")
        return

    # نبني index معزول في /tmp بعيداً عن البيانات الرئيسية
    tmp_data  = Path(tempfile.mkdtemp(prefix="test_rag_data_"))
    tmp_index = Path(tempfile.mkdtemp(prefix="test_rag_idx_"))

    # هيكل مجلد مؤقت: test_subject/courses/lecture.pdf
    courses_dir = tmp_data / "test_subject" / "courses"
    courses_dir.mkdir(parents=True)
    shutil.copy(pdf, courses_dir / pdf.name)

    print(f"📂 بيانات مؤقتة : {tmp_data}")
    print(f"📂 index مؤقت  : {tmp_index}")
    print(f"❓ الاستعلام    : {query}")

    sys.path.insert(0, str(ROOT / "exam-forge" / "backend"))
    try:
        from app.rag.indexer import SubjectIndex

        idx = SubjectIndex("test_subject", tmp_index)
        print("\n⏳ يبني الـ index (قد يأخذ دقيقة)...")
        idx.build(tmp_data)
        idx.load()

        print("✅ Index جاهز! يستعلم...")
        results = idx.retriever.query(query, top_k=3)

        if not results:
            print("⚠️  لم يُرجع نتائج — تحقق من محتوى PDF")
        else:
            print(f"\n✅ نجح RAG! أفضل {len(results)} نتيجة:\n")
            for i, chunk in enumerate(results, 1):
                text = chunk.get("text", "")[:300]
                src  = chunk.get("source", "")
                print(f"  [{i}] {src}")
                print(f"      {text}")
                print()

    except Exception as e:
        print(f"❌ فشل RAG: {e}")
        import traceback; traceback.print_exc()
    finally:
        shutil.rmtree(tmp_data, ignore_errors=True)
        shutil.rmtree(tmp_index, ignore_errors=True)

# ── main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--exam",    help="PDF امتحان لاختبار Parser")
    ap.add_argument("--lecture", help="PDF محاضرة لاختبار RAG")
    ap.add_argument("--query",   default="ما هو موضوع هذه المحاضرة؟",
                    help="سؤال للاستعلام في RAG")
    args = ap.parse_args()

    if not args.exam and not args.lecture:
        ap.print_help()
        sys.exit(1)

    if args.exam:
        test_parser(args.exam)

    if args.lecture:
        test_rag(args.lecture, args.query)

    print("\n✅ انتهى الاختبار — لم يُعدَّل أي ملف في النظام الرئيسي")

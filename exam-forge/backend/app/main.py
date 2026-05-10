"""FastAPI entry point.

Endpoints:
  GET  /api/health            -> liveness
  GET  /api/subjects          -> dataset summary (counts per subject / level)
  GET  /api/templates         -> discovered exam templates for all subjects
  GET  /api/templates/{subject} -> template for one subject
  POST /api/generate          -> SSE stream of generation events
  POST /api/parse             -> SSE stream of PDF parsing progress
  POST /api/validate          -> save a human-validated question to validated/
"""

from __future__ import annotations

import asyncio
import json
import logging
import tempfile
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, AsyncIterator

from fastapi import FastAPI, HTTPException, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .dataset import Dataset
from .evaluator import get_evaluator
from .exam_assembler import get_assembler
from .exam_planner import GenerateExamRequest, get_planner
from .generator import get_generator
try:
    from .rag.indexer import RAGIndexer
except ImportError:
    RAGIndexer = None  # type: ignore[assignment,misc]
from .rag_cloud import CloudIndexer, CloudRAGAdapter, CloudRetriever, SupabaseStore
from .schemas import GenerateRequest, SubjectSummary, SubjectsResponse
from .settings import settings
from .template_analyzer import get_analyzer

_VALIDATED_DIR = Path(__file__).parent.parent / "validated"

log = logging.getLogger("exam-forge")
logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")

_dataset: Dataset | None = None
_rag: RAGIndexer | None = None
_cloud_retriever: CloudRetriever | None = None
_cloud_indexer: CloudIndexer | None = None

# Per-teacher Dataset cache.
# Key: (teacher_id, include_shared). Invalidated when a new file is parsed for that teacher.
_teacher_dataset_cache: dict[tuple[int, bool], Dataset] = {}


def _get_teacher_dataset(teacher_id: int, include_shared: bool = False) -> Dataset:
    key = (teacher_id, include_shared)
    if key not in _teacher_dataset_cache:
        _teacher_dataset_cache[key] = Dataset(
            settings.data_dir, teacher_id=teacher_id, include_shared=include_shared
        )
        log.info("Dataset cached for teacher_%d (include_shared=%s)", teacher_id, include_shared)
    return _teacher_dataset_cache[key]


def _invalidate_teacher_dataset(teacher_id: int) -> None:
    keys = [k for k in _teacher_dataset_cache if k[0] == teacher_id]
    for k in keys:
        del _teacher_dataset_cache[k]
    if keys:
        log.info("Dataset cache invalidated for teacher_%d (%d entries)", teacher_id, len(keys))

# #Main_History — cross-session exercise title log to prevent duplicates across restarts
_HISTORY_FILE = Path(__file__).parent.parent / "exercise_history.json"
_exercise_history: dict[str, list[str]] = defaultdict(list)  # subject → [titles]


def _load_history() -> None:
    if _HISTORY_FILE.exists():
        try:
            data = json.loads(_HISTORY_FILE.read_text(encoding="utf-8"))
            _exercise_history.update({k: list(v) for k, v in data.items()})
            log.info("Loaded exercise history: %d subjects", len(_exercise_history))
        except Exception as e:
            log.warning("Could not load exercise history: %s", e)


def _save_history() -> None:
    try:
        _HISTORY_FILE.write_text(
            json.dumps(dict(_exercise_history), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception as e:
        log.warning("Could not save exercise history: %s", e)


def _build_rag_background() -> None:
    log.info("Building/loading RAG indices in background (index_dir=%s) …", settings.rag_index_dir)
    try:
        _rag.build_all()
        log.info("RAG ready for subjects: %s", _rag.subjects())
    except Exception as e:
        log.error("RAG build failed: %s", e)


def dataset() -> Dataset:
    assert _dataset is not None, "dataset not initialised"
    return _dataset


def _rag_for(user_id: str | None) -> RAGIndexer | CloudRAGAdapter | None:
    """Return cloud RAG adapter when user_id + Supabase are available, else local RAG."""
    if _cloud_retriever is not None and user_id:
        return CloudRAGAdapter(_cloud_retriever, user_id)
    return _rag


# #Main_Lifespan — startup: load dataset + build RAG in background thread
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _dataset, _rag, _cloud_retriever, _cloud_indexer
    _load_history()
    log.info("Loading dataset from %s", settings.data_dir)
    _dataset = Dataset(settings.data_dir)
    log.info("Dataset loaded: %d examples across %d subjects", len(_dataset.examples), len(_dataset.subjects()))
    get_analyzer(settings.data_dir)  # initialise singleton with data_dir

    if settings.rag_enabled and RAGIndexer is not None:
        _rag = RAGIndexer(
            settings.data_dir,
            settings.rag_index_dir,
            arabert_api_key=settings.arabert_api_key,
            arabert_model=settings.arabert_model,
        )
        asyncio.get_event_loop().run_in_executor(None, _build_rag_background)
    elif settings.rag_enabled:
        log.warning("faiss not installed — local RAG disabled, cloud RAG only")

    if settings.supabase_url and settings.supabase_key:
        try:
            store = SupabaseStore(settings.supabase_url, settings.supabase_key)
            gen_key = settings.general_embed_api_key or settings.arabert_api_key
            _cloud_retriever = CloudRetriever(
                store,
                arabert_api_key=settings.arabert_api_key,
                arabert_model=settings.arabert_model,
                general_api_key=gen_key,
                general_model=settings.general_embed_model,
            )
            _cloud_indexer = CloudIndexer(
                store,
                arabert_api_key=settings.arabert_api_key,
                arabert_model=settings.arabert_model,
                general_api_key=gen_key,
                general_model=settings.general_embed_model,
            )
            log.info("Cloud RAG (Supabase) initialised")
        except Exception as e:
            log.warning("Cloud RAG init failed: %s — falling back to local RAG", e)

    yield


app = FastAPI(title="Exam Forge", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https://.*\.trycloudflare\.com",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True, "model": settings.openrouter_model}


@app.get("/api/subjects", response_model=SubjectsResponse)
async def subjects(teacher_id: int | None = None) -> SubjectsResponse:
    # Summary shows only the teacher's own subjects (include_shared=False)
    ds = _get_teacher_dataset(teacher_id, include_shared=False) if teacher_id else dataset()
    return SubjectsResponse(
        subjects=[SubjectSummary(**row) for row in ds.summary()],
        model=settings.openrouter_model,
    )


@app.get("/api/templates")
async def all_templates() -> dict:
    templates = get_analyzer().all()
    return {subj: tmpl.model_dump() for subj, tmpl in templates.items()}


@app.get("/api/templates/{subject}")
async def subject_template(subject: str) -> dict:
    tmpl = get_analyzer().get(subject)
    if tmpl is None:
        raise HTTPException(404, f"No template found for subject: {subject}")
    return tmpl.model_dump()


@app.post("/api/generate-exam")
async def generate_exam(req: GenerateExamRequest):
    """Generate a complete exam from archive template + user overrides."""
    ds = _get_teacher_dataset(req.teacher_id, include_shared=True) if req.teacher_id else dataset()
    if req.subject not in ds.subjects():
        raise HTTPException(422, f"Unknown subject: {req.subject}. Known: {ds.subjects()}")

    plan = get_planner().plan(req)
    rag = _rag_for(req.user_id)

    async def _stream() -> AsyncIterator[bytes]:
        async for event in get_assembler().assemble(
            plan,
            generator=get_generator(),
            dataset=ds,
            rag=rag,
            evaluator=get_evaluator(),
        ):
            yield _sse(event["event"], event["data"])

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class IndexRequest(BaseModel):
    user_id: str
    subject: str
    rebuild: bool = False


class IndexFileRequest(BaseModel):
    user_id: str
    subject: str
    file_path: str   # absolute path to the JSON/PDF file
    passed_parser: bool = True


@app.post("/api/index")
async def index_subject(req: IndexRequest) -> dict:
    """Build (or rebuild) the cloud RAG index for a user+subject."""
    if _cloud_indexer is None:
        raise HTTPException(503, "Cloud RAG is not configured (SUPABASE_URL / SUPABASE_KEY missing)")
    loop = asyncio.get_event_loop()
    count = await loop.run_in_executor(
        None,
        lambda: _cloud_indexer.build(req.user_id, req.subject, settings.data_dir, req.rebuild),
    )
    return {"user_id": req.user_id, "subject": req.subject, "chunks_stored": count}


@app.post("/api/invalidate-cache")
async def invalidate_cache(user_id: str) -> dict:
    """Invalidate per-teacher dataset cache after a new PDF is parsed."""
    tid = user_id.removeprefix("teacher_")
    if not tid.isdigit():
        raise HTTPException(422, "user_id must be 'teacher_{int}'")
    _invalidate_teacher_dataset(int(tid))
    return {"invalidated": user_id}


@app.post("/api/index-file")
async def index_file(req: IndexFileRequest) -> dict:
    """Index a single file (JSON or PDF) into the cloud RAG for a user.

    Called automatically by docparser_service after parsing completes.
    """
    # Always invalidate dataset cache so next generation picks up the new file
    tid = req.user_id.removeprefix("teacher_")
    if tid.isdigit():
        _invalidate_teacher_dataset(int(tid))

    if _cloud_indexer is None:
        return {"user_id": req.user_id, "subject": req.subject, "chunks_stored": 0, "note": "no cloud RAG"}
    path = Path(req.file_path)
    if not path.exists():
        raise HTTPException(404, f"File not found: {req.file_path}")
    loop = asyncio.get_event_loop()
    count = await loop.run_in_executor(
        None,
        lambda: _cloud_indexer.index_file(req.user_id, req.subject, path, req.passed_parser),
    )
    # Invalidate dataset cache so next generation picks up the new file
    tid = req.user_id.removeprefix("teacher_")
    if tid.isdigit():
        _invalidate_teacher_dataset(int(tid))
    return {"user_id": req.user_id, "subject": req.subject, "file": path.name, "chunks_stored": count}


def _sse(event: str, data: dict) -> bytes:
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n".encode("utf-8")


# #Main_SSE_Stream — core SSE generator: status → examples → RAG → questions → evaluations → done
async def _stream_generation(req: GenerateRequest) -> AsyncIterator[bytes]:
    ds = _get_teacher_dataset(req.teacher_id, include_shared=True) if req.teacher_id else dataset()
    if req.subject not in ds.subjects():
        yield _sse("error", {"message": f"Unknown subject: {req.subject}. Known: {ds.subjects()}"})
        return
    active_rag = _rag_for(req.user_id)

    level_key = req.level if req.level != "Mixed" else None
    # Over-sample a bit: a handful of stylistic anchors works better than many weak ones.
    n_examples = min(6, max(3, req.count))
    examples = ds.sample(req.subject, level_key, n=n_examples)

    yield _sse("status", {
        "phase": "studying",
        "message": f"Studying {len(examples)} past questions from {req.subject}"
                   + (f" / {req.level}" if level_key else ""),
    })
    for i, ex in enumerate(examples):
        yield _sse("example", {
            "idx": i,
            "stem": ex.stem[:400],
            "level": ex.level,
            "source": ex.source,
        })
        await asyncio.sleep(0)  # let the event flush

    # RAG: retrieve relevant course content once per batch (subject-scoped)
    rag_context: str | None = None
    if active_rag is not None:
        query_text = req.topic or req.subject
        rag_context = active_rag.query(req.subject, query_text, top_k=settings.rag_top_k) or None
        if rag_context:
            yield _sse("status", {
                "phase": "retrieving",
                "message": f"Retrieved {settings.rag_top_k} course excerpts for factual grounding",
            })

    try:
        gen = get_generator()
    except RuntimeError as e:
        yield _sse("error", {"message": str(e)})
        return

    evaluator = get_evaluator()

    if req.question_type == "Exercise":
        ex_examples = ds.sample_exercises_by_topic(req.subject, req.topic, n=min(3, max(2, req.count)))
        type_label = f"exercises ({req.questions_per_exercise} sub-questions each)"
        yield _sse("status", {"phase": "generating", "message": f"Generating {req.count} {type_label}"})

        # Merge cross-session history with this batch's new titles
        all_seen_titles = list(_exercise_history[req.subject])
        produced_titles: list[str] = []

        for i in range(req.count):
            effective_level = req.level if req.level != "Mixed" else "Conceptual"
            try:
                ex = await gen.generate_exercise(
                    subject=req.subject,
                    level=effective_level,
                    topic=req.topic,
                    n_questions=req.questions_per_exercise,
                    examples=ex_examples,
                    already_generated_titles=all_seen_titles,
                    rag_context=rag_context,
                    critique=req.critique,
                )
            except Exception as e:
                log.exception("exercise generation failed")
                yield _sse("error", {"message": f"Generation failed on exercise #{i+1}: {e}"})
                return

            produced_titles.append(ex.title)
            all_seen_titles.append(ex.title)
            yield _sse("question", {"idx": i, "total": req.count, "type": "Exercise", "data": ex.model_dump()})

            # Re-retrieve using the exercise context as query — independent from generation
            # retrieval so the evaluator can check answer extractability without circularity.
            if evaluator:
                eval_query = ex.context[:300] if ex.context else ex.title
                q_rag = active_rag.query(req.subject, eval_query, top_k=settings.evaluator_top_k) if active_rag else ""
                ev = await evaluator.evaluate(ex, q_rag or rag_context or "",
                                             exam_duration_minutes=None, total_exam_points=None)
                yield _sse("evaluation", {"idx": i, "result": ev.model_dump()})

        # Persist new titles to disk
        _exercise_history[req.subject].extend(produced_titles)
        _save_history()

        yield _sse("done", {"total": len(produced_titles)})
        return

    produced_stems: list[str] = []
    type_label = "MCQs" if req.question_type == "MCQ" else "SAQs"
    yield _sse("status", {"phase": "generating", "message": f"Generating {req.count} {type_label}"})

    for i in range(req.count):
        effective_level = req.level if req.level != "Mixed" else (
            examples[i % len(examples)].level if examples and examples[i % len(examples)].level else "Conceptual"
        )
        try:
            if req.question_type == "MCQ":
                q = await gen.generate_mcq(
                    subject=req.subject,
                    level=effective_level,
                    topic=req.topic,
                    examples=examples,
                    already_generated_stems=produced_stems,
                    rag_context=rag_context,
                )
            else:
                q = await gen.generate_saq(
                    subject=req.subject,
                    level=effective_level,
                    topic=req.topic,
                    examples=examples,
                    already_generated_stems=produced_stems,
                    rag_context=rag_context,
                )
        except Exception as e:
            log.exception("generation failed")
            yield _sse("error", {"message": f"Generation failed on #{i+1}: {e}"})
            return

        produced_stems.append(q.stem)
        yield _sse("question", {"idx": i, "total": req.count, "type": req.question_type, "data": q.model_dump()})

        # Re-retrieve using the question stem as query — independent from generation
        # retrieval so the evaluator checks whether the answer exists in the material,
        # not whether the question is consistent with what the generator already saw.
        if evaluator:
            q_rag = active_rag.query(req.subject, q.stem[:300], top_k=settings.evaluator_top_k) if active_rag else ""
            ev = await evaluator.evaluate(q, q_rag or rag_context or "",
                                         exam_duration_minutes=None, total_exam_points=None)
            yield _sse("evaluation", {"idx": i, "result": ev.model_dump()})

    yield _sse("done", {"total": len(produced_stems)})


# #Main_GenerateEndpoint — POST /api/generate → StreamingResponse with SSE frames
@app.post("/api/generate")
async def generate(req: GenerateRequest):
    if req.count < 1 or req.count > 20:
        raise HTTPException(422, "count must be between 1 and 20")
    return StreamingResponse(
        _stream_generation(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.post("/api/generate-sync")
async def generate_sync(req: GenerateRequest) -> dict:
    """JSON (non-streaming) variant of /api/generate — for server-to-server calls."""
    if req.count < 1 or req.count > 20:
        raise HTTPException(422, "count must be between 1 and 20")

    ds = _get_teacher_dataset(req.teacher_id, include_shared=True) if req.teacher_id else dataset()
    if req.subject not in ds.subjects():
        raise HTTPException(422, f"Unknown subject: {req.subject}. Known: {ds.subjects()}")

    level_key = req.level if req.level != "Mixed" else None
    n_examples = min(6, max(3, req.count))
    examples = ds.sample(req.subject, level_key, n=n_examples)

    active_rag = _rag_for(req.user_id)
    rag_context: str | None = None
    if active_rag is not None:
        query_text = req.topic or req.subject
        rag_context = active_rag.query(req.subject, query_text, top_k=settings.rag_top_k) or None

    try:
        gen = get_generator()
    except RuntimeError as e:
        raise HTTPException(503, str(e))

    questions: list[dict] = []

    if req.question_type == "Exercise":
        ex_examples = ds.sample_exercises_by_topic(req.subject, req.topic, n=min(3, max(2, req.count)))
        all_seen_titles = list(_exercise_history[req.subject])
        produced_titles: list[str] = []

        for _ in range(req.count):
            effective_level = req.level if req.level != "Mixed" else "Conceptual"
            ex = await gen.generate_exercise(
                subject=req.subject,
                level=effective_level,
                topic=req.topic,
                n_questions=req.questions_per_exercise,
                examples=ex_examples,
                already_generated_titles=all_seen_titles,
                rag_context=rag_context,
            )
            produced_titles.append(ex.title)
            all_seen_titles.append(ex.title)
            questions.append({"type": "Exercise", "data": ex.model_dump()})

        _exercise_history[req.subject].extend(produced_titles)
        _save_history()
    else:
        produced_stems: list[str] = []
        for i in range(req.count):
            effective_level = req.level if req.level != "Mixed" else (
                examples[i % len(examples)].level if examples and examples[i % len(examples)].level else "Conceptual"
            )
            if req.question_type == "MCQ":
                q = await gen.generate_mcq(
                    subject=req.subject,
                    level=effective_level,
                    topic=req.topic,
                    examples=examples,
                    already_generated_stems=produced_stems,
                    rag_context=rag_context,
                )
            else:
                q = await gen.generate_saq(
                    subject=req.subject,
                    level=effective_level,
                    topic=req.topic,
                    examples=examples,
                    already_generated_stems=produced_stems,
                    rag_context=rag_context,
                )
            produced_stems.append(q.stem)
            questions.append({"type": req.question_type, "data": q.model_dump()})

    return {"subject": req.subject, "total": len(questions), "questions": questions}


@app.post("/api/parse")
async def parse_pdf_upload(
    file: UploadFile,
    subject: str = Form(...),
):
    """Upload a PDF and stream SSE parse progress events.

    Events emitted: status{phase,message,...} · done{confidence,exercises,questions,saved_to} · error{message}
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(422, "Only PDF files are accepted")

    loop = asyncio.get_event_loop()
    queue: asyncio.Queue[dict | None] = asyncio.Queue()

    def on_progress(phase: str, message: str, extra: dict) -> None:
        event = {"phase": phase, "message": message, **extra}
        loop.call_soon_threadsafe(queue.put_nowait, {"event": "status", "data": event})

    async def _run_pipeline(pdf_path: str, out_dir: str) -> None:
        try:
            from docParser.pipeline import parse_pdf  # type: ignore[import]
            exam = await loop.run_in_executor(
                None, lambda: parse_pdf(pdf_path, output_dir=out_dir, on_progress=on_progress)
            )
            n_q = sum(len(e.questions) for e in exam.exercises)
            saved_to = str(Path(out_dir) / (Path(pdf_path).stem + ".json"))
            await queue.put({
                "event": "done",
                "data": {
                    "confidence": exam.confidence,
                    "needs_review": exam.needs_review,
                    "exercises": len(exam.exercises),
                    "questions": n_q,
                    "saved_to": saved_to,
                },
            })
        except Exception as exc:
            log.exception("parse_pdf failed")
            await queue.put({"event": "error", "data": {"message": str(exc)}})
        finally:
            await queue.put(None)  # sentinel

    async def _stream() -> AsyncIterator[bytes]:
        # Save upload to a temp file first
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        out_dir = str(Path(settings.data_dir) / subject)
        asyncio.create_task(_run_pipeline(tmp_path, out_dir))

        while True:
            item = await queue.get()
            if item is None:
                break
            yield _sse(item["event"], item["data"])

        # Clean up temp file
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class ValidateRequest(BaseModel):
    subject: str
    type: str  # "MCQ" | "SAQ" | "Exercise"
    data: dict[str, Any]
    status: str = "favorite"   # "favorite" | "draft" | "trash"
    reason: str | None = None  # required when status == "trash"


@app.post("/api/validate")
async def validate_question(req: ValidateRequest) -> dict:
    status = req.status if req.status in ("favorite", "draft", "trash") else "favorite"
    subject_dir = _VALIDATED_DIR / req.subject / status
    subject_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%S%f")
    filename = f"{req.type}_{ts}.json"
    payload: dict[str, Any] = {"subject": req.subject, "type": req.type, "status": status, "data": req.data}
    if req.reason:
        payload["reason"] = req.reason
    (subject_dir / filename).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    log.info("Question saved [%s]: %s/%s/%s", status, req.subject, status, filename)
    return {"saved": True, "file": filename, "status": status}

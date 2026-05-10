# Exam Forge

Agent that reads a professor's labeled past exams and generates fresh multiple-choice
questions in the same voice and cognitive level. Schema-validated via `instructor` +
Pydantic, streamed one card at a time to a SvelteKit UI.

```
┌─────────────┐   SSE    ┌─────────────────┐
│  SvelteKit  │ ◀─────── │  FastAPI + SSE  │ ─── instructor → DeepSeek V4 Flash
│  :27296     │          │     :26564      │         (OpenRouter, JSON mode)
└─────────────┘          └─────────────────┘
                                 │
                                 ▼
                          backend/data/final_unified/
                          {algo, se, commerce, Law, compilation}/…*.json
```

Supports two question types: **MCQ** (4 choices + explanation) and **SAQ** (short
answer + model answer + grading rubric + points).

## Why this exists

The previous RAG-Phi4 attempt tried to do Q&A style retrieval over hand-labeled exam
JSONs, then asked a free-tier LLM to "generate an exam" via a free-text prompt. It
failed because:

1. No structured outputs — the model returned prose, not MCQs.
2. Free-tier models ignore instructions.
3. Semantic RAG blended topics and weakened style transfer, when the data was already
   labeled by subject + cognitive level (`Procedural` / `Conceptual` / `Metacognitive`).

Exam Forge fixes all three: `instructor` validates each MCQ/SAQ against a Pydantic
schema with auto-retry, the default model is paid-tier DeepSeek V4 Flash, and style
anchors are drawn by plain filter-based sampling on the labeled dataset — no
embeddings.

## Quickstart

### First-time install

```bash
# backend
cd backend && python3.12 -m venv .venv && .venv/bin/pip install -e . && cp .env.example .env
# put your OpenRouter key in backend/.env — get one at https://openrouter.ai/keys

# frontend
cd ../frontend && npm install
```

### Run with pm2 (recommended)

```bash
cd ..                             # project root
pm2 start ecosystem.config.cjs    # starts backend + frontend
pm2 logs exam-forge-backend       # tail logs
pm2 restart exam-forge-backend    # after editing backend code
pm2 stop exam-forge-backend exam-forge-frontend
```

Then open **http://localhost:27296** — backend listens on 27296, frontend on 26564,
picked randomly in the 20k–60k range to avoid colliding with other local stacks. The
Vite dev server proxies `/api/*` to the backend.

### Run manually (without pm2)

```bash
# terminal 1
cd backend && .venv/bin/uvicorn app.main:app --reload --port 26564

# terminal 2
cd frontend && npm run dev
```

### Sanity checks

```bash
curl -s http://127.0.0.1:26564/api/health
curl -s http://127.0.0.1:26564/api/subjects | python -m json.tool

# Stream a real MCQ generation
curl -N -X POST http://127.0.0.1:26564/api/generate \
  -H 'content-type: application/json' \
  -d '{"subject":"algo","level":"Procedural","count":2,"question_type":"MCQ"}'

# Stream an SAQ instead
curl -N -X POST http://127.0.0.1:26564/api/generate \
  -H 'content-type: application/json' \
  -d '{"subject":"compilation","level":"Conceptual","count":1,"question_type":"SAQ"}'
```

## Project layout

```
backend/
  app/
    main.py          FastAPI app, SSE endpoint
    generator.py     instructor + OpenRouter client
    dataset.py       loads Meriem's labeled JSONs (schemas A/B/C)
    schemas.py       Pydantic models (MCQ, GenerateRequest, …)
    settings.py      env-driven config
  data/final_unified/   copy of the labeled corpus
  pyproject.toml
  .env.example

frontend/
  src/
    routes/+page.svelte         orchestrates form + feed + cards
    lib/
      api.ts                    fetch + SSE parser
      types.ts                  shared event shapes
      components/
        GeneratorForm.svelte
        ActivityFeed.svelte
        QuestionCard.svelte
    app.css                     Tailwind v4 + theme tokens
  vite.config.ts                Tailwind plugin + /api proxy
```

## Configuration

| env var | default | notes |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | _(required)_ | your OpenRouter key |
| `OPENROUTER_MODEL` | `deepseek/deepseek-v4-flash` | any tool-use-capable model on OpenRouter |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | |
| `DATA_DIR` | `./data/final_unified` | where the labeled JSONs live |
| `CORS_ORIGINS` | `http://localhost:27296,http://127.0.0.1:27296` | comma-separated |

## Supplying new data

`data/final_unified/` is organized as `{subject}/{exam|exams|td|courses}/*.json`. The
loader auto-detects three shapes documented in `backend/app/dataset.py`:

- **A** — `{"exercises": [{"Question": [...]}]}` with optional `subquestions`.
- **B** — flat array of QA dicts at root.
- **C** — dict mapping keys to QA dicts.

Per-question fields the loader reads: `question_text`/`question`/`q` for the stem,
`Solution`/`answer`/… for the solution, `level` (Procedural / Conceptual /
Metacognitive), and context fields like `introduction_context`, `pseudocode`,
`semaphore_init_table`.

Drop a new subject folder in and it appears in the form automatically on restart.

## Security note

The original `rag-phi4/.env` committed a live OpenRouter key. That key is
compromised — rotate it via the OpenRouter dashboard. `.env` is gitignored here.

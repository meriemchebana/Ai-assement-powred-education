"""Stage 2 — Markdown → Exam JSON via LLM + Instructor self-healing.

Instructor wraps any OpenAI-compatible API and automatically:
  - Sends the Pydantic schema to the model
  - Retries up to max_retries times if validation fails
  - Returns a fully-validated Exam object

Supported providers (pick by setting env vars):
  DEEPSEEK_API_KEY   → DeepSeek (api.deepseek.com)
  GOOGLE_API_KEY     → Gemini Flash  (via openai-compatible endpoint)
  OPENROUTER_API_KEY → OpenRouter free models
  ANTHROPIC_API_KEY  → Claude (via instructor[anthropic])
"""
from __future__ import annotations
import os
from docParser.schema.exam import Exam
from docParser.extract.prompts import SYSTEM_PROMPT, EXTRACTION_PROMPT_TEMPLATE


# ── Provider selection ────────────────────────────────────────────────────────

def _build_client():
    """Return (instructor_client, model_name) for the first available API key."""
    import instructor

    if key := os.getenv("DEEPSEEK_API_KEY"):
        from openai import OpenAI
        raw = OpenAI(api_key=key, base_url="https://api.deepseek.com/v1")
        return instructor.from_openai(raw), "deepseek-chat"

    if key := os.getenv("GOOGLE_API_KEY"):
        import google.generativeai as genai
        genai.configure(api_key=key)
        import instructor
        raw = genai.GenerativeModel("gemini-2.0-flash")
        return instructor.from_gemini(raw), "gemini-2.0-flash"

    if key := os.getenv("OPENROUTER_API_KEY"):
        from openai import OpenAI
        raw = OpenAI(api_key=key, base_url="https://openrouter.ai/api/v1")
        return instructor.from_openai(raw, mode=instructor.Mode.JSON), None  # model chosen at call time

    if key := os.getenv("ANTHROPIC_API_KEY"):
        import anthropic
        raw = anthropic.Anthropic(api_key=key)
        return instructor.from_anthropic(raw), "claude-sonnet-4-6"

    raise EnvironmentError(
        "No API key found. Set one of: DEEPSEEK_API_KEY, GOOGLE_API_KEY, "
        "OPENROUTER_API_KEY, ANTHROPIC_API_KEY"
    )


# ── Language detection (simple, no extra deps) ────────────────────────────────

def _detect_language(markdown: str) -> str:
    arabic_chars = sum(1 for c in markdown if "؀" <= c <= "ۿ")
    ratio = arabic_chars / max(len(markdown), 1)
    if ratio > 0.3:
        return "arabic"
    if ratio > 0.05:
        return "bilingual (French + Arabic)"
    return "french"


# ── Main extraction function ──────────────────────────────────────────────────

_OPENROUTER_FREE_MODELS = [
    "deepseek/deepseek-chat-v3.1",                # DeepSeek — excellent JSON, cheap
    "meta-llama/llama-3.3-70b-instruct:free",     # Llama  — Venice
    "qwen/qwen3-coder:free",                      # Qwen   — bucket différent
    "z-ai/glm-4.5-air:free",                      # GLM    — bucket différent
    "nvidia/nemotron-3-super-120b-a12b:free",     # Nvidia — bucket différent
    "openai/gpt-oss-20b:free",                    # fallback final
]


def extract(
    markdown: str,
    source_pdf: str = "",
    max_retries: int = 3,
) -> Exam:
    """
    Send Markdown to the LLM and return a validated Exam object.
    For OpenRouter, tries free models in order until one succeeds.
    """
    client, model = _build_client()
    language = _detect_language(markdown)

    user_prompt = EXTRACTION_PROMPT_TEMPLATE.format(
        source=source_pdf or "unknown",
        language=language,
        markdown=markdown[:40_000],
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": user_prompt},
    ]

    models_to_try = _OPENROUTER_FREE_MODELS if model is None else [model]

    last_error = None
    for m in models_to_try:
        try:
            print(f"[stage2] Trying model: {m}")
            exam: Exam = client.chat.completions.create(
                model=m,
                response_model=Exam,
                max_retries=max_retries,
                max_tokens=8000,
                messages=messages,
            )
            exam.source_pdf = source_pdf
            return exam
        except Exception as e:
            print(f"[stage2] {m} failed: {type(e).__name__}")
            last_error = e
            continue

    raise RuntimeError(f"All models failed. Last error: {last_error}")

"""Stage 4 — Bloom's cognitive level classification.

Reuses the system prompt and logic from exam-forge/evaluator/evaluation.py.
Calls OpenRouter (OPENROUTER_API_KEY) with gpt-oss-120b:free.
Adds Question.level in-place; skips questions that already have a valid level.
"""
from __future__ import annotations
import os
import time
import requests
from docParser.schema.exam import Exam, Question, VALID_LEVELS

MODEL    = "openai/gpt-oss-120b:free"
BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
DELAY    = 1.0   # seconds between calls (rate-limit safety)

SYSTEM_PROMPT = """You are an expert at classifying academic exam questions by their cognitive knowledge level.

Classify each question into exactly ONE of the following levels (ordered from easiest to hardest):

1. Factual — Remembering/Knowledge:
   The question asks to recall facts, dates, definitions, or information exactly as learned.
   Indicators: "Define...", "State...", "What is...", "List...", "Name..."

2. Conceptual — Comprehension/Analysis:
   The question asks to explain in own words, find relationships, compare, or break down information.
   Indicators: "Explain...", "Compare...", "Analyze...", "Show that...", "Why...", "Deduce..."

3. Procedural — Application:
   The question asks to apply known steps or methods to a new situation or solve a practical problem.
   Indicators: "Calculate...", "Write an algorithm...", "Apply...", "Use method X to...", "Compute...", "Implement..."

4. Metacognitive — Evaluation/Synthesis:
   The question asks to evaluate quality of a solution, judge between alternatives with justification, or create something original.
   Indicators: "Evaluate...", "Which is better and why?", "Propose...", "Criticize..."

Rule: If a question involves multiple levels, choose only the hardest one.
Respond with exactly one word: Factual | Conceptual | Procedural | Metacognitive
No explanation. No punctuation. Just the label."""


def _classify(question_text: str, api_key: str) -> str:
    """Call OpenRouter and return a Bloom's level label. Retries on failure."""
    wait = 5
    for attempt in range(1, 6):
        try:
            resp = requests.post(
                BASE_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user",   "content": f"Question: {question_text}"},
                    ],
                    "max_tokens": 20,
                    "temperature": 0,
                },
                timeout=30,
            )
            resp.raise_for_status()
            answer = resp.json()["choices"][0]["message"]["content"].strip()
            for level in VALID_LEVELS:
                if level.lower() in answer.lower():
                    return level
            print(f"[level_eval] unexpected answer '{answer}', defaulting to Factual")
            return "Factual"
        except Exception as e:
            print(f"[level_eval] attempt {attempt} failed: {e} — retry in {wait}s")
            time.sleep(wait)
            wait = min(wait * 2, 120)
    return "Factual"


def _eval_question(q: Question, api_key: str) -> None:
    """Classify one question (and its sub_questions) in place."""
    if q.level not in VALID_LEVELS:
        q.level = _classify(q.question_text, api_key)
        print(f"[level_eval] {q.id}: {q.level:<16} | {q.question_text[:70]}")
        time.sleep(DELAY)
    for sq in q.sub_questions:
        _eval_question(sq, api_key)


def evaluate_levels(exam: Exam) -> Exam:
    """Stage 4: add Bloom's level to every Question in the exam. Returns exam."""
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key:
        print("[level_eval] OPENROUTER_API_KEY not set — skipping level classification")
        return exam

    print("[stage4] Classifying cognitive levels …")
    for ex in exam.exercises:
        for q in ex.questions:
            _eval_question(q, api_key)

    classified = sum(
        1 for ex in exam.exercises
        for q in ex.questions
        if q.level in VALID_LEVELS
    )
    print(f"[stage4] Done — {classified} question(s) classified")
    return exam

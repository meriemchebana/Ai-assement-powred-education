"""Question generator backed by instructor + Pydantic + OpenRouter (DeepSeek V4 Flash default).

Produces either MCQ (4 choices, one correct) or SAQ (stem + model answer + rubric).
Both paths use JSON mode to stay compatible with providers that reject tool_choice.

The non-negotiable fixes vs. the previous attempt:
  1. `instructor` enforces the Pydantic schema; on validation failure it reprompts the
     model with the error and retries (max_retries=3). No free-text parsing.
  2. The prompt explicitly instructs style imitation with labeled few-shot anchors
     drawn from the same subject+level — not semantic RAG, which blends topics and
     weakens style transfer.
  3. Temperature is moderate (0.75) so questions vary between calls.
"""

from __future__ import annotations

from typing import TypeVar

import instructor
from openai import AsyncOpenAI
from pydantic import BaseModel

from .schemas import MCQ, SAQ, Exercise, ExerciseExample, StyleExample
from .settings import settings

TQuestion = TypeVar("TQuestion", bound=BaseModel)


MCQ_SYSTEM_PROMPT = """You are an expert exam-writer who imitates a specific professor's style.

Your job: generate ONE multiple-choice question that looks like it was written by the same
professor as the provided examples. Match their voice, typical phrasing, typical length,
whether they use context prefixes or data tables, and their cognitive level.

Hard rules for the MCQ:
- Exactly 4 answer choices, all plausible, all distinct, only one correct.
- Distractors must be common-mistake plausible, not obviously wrong.
- Stem must be self-contained: everything needed to answer is in the stem.
- Use the same language as the style examples (usually English or French; Arabic for Law).
- Do NOT copy any example verbatim. Invent a new question on a similar topic/concept.
- Explanation is one or two sentences justifying the correct choice.
"""

SAQ_SYSTEM_PROMPT = """You are an expert exam-writer who imitates a specific professor's style.

Your job: generate ONE short-answer question that looks like it was written by the same
professor as the provided examples. These examples often ask students to write procedures,
derive values, explain a concept, or justify a property. Match that voice and cognitive
level exactly.

Hard rules for the SAQ:
- The stem is self-contained: all required setup, pseudocode, or data is stated.
- Provide a concise `model_answer` a strong student would give (not a full tutorial).
- Provide a `grading_rubric` of 2–6 bullet points naming the key concepts, steps, or
  phrases a correct answer MUST include. Rubric language matches the stem language.
- Pick a `points` value between 1 and 10 that fits the depth of the task.
- Use the same language as the style examples (English / French / Arabic).
- Do NOT copy any example verbatim. Invent a new question on a similar topic/concept.
"""


EXERCISE_SYSTEM_PROMPT = """You are an expert exam-writer who imitates a specific professor's style.

Your job: generate ONE structured exercise that looks like it was written by the same professor as the provided examples.

An exercise has three parts:
  1. title   – a short name for the scenario or problem.
  2. context – a self-contained setup: data table, array, pseudocode, scenario, definitions, or problem statement.
               Every sub-question must be answerable from this context alone — no outside knowledge needed.
  3. questions – sub-questions (exact count in the prompt) that build progressively. Q2 may use Q1's result; Q3 builds on Q2; etc.
               Each sub-question has a model answer, a rubric of 2-4 grading bullets, and a points value.

Hard rules:
  - The context must include ALL data needed for every sub-question.
  - Sub-questions must be coherent, related, and ordered from simpler to more complex.
  - Match the professor's language, phrasing, use of pseudocode or data tables, and cognitive level.
  - Use the SAME language as the style examples (French / Arabic / English).
  - Do NOT copy any example verbatim. Invent a new scenario on a related topic/concept.

━━━ MANDATORY SELF-CHECK (answer mentally before writing the exercise) ━━━

Before producing the final exercise, verify each point. If any check fails, fix it first.

□ COMPLETENESS — For each sub-question, ask: "Can a student answer this using ONLY what is in the context?"
  If no → add the missing data to the context. Never assume the student knows implicit values.

□ UNIQUENESS — For each sub-question, ask: "Is there exactly ONE correct answer, or could two students
  both be right but draw/write different things?"
  Common ambiguity traps to fix explicitly in the question text:
    • BST deletion       → specify "use the in-order successor" OR "use the in-order predecessor"
    • Tree traversal     → specify the order (in-order, pre-order, post-order, BFS…)
    • Hash collision     → specify the resolution method (chaining, linear probing, quadratic…)
    • Sorting algorithm  → specify which variant if multiple exist (stable? ascending/descending?)
    • Graph traversal    → specify starting node and tie-breaking rule (alphabetical? lowest index?)
    • Pointer types      → specify representation (static array with indices, or dynamic pointers?)
    • Memory model       → if asking for stack/heap frames, specify calling convention assumed

□ DEPENDENCY CHAIN — If Q_n uses the result of Q_{n-1}, state it explicitly:
  "Using the tree built in Q1, …" or "Using your result from Q2, …"
  Never silently assume the student carries forward a result.

□ EDGE CASES STATED — If the algorithm must handle edge cases (empty tree, n=0, null pointer),
  state whether the student must handle them or may assume valid input.

□ NOTATION CONSISTENCY — Use the same variable names throughout context and all sub-questions.
  If the context calls a pointer "R", every sub-question must use "R", not "root" or "T".

Only after all five checks pass: produce the exercise JSON.

━━━ REASONING FIELD ━━━
Fill the `reasoning` field with a short self-check trace (2-5 sentences):
  • For each sub-question: what data does it need? Is it explicitly in the context?
  • Does any sub-question require non-trivial prior knowledge? If yes, is it intuitive enough for a student who studied the course?
  • Flag anything you had to add to the context to make the exercise self-contained.
Example: "Q1 needs array A — present in context. Q2 needs the result of Q1's sort, stated explicitly. Q3 requires knowledge of big-O notation, which is standard course material."
"""


def _format_exercise_examples(examples: list[ExerciseExample]) -> str:
    blocks: list[str] = []
    for i, ex in enumerate(examples, 1):
        lines = [f"--- Exercise example {i} (source: {ex.source}) ---"]
        if ex.title:
            lines.append(f"Title: {ex.title}")
        if ex.context:
            lines.append(f"Context:\n{ex.context[:600]}")
        for j, q in enumerate(ex.questions[:5], 1):
            lines.append(f"Q{j}: {q.get('stem', '')[:300]}")
            sol = q.get("solution", "")
            if sol:
                lines.append(f"   Solution: {sol[:200]}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks) if blocks else "(no exercise examples available — generate based on subject)"


def _build_exercise_prompt(
    *,
    subject: str,
    level: str,
    topic: str | None,
    n_questions: int,
    total_points: float | None = None,
    examples: list[ExerciseExample],
    already_generated_titles: list[str],
    rag_context: str | None = None,
    critique: str | None = None,
) -> str:
    parts = [
        f"Subject: {subject}",
        f"Target cognitive level: {level}",
        f"Number of sub-questions: {n_questions} (you MUST produce exactly {n_questions} sub-questions — no more, no less)",
    ]
    if total_points is not None:
        pts_each = round(total_points / n_questions * 2) / 2
        parts.append(
            f"Total points for this exercise: {total_points}. "
            f"Distribute them across the {n_questions} sub-questions (roughly {pts_each} pts each, "
            f"varying by difficulty). The sum of all sub-question points MUST equal {total_points}."
        )
    if topic:
        parts.append(f"Topic focus: {topic}")

    if rag_context:
        parts.append("")
        parts.append(
            "=== VERIFIED COURSE MATERIAL ===\n"
            "Ground the exercise context and answers in this material. "
            "Do NOT invent facts that contradict it. Do NOT copy verbatim.\n"
        )
        parts.append(rag_context[:2000])
        parts.append("=== END COURSE MATERIAL ===")

    parts.append("")
    parts.append("Reference style examples (DO NOT COPY — imitate the professor's structure and voice):")
    parts.append(_format_exercise_examples(examples))

    if already_generated_titles:
        parts.append("")
        parts.append("Exercises already produced in this batch — invent a different scenario:")
        for t in already_generated_titles:
            parts.append(f"  • {t}")

    if critique:
        parts.append("")
        parts.append(
            "=== EVALUATOR CRITIQUE (previous attempt was rejected) ===\n"
            f"{critique}\n"
            "Fix ALL issues raised above. Pay special attention to factual grounding and self-containment.\n"
            "=== END CRITIQUE ==="
        )

    parts.append("")
    parts.append(
        f"Now produce ONE new exercise with exactly {n_questions} sub-questions, "
        "in the same style, grounded in the verified course material above."
    )
    return "\n".join(parts)


def _format_examples(examples: list[StyleExample]) -> str:
    blocks: list[str] = []
    for i, ex in enumerate(examples, 1):
        lines = [f"--- Style example {i} (level: {ex.level or 'unlabeled'}, source: {ex.source}) ---"]
        if ex.context:
            lines.append(f"Context:\n{ex.context}")
        lines.append(f"Question:\n{ex.stem}")
        if ex.solution:
            lines.append(f"Expected solution:\n{ex.solution}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks) if blocks else "(no examples available — generate on your own best guess)"


def _build_user_prompt(
    *,
    question_type: str,
    subject: str,
    level: str,
    topic: str | None,
    examples: list[StyleExample],
    already_generated_stems: list[str],
    rag_context: str | None = None,
) -> str:
    parts = [
        f"Subject: {subject}",
        f"Target cognitive level: {level}",
    ]
    if topic:
        parts.append(f"Topic focus: {topic}")

    if rag_context:
        parts.append("")
        parts.append(
            "=== VERIFIED COURSE MATERIAL ===\n"
            "Use the following excerpts from the actual course content to ensure "
            "your question is factually correct. Do NOT invent facts that contradict "
            "or go beyond this material. Do NOT copy sentences verbatim.\n"
        )
        # Cap context length to avoid token overflow (~2000 chars)
        parts.append(rag_context[:2000])
        parts.append("=== END COURSE MATERIAL ===")

    parts.append("")
    parts.append("Reference style examples (DO NOT COPY, imitate the professor's voice and format):")
    parts.append(_format_examples(examples))
    if already_generated_stems:
        parts.append("")
        parts.append("Questions already produced in this batch — make yours different in angle and wording:")
        for i, stem in enumerate(already_generated_stems, 1):
            parts.append(f"  {i}. {stem}")
    parts.append("")
    parts.append(f"Now produce ONE new {question_type} in the same style, grounded in the verified material above.")
    return "\n".join(parts)


class Generator:
    def __init__(self) -> None:
        if not settings.openrouter_api_key or settings.openrouter_api_key.startswith("sk-or-v1-replace"):
            raise RuntimeError(
                "OPENROUTER_API_KEY not set. Copy backend/.env.example to backend/.env "
                "and put your key there. Get one at https://openrouter.ai/keys"
            )
        # JSON mode (not TOOLS): DeepSeek V4 Flash routes to deepseek-reasoner on
        # OpenRouter, which rejects `tool_choice=required`. JSON mode relies on
        # `response_format={"type":"json_object"}` + a schema injected into the prompt,
        # which every OpenAI-compatible provider supports.
        self._client = instructor.from_openai(
            AsyncOpenAI(
                api_key=settings.openrouter_api_key,
                base_url=settings.openrouter_base_url,
            ),
            mode=instructor.Mode.JSON,
        )
        self.model = settings.openrouter_model

    async def _generate(
        self,
        *,
        response_model: type[TQuestion],
        system_prompt: str,
        user_prompt: str,
    ) -> TQuestion:
        return await self._client.chat.completions.create(
            model=self.model,
            response_model=response_model,
            max_retries=3,
            temperature=0.75,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            extra_headers={
                "HTTP-Referer": "https://github.com/exam-forge",
                "X-Title": "Exam Forge",
            },
        )

    async def generate_mcq(
        self,
        *,
        subject: str,
        level: str,
        topic: str | None,
        examples: list[StyleExample],
        already_generated_stems: list[str],
        rag_context: str | None = None,
    ) -> MCQ:
        return await self._generate(
            response_model=MCQ,
            system_prompt=MCQ_SYSTEM_PROMPT,
            user_prompt=_build_user_prompt(
                question_type="MCQ",
                subject=subject,
                level=level,
                topic=topic,
                examples=examples,
                already_generated_stems=already_generated_stems,
                rag_context=rag_context,
            ),
        )

    async def generate_saq(
        self,
        *,
        subject: str,
        level: str,
        topic: str | None,
        examples: list[StyleExample],
        already_generated_stems: list[str],
        rag_context: str | None = None,
    ) -> SAQ:
        return await self._generate(
            response_model=SAQ,
            system_prompt=SAQ_SYSTEM_PROMPT,
            user_prompt=_build_user_prompt(
                question_type="SAQ",
                subject=subject,
                level=level,
                topic=topic,
                examples=examples,
                already_generated_stems=already_generated_stems,
                rag_context=rag_context,
            ),
        )


    async def generate_exercise(
        self,
        *,
        subject: str,
        level: str,
        topic: str | None,
        n_questions: int,
        total_points: float | None = None,
        examples: list[ExerciseExample],
        already_generated_titles: list[str],
        rag_context: str | None = None,
        critique: str | None = None,
    ) -> Exercise:
        return await self._generate(
            response_model=Exercise,
            system_prompt=EXERCISE_SYSTEM_PROMPT,
            user_prompt=_build_exercise_prompt(
                subject=subject,
                level=level,
                topic=topic,
                n_questions=n_questions,
                total_points=total_points,
                examples=examples,
                already_generated_titles=already_generated_titles,
                rag_context=rag_context,
                critique=critique,
            ),
        )


_generator: Generator | None = None


def get_generator() -> Generator:
    global _generator
    if _generator is None:
        _generator = Generator()
    return _generator

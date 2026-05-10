"""Stage 5 — VLM description for visual diagrams only.

Extracts ONLY non-tabular visual content: automata, trees, graphs, flowcharts.
Structured tables (grids of rectangles) are skipped — they are already
handled as TableData by the LLM extraction stage.

Detection heuristic:
  A vector cluster is a DIAGRAM  if any drawing in it has items > 2
    (arrows, curves, arrowheads → non-rectangular path commands).
  A vector cluster is a TABLE    if all drawings have items ≤ 2
    (only rectangles and straight lines → regular grid).

Primary model  : qwen/qwen2.5-vl-72b-instruct  (OpenRouter)
Fallback model : gemini-2.0-flash               (Google API)
"""
from __future__ import annotations
import base64
import os
import time
from pathlib import Path

import fitz

from docParser.schema.exam import DiagramData, Exam, Solution

VEC_MIN_PT = 5       # pt  — minimum individual drawing size for clustering
CLUSTER_MIN_PT = 80  # pt  — minimum cluster bounding box to be worth rendering
VEC_PAD    = 40      # pt  — padding around cluster bounding box
MIN_PX     = 80      # px  — skip rendered image if too small
MAX_TOKENS = 2000
DELAY      = 6.0     # seconds between VLM calls (free-tier rate limit)

VISION_PROMPT = """You are analyzing a technical diagram extracted from a university exam paper.
Describe it with maximum precision using this structure:

1. TYPE — automaton / parse tree / graph / flowchart / circuit / other
2. TEXT — copy ALL visible text verbatim, preserving spatial layout
3. ELEMENTS — list every node/state/symbol with count and left-to-right/top-to-bottom order
4. RELATIONSHIPS — every arrow/edge with its label and direction
5. STRUCTURE — overall layout and hierarchy

Rules:
- Never omit text visible in the image.
- Copy every label exactly as written.
- Count elements explicitly ("4 states", "6 transitions", etc.).
- Be exhaustive — missing a detail is worse than being verbose."""


# ── Table vs Diagram detection ────────────────────────────────────────────────

def _is_grid(drawings: list[dict], tol: float = 5.0) -> bool:
    """Return True if drawings form a regular grid (table pattern).

    A grid has drawings whose centers cluster into a small number of
    distinct rows × distinct columns that together cover ~all drawings.
    Trees and automata have irregular X/Y positions.
    """
    if len(drawings) < 4:
        return False
    cy = [d["rect"].y0 + d["rect"].height / 2 for d in drawings]
    cx = [d["rect"].x0 + d["rect"].width  / 2 for d in drawings]

    def count_groups(vals: list[float]) -> int:
        s = sorted(vals)
        groups, prev = 1, s[0]
        for v in s[1:]:
            if v - prev > tol:
                groups += 1
            prev = v
        return groups

    rows = count_groups(cy)
    cols = count_groups(cx)
    expected = rows * cols
    # if actual count is close to rows×cols → grid
    return len(drawings) >= expected * 0.7


def _is_diagram_cluster(drawings: list[dict]) -> bool:
    """Return True if the cluster is a visual diagram (not a structured table).

    Two signals — either is enough:
      1. Any drawing has items > 2  → contains arrows/curves (automaton)
      2. Drawings do NOT form a regular grid → tree, graph, flowchart
    """
    if any(len(d.get("items", [])) > 2 for d in drawings):
        return True          # arrows/curves present → definitely a diagram
    return not _is_grid(drawings)  # irregular layout → diagram, not table


# ── Vector region extraction ──────────────────────────────────────────────────

def _extract_diagram_regions(pdf_path: str, output_dir: str) -> list[dict]:
    """Find vector clusters that are diagrams (not tables), render them as PNG."""
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    doc   = fitz.open(pdf_path)
    stem  = Path(pdf_path).stem
    found = []

    for page_num, page in enumerate(doc, 1):
        large = [d for d in page.get_drawings()
                 if d["rect"].width > VEC_MIN_PT and d["rect"].height > VEC_MIN_PT
                 and not (d["rect"].width < 2 or d["rect"].height < 2)]  # skip pure lines
        if not large:
            continue

        # cluster by proximity (within 60 pt)
        clusters: list[list[dict]] = []
        cluster_rects: list[fitz.Rect] = []

        for d in large:
            r = d["rect"]
            expanded = r + (-60, -60, 60, 60)
            merged = False
            for ci, cr in enumerate(cluster_rects):
                if cr.intersects(expanded):
                    cluster_rects[ci] = cr | r
                    clusters[ci].append(d)
                    merged = True
                    break
            if not merged:
                clusters.append([d])
                cluster_rects.append(fitz.Rect(r))

        for ci, (drawings, cluster_rect) in enumerate(zip(clusters, cluster_rects)):
            # skip clusters that are too small to be meaningful
            if cluster_rect.width < CLUSTER_MIN_PT or cluster_rect.height < CLUSTER_MIN_PT:
                continue

            if not _is_diagram_cluster(drawings):
                print(f"[stage5] p{page_num} cluster {ci}: table grid — skipped")
                continue

            clip = cluster_rect + (-VEC_PAD, -VEC_PAD, VEC_PAD, VEC_PAD)
            clip &= page.rect
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=clip)

            if pix.width < MIN_PX or pix.height < MIN_PX:
                continue

            img_path = str(Path(output_dir) / f"{stem}_p{page_num}_diag{ci}.png")
            pix.save(img_path)
            found.append({
                "page": page_num, "index": ci,
                "path": img_path,
                "bbox": [clip.x0, clip.y0, clip.x1, clip.y1],
                "width": pix.width, "height": pix.height,
            })
            print(f"[stage5] p{page_num} cluster {ci}: diagram — extracted")

    doc.close()
    return found


# ── Question linking ──────────────────────────────────────────────────────────

def _link_to_question(img: dict, exam: Exam, pdf_path: str) -> str | None:
    doc  = fitz.open(pdf_path)
    page = doc[img["page"] - 1]
    img_y = img["bbox"][1]

    best_qid, best_dist = None, float("inf")
    for ex in exam.exercises:
        for q in ex.questions:
            for hit in page.search_for(q.question_text[:40]):
                dist = img_y - hit.y1
                if 0 <= dist < best_dist:
                    best_dist, best_qid = dist, q.id
    doc.close()
    return best_qid


# ── VLM calls ─────────────────────────────────────────────────────────────────

def _b64(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def _call_qwen(image_path: str, api_key: str) -> str:
    import requests
    resp = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": "qwen/qwen2.5-vl-72b-instruct",
            "messages": [{"role": "user", "content": [
                {"type": "image_url",
                 "image_url": {"url": f"data:image/png;base64,{_b64(image_path)}"}},
                {"type": "text", "text": VISION_PROMPT},
            ]}],
            "max_tokens": MAX_TOKENS,
            "temperature": 0,
        },
        timeout=90,
    )
    resp.raise_for_status()
    data = resp.json()
    if "choices" not in data:
        raise ValueError(f"No choices: {list(data.keys())}")
    return data["choices"][0]["message"]["content"].strip()


def _call_gemini(image_path: str, api_key: str) -> str:
    import google.generativeai as genai
    from PIL import Image as PILImage
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")
    resp  = model.generate_content(
        [VISION_PROMPT, PILImage.open(image_path)],
        generation_config={"max_output_tokens": MAX_TOKENS, "temperature": 0},
    )
    return resp.text.strip()


def _describe(image_path: str) -> tuple[str, str]:
    """Qwen primary → Gemini fallback."""
    or_key  = os.getenv("OPENROUTER_API_KEY", "")
    ggl_key = os.getenv("GOOGLE_API_KEY", "")

    if or_key:
        try:
            desc = _call_qwen(image_path, or_key)
            if len(desc) >= 50:
                return desc, "qwen2.5-vl-72b"
            print("[vision] Qwen response too short — trying Gemini")
        except Exception as e:
            print(f"[vision] Qwen failed ({e}) — trying Gemini")

    if ggl_key:
        try:
            return _call_gemini(image_path, ggl_key), "gemini-2.0-flash"
        except Exception as e:
            print(f"[vision] Gemini failed ({e})")

    return "[VLM unavailable]", "none"


# ── Public entry point ────────────────────────────────────────────────────────

def extract_and_describe(exam: Exam, pdf_path: str, output_dir: str | None = None) -> Exam:
    """Stage 5: find visual diagrams, describe with VLM, attach to questions."""
    if output_dir is None:
        output_dir = str(Path(pdf_path).parent.parent / "images")

    print("[stage5] Scanning for visual diagrams (skipping structured tables) …")
    visuals = _extract_diagram_regions(pdf_path, output_dir)

    if not visuals:
        print("[stage5] No visual diagrams found — stage skipped")
        return exam

    print(f"[stage5] {len(visuals)} diagram(s) to describe …")
    question_map = {q.id: q for ex in exam.exercises for q in ex.questions}

    for i, img in enumerate(visuals, 1):
        print(f"[stage5] {i}/{len(visuals)}: {Path(img['path']).name}")
        desc, model = _describe(img["path"])
        time.sleep(DELAY)

        qid = _link_to_question(img, exam, pdf_path)

        diag = DiagramData(
            id          = f"diag_p{img['page']}_{img['index']}",
            name        = f"Diagram page {img['page']} #{img['index'] + 1}",
            image_path  = img["path"],
            page        = img["page"],
            bbox        = img["bbox"],
            question_id = qid,
            description = desc,
            model_used  = model,
        )

        if qid and qid in question_map:
            q = question_map[qid]
            q.diagrams.append(diag)
            if desc and desc != "[VLM unavailable]":
                if q.solution is None:
                    q.solution = Solution()
                if not q.solution.diagram:
                    q.solution.diagram = desc
                else:
                    q.solution.diagram += f"\n\n---\n{desc}"
            print(f"[stage5]   → {qid} | model={model}")
        else:
            target_ex = next(
                (ex for ex in exam.exercises if any(q.id == qid for q in ex.questions)),
                exam.exercises[0] if exam.exercises else None,
            )
            if target_ex:
                target_ex.diagrams.append(diag)
                print(f"[stage5]   → {target_ex.id} (no question match) | model={model}")

    print(f"[stage5] Done")
    return exam

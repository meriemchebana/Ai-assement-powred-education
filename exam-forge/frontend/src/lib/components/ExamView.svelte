<script lang="ts">
	import type { AssembledExercise, AssembledExam, AssembledQuestion, ExamPlanEvent } from '../types';
	import { validateQuestion } from '../api';

	let {
		plan = null,
		exercises = [],
		exam = null,
		streaming = false
	}: {
		plan: ExamPlanEvent | null;
		exercises: AssembledExercise[];
		exam: AssembledExam | null;
		streaming: boolean;
	} = $props();

	const subject = $derived(plan?.subject ?? '');

	const LETTERS = ['A', 'B', 'C', 'D', 'E'];

	const KIND_COLOR: Record<string, string> = {
		QCM: 'rgba(59,130,246,0.18)',
		PRACTICAL: 'rgba(16,185,129,0.18)',
		THEORY: 'rgba(245,158,11,0.18)'
	};

	function kindOf(ex: AssembledExercise): string {
		const types = ex.questions.map((q) => q.type);
		if (types.every((t) => t === 'QCM')) return 'QCM';
		return 'PRACTICAL';
	}

	// ── Edit / Validate state (per exercise) ──────────────────────────────────
	let editingId = $state<string | null>(null);
	let drafts = $state<Record<string, AssembledExercise>>({});
	let savingId = $state<string | null>(null);
	let savedIds = $state<Set<string>>(new Set());
	let saveError = $state<string | null>(null);

	function cloneExercise(ex: AssembledExercise): AssembledExercise {
		return {
			...ex,
			questions: ex.questions.map((q) => ({
				...q,
				choices: q.choices ? [...q.choices] : undefined
			}))
		};
	}

	function startEdit(ex: AssembledExercise) {
		drafts = { ...drafts, [ex.id]: cloneExercise(ex) };
		editingId = ex.id;
		saveError = null;
	}

	function cancelEdit() {
		editingId = null;
		saveError = null;
	}

	async function saveExercise(id: string) {
		const draft = drafts[id];
		if (!draft) return;
		savingId = id;
		saveError = null;
		try {
			await validateQuestion(subject, 'Exercise', draft as unknown as Record<string, unknown>);
			savedIds = new Set([...savedIds, id]);
			editingId = null;
		} catch (e) {
			saveError = (e as Error).message;
		} finally {
			savingId = null;
		}
	}

	function addChoice(exId: string, qi: number) {
		const d = drafts[exId];
		if (!d) return;
		const q = d.questions[qi];
		d.questions[qi] = { ...q, choices: [...(q.choices ?? []), ''] };
		drafts = { ...drafts, [exId]: { ...d } };
	}

	function removeChoice(exId: string, qi: number, ci: number) {
		const d = drafts[exId];
		if (!d) return;
		const q = d.questions[qi];
		d.questions[qi] = { ...q, choices: q.choices?.filter((_, j) => j !== ci) };
		drafts = { ...drafts, [exId]: { ...d } };
	}

	// ── Export ─────────────────────────────────────────────────────────────────
	function openBuilder() {
		if (!exam) return;
		sessionStorage.setItem('exam-build', JSON.stringify({ mode: 'exam', exam, plan }));
		window.location.href = '/build';
	}
</script>

<!-- Plan info banner -->
{#if plan}
	<div
		class="parchment-card rounded-xl p-4 flex flex-wrap gap-4 text-sm"
		style="border-color: rgba(139,92,246,0.3);"
	>
		<div class="flex flex-col gap-0.5">
			<span class="text-xs uppercase tracking-widest text-parchment/50">Pattern</span>
			<span class="mono text-amber-300">{plan.template_hint.split('|')[1]?.trim() ?? plan.template_hint}</span>
		</div>
		{#if plan.duration_minutes}
			<div class="flex flex-col gap-0.5">
				<span class="text-xs uppercase tracking-widest text-parchment/50">Duration</span>
				<span>{plan.duration_minutes} min</span>
			</div>
		{/if}
		{#if plan.total_points}
			<div class="flex flex-col gap-0.5">
				<span class="text-xs uppercase tracking-widest text-parchment/50">Total</span>
				<span>{plan.total_points} pts</span>
			</div>
		{/if}
		<div class="flex flex-col gap-0.5">
			<span class="text-xs uppercase tracking-widest text-parchment/50">Exercises</span>
			<span>{exercises.length}/{plan.n_exercises}</span>
		</div>
		<div class="flex flex-col gap-0.5 ms-auto self-center">
			<span
				class="text-xs px-2 py-0.5 rounded"
				style="background: rgba(139,92,246,0.18); color: rgba(167,139,250,1);"
			>{plan.template_source}</span>
		</div>
	</div>
{/if}

<!-- Exercise cards -->
{#each exercises as ex, i (ex.id)}
	{@const kind = kindOf(ex)}
	{@const isEditing = editingId === ex.id}
	{@const draft = drafts[ex.id]}
	<div class="parchment-card rounded-2xl overflow-hidden">

		<!-- Exercise header -->
		<div
			class="px-5 py-3 flex items-center justify-between gap-3"
			style="background: {KIND_COLOR[kind] ?? 'rgba(255,255,255,0.04)'}; border-bottom: 1px solid rgba(245,239,230,0.08);"
		>
			<div class="flex items-center gap-3">
				<span
					class="mono text-xs px-2 py-0.5 rounded"
					style="background: rgba(0,0,0,0.25); color: var(--color-amber);"
				>Ex {i + 1}</span>
				{#if isEditing && draft}
					<input class="input-field text-sm font-medium w-56" bind:value={draft.title} />
				{:else}
					<span class="font-medium">{ex.title}</span>
				{/if}
				<span class="mono text-xs opacity-50">{kind}</span>
			</div>
			{#if ex.total_exercise_points}
				<span class="mono text-sm" style="color: var(--color-amber-soft);">
					{ex.total_exercise_points} pts
				</span>
			{/if}
		</div>

		<div class="px-5 py-4 flex flex-col gap-4">

			<!-- Context -->
			{#if isEditing && draft}
				{#if draft.introduction_context !== undefined}
					<label class="flex flex-col gap-1">
						<span class="text-[10px] uppercase tracking-[0.18em] text-parchment/50">Context</span>
						<textarea
							class="input-field text-sm leading-relaxed resize-y"
							rows="3"
							bind:value={draft.introduction_context}
						></textarea>
					</label>
				{/if}
			{:else if ex.introduction_context}
				<div
					class="text-sm leading-relaxed p-3 rounded-lg"
					style="background: rgba(255,255,255,0.04); color: var(--color-parchment); border-left: 2px solid rgba(245,239,230,0.2);"
				>{ex.introduction_context}</div>
			{/if}

			<!-- Questions -->
			{#if isEditing && draft}
				{#each draft.questions as q, qi (qi)}
					<div
						class="rounded-lg border p-4 flex flex-col gap-3"
						style="border-color: rgba(245,239,230,0.1); background: rgba(245,239,230,0.02);"
					>
						<div class="flex items-center gap-2">
							<span class="mono text-xs" style="color: var(--color-amber);">{qi + 1}.</span>
							<span
								class="text-[10px] px-2 py-0.5 rounded mono"
								style="background: rgba(0,0,0,0.2); color: var(--color-amber-soft);"
							>{q.type}</span>
							{#if q.points !== undefined}
								<input
									class="input-field text-xs w-14 ms-auto"
									type="number"
									min="1"
									max="20"
									bind:value={q.points}
									placeholder="pts"
								/>
							{/if}
						</div>

						<textarea
							class="input-field text-sm leading-relaxed resize-y"
							rows="2"
							bind:value={q.question_text}
						></textarea>

						{#if q.type === 'QCM' && q.choices}
							<div class="flex flex-col gap-2">
								<span class="text-[10px] text-parchment/40">Choices</span>
								{#each q.choices as _, ci (ci)}
									<div class="flex items-center gap-2">
										<span class="mono text-xs w-5" style="color: var(--color-amber);">{LETTERS[ci]}.</span>
										<input class="input-field text-sm flex-1" bind:value={q.choices![ci]} />
										<button
											type="button"
											class="text-xs text-parchment/40 hover:text-parchment/70 px-1"
											onclick={() => removeChoice(ex.id, qi, ci)}
											disabled={(q.choices?.length ?? 0) <= 2}
										>✕</button>
									</div>
								{/each}
								<button
									type="button"
									class="text-xs self-start px-2 py-1 rounded border"
									style="border-color: rgba(245,239,230,0.15); color: rgba(245,239,230,0.5);"
									onclick={() => addChoice(ex.id, qi)}
									disabled={(q.choices?.length ?? 0) >= 5}
								>+ choice</button>
							</div>
						{/if}
					</div>
				{/each}
			{:else}
				{#each ex.questions as q, qi}
					<div class="flex flex-col gap-2">
						<div class="flex items-baseline gap-2">
							<span class="mono text-xs shrink-0" style="color: var(--color-amber); min-width: 1.5rem;">{qi + 1}.</span>
							<span class="text-sm leading-relaxed">{q.question_text}</span>
							{#if q.points}
								<span class="mono text-xs opacity-50 shrink-0 ms-auto">({q.points} pt)</span>
							{/if}
						</div>
						{#if q.type === 'QCM' && q.choices}
							<div class="flex flex-col gap-1 ms-6">
								{#each q.choices as choice, ci}
									<div class="flex items-start gap-2 text-sm text-parchment/80">
										<span class="mono text-xs shrink-0 mt-0.5" style="color: var(--color-amber-soft);">{LETTERS[ci]}.</span>
										<span>{choice}</span>
									</div>
								{/each}
							</div>
						{/if}
						{#if q.level}
							<span
								class="ms-6 text-xs mono self-start px-2 py-0.5 rounded"
								style="background: rgba(255,255,255,0.05); color: var(--color-parchment); opacity: 0.6;"
							>{q.level}</span>
						{/if}
					</div>
				{/each}
			{/if}
		</div>

		<!-- Footer: edit button + validate per exercise -->
		<div
			class="px-5 py-3 border-t flex items-center gap-2 flex-wrap"
			style="border-color: rgba(245,239,230,0.07);"
		>
			{#if isEditing && draft}
				{#if saveError}
					<p class="text-xs w-full" style="color: var(--color-amber-soft);">{saveError}</p>
				{/if}
				<button
					type="button"
					class="text-xs px-4 py-1.5 rounded-md font-medium transition-all"
					style="background: var(--color-sage); color: var(--color-ink);"
					onclick={() => saveExercise(ex.id)}
					disabled={savingId === ex.id}
				>{savingId === ex.id ? 'Saving…' : 'Validate ✓'}</button>
				<button
					type="button"
					class="text-xs px-3 py-1.5 rounded-md border transition-all"
					style="border-color: rgba(245,239,230,0.15); color: var(--color-parchment);"
					onclick={cancelEdit}
					disabled={savingId === ex.id}
				>Cancel</button>
			{:else}
				<button
					type="button"
					class="text-xs px-3 py-1.5 rounded-md border transition-all"
					style="border-color: rgba(245,239,230,0.15); color: var(--color-parchment);"
					onclick={() => startEdit(ex)}
					disabled={editingId !== null && editingId !== ex.id}
				>Edit all questions</button>
				{#if savedIds.has(ex.id)}
					<span class="text-xs" style="color: var(--color-sage);">✓ Saved to validated</span>
				{/if}
			{/if}
		</div>
	</div>
{/each}

<!-- Generating placeholder -->
{#if streaming && plan && exercises.length < plan.n_exercises}
	<div class="parchment-card rounded-2xl p-6 flex items-center gap-3" style="border-style: dashed;">
		<span class="inline-block w-2 h-2 rounded-full animate-pulse" style="background: var(--color-amber);"></span>
		<span class="text-sm text-parchment/70">
			Generating exercise {exercises.length + 1} of {plan.n_exercises}…
		</span>
	</div>
{/if}

<!-- Export buttons -->
{#if exam}
	<div class="mt-4">
		<button
			type="button"
			onclick={openBuilder}
			class="text-sm px-6 py-3 rounded-xl font-semibold transition-all w-full"
			style="background: var(--color-amber); color: var(--color-parchment);"
		>Open in Document Builder →</button>
	</div>
{/if}

<style>
	.input-field {
		background: rgba(245, 239, 230, 0.04);
		border: 1px solid rgba(245, 239, 230, 0.15);
		border-radius: 6px;
		padding: 6px 10px;
		color: var(--color-parchment);
		width: 100%;
		outline: none;
		transition: border-color 0.15s;
	}
	.input-field:focus {
		border-color: rgba(245, 239, 230, 0.35);
	}
</style>

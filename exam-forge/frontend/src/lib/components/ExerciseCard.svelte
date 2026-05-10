<script lang="ts">
	import type { EvaluationResult, Exercise, QuestionType } from '../types';
	import { fly, slide } from 'svelte/transition';
	import EvaluationBadge from './EvaluationBadge.svelte';
	import { validateQuestion } from '../api';

	let { exercise, idx, total, evaluation = null, subject = '' }: {
		exercise: Exercise;
		idx: number;
		total: number;
		evaluation?: EvaluationResult | null;
		subject?: string;
	} = $props();

	const LEVEL_LABELS: Record<string, string> = {
		Procedural: 'Procedural',
		Conceptual: 'Conceptual',
		Metacognitive: 'Metacognitive'
	};
	const LEVELS = ['Procedural', 'Conceptual', 'Metacognitive'];

	let revealed = $state<boolean[]>([]);
	$effect(() => { revealed = Array(exercise.questions.length).fill(false); });

	function toggleAll() {
		const anyHidden = revealed.some((r) => !r);
		revealed = revealed.map(() => anyHidden);
	}

	const totalPoints = $derived(exercise.questions.reduce((s, q) => s + q.points, 0));

	// Edit / validate state
	let editing = $state(false);
	let saving = $state(false);
	let savedAs = $state<'favorite' | 'draft' | 'trash' | null>(null);
	let saveError = $state<string | null>(null);
	let trashMode = $state(false);
	let trashReason = $state('');

	function cloneExercise(ex: Exercise): Exercise {
		return {
			...ex,
			questions: ex.questions.map((q) => ({
				...q,
				grading_rubric: [...q.grading_rubric]
			}))
		};
	}

	let draft = $state<Exercise>(cloneExercise(exercise));

	function startEdit() {
		draft = cloneExercise(exercise);
		editing = true;
		savedAs = null;
		saveError = null;
	}

	function cancelEdit() {
		editing = false;
		saveError = null;
	}

	async function save() {
		saving = true;
		saveError = null;
		try {
			await validateQuestion(subject, 'Exercise' as QuestionType, draft as unknown as Record<string, unknown>, 'favorite');
			savedAs = 'favorite';
			editing = false;
		} catch (e) {
			saveError = (e as Error).message;
		} finally {
			saving = false;
		}
	}

	async function saveAs(status: 'favorite' | 'draft') {
		saving = true;
		saveError = null;
		try {
			await validateQuestion(subject, 'Exercise' as QuestionType, exercise as unknown as Record<string, unknown>, status);
			savedAs = status;
		} catch (e) {
			saveError = (e as Error).message;
		} finally {
			saving = false;
		}
	}

	async function confirmTrash() {
		saving = true;
		saveError = null;
		try {
			await validateQuestion(subject, 'Exercise' as QuestionType, exercise as unknown as Record<string, unknown>, 'trash', trashReason || undefined);
			savedAs = 'trash';
			trashMode = false;
		} catch (e) {
			saveError = (e as Error).message;
		} finally {
			saving = false;
		}
	}

	function addBullet(qi: number) {
		draft.questions[qi].grading_rubric = [...draft.questions[qi].grading_rubric, ''];
	}

	function removeBullet(qi: number, bi: number) {
		draft.questions[qi].grading_rubric = draft.questions[qi].grading_rubric.filter((_, j) => j !== bi);
	}
</script>

<article
	class="parchment-card rounded-2xl overflow-hidden"
	transition:fly={{ y: 18, duration: 270 }}
>
	<!-- Header -->
	<div class="p-6 pb-4 flex flex-col gap-3">
		<div class="flex items-baseline gap-3 flex-wrap">
			<span class="serif text-3xl leading-none mono" dir="ltr" style="color: var(--color-amber);"
				>{String(idx + 1).padStart(2, '0')}</span>
			<span class="mono text-xs text-parchment/40" dir="ltr">of {total}</span>
			<span
				class="ms-auto text-[11px] px-2 py-1 rounded-md"
				style="background: rgba(138,165,142,0.12); color: var(--color-sage); border: 1px solid rgba(138,165,142,0.25);"
			>{LEVEL_LABELS[exercise.level] ?? exercise.level}</span>
			<span
				class="text-[11px] px-2 py-1 rounded-md font-medium"
				style="background: rgba(139,92,246,0.12); color: var(--color-amber-soft); border: 1px solid rgba(139,92,246,0.3);"
			>{totalPoints} pt</span>
			<span class="text-[11px] text-parchment/50">{exercise.topic}</span>
		</div>

		{#if editing}
			<!-- Edit mode -->
			<div class="flex flex-col gap-3 mt-1" transition:fly={{ y: 4, duration: 160 }}>
				<label class="flex flex-col gap-1">
					<span class="text-[10px] uppercase tracking-[0.18em] text-parchment/50">Title</span>
					<input class="input-field text-sm" bind:value={draft.title} />
				</label>

				<label class="flex flex-col gap-1">
					<span class="text-[10px] uppercase tracking-[0.18em] text-parchment/50">Context</span>
					<textarea class="input-field text-sm leading-relaxed resize-y" rows="4" bind:value={draft.context}></textarea>
				</label>

				<div class="flex gap-3 flex-wrap">
					<label class="flex flex-col gap-1 flex-1 min-w-[120px]">
						<span class="text-[10px] uppercase tracking-[0.18em] text-parchment/50">Level</span>
						<select class="input-field text-sm" bind:value={draft.level}>
							{#each LEVELS as l (l)}<option value={l}>{l}</option>{/each}
						</select>
					</label>
					<label class="flex flex-col gap-1 flex-1 min-w-[120px]">
						<span class="text-[10px] uppercase tracking-[0.18em] text-parchment/50">Topic</span>
						<input class="input-field text-sm" bind:value={draft.topic} />
					</label>
				</div>

				<!-- Sub-questions -->
				{#each draft.questions as q, qi (qi)}
					<div
						class="rounded-lg border p-4 flex flex-col gap-3"
						style="border-color: rgba(245,239,230,0.1); background: rgba(245,239,230,0.02);"
					>
						<p class="text-[10px] uppercase tracking-[0.18em] text-parchment/50">Sub-question {qi + 1}</p>

						<label class="flex flex-col gap-1">
							<span class="text-[10px] text-parchment/40">Stem</span>
							<textarea class="input-field text-sm resize-y" rows="2" bind:value={q.stem}></textarea>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-[10px] text-parchment/40">Model answer</span>
							<textarea class="input-field text-sm resize-y" rows="2" bind:value={q.model_answer}></textarea>
						</label>

						<div class="flex flex-col gap-2">
							<span class="text-[10px] text-parchment/40">Rubric</span>
							{#each q.grading_rubric as _, bi (bi)}
								<div class="flex items-center gap-2">
									<span class="mono text-xs" style="color: var(--color-amber);">•</span>
									<input class="input-field text-sm flex-1" bind:value={q.grading_rubric[bi]} />
									<button
										type="button"
										class="text-xs text-parchment/40 hover:text-parchment/70 px-1"
										onclick={() => removeBullet(qi, bi)}
										disabled={q.grading_rubric.length <= 2}
									>✕</button>
								</div>
							{/each}
							<button
								type="button"
								class="text-xs self-start px-2 py-1 rounded border"
								style="border-color: rgba(245,239,230,0.15); color: rgba(245,239,230,0.5);"
								onclick={() => addBullet(qi)}
								disabled={q.grading_rubric.length >= 4}
							>+ bullet</button>
						</div>

						<label class="flex items-center gap-2">
							<span class="text-[10px] text-parchment/40">Points</span>
							<input class="input-field text-sm w-16" type="number" min="1" max="8" bind:value={q.points} />
						</label>
					</div>
				{/each}

				{#if saveError}
					<p class="text-xs" style="color: var(--color-amber-soft);">{saveError}</p>
				{/if}

				<div class="flex gap-2">
					<button
						type="button"
						class="text-xs px-4 py-1.5 rounded-md font-medium transition-all"
						style="background: var(--color-sage); color: var(--color-ink);"
						onclick={save}
						disabled={saving}
					>{saving ? 'Saving…' : 'Validate ✓'}</button>
					<button
						type="button"
						class="text-xs px-3 py-1.5 rounded-md border transition-all"
						style="border-color: rgba(245,239,230,0.15); color: var(--color-parchment);"
						onclick={cancelEdit}
						disabled={saving}
					>Cancel</button>
				</div>
			</div>
		{:else}
			<!-- View mode -->
			{#if exercise.title}
				<h3 class="serif text-xl leading-snug">{exercise.title}</h3>
			{/if}

			{#if exercise.context}
				<div
					class="rounded-lg border p-4 mt-1"
					style="border-color: rgba(245,239,230,0.12); background: rgba(245,239,230,0.03);"
				>
					<p class="text-[10px] uppercase tracking-[0.2em] text-parchment/40 mb-2">Context</p>
					<p class="text-sm leading-relaxed whitespace-pre-wrap">{exercise.context}</p>
				</div>
			{/if}

			<div class="flex items-center gap-3 mt-1">
				<span class="text-xs text-parchment/50">
					{exercise.questions.length} sub-question{exercise.questions.length > 1 ? 's' : ''}
				</span>
				<button
					type="button"
					class="text-xs px-3 py-1.5 rounded-md border transition-all ms-auto"
					style="border-color: rgba(245,239,230,0.15); color: var(--color-parchment);"
					onclick={toggleAll}
				>{revealed.every(Boolean) ? 'Hide all answers' : 'Show all answers'}</button>
			</div>
		{/if}
	</div>

	{#if !editing}
		<!-- Sub-questions view -->
		<div class="flex flex-col divide-y" style="border-color: rgba(245,239,230,0.07);">
			{#each exercise.questions as q, qi (qi)}
				<div class="px-6 py-4 flex flex-col gap-3">
					<div class="flex items-start gap-3">
						<span class="mono text-xs shrink-0 mt-1" style="color: var(--color-amber); min-width: 1.4rem;">{qi + 1}.</span>
						<p class="serif text-base leading-relaxed flex-1">{q.stem}</p>
						<span
							class="shrink-0 text-[11px] px-2 py-0.5 rounded-md self-start"
							style="background: rgba(139,92,246,0.1); color: var(--color-amber-soft); border: 1px solid rgba(139,92,246,0.25);"
						>{q.points} pt</span>
					</div>
					<button
						type="button"
						class="text-xs px-3 py-1.5 rounded-md border transition-all self-start"
						style="border-color: rgba(245,239,230,0.15); color: var(--color-parchment);"
						onclick={() => (revealed[qi] = !revealed[qi])}
					>{revealed[qi] ? 'Hide answer' : 'Show answer & rubric'}</button>

					{#if revealed[qi]}
						<div class="flex flex-col gap-2" transition:slide={{ duration: 200 }}>
							<div class="rounded-md border p-3" style="border-color: rgba(138,165,142,0.3); background: rgba(138,165,142,0.06);">
								<p class="text-[10px] uppercase tracking-[0.18em] text-parchment/50 mb-1">Model answer</p>
								<p class="text-sm leading-relaxed">{q.model_answer}</p>
							</div>
							<div class="rounded-md border p-3" style="border-color: rgba(139,92,246,0.25); background: rgba(139,92,246,0.04);">
								<p class="text-[10px] uppercase tracking-[0.18em] text-parchment/50 mb-2">Grading rubric</p>
								<ul class="flex flex-col gap-1.5">
									{#each q.grading_rubric as bullet, bi (bi)}
										<li class="text-sm flex items-start gap-2">
											<span class="mono text-xs mt-0.5" style="color: var(--color-amber);">•</span>
											<span class="flex-1">{bullet}</span>
										</li>
									{/each}
								</ul>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Footer: evaluator + edit + status buttons -->
	<div class="px-6 py-4 border-t flex flex-col gap-2" style="border-color: rgba(245,239,230,0.07);">
		{#if !editing}
			{#if trashMode}
				<div class="rounded-lg border p-3 flex flex-col gap-2" style="border-color: rgba(196,84,45,0.35); background: rgba(196,84,45,0.06);">
					<p class="text-xs leading-relaxed" style="color: var(--color-amber-soft);">
						💡 Adding a reason helps the generator avoid similar questions in future runs — improving output quality over time.
					</p>
					<input
						class="input-field text-sm"
						placeholder="Reason (optional): e.g. too easy, wrong topic, ambiguous…"
						bind:value={trashReason}
					/>
					<div class="flex gap-2">
						<button
							type="button"
							class="text-xs px-3 py-1.5 rounded-md font-medium transition-all"
							style="background: rgba(196,84,45,0.7); color: var(--color-parchment);"
							onclick={confirmTrash}
							disabled={saving}
						>{saving ? 'Saving…' : 'Confirm Trash'}</button>
						<button
							type="button"
							class="text-xs px-3 py-1.5 rounded-md border"
							style="border-color: rgba(245,239,230,0.15); color: var(--color-parchment);"
							onclick={() => (trashMode = false)}
						>Cancel</button>
					</div>
					{#if saveError}<p class="text-xs" style="color: var(--color-amber-soft);">{saveError}</p>{/if}
				</div>
			{:else}
				<div class="flex items-center gap-2 flex-wrap">
					<button
						type="button"
						class="text-xs px-3 py-1.5 rounded-md border transition-all"
						style="border-color: rgba(245,239,230,0.15); color: var(--color-parchment);"
						onclick={startEdit}
					>Edit</button>

					{#if savedAs}
						<span class="text-xs" style="color: var(--color-sage);">
							{savedAs === 'favorite' ? '★ Saved as Favorite' : savedAs === 'draft' ? '✏ Saved as Draft' : '🗑 Sent to Trash'}
						</span>
					{:else}
						<button
							type="button"
							class="text-xs px-3 py-1.5 rounded-md border transition-all"
							style="border-color: rgba(139,92,246,0.5); color: var(--color-amber-soft);"
							onclick={() => saveAs('favorite')}
							disabled={saving}
						>★ Favorite</button>
						<button
							type="button"
							class="text-xs px-3 py-1.5 rounded-md border transition-all"
							style="border-color: rgba(77,196,176,0.35); color: var(--color-teal);"
							onclick={() => saveAs('draft')}
							disabled={saving}
						>✏ Draft</button>
						<button
							type="button"
							class="text-xs px-3 py-1.5 rounded-md border transition-all"
							style="border-color: rgba(196,84,45,0.4); color: var(--color-ember);"
							onclick={() => { trashMode = true; trashReason = ''; }}
							disabled={saving}
						>🗑 Trash</button>
					{/if}

					{#if saveError && !trashMode}
						<p class="text-xs" style="color: var(--color-amber-soft);">{saveError}</p>
					{/if}
					<div class="ms-auto">
						<EvaluationBadge result={evaluation} />
					</div>
				</div>
			{/if}
		{:else}
			<div class="ms-auto">
				<EvaluationBadge result={evaluation} />
			</div>
		{/if}
	</div>
</article>

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
	select.input-field option {
		background: #1a1a1a;
	}
</style>

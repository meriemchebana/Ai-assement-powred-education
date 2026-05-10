<script lang="ts">
	import type { EvaluationResult, SAQ, QuestionType } from '../types';
	import { fly } from 'svelte/transition';
	import EvaluationBadge from './EvaluationBadge.svelte';
	import { validateQuestion } from '../api';

	let { saq, idx, total, evaluation = null, subject = '' }: {
		saq: SAQ;
		idx: number;
		total: number;
		evaluation?: EvaluationResult | null;
		subject?: string;
	} = $props();

	let revealed = $state(false);
	let editing = $state(false);
	let saving = $state(false);
	let savedAs = $state<'favorite' | 'draft' | 'trash' | null>(null);
	let saveError = $state<string | null>(null);
	let trashMode = $state(false);
	let trashReason = $state('');

	let draft = $state<SAQ>({ ...saq, grading_rubric: [...saq.grading_rubric] });

	function startEdit() {
		draft = { ...saq, grading_rubric: [...saq.grading_rubric] };
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
			await validateQuestion(subject, 'SAQ' as QuestionType, draft as unknown as Record<string, unknown>, 'favorite');
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
			await validateQuestion(subject, 'SAQ' as QuestionType, saq as unknown as Record<string, unknown>, status);
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
			await validateQuestion(subject, 'SAQ' as QuestionType, saq as unknown as Record<string, unknown>, 'trash', trashReason || undefined);
			savedAs = 'trash';
			trashMode = false;
		} catch (e) {
			saveError = (e as Error).message;
		} finally {
			saving = false;
		}
	}

	function addBullet() {
		draft.grading_rubric = [...draft.grading_rubric, ''];
	}

	function removeBullet(i: number) {
		draft.grading_rubric = draft.grading_rubric.filter((_, j) => j !== i);
	}

	const LEVEL_LABELS: Record<string, string> = {
		Procedural: 'Procedural',
		Conceptual: 'Conceptual',
		Metacognitive: 'Metacognitive'
	};
	const LEVELS = ['Procedural', 'Conceptual', 'Metacognitive'];
</script>

<article
	class="parchment-card rounded-2xl p-6 flex flex-col gap-4"
	transition:fly={{ y: 16, duration: 260 }}
>
	<header class="flex items-baseline gap-3 flex-wrap">
		<span class="serif text-3xl leading-none mono" dir="ltr" style="color: var(--color-amber);"
			>{String(idx + 1).padStart(2, '0')}</span>
		<span class="mono text-xs text-parchment/40" dir="ltr">of {total}</span>
		<span
			class="ms-auto text-[11px] px-2 py-1 rounded-md"
			style="background: rgba(138,165,142,0.12); color: var(--color-sage); border: 1px solid rgba(138,165,142,0.25);"
		>{LEVEL_LABELS[saq.level] ?? saq.level}</span>
		<span
			class="text-[11px] px-2 py-1 rounded-md"
			style="background: rgba(139,92,246,0.12); color: var(--color-amber-soft); border: 1px solid rgba(139,92,246,0.3);"
		>{saq.points} pt</span>
		<span class="text-[11px] text-parchment/50">{saq.topic}</span>
	</header>

	{#if editing}
		<div class="flex flex-col gap-3" transition:fly={{ y: 4, duration: 160 }}>
			<label class="flex flex-col gap-1">
				<span class="text-[10px] uppercase tracking-[0.18em] text-parchment/50">Question</span>
				<textarea class="input-field text-sm leading-relaxed resize-y" rows="3" bind:value={draft.stem}></textarea>
			</label>

			<label class="flex flex-col gap-1">
				<span class="text-[10px] uppercase tracking-[0.18em] text-parchment/50">Model answer</span>
				<textarea class="input-field text-sm leading-relaxed resize-y" rows="3" bind:value={draft.model_answer}></textarea>
			</label>

			<div class="flex flex-col gap-2">
				<span class="text-[10px] uppercase tracking-[0.18em] text-parchment/50">Grading rubric</span>
				{#each draft.grading_rubric as _, i (i)}
					<div class="flex items-center gap-2">
						<span class="mono text-xs" style="color: var(--color-amber);">•</span>
						<input class="input-field text-sm flex-1" bind:value={draft.grading_rubric[i]} />
						<button
							type="button"
							class="text-xs text-parchment/40 hover:text-parchment/70 px-1"
							onclick={() => removeBullet(i)}
							disabled={draft.grading_rubric.length <= 2}
						>✕</button>
					</div>
				{/each}
				<button
					type="button"
					class="text-xs self-start px-2 py-1 rounded border"
					style="border-color: rgba(245,239,230,0.15); color: var(--color-parchment)/70;"
					onclick={addBullet}
					disabled={draft.grading_rubric.length >= 6}
				>+ Add bullet</button>
			</div>

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
				<label class="flex flex-col gap-1 w-20">
					<span class="text-[10px] uppercase tracking-[0.18em] text-parchment/50">Points</span>
					<input class="input-field text-sm" type="number" min="1" max="10" bind:value={draft.points} />
				</label>
			</div>

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
		<p class="serif text-lg leading-relaxed">{saq.stem}</p>

		<div class="flex items-center gap-3">
			<button
				type="button"
				class="text-xs px-3 py-1.5 rounded-md border transition-all"
				style="border-color: rgba(245,239,230,0.15); color: var(--color-parchment);"
				onclick={() => (revealed = !revealed)}
			>{revealed ? 'Hide model answer & rubric' : 'Show model answer & rubric'}</button>
		</div>

		{#if revealed}
			<div class="flex flex-col gap-3" transition:fly={{ y: 4, duration: 200 }}>
				<div class="rounded-md border p-3" style="border-color: rgba(138,165,142,0.3); background: rgba(138,165,142,0.06);">
					<p class="text-[11px] uppercase tracking-[0.18em] text-parchment/50 mb-1">Model answer</p>
					<p class="text-sm leading-relaxed">{saq.model_answer}</p>
				</div>
				<div class="rounded-md border p-3" style="border-color: rgba(139,92,246,0.25); background: rgba(139,92,246,0.04);">
					<p class="text-[11px] uppercase tracking-[0.18em] text-parchment/50 mb-2">Grading rubric</p>
					<ul class="flex flex-col gap-1.5">
						{#each saq.grading_rubric as bullet, i (i)}
							<li class="text-sm flex items-start gap-2">
								<span class="mono text-xs mt-0.5" style="color: var(--color-amber);">•</span>
								<span class="flex-1">{bullet}</span>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		{/if}

		<div class="flex flex-col gap-2 pt-3 border-t" style="border-color: rgba(245,239,230,0.07);">
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
		</div>
	{/if}
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

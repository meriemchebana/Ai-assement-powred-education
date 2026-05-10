<script lang="ts">
	import type { EvaluationResult, MCQ, QuestionType } from '../types';
	import { fly } from 'svelte/transition';
	import EvaluationBadge from './EvaluationBadge.svelte';
	import { validateQuestion } from '../api';

	let { mcq, idx, total, evaluation = null, subject = '' }: {
		mcq: MCQ;
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

	let draft = $state<MCQ>({ ...mcq, choices: [...mcq.choices] });

	function startEdit() {
		draft = { ...mcq, choices: [...mcq.choices] };
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
			await validateQuestion(subject, 'MCQ' as QuestionType, draft as unknown as Record<string, unknown>, 'favorite');
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
			await validateQuestion(subject, 'MCQ' as QuestionType, mcq as unknown as Record<string, unknown>, status);
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
			await validateQuestion(subject, 'MCQ' as QuestionType, mcq as unknown as Record<string, unknown>, 'trash', trashReason || undefined);
			savedAs = 'trash';
			trashMode = false;
		} catch (e) {
			saveError = (e as Error).message;
		} finally {
			saving = false;
		}
	}

	const LETTERS = ['A', 'B', 'C', 'D'];
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
		>{LEVEL_LABELS[mcq.level] ?? mcq.level}</span>
		<span class="text-[11px] text-parchment/50">{mcq.topic}</span>
	</header>

	{#if editing}
		<!-- Edit mode -->
		<div class="flex flex-col gap-3" transition:fly={{ y: 4, duration: 160 }}>
			<label class="flex flex-col gap-1">
				<span class="text-[10px] uppercase tracking-[0.18em] text-parchment/50">Question</span>
				<textarea
					class="input-field text-sm leading-relaxed resize-y"
					rows="3"
					bind:value={draft.stem}
				></textarea>
			</label>

			<div class="flex flex-col gap-2">
				<span class="text-[10px] uppercase tracking-[0.18em] text-parchment/50">Choices</span>
				{#each draft.choices as _, i (i)}
					<label class="flex items-center gap-2">
						<input
							type="radio"
							name="correct-{idx}"
							value={i}
							checked={draft.correct_index === i}
							onchange={() => (draft.correct_index = i)}
							class="accent-amber-400"
						/>
						<span class="mono text-xs w-5" style="color: var(--color-amber);">{LETTERS[i]}</span>
						<input
							class="input-field text-sm flex-1"
							bind:value={draft.choices[i]}
						/>
					</label>
				{/each}
				<p class="text-[10px] text-parchment/40">Select the radio button for the correct answer.</p>
			</div>

			<label class="flex flex-col gap-1">
				<span class="text-[10px] uppercase tracking-[0.18em] text-parchment/50">Explanation</span>
				<textarea
					class="input-field text-sm leading-relaxed resize-y"
					rows="2"
					bind:value={draft.explanation}
				></textarea>
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
		<p class="serif text-lg leading-relaxed">{mcq.stem}</p>

		<ol class="flex flex-col gap-2">
			{#each mcq.choices as choice, i (i)}
				{@const isCorrect = revealed && i === mcq.correct_index}
				{@const isWrong = revealed && i !== mcq.correct_index}
				<li
					class="flex items-start gap-3 rounded-md border px-3 py-2 text-sm transition-all"
					style={isCorrect
						? 'border-color: rgba(138,165,142,0.6); background: rgba(138,165,142,0.12); color: var(--color-parchment);'
						: isWrong
							? 'border-color: rgba(245,239,230,0.06); background: transparent; color: rgba(245,239,230,0.35);'
							: 'border-color: rgba(245,239,230,0.1); background: rgba(245,239,230,0.02); color: var(--color-parchment);'}
				>
					<span
						class="text-xs mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold"
						style={isCorrect
							? 'background: var(--color-sage); color: var(--color-ink);'
							: 'background: rgba(245,239,230,0.08); color: var(--color-parchment);'}
					>{LETTERS[i]}</span>
					<span class="flex-1">{choice}</span>
				</li>
			{/each}
		</ol>

		<div class="flex items-center gap-3 flex-wrap">
			<button
				type="button"
				class="text-xs px-3 py-1.5 rounded-md border transition-all"
				style="border-color: rgba(245,239,230,0.15); color: var(--color-parchment);"
				onclick={() => (revealed = !revealed)}
			>{revealed ? 'Hide answer' : 'Show answer'}</button>
			{#if revealed}
				<p class="text-xs text-parchment/70" transition:fly={{ y: 4, duration: 200 }}>
					{mcq.explanation}
				</p>
			{/if}
		</div>

		<div class="flex flex-col gap-2 pt-1 border-t" style="border-color: rgba(245,239,230,0.07);">
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

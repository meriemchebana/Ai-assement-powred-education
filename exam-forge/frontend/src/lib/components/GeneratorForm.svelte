<script lang="ts">
	import type { SubjectSummary, LevelOrMixed, GenerateRequest, QuestionType } from '../types';

	let {
		subjects,
		model,
		disabled = false,
		onSubmit
	}: {
		subjects: SubjectSummary[];
		model: string;
		disabled?: boolean;
		onSubmit: (req: GenerateRequest) => void;
	} = $props();

	let subject = $state('');
	let level = $state<LevelOrMixed>('Mixed');
	let count = $state(5);
	let topic = $state('');
	let questionType = $state<QuestionType>('MCQ');
	let questionsPerExercise = $state(3);

	const LEVELS: LevelOrMixed[] = ['Mixed', 'Procedural', 'Conceptual', 'Metacognitive'];

	const LEVEL_LABELS: Record<LevelOrMixed, string> = {
		Mixed: 'Mixed',
		Procedural: 'Procedural',
		Conceptual: 'Conceptual',
		Metacognitive: 'Metacognitive'
	};

	const SUBJECT_LABELS: Record<string, string> = {
		algo: 'Algorithms',
		se: 'Operating Systems',
		commerce: 'Commerce',
		Law: 'Law',
		compilation: 'Compilation'
	};

	function labelFor(s: SubjectSummary): string {
		// demo mode injects displayName onto the object; fall back to SUBJECT_LABELS
		return (s as any).displayName ?? SUBJECT_LABELS[s.subject] ?? s.subject;
	}

	const TYPES: { value: QuestionType; label: string; hint: string }[] = [
		{ value: 'MCQ', label: 'Multiple Choice', hint: '4 choices · one correct answer' },
		{ value: 'SAQ', label: 'Short Answer', hint: 'Model answer + grading rubric' },
		{ value: 'Exercise', label: 'Full Exercise', hint: 'Shared context + progressive sub-questions' }
	];

	$effect(() => {
		if (!subjects.some((s) => s.subject === subject) && subjects.length) {
			subject = subjects[0].subject;
		}
	});

	const current = $derived(subjects.find((s) => s.subject === subject));

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (disabled || !subject) return;
		onSubmit({
			subject,
			level,
			count,
			topic: topic.trim() || null,
			question_type: questionType,
			questions_per_exercise: questionsPerExercise
		});
	}
</script>

<form onsubmit={submit} class="parchment-card rounded-2xl p-6 flex flex-col gap-5">
	<div class="flex items-baseline justify-between gap-4">
		<h2 class="serif text-2xl">New Exam</h2>
		<span class="mono text-xs text-parchment/50" dir="ltr">{model}</span>
	</div>

	<!-- Subject -->
	<div class="flex flex-col gap-2">
		<span class="text-xs uppercase tracking-[0.18em] text-parchment/60">Subject</span>
		<div class="flex flex-wrap gap-2">
			{#each subjects as s (s.subject)}
				<button
					type="button"
					class="px-3 py-2 rounded-lg border text-sm transition-all"
					style={subject === s.subject
						? 'background: var(--color-amber); color: var(--color-ink); border-color: var(--color-amber);'
						: 'border-color: rgba(245,239,230,0.15); color: var(--color-parchment);'}
					onclick={() => (subject = s.subject)}
				>
					<span class="font-medium">{labelFor(s)}</span>
					<span class="mono text-[11px] opacity-70 ms-1" dir="ltr">{s.total}</span>
				</button>
			{/each}
		</div>
	</div>

	<!-- Question type -->
	<div class="flex flex-col gap-2">
		<span class="text-xs uppercase tracking-[0.18em] text-parchment/60">Question Type</span>
		<div class="flex gap-2">
			{#each TYPES as t (t.value)}
				<button
					type="button"
					class="flex-1 px-3 py-2 rounded-md text-sm border transition-all text-start"
					style={questionType === t.value
						? 'background: rgba(139,92,246,0.18); color: var(--color-amber-soft); border-color: rgba(139,92,246,0.55);'
						: 'background: transparent; color: var(--color-parchment); border-color: rgba(245,239,230,0.12);'}
					onclick={() => (questionType = t.value)}
				>
					<div class="font-medium">{t.label}</div>
					<div class="text-[11px] opacity-60 mt-0.5">{t.hint}</div>
				</button>
			{/each}
		</div>
	</div>

	<!-- Level -->
	<div class="flex flex-col gap-2">
		<span class="text-xs uppercase tracking-[0.18em] text-parchment/60">Cognitive Level</span>
		<div class="flex flex-wrap gap-2">
			{#each LEVELS as l (l)}
				<button
					type="button"
					class="px-3 py-1.5 rounded-md text-sm transition-all border"
					style={level === l
						? 'background: rgba(139,92,246,0.18); color: var(--color-amber-soft); border-color: rgba(139,92,246,0.55);'
						: 'background: transparent; color: var(--color-parchment); border-color: rgba(245,239,230,0.12);'}
					onclick={() => (level = l)}
				>
					{LEVEL_LABELS[l]}
					{#if current && l !== 'Mixed'}
						<span class="mono text-[11px] opacity-60 ms-1" dir="ltr">{current.levels[l] ?? 0}</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<!-- Count -->
	<div class="flex flex-col gap-2">
		<label for="count" class="text-xs uppercase tracking-[0.18em] text-parchment/60">
			{questionType === 'Exercise' ? 'Number of exercises' : 'Number of questions'} · <span class="mono text-parchment" dir="ltr">{count}</span>
		</label>
		<input
			id="count"
			type="range"
			min="1"
			max="20"
			bind:value={count}
			class="w-full"
			style="accent-color: var(--color-amber); direction: ltr;"
		/>
	</div>

	<!-- Sub-questions per exercise -->
	{#if questionType === 'Exercise'}
		<div class="flex flex-col gap-2">
			<label for="qpe" class="text-xs uppercase tracking-[0.18em] text-parchment/60">
				Questions per exercise · <span class="mono text-parchment" dir="ltr">{questionsPerExercise}</span>
			</label>
			<input
				id="qpe"
				type="range"
				min="2"
				max="5"
				bind:value={questionsPerExercise}
				class="w-full"
				style="accent-color: var(--color-amber); direction: ltr;"
			/>
		</div>
	{/if}

	<!-- Topic -->
	<div class="flex flex-col gap-2">
		<label for="topic" class="text-xs uppercase tracking-[0.18em] text-parchment/60">
			Specific topic <span class="text-parchment/40 normal-case">(optional)</span>
		</label>
		<input
			id="topic"
			type="text"
			bind:value={topic}
			placeholder="e.g. binary search trees, semaphores, context-free grammars…"
			class="px-3 py-2 rounded-md bg-transparent border placeholder:text-parchment/30 focus:outline-none text-start"
			style="border-color: rgba(245,239,230,0.15); color: var(--color-parchment);"
		/>
	</div>

	<button
		type="submit"
		{disabled}
		class="mt-1 py-3 rounded-lg serif text-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed amber-ring"
		style="background: var(--color-amber); color: var(--color-ink);"
	>
		{#if disabled}
			Generating…
		{:else if questionType === 'MCQ'}
			Generate {count} MCQ{count > 1 ? 's' : ''}
		{:else if questionType === 'SAQ'}
			Generate {count} Short Answer{count > 1 ? 's' : ''}
		{:else}
			Generate {count} Exercise{count > 1 ? 's' : ''} · {questionsPerExercise} questions each
		{/if}
	</button>
</form>

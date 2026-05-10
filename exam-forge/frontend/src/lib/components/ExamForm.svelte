<script lang="ts">
	import type { SubjectSummary, GenerateExamRequest, PatternName } from '../types';

	let {
		subjects,
		model,
		disabled = false,
		onSubmit
	}: {
		subjects: SubjectSummary[];
		model: string;
		disabled?: boolean;
		onSubmit: (req: GenerateExamRequest) => void;
	} = $props();

	let subject = $state('');
	let title = $state('');
	let nExercises = $state(3);
	let durationMinutes = $state<number | null>(null);
	let totalPoints = $state<number | null>(null);
	let targetLevel = $state('Mixed');
	let topic = $state('');
	let patternOverride = $state<PatternName | null>(null);
	let useArchive = $state(true);

	const LEVELS = ['Mixed', 'Procedural', 'Conceptual', 'Metacognitive', 'Factual'];

	const PATTERNS: { value: PatternName; label: string }[] = [
		{ value: 'all_QCM', label: 'All QCM' },
		{ value: 'all_practical', label: 'All Practical' },
		{ value: 'all_theory', label: 'All Theory' },
		{ value: 'theory_then_practical', label: 'Theory → Practical' },
		{ value: 'qcm_then_practical', label: 'QCM → Practical' },
		{ value: 'mixed', label: 'Mixed' }
	];

	const SUBJECT_LABELS: Record<string, string> = {
		algo: 'Algorithms',
		se: 'Operating Systems',
		commerce: 'Commerce',
		Law: 'Law',
		compilation: 'Compilation',
		'Medcine-Biochemie': 'Medicine'
	};

	$effect(() => {
		if (!subjects.some((s) => s.subject === subject) && subjects.length) {
			subject = subjects[0].subject;
		}
	});

	function labelFor(s: SubjectSummary): string {
		return (s as any).displayName ?? SUBJECT_LABELS[s.subject] ?? s.subject;
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (disabled || !subject) return;
		onSubmit({
			subject,
			title: title.trim() || null,
			n_exercises: nExercises,
			duration_minutes: durationMinutes,
			total_points: totalPoints,
			target_level: targetLevel,
			topic: topic.trim() || null,
			pattern_override: useArchive ? null : patternOverride
		});
	}
</script>

<form onsubmit={submit} class="parchment-card rounded-2xl p-6 flex flex-col gap-5">
	<div class="flex items-baseline justify-between gap-4">
		<h2 class="serif text-2xl">Full Exam</h2>
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
					{labelFor(s)}
				</button>
			{/each}
		</div>
	</div>

	<!-- Template source -->
	<div class="flex flex-col gap-2">
		<span class="text-xs uppercase tracking-[0.18em] text-parchment/60">Template</span>
		<div class="flex gap-2">
			<button
				type="button"
				class="flex-1 px-3 py-2 rounded-md text-sm border transition-all text-start"
				style={useArchive
					? 'background: rgba(139,92,246,0.18); color: var(--color-amber-soft); border-color: rgba(139,92,246,0.55);'
					: 'background: transparent; color: var(--color-parchment); border-color: rgba(245,239,230,0.12);'}
				onclick={() => (useArchive = true)}
			>
				<div class="font-medium">Auto from archive</div>
				<div class="text-[11px] opacity-60 mt-0.5">Learns pattern from past exams</div>
			</button>
			<button
				type="button"
				class="flex-1 px-3 py-2 rounded-md text-sm border transition-all text-start"
				style={!useArchive
					? 'background: rgba(139,92,246,0.18); color: var(--color-amber-soft); border-color: rgba(139,92,246,0.55);'
					: 'background: transparent; color: var(--color-parchment); border-color: rgba(245,239,230,0.12);'}
				onclick={() => (useArchive = false)}
			>
				<div class="font-medium">Custom pattern</div>
				<div class="text-[11px] opacity-60 mt-0.5">Override exam structure</div>
			</button>
		</div>

		{#if !useArchive}
			<div class="flex flex-wrap gap-2 mt-1">
				{#each PATTERNS as p}
					<button
						type="button"
						class="px-3 py-1.5 rounded-md text-xs border transition-all"
						style={patternOverride === p.value
							? 'background: rgba(139,92,246,0.18); color: var(--color-amber-soft); border-color: rgba(139,92,246,0.55);'
							: 'background: transparent; color: var(--color-parchment); border-color: rgba(245,239,230,0.12);'}
						onclick={() => (patternOverride = p.value)}
					>
						{p.label}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Number of exercises -->
	<div class="flex flex-col gap-2">
		<label for="ef-n-exercises" class="text-xs uppercase tracking-[0.18em] text-parchment/60">
			Number of exercises · <span class="mono text-parchment" dir="ltr">{nExercises}</span>
		</label>
		<input
			id="ef-n-exercises"
			type="range"
			min="1" max="8"
			bind:value={nExercises}
			class="w-full"
			style="accent-color: var(--color-amber); direction: ltr;"
		/>
	</div>

	<!-- Overrides -->
	<div class="grid grid-cols-2 gap-3">
		<div class="flex flex-col gap-1">
			<label for="ef-duration" class="text-xs uppercase tracking-[0.18em] text-parchment/60">
				Duration (min) <span class="normal-case opacity-50">(optional)</span>
			</label>
			<input
				id="ef-duration"
				type="number"
				min="15" max="300"
				placeholder="auto"
				bind:value={durationMinutes}
				class="px-3 py-2 rounded-md bg-transparent border text-sm placeholder:text-parchment/30 focus:outline-none"
				style="border-color: rgba(245,239,230,0.15); color: var(--color-parchment);"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="ef-total-points" class="text-xs uppercase tracking-[0.18em] text-parchment/60">
				Total points <span class="normal-case opacity-50">(optional)</span>
			</label>
			<input
				id="ef-total-points"
				type="number"
				min="1"
				placeholder="auto"
				bind:value={totalPoints}
				class="px-3 py-2 rounded-md bg-transparent border text-sm placeholder:text-parchment/30 focus:outline-none"
				style="border-color: rgba(245,239,230,0.15); color: var(--color-parchment);"
			/>
		</div>
		<div class="flex flex-col gap-1 col-span-2">
			<label for="ef-level" class="text-xs uppercase tracking-[0.18em] text-parchment/60">Difficulty level</label>
			<select
				id="ef-level"
				bind:value={targetLevel}
				class="px-3 py-2 rounded-md bg-transparent border text-sm focus:outline-none"
				style="border-color: rgba(245,239,230,0.15); color: var(--color-parchment); background: var(--color-ink);"
			>
				{#each LEVELS as l}
					<option value={l}>{l}</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- Topic -->
	<div class="flex flex-col gap-1">
		<label for="ef-topic" class="text-xs uppercase tracking-[0.18em] text-parchment/60">
			Topic <span class="normal-case opacity-50">(optional)</span>
		</label>
		<input
			id="ef-topic"
			type="text"
			bind:value={topic}
			placeholder="e.g. semaphores, binary trees…"
			class="px-3 py-2 rounded-md bg-transparent border text-sm placeholder:text-parchment/30 focus:outline-none"
			style="border-color: rgba(245,239,230,0.15); color: var(--color-parchment);"
		/>
	</div>

	<button
		type="submit"
		{disabled}
		class="mt-1 py-3 rounded-lg serif text-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed amber-ring"
		style="background: var(--color-amber); color: var(--color-ink);"
	>
		{disabled ? 'Generating…' : 'Generate Full Exam'}
	</button>
</form>

<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchSubjects, streamGenerate, streamGenerateExam } from '$lib/api';
	import type {
		AssembledExam,
		AssembledExercise,
		EvaluationResult,
		ExamPlanEvent,
		ExampleEvent,
		Exercise,
		GenerateExamRequest,
		GenerateRequest,
		GeneratedQuestion,
		MCQ,
		SAQ,
		StatusEvent,
		SubjectSummary
	} from '$lib/types';
	import { isDemoMode, DEMO_SUBJECTS, getDemoLabel } from '$lib/demo';
	import GeneratorForm from '$lib/components/GeneratorForm.svelte';
	import ExamForm from '$lib/components/ExamForm.svelte';
	import ExamView from '$lib/components/ExamView.svelte';
	import ActivityFeed from '$lib/components/ActivityFeed.svelte';
	import QuestionCard from '$lib/components/QuestionCard.svelte';
	import SAQCard from '$lib/components/SAQCard.svelte';
	import ExerciseCard from '$lib/components/ExerciseCard.svelte';
	import ParseUpload from '$lib/components/ParseUpload.svelte';

	let subjects = $state<SubjectSummary[]>([]);
	let model = $state('');
	let loading = $state(true);
	let error = $state<string | null>(null);
	let demoMode = $state(false);

	// Mode toggle
	let mode = $state<'questions' | 'exam' | 'upload'>('questions');

	// Questions mode
	let streaming = $state(false);
	let status = $state<StatusEvent | null>(null);
	let examples = $state<ExampleEvent[]>([]);
	let questions = $state<GeneratedQuestion[]>([]);
	let evaluations = $state<Record<number, EvaluationResult>>({});
	let targetCount = $state(0);
	let currentSubject = $state('');
	let controller: AbortController | null = null;
	const done = $derived(!streaming && questions.length > 0);

	// Exam mode
	let examStreaming = $state(false);
	let examStatus = $state<StatusEvent | null>(null);
	let examPlan = $state<ExamPlanEvent | null>(null);
	let examExercises = $state<AssembledExercise[]>([]);
	let examFinal = $state<AssembledExam | null>(null);
	let examController: AbortController | null = null;

	const STORE_KEY = 'exam-forge-state';

	onMount(async () => {
		demoMode = isDemoMode();

		// Restore persisted state
		try {
			const raw = localStorage.getItem(STORE_KEY);
			if (raw) {
				const saved = JSON.parse(raw);
				if (saved.mode === 'questions' && saved.questions?.length) {
					mode = 'questions';
					questions = saved.questions;
					currentSubject = saved.subject ?? '';
					targetCount = saved.questions.length;
				} else if (saved.mode === 'exam' && saved.examExercises?.length) {
					mode = 'exam';
					examPlan = saved.examPlan ?? null;
					examExercises = saved.examExercises;
					examFinal = saved.examFinal ?? null;
				}
			}
		} catch { /* ignore */ }

		try {
			const res = await fetchSubjects();
			model = res.model;

			if (demoMode) {
				// In demo mode: keep only subjects that have real data, apply demo display names
				subjects = DEMO_SUBJECTS
					.filter((d) => res.subjects.some((s) => s.subject === d.subject))
					.map((d) => {
						const real = res.subjects.find((s) => s.subject === d.subject)!;
						return { ...real, displayName: d.displayName } as SubjectSummary & { displayName: string };
					});
			} else {
				subjects = res.subjects;
			}
		} catch (e) {
			error = `Failed to load subjects: ${(e as Error).message}. Is the server running?`;
		} finally {
			loading = false;
		}
	});

	// Persist state whenever results change
	$effect(() => {
		if (questions.length > 0 && !streaming) {
			try {
				localStorage.setItem(STORE_KEY, JSON.stringify({
					mode: 'questions', questions, subject: currentSubject
				}));
			} catch { /* ignore */ }
		}
	});

	$effect(() => {
		if (examExercises.length > 0 && !examStreaming) {
			try {
				localStorage.setItem(STORE_KEY, JSON.stringify({
					mode: 'exam', examPlan, examExercises, examFinal
				}));
			} catch { /* ignore */ }
		}
	});

	function newGeneration() {
		controller?.abort();
		examController?.abort();
		questions = [];
		evaluations = {};
		examples = [];
		status = null;
		examPlan = null;
		examExercises = [];
		examFinal = null;
		examStatus = null;
		error = null;
		try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
	}

	async function start(req: GenerateRequest) {
		controller?.abort();
		controller = new AbortController();
		streaming = true;
		error = null;
		status = null;
		examples = [];
		questions = [];
		evaluations = {};
		targetCount = req.count;
		currentSubject = req.subject;

		try {
			for await (const ev of streamGenerate(req, controller.signal)) {
				switch (ev.type) {
					case 'status':
						status = ev.data;
						break;
					case 'example':
						examples = [...examples, ev.data];
						break;
					case 'question':
						questions = [
							...questions,
							ev.data.type === 'MCQ'
								? { type: 'MCQ', data: ev.data.data as MCQ }
								: ev.data.type === 'SAQ'
									? { type: 'SAQ', data: ev.data.data as SAQ }
									: { type: 'Exercise', data: ev.data.data as Exercise }
						];
						break;
					case 'evaluation':
						evaluations = { ...evaluations, [ev.data.idx]: ev.data.result };
						break;
					case 'error':
						error = ev.data.message;
						break;
					case 'done':
						status = null;
						break;
				}
			}
		} catch (e) {
			if ((e as Error).name !== 'AbortError') {
				error = `Stream failed: ${(e as Error).message}`;
			}
		} finally {
			streaming = false;
		}
	}

	function stop() {
		controller?.abort();
	}

	async function startExam(req: GenerateExamRequest) {
		examController?.abort();
		examController = new AbortController();
		examStreaming = true;
		error = null;
		examStatus = null;
		examPlan = null;
		examExercises = [];
		examFinal = null;

		try {
			for await (const ev of streamGenerateExam(req, examController.signal)) {
				switch (ev.type) {
					case 'plan':
						examPlan = ev.data;
						break;
					case 'status':
						examStatus = ev.data;
						break;
					case 'exercise':
						examExercises = [...examExercises, ev.data.exercise];
						break;
					case 'done':
						examFinal = ev.data.exam;
						examStatus = null;
						break;
					case 'error':
						error = ev.data.message;
						break;
				}
			}
		} catch (e) {
			if ((e as Error).name !== 'AbortError')
				error = `Stream failed: ${(e as Error).message}`;
		} finally {
			examStreaming = false;
		}
	}

	function stopExam() {
		examController?.abort();
	}

	const LETTERS = ['A', 'B', 'C', 'D'];

	function openBuilder() {
		sessionStorage.setItem('exam-build', JSON.stringify({ questions, subject: currentSubject }));
		window.location.href = '/build';
	}

</script>

<main class="min-h-screen px-6 lg:px-10 py-10 max-w-[1400px] mx-auto">
	<header class="mb-10 flex items-end justify-between gap-6 flex-wrap">
		<div>
			<p class="mono text-xs tracking-[0.3em] uppercase" style="color: var(--color-amber);">
				Exam Forge · AI Exam Generator
			</p>
			<h1 class="serif text-5xl leading-[1.15] mt-2">
				Learn your professor's style.<br />
				<span style="color: var(--color-amber-soft);">Generate new exams.</span>
			</h1>
			<p class="mt-3 text-parchment/60 max-w-xl leading-relaxed">
				An AI agent that reads labeled past exam questions, mimics the professor's voice and
				cognitive level, then produces new MCQs, short-answer questions, or structured exercises —
				schema-validated and streamed card by card in real time.
			</p>
		</div>
	</header>

	{#if loading}
		<p class="text-parchment/60">Loading subjects…</p>
	{:else if subjects.length === 0}
		<div
			class="parchment-card rounded-2xl p-6"
			style="border-color: rgba(196,84,45,0.4);"
		>
			<p class="serif text-lg mb-2">No subjects found</p>
			<p class="text-sm text-parchment/70">
				The data folder appears to be empty. See README for <span class="mono">backend/data/</span> structure.
			</p>
			{#if error}<p class="mt-2 text-sm" style="color: var(--color-amber-soft);">{error}</p>{/if}
		</div>
	{:else}
		<!-- Mode toggle + New Generation -->
		<div class="flex gap-2 mb-6 items-center flex-wrap">
			{#each [{ v: 'questions', label: 'Questions' }, { v: 'exam', label: 'Full Exam' }, { v: 'upload', label: 'Upload PDF' }] as tab}
				<button
					type="button"
					class="px-5 py-2 rounded-lg text-sm font-medium border transition-all"
					style={mode === tab.v
						? 'background: var(--color-amber); color: var(--color-ink); border-color: var(--color-amber);'
						: 'background: transparent; color: var(--color-parchment); border-color: rgba(245,239,230,0.15);'}
					onclick={() => (mode = tab.v as 'questions' | 'exam' | 'upload')}
				>
					{tab.label}
				</button>
			{/each}
			{#if (mode === 'questions' && questions.length > 0) || (mode === 'exam' && examExercises.length > 0)}
				<button
					type="button"
					class="ms-auto text-xs px-4 py-2 rounded-lg border transition-all"
					style="border-color: rgba(77,196,176,0.35); color: var(--color-teal);"
					onclick={newGeneration}
				>← New Generation</button>
			{/if}
		</div>

		<div class="grid lg:grid-cols-[400px_1fr] gap-6 items-start">
			<!-- Form + activity -->
			<div class="flex flex-col gap-5 lg:sticky lg:top-6">
				{#if mode === 'questions'}
					<GeneratorForm {subjects} {model} disabled={streaming} onSubmit={start} />
					<ActivityFeed {status} {examples} {error} />
					{#if streaming}
						<button
							type="button"
							class="text-xs self-start px-3 py-1.5 rounded-md border text-parchment/70 hover:text-parchment"
							style="border-color: rgba(245,239,230,0.15);"
							onclick={stop}
						>
							Stop generation
						</button>
					{/if}
				{:else if mode === 'exam'}
					<ExamForm {subjects} {model} disabled={examStreaming} onSubmit={startExam} />
					<ActivityFeed status={examStatus} examples={[]} {error} />
					{#if examStreaming}
						<button
							type="button"
							class="text-xs self-start px-3 py-1.5 rounded-md border text-parchment/70 hover:text-parchment"
							style="border-color: rgba(245,239,230,0.15);"
							onclick={stopExam}
						>
							Stop generation
						</button>
					{/if}
				{:else}
					<ParseUpload {subjects} />
				{/if}
			</div>

			<!-- Results -->
			<section class="flex flex-col gap-4">
				{#if mode === 'upload'}
					<div
						class="parchment-card rounded-2xl p-10 text-center"
						style="border-style: dashed; border-color: rgba(245,239,230,0.12);"
					>
						<p class="serif text-2xl mb-2">Parsed questions will be added to the dataset</p>
						<p class="text-sm text-parchment/60">
							After parsing completes, the new JSON file is saved directly to the subject folder and becomes available for generation.
						</p>
					</div>
				{:else if mode === 'exam'}
					<ExamView
						plan={examPlan}
						exercises={examExercises}
						exam={examFinal}
						streaming={examStreaming}
					/>
				{:else}
					{#if questions.length === 0 && !streaming}
						<div
							class="parchment-card rounded-2xl p-10 text-center"
							style="border-style: dashed; border-color: rgba(245,239,230,0.12);"
						>
							<p class="serif text-2xl mb-2">Your questions will appear here</p>
							<p class="text-sm text-parchment/60">
								Each card appears after schema validation.
							</p>
						</div>
					{/if}

					{#each questions as q, i (i)}
						{#if q.type === 'MCQ'}
							<QuestionCard mcq={q.data} idx={i} total={targetCount || questions.length} evaluation={evaluations[i] ?? null} subject={currentSubject} />
						{:else if q.type === 'SAQ'}
							<SAQCard saq={q.data} idx={i} total={targetCount || questions.length} evaluation={evaluations[i] ?? null} subject={currentSubject} />
						{:else}
							<ExerciseCard exercise={q.data} idx={i} total={targetCount || questions.length} evaluation={evaluations[i] ?? null} subject={currentSubject} />
						{/if}
					{/each}

					{#if streaming && questions.length < targetCount}
						<div
							class="parchment-card rounded-2xl p-6 flex items-center gap-3"
							style="border-style: dashed;"
						>
							<span
								class="inline-block w-2 h-2 rounded-full animate-pulse"
								style="background: var(--color-amber);"
							></span>
							<span class="text-sm text-parchment/70">
								Preparing question {questions.length + 1} of {targetCount}…
							</span>
						</div>
					{/if}

					{#if done}
						<div class="mt-4">
							<button
								type="button"
								onclick={openBuilder}
								class="text-sm px-6 py-3 rounded-xl font-semibold transition-all w-full"
								style="background: var(--color-amber); color: var(--color-parchment);"
							>Open in Document Builder →</button>
						</div>
					{/if}
				{/if}
			</section>
		</div>
	{/if}

	<footer
		class="mt-14 pt-6 border-t text-xs text-parchment/40 flex justify-between flex-wrap gap-2"
		style="border-color: rgba(245,239,230,0.08);"
	>
		<span>Schema-validated · DeepSeek V4 Flash via OpenRouter</span>
		<span class="mono">exam-forge</span>
	</footer>
</main>

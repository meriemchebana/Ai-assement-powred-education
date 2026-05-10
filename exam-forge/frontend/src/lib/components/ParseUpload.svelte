<script lang="ts">
	import { streamParse } from '$lib/api';
	import type { ParseDoneEvent, ParsePhase, ParseStatusEvent, SubjectSummary } from '$lib/types';

	let { subjects }: { subjects: SubjectSummary[] } = $props();

	let selectedSubject = $state(subjects[0]?.subject ?? '');
	let file = $state<File | null>(null);
	let dragging = $state(false);
	let parsing = $state(false);
	let controller: AbortController | null = null;

	let steps = $state<ParseStatusEvent[]>([]);
	let result = $state<ParseDoneEvent | null>(null);
	let error = $state<string | null>(null);

	const PHASE_LABELS: Record<ParsePhase, string> = {
		converting: 'PDF → Markdown',
		extracting: 'LLM Extraction',
		validating: 'Quality Check',
		classifying: "Bloom's Levels",
		vision: 'Visual Diagrams',
		saving: 'Saving',
	};

	const PHASE_ORDER: ParsePhase[] = ['converting', 'extracting', 'validating', 'classifying', 'vision', 'saving'];

	// Which phase is currently active (last seen)
	const activePhase = $derived(steps.length ? steps[steps.length - 1].phase : null);

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const f = e.dataTransfer?.files[0];
		if (f?.name.endsWith('.pdf')) file = f;
	}

	function onFileInput(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		file = input.files?.[0] ?? null;
	}

	async function start() {
		if (!file || !selectedSubject) return;
		controller?.abort();
		controller = new AbortController();
		parsing = true;
		steps = [];
		result = null;
		error = null;

		try {
			for await (const ev of streamParse(file, selectedSubject, controller.signal)) {
				if (ev.type === 'status') {
					// Deduplicate: update last step if same phase, else append
					if (steps.length && steps[steps.length - 1].phase === ev.data.phase) {
						steps = [...steps.slice(0, -1), ev.data];
					} else {
						steps = [...steps, ev.data];
					}
				} else if (ev.type === 'done') {
					result = ev.data;
				} else if (ev.type === 'error') {
					error = ev.data.message;
				}
			}
		} catch (e) {
			if ((e as Error).name !== 'AbortError')
				error = `Connection failed: ${(e as Error).message}`;
		} finally {
			parsing = false;
		}
	}

	function stop() {
		controller?.abort();
	}

	function reset() {
		controller?.abort();
		file = null;
		steps = [];
		result = null;
		error = null;
		parsing = false;
	}

	function confidenceColor(c: number) {
		if (c >= 0.8) return 'var(--color-teal)';
		if (c >= 0.5) return 'var(--color-amber)';
		return '#f87171';
	}
</script>

<div class="parchment-card rounded-2xl p-5 flex flex-col gap-5">
	<h3 class="serif text-lg">Upload PDF for Parsing</h3>

	<!-- Subject selector -->
	<div class="flex flex-col gap-1.5">
		<label class="text-xs uppercase tracking-[0.15em] text-parchment/50" for="parse-subject">Subject</label>
		<select
			id="parse-subject"
			class="w-full rounded-lg px-3 py-2 text-sm border"
			style="background: rgba(245,239,230,0.04); border-color: rgba(245,239,230,0.15); color: var(--color-parchment);"
			bind:value={selectedSubject}
			disabled={parsing}
		>
			{#each subjects as s}
				<option value={s.subject}>{s.subject}</option>
			{/each}
		</select>
	</div>

	<!-- Drop zone -->
	{#if !file}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-10 px-4 text-center cursor-pointer transition-all"
			style="border-color: {dragging ? 'var(--color-amber)' : 'rgba(245,239,230,0.15)'}; background: {dragging ? 'rgba(212,162,80,0.06)' : 'transparent'};"
			ondragover={(e) => { e.preventDefault(); dragging = true; }}
			ondragleave={() => (dragging = false)}
			ondrop={onDrop}
			onclick={() => (document.getElementById('pdf-input') as HTMLInputElement)?.click()}
			onkeydown={(e) => e.key === 'Enter' && (document.getElementById('pdf-input') as HTMLInputElement)?.click()}
		>
			<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-parchment/30">
				<path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
			<p class="text-sm text-parchment/60">Drop a PDF here or <span style="color: var(--color-amber);">click to browse</span></p>
			<input id="pdf-input" type="file" accept=".pdf" class="hidden" onchange={onFileInput} />
		</div>
	{:else}
		<!-- File selected -->
		<div class="flex items-center gap-3 rounded-lg px-4 py-3 border" style="border-color: rgba(245,239,230,0.12); background: rgba(245,239,230,0.03);">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--color-amber); flex-shrink:0;">
				<path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
			<div class="flex-1 min-w-0">
				<p class="text-sm font-medium truncate">{file.name}</p>
				<p class="text-xs text-parchment/50">{(file.size / 1024).toFixed(0)} KB</p>
			</div>
			{#if !parsing}
				<button type="button" onclick={reset} class="text-xs text-parchment/40 hover:text-parchment/70 transition-colors">✕</button>
			{/if}
		</div>
	{/if}

	<!-- Start / Stop -->
	{#if file && !result}
		<div class="flex gap-2">
			<button
				type="button"
				onclick={start}
				disabled={parsing || !selectedSubject}
				class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
				style="background: {parsing ? 'rgba(212,162,80,0.3)' : 'var(--color-amber)'}; color: var(--color-ink); opacity: {parsing ? 0.7 : 1};"
			>
				{parsing ? 'Parsing…' : 'Start Parsing'}
			</button>
			{#if parsing}
				<button
					type="button"
					onclick={stop}
					class="px-4 py-2.5 rounded-xl text-sm border transition-all"
					style="border-color: rgba(245,239,230,0.15); color: var(--color-parchment)/70;"
				>Stop</button>
			{/if}
		</div>
	{/if}

	<!-- Progress steps -->
	{#if steps.length > 0}
		<div class="flex flex-col gap-2">
			<p class="text-xs uppercase tracking-[0.15em] text-parchment/50">Progress</p>
			<ol class="flex flex-col gap-1.5">
				{#each PHASE_ORDER as phase}
					{@const step = steps.find(s => s.phase === phase)}
					{@const isActive = activePhase === phase && parsing}
					{@const isDone = step !== undefined && !(isActive)}
					{@const isPending = !step && !isDone}
					<li class="flex items-start gap-3 text-sm">
						<!-- Icon -->
						<span class="mt-0.5 w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full text-[10px] font-bold"
							style="background: {isActive ? 'rgba(212,162,80,0.2)' : isDone ? 'rgba(77,196,176,0.15)' : 'rgba(245,239,230,0.05)'}; color: {isActive ? 'var(--color-amber)' : isDone ? 'var(--color-teal)' : 'var(--color-parchment)/30'};"
						>
							{#if isActive}
								<span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background: var(--color-amber);"></span>
							{:else if isDone}
								✓
							{:else}
								·
							{/if}
						</span>
						<!-- Label + message -->
						<div class="flex-1 min-w-0">
							<span style="color: {isActive ? 'var(--color-amber)' : isDone ? 'var(--color-parchment)' : 'rgba(245,239,230,0.3)'};">
								{PHASE_LABELS[phase]}
							</span>
							{#if step}
								<p class="text-xs mt-0.5" style="color: rgba(245,239,230,0.5);">{step.message}</p>
							{/if}
						</div>
					</li>
				{/each}
			</ol>
		</div>
	{/if}

	<!-- Error -->
	{#if error}
		<div class="text-sm rounded-md px-3 py-2" style="background: rgba(196,84,45,0.15); color: #f5c57e; border: 1px solid rgba(196,84,45,0.4);">
			{error}
		</div>
	{/if}

	<!-- Result card -->
	{#if result}
		<div class="rounded-xl border p-4 flex flex-col gap-3" style="border-color: rgba(77,196,176,0.3); background: rgba(77,196,176,0.05);">
			<div class="flex items-center justify-between">
				<p class="text-sm font-semibold" style="color: var(--color-teal);">Parsing Complete</p>
				<button type="button" onclick={reset} class="text-xs text-parchment/40 hover:text-parchment/70">Parse another</button>
			</div>
			<div class="grid grid-cols-3 gap-3 text-center">
				<div>
					<p class="text-2xl font-bold mono" style="color: {confidenceColor(result.confidence)};">{(result.confidence * 100).toFixed(0)}%</p>
					<p class="text-xs text-parchment/50 mt-0.5">Quality</p>
				</div>
				<div>
					<p class="text-2xl font-bold mono" style="color: var(--color-parchment);">{result.exercises}</p>
					<p class="text-xs text-parchment/50 mt-0.5">Exercises</p>
				</div>
				<div>
					<p class="text-2xl font-bold mono" style="color: var(--color-parchment);">{result.questions}</p>
					<p class="text-xs text-parchment/50 mt-0.5">Questions</p>
				</div>
			</div>
			{#if result.needs_review}
				<p class="text-xs rounded-md px-3 py-2" style="background: rgba(212,162,80,0.1); color: var(--color-amber); border: 1px solid rgba(212,162,80,0.25);">
					⚠ Low confidence — manual review recommended before using for generation
				</p>
			{/if}
		</div>
	{/if}
</div>

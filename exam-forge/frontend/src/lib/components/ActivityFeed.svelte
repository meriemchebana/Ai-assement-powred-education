<script lang="ts">
	import type { ExampleEvent, StatusEvent } from '../types';
	import { fly } from 'svelte/transition';

	let {
		status,
		examples,
		error
	}: {
		status: StatusEvent | null;
		examples: ExampleEvent[];
		error: string | null;
	} = $props();

	let open = $state(true);

	const LEVEL_LABELS: Record<string, string> = {
		Procedural: 'Procedural',
		Conceptual: 'Conceptual',
		Metacognitive: 'Metacognitive'
	};

	function statusText(s: StatusEvent, exampleCount: number): string {
		if (s.phase === 'studying') {
			return exampleCount
				? `Studying ${exampleCount} past questions…`
				: 'Reading past questions…';
		}
		return 'Generating questions…';
	}
</script>

<div class="parchment-card rounded-2xl p-5 flex flex-col gap-4">
	<div class="flex items-baseline justify-between gap-4">
		<h3 class="serif text-lg">Agent Activity</h3>
		{#if examples.length}
			<button
				type="button"
				class="text-xs text-parchment/60 hover:text-parchment"
				onclick={() => (open = !open)}
			>
				{open ? 'Hide examples' : 'Show examples'}
			</button>
		{/if}
	</div>

	{#if status}
		<div class="flex items-center gap-3">
			<span
				class="inline-block w-2.5 h-2.5 rounded-full animate-pulse"
				style="background: var(--color-amber);"
			></span>
			<span class="text-sm">{statusText(status, examples.length)}</span>
		</div>
	{:else if !examples.length}
		<p class="text-sm text-parchment/50">Ready. Fill the form to start generation.</p>
	{/if}

	{#if error}
		<div
			class="text-sm rounded-md px-3 py-2"
			style="background: rgba(196,84,45,0.15); color: #f5c57e; border: 1px solid rgba(196,84,45,0.4);"
			transition:fly={{ y: 6, duration: 200 }}
		>
			{error}
		</div>
	{/if}

	{#if open && examples.length}
		<div class="flex flex-col gap-2">
			<p class="text-xs uppercase tracking-[0.18em] text-parchment/50">
				Style samples
				<span class="text-parchment/30" dir="ltr">· {examples.length}</span>
			</p>
			<ul class="flex flex-col gap-2">
				{#each examples as ex (ex.idx)}
					<li
						class="text-xs rounded-md border px-3 py-2"
						style="border-color: rgba(245,239,230,0.08); background: rgba(245,239,230,0.02);"
						transition:fly={{ y: 4, duration: 180 }}
					>
						<div class="flex items-center gap-2 mb-1 text-parchment/50">
							<span class="mono" dir="ltr">#{ex.idx + 1}</span>
							{#if ex.level}
								<span
									class="px-1.5 py-0.5 rounded-sm text-[10px]"
									style="background: rgba(139,92,246,0.1); color: var(--color-amber-soft);"
									>{LEVEL_LABELS[ex.level] ?? ex.level}</span
								>
							{/if}
							<span class="ms-auto truncate max-w-[60%] mono" dir="ltr">{ex.source}</span>
						</div>
						<p class="text-parchment/80 line-clamp-2">{ex.stem}</p>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<script lang="ts">
	import type { EvaluationResult } from '../types';
	import { slide } from 'svelte/transition';

	let { result }: { result: EvaluationResult | null } = $props();

	let expanded = $state(false);

	const VERDICT_STYLES: Record<string, string> = {
		pass:   'background: rgba(138,165,142,0.15); color: var(--color-sage); border-color: rgba(138,165,142,0.35);',
		flag:   'background: rgba(139,92,246,0.15);  color: var(--color-amber-soft); border-color: rgba(139,92,246,0.4);',
		reject: 'background: rgba(196,84,45,0.15);   color: #e07055; border-color: rgba(196,84,45,0.4);'
	};

	const VERDICT_ICONS: Record<string, string> = {
		pass:   '✓',
		flag:   '⚠',
		reject: '✗'
	};

	const VERDICT_LABELS: Record<string, string> = {
		pass:   'Pass',
		flag:   'Needs review',
		reject: 'Rejected'
	};

	const QUALITY_LABEL: Record<string, string> = {
		good:           'Good quality',
		needs_revision: 'Needs revision',
		reject:         'Rejected'
	};

	const CALIBRATION_LABEL: Record<string, string> = {
		too_low:  'Points too low',
		fair:     'Points fair',
		too_high: 'Points too high',
	};

	const CALIBRATION_COLOR: Record<string, string> = {
		too_low:  '#e07055',
		fair:     'var(--color-sage)',
		too_high: 'var(--color-amber-soft)',
	};
</script>

{#if result}
	<div class="flex items-center gap-2 flex-wrap">
		<button
			type="button"
			class="text-[11px] px-2.5 py-1 rounded-md border font-medium flex items-center gap-1.5 transition-all"
			style={VERDICT_STYLES[result.verdict]}
			onclick={() => (expanded = !expanded)}
			title="Click to see evaluation details"
		>
			<span>{VERDICT_ICONS[result.verdict]}</span>
			<span>{VERDICT_LABELS[result.verdict]}</span>
		</button>

		{#if !result.level_correct && result.corrected_level}
			<span
				class="text-[11px] px-2 py-1 rounded-md border"
				style="background: rgba(139,92,246,0.08); color: var(--color-amber-soft); border-color: rgba(139,92,246,0.25);"
			>
				Suggested level: {result.corrected_level}
			</span>
		{/if}

		{#if !result.factual_ok}
			<span
				class="text-[11px] px-2 py-1 rounded-md border"
				style="background: rgba(196,84,45,0.08); color: #e07055; border-color: rgba(196,84,45,0.25);"
			>
				⚑ Possible factual error
			</span>
		{/if}

		{#if result.points_calibration !== 'fair'}
			<span
				class="text-[11px] px-2 py-1 rounded-md border"
				style="background: rgba(196,84,45,0.08); color: {CALIBRATION_COLOR[result.points_calibration]}; border-color: rgba(196,84,45,0.25);"
			>
				⚖ {CALIBRATION_LABEL[result.points_calibration]}
			</span>
		{/if}

		{#if !result.difficulty_ok}
			<span
				class="text-[11px] px-2 py-1 rounded-md border"
				style="background: rgba(139,92,246,0.08); color: var(--color-amber-soft); border-color: rgba(139,92,246,0.25);"
			>
				⚡ Difficulty mismatch
			</span>
		{/if}
	</div>

	{#if expanded}
		<div
			class="rounded-md border p-3 flex flex-col gap-2 text-sm"
			style="border-color: rgba(245,239,230,0.1); background: rgba(245,239,230,0.03);"
			transition:slide={{ duration: 180 }}
		>
			<p class="text-[10px] uppercase tracking-[0.18em] text-parchment/40">Evaluator report · gpt-oss-120b</p>

			<div class="flex flex-wrap gap-3 text-[11px]">
				<span style="color: {result.factual_ok ? 'var(--color-sage)' : '#e07055'}">
					{result.factual_ok ? '✓' : '✗'} Factual accuracy
				</span>
				<span style="color: {result.level_correct ? 'var(--color-sage)' : 'var(--color-amber-soft)'}">
					{result.level_correct ? '✓' : '⚠'} Cognitive level
				</span>
				<span style="color: {result.quality === 'good' ? 'var(--color-sage)' : result.quality === 'needs_revision' ? 'var(--color-amber-soft)' : '#e07055'}">
					{result.quality === 'good' ? '✓' : result.quality === 'needs_revision' ? '⚠' : '✗'} {QUALITY_LABEL[result.quality]}
				</span>
				<span style="color: {CALIBRATION_COLOR[result.points_calibration]}">
					{result.points_calibration === 'fair' ? '✓' : '⚠'} {CALIBRATION_LABEL[result.points_calibration]}
				</span>
				<span style="color: {result.difficulty_ok ? 'var(--color-sage)' : 'var(--color-amber-soft)'}">
					{result.difficulty_ok ? '✓' : '⚠'} Difficulty {result.difficulty_ok ? 'appropriate' : 'mismatch'}
				</span>
				{#if result.estimated_minutes}
					<span class="text-parchment/50">
						~{result.estimated_minutes} min
					</span>
				{/if}
			</div>

			{#if result.notes}
				<p class="text-parchment/70 leading-relaxed">{result.notes}</p>
			{/if}
		</div>
	{/if}
{:else}
	<span class="text-[11px] text-parchment/30 flex items-center gap-1.5">
		<span class="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style="background: var(--color-amber);"></span>
		Evaluating…
	</span>
{/if}

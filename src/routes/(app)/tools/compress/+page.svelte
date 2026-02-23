<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { setHeaderSlots, clearHeaderSlots } from '$lib/stores/page-header.svelte';
	import { ImageCompressor, tools } from '$lib/components/tools';

	const tool = tools.find((t) => t.key === 'compress')!;

	$effect(() => {
		setHeaderSlots({ left: headerLeft });
		return () => clearHeaderSlots();
	});
</script>

{#snippet headerLeft()}
	<div class="flex items-center gap-2.5">
		<button
			onclick={() => goto('/tools')}
			class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
		>
			<ArrowLeft class="h-4 w-4" />
		</button>
		<div class="flex items-center gap-2">
			<div class="flex h-7 w-7 items-center justify-center rounded-md {tool.iconBg}">
				<tool.icon class="h-3.5 w-3.5 {tool.iconColor}" />
			</div>
			<span class="text-sm font-medium">{tool.label}</span>
		</div>
	</div>
{/snippet}

<div class="relative flex h-full flex-col">
	<ImageCompressor />
</div>

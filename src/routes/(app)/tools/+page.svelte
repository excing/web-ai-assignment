<script lang="ts">
	import { goto } from '$app/navigation';
	import { tools } from '$lib/components/tools';
</script>

<div class="flex h-full flex-col">
	<div class="flex-1 overflow-y-auto">
		<div class="mx-auto max-w-2xl px-4 py-8 sm:px-6">
			<div class="mb-6">
				<h1 class="text-lg font-semibold">工具箱</h1>
				<p class="mt-1 text-sm text-muted-foreground">实用小工具合集</p>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{#each tools as tool (tool.key)}
					<button
						onclick={() => goto(`/tools/${tool.key}`)}
						class="group flex items-start gap-3.5 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/50"
					>
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {tool.iconBg}">
							<tool.icon class="h-5 w-5 {tool.iconColor}" />
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium group-hover:text-foreground">{tool.label}</p>
							<p class="mt-0.5 text-xs text-muted-foreground">{tool.description}</p>
						</div>
					</button>
				{/each}
			</div>
		</div>
	</div>
</div>

<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Sparkles, X } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { type ApiTemplate, extractPlaceholders, formatImageCountHint } from './types';

	interface Props {
		templates: ApiTemplate[];
		groupedTemplates: Record<string, ApiTemplate[]>;
		loading: boolean;
		selectedTemplate: ApiTemplate | null;
		placeholderValues: Record<string, string>;
		onSelectTemplate: (tpl: ApiTemplate) => void;
		onDeselectTemplate: () => void;
		onPlaceholderChange: (key: string, value: string) => void;
	}

	let {
		templates,
		groupedTemplates,
		loading,
		selectedTemplate,
		placeholderValues,
		onSelectTemplate,
		onDeselectTemplate,
		onPlaceholderChange,
	}: Props = $props();

	let placeholders = $derived(
		selectedTemplate ? extractPlaceholders(selectedTemplate.prompt) : []
	);
</script>

<div class="mx-auto max-w-2xl px-4 py-5 lg:max-w-3xl">
	<!-- Header -->
	<div class="mb-5">
		<h2 class="text-lg font-semibold tracking-tight text-foreground">创作模板</h2>
		<p class="mt-0.5 text-sm text-muted-foreground">选择一个模板快速开始，或直接输入你的描述</p>
	</div>

	{#if loading}
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
			{#each Array(6) as _}
				<Skeleton class="h-28 rounded-2xl" />
			{/each}
		</div>
	{:else if templates.length === 0}
		<div class="flex flex-col items-center py-12 text-center">
			<Sparkles class="h-10 w-10 text-muted-foreground/30" />
			<p class="mt-3 text-sm text-muted-foreground">暂无模板，请直接输入描述</p>
		</div>
	{:else}
		<!-- Placeholder inputs for selected template -->
		{#if selectedTemplate && placeholders.length > 0}
			<div
				class="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4"
				style="animation: fadeSlideIn 0.2s ease both;"
			>
				<div class="mb-3 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Avatar.Root class="rounded-lg">
							<Avatar.Image src={selectedTemplate.previewImageUrl} alt={selectedTemplate.name} />
							<Avatar.Fallback class="rounded-lg">
								<Sparkles class="h-4 w-4 text-muted-foreground" />
							</Avatar.Fallback>
						</Avatar.Root>
						<span class="text-sm font-medium">{selectedTemplate.name}</span>
					</div>
					<Button variant="ghost" size="icon-sm" class="h-6 w-6 rounded-full" onclick={onDeselectTemplate}>
						<X class="h-3.5 w-3.5" />
					</Button>
				</div>
				{#if selectedTemplate.description}
					<p class="mb-3 text-xs text-muted-foreground">{selectedTemplate.description}</p>
				{/if}
				<div class="space-y-2">
					{#each placeholders as placeholder}
						<div class="flex items-center gap-2">
							<span class="w-20 flex-shrink-0 text-right text-xs text-muted-foreground/80">{placeholder}</span>
							<Input
								value={placeholderValues[placeholder] ?? ''}
								oninput={(e) => onPlaceholderChange(placeholder, (e.target as HTMLInputElement).value)}
								placeholder={`输入${placeholder}`}
								class="h-8 text-sm"
							/>
						</div>
					{/each}
				</div>
				{#if formatImageCountHint(selectedTemplate.imageCountMin, selectedTemplate.imageCountMax)}
					<p class="mt-2 text-xs text-muted-foreground/60">
						{formatImageCountHint(selectedTemplate.imageCountMin, selectedTemplate.imageCountMax)}
					</p>
				{/if}
			</div>
		{/if}

		<!-- Template cards grouped by category -->
		{#each Object.entries(groupedTemplates) as [category, categoryTemplates], ci}
			<div class={ci > 0 ? 'mt-5' : ''}>
				{#if Object.keys(groupedTemplates).length > 1}
					<h3 class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">{category}</h3>
				{/if}
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
					{#each categoryTemplates as tpl, i}
						<button
							onclick={() => onSelectTemplate(tpl)}
							class={cn(
								'group relative flex flex-col items-start gap-2 rounded-2xl border bg-card p-3 text-left transition-all hover:shadow-sm active:scale-[0.97]',
								selectedTemplate?.id === tpl.id
									? 'border-primary/40 bg-primary/5 shadow-sm'
									: 'border-border/50 hover:border-border hover:bg-accent/50'
							)}
							style="animation: fadeSlideIn 0.3s ease both; animation-delay: {(ci * 4 + i) * 30}ms;"
						>
							{#if tpl.previewImageUrl}
								<div class="w-full overflow-hidden rounded-xl">
									<img
										src={tpl.previewImageUrl}
										alt={tpl.name}
										class="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
									/>
								</div>
							{:else}
								<Avatar.Root class="h-9 w-9 rounded-xl transition-transform group-hover:scale-110">
									<Avatar.Fallback class="rounded-xl bg-muted/70">
										<Sparkles class="h-[18px] w-[18px] text-muted-foreground" />
									</Avatar.Fallback>
								</Avatar.Root>
							{/if}
							<div class="w-full">
								<p class="text-sm font-medium text-foreground">{tpl.name}</p>
								{#if tpl.description}
									<p class="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground/70">{tpl.description}</p>
								{:else}
									<p class="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground/70">{tpl.prompt}</p>
								{/if}
							</div>
							{#if tpl.isPinned}
								<div class="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
									<Sparkles class="h-3 w-3 text-primary" />
								</div>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>

<style>
	@keyframes fadeSlideIn {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>

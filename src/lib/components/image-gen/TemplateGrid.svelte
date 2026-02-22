<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as Select from '$lib/components/ui/select';
	import { Sparkles } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import type { ApiTemplate } from './types';

	interface Props {
		templates: ApiTemplate[];
		categories: string[];
		selectedCategory: string | null;
		onSelectCategory: (cat: string | null) => void;
		loading: boolean;
		selectedTemplate: ApiTemplate | null;
		onSelectTemplate: (tpl: ApiTemplate) => void;
	}

	let {
		templates,
		categories,
		selectedCategory,
		onSelectCategory,
		loading,
		selectedTemplate,
		onSelectTemplate,
	}: Props = $props();

	let showFilter = $derived(categories.length > 1);
</script>

<div class="mx-auto max-w-2xl px-4 py-5 lg:max-w-3xl">
	<!-- Header -->
	<div class="mb-5 flex items-center justify-between gap-4">
		<div>
			<h2 class="text-lg font-semibold tracking-tight text-foreground">创作模板</h2>
			<p class="mt-0.5 text-sm text-muted-foreground">选择一个模板快速开始，或直接输入你的描述</p>
		</div>
		{#if showFilter}
			<Select.Root
				type="single"
				value={selectedCategory ?? ''}
				onValueChange={(v) => onSelectCategory(v || null)}
			>
				<Select.Trigger class="h-8 w-auto min-w-24 gap-1 px-2.5 text-xs">
					{selectedCategory ?? '全部'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="" label="全部" />
					{#each categories as cat}
						<Select.Item value={cat} label={cat} />
					{/each}
				</Select.Content>
			</Select.Root>
		{/if}
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
		<!-- Template cards -->
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
			{#each templates as tpl, i}
				<button
					onclick={() => onSelectTemplate(tpl)}
					class={cn(
						'group relative aspect-[1/1] overflow-hidden rounded-2xl border text-left transition-all hover:shadow-sm active:scale-[0.97]',
						selectedTemplate?.id === tpl.id
							? 'border-primary/40 shadow-sm ring-1 ring-primary/30'
							: 'border-border/50 hover:border-border'
					)}
					style="animation: fadeSlideIn 0.3s ease both; animation-delay: {i * 30}ms;"
				>
					<!-- Full-bleed image -->
					{#if tpl.previewImageUrl}
						<img
							src={tpl.previewImageUrl}
							alt={tpl.name}
							class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
						/>
					{:else}
						<div class="absolute inset-0 flex items-center justify-center bg-muted/70">
							<Sparkles class="h-8 w-8 text-muted-foreground/40" />
						</div>
					{/if}

					<!-- Bottom text overlay with backdrop blur -->
					<div class="absolute inset-x-0 bottom-0 bg-background/60 px-2.5 py-2 backdrop-blur-md">
						<p class="truncate text-sm font-medium text-foreground">{tpl.name}</p>
						{#if tpl.description}
							<p class="mt-0.5 line-clamp-1 text-xs leading-relaxed text-muted-foreground">{tpl.description}</p>
						{:else}
							<p class="mt-0.5 line-clamp-1 text-xs leading-relaxed text-muted-foreground">{tpl.prompt}</p>
						{/if}
					</div>

					<!-- Category badge & pinned indicator -->
					<div class="absolute right-1.5 top-1.5 flex items-center gap-1">
						<span class="rounded-full bg-background/60 px-1.5 py-0.5 text-[10px] leading-none text-foreground/80 backdrop-blur-md">{tpl.category}</span>
						{#if tpl.isPinned}
							<span class="flex h-5 w-5 items-center justify-center rounded-full bg-background/60 backdrop-blur-md">
								<Sparkles class="h-3 w-3 text-primary" />
							</span>
						{/if}
					</div>
				</button>
			{/each}
		</div>
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

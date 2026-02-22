<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import {
		Loader2,
		Download,
		Trash2,
		RefreshCw,
		X,
		Clock,
		Music,
		FileIcon,
		Copy,
		ClipboardCopy,
		Timer,
		AlertTriangle,
		Eraser,
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { taskManager, type GenerationTask } from '$lib/stores/image-gen/task-store.svelte';
	import type { MediaResource } from '$lib/types/media';

	interface Props {
		tasks: GenerationTask[];
		activeTasks: GenerationTask[];
		completedTasks: GenerationTask[];
		stats: { success: number };
		onSwitchToTemplates: () => void;
		onOpenGallery: (images: MediaResource[], index: number, caption?: string) => void;
		onDownloadImage: (data: string, filename: string, index: number) => void;
	}

	let {
		tasks,
		activeTasks,
		completedTasks,
		stats,
		onSwitchToTemplates,
		onOpenGallery,
		onDownloadImage,
	}: Props = $props();

	function previewsToMediaResources(previews: string[]): MediaResource[] {
		return previews.map((p, idx) => ({
			type: 'image' as const,
			data: p,
			filename: `参考图 ${idx + 1}`,
		}));
	}

	/** Merge input reference images + output images into a single gallery array */
	function mergedGallery(task: GenerationTask): MediaResource[] {
		const inputs = task.attachedPreviews ? previewsToMediaResources(task.attachedPreviews) : [];
		return [...inputs, ...task.mediaResources];
	}

	/** Get the offset for output images (= number of input images) */
	function inputCount(task: GenerationTask): number {
		return task.attachedPreviews?.length ?? 0;
	}

	/** Grid column class based on total count */
	function gridCols(count: number): string {
		if (count === 1) return 'grid-cols-1';
		return 'grid-cols-2';
	}

	/** Format duration between createdAt and completedAt */
	function formatDuration(task: GenerationTask): string | null {
		if (!task.completedAt) return null;
		const seconds = Math.round((task.completedAt - task.createdAt) / 1000);
		if (seconds < 1) return '耗时 <1s';
		return `耗时 ${seconds}s`;
	}

	async function copyPrompt(prompt: string) {
		try {
			await navigator.clipboard.writeText(prompt);
			toast.success('已复制提示词');
		} catch {
			toast.error('复制失败');
		}
	}
</script>

{#snippet downloadBtn(data: string, filename: string, index: number, variant: 'overlay' | 'inline')}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<button
					{...props}
					class="flex items-center justify-center rounded-full transition-colors {variant === 'overlay'
						? 'h-7 w-7 bg-white/15 text-white backdrop-blur-sm hover:bg-white/30'
						: 'h-7 w-7 flex-shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground'}"
					onclick={(e) => { if (variant === 'overlay') e.stopPropagation(); onDownloadImage(data, filename, index); }}
				>
					<Download class={variant === 'overlay' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
				</button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>下载</Tooltip.Content>
	</Tooltip.Root>
{/snippet}

{#snippet metaRefPreviews(task: GenerationTask)}
	{#if task.attachedPreviews && task.attachedPreviews.length > 0}
		<div class="flex flex-shrink-0 gap-1">
			{#each task.attachedPreviews as preview, i}
				<button
					onclick={() => onOpenGallery(mergedGallery(task), i, task.prompt)}
					class="overflow-hidden rounded-md border border-border/50 transition-opacity hover:opacity-80"
				>
					<img src={preview} alt="参考图 {i + 1}" class="h-6 w-6 object-cover" />
				</button>
			{/each}
		</div>
	{/if}
{/snippet}

{#if tasks.length === 0}
	<div class="flex h-full flex-col items-center justify-center px-4 pb-4">
		<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
			<Clock class="h-7 w-7 text-muted-foreground/40" />
		</div>
		<p class="mt-4 text-sm text-muted-foreground">还没有创作记录</p>
		<Button variant="link" class="mt-3 text-foreground/70 no-underline decoration-foreground/20 underline-offset-4 hover:text-foreground hover:underline hover:decoration-foreground/50" onclick={onSwitchToTemplates}>浏览模板开始创作</Button>
	</div>
{:else}
	<div class="mx-auto max-w-2xl space-y-3 p-4 pb-6 lg:max-w-3xl">
		<!-- Active tasks (loading / pending) -->
		{#if activeTasks.length > 0}
			<div class="space-y-3">
				{#each activeTasks as task (task.id)}
					<Card.Root class="gap-0 overflow-hidden rounded-2xl border-border/60 p-0 shadow-none">
						{#if task.status === 'loading'}
							<div class="relative aspect-[4/3] w-full overflow-hidden bg-muted/50 sm:aspect-[16/9]">
								<div class="shimmer absolute inset-0"></div>
								<div class="flex h-full flex-col items-center justify-center gap-3">
									<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/80 shadow-sm">
										<Loader2 class="h-5 w-5 animate-spin text-muted-foreground" />
									</div>
									<span class="text-sm text-muted-foreground">正在创作中...</span>
								</div>
							</div>
						{:else}
							<div class="flex items-center gap-3 px-4 py-5">
								<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
									<div class="h-2 w-2 rounded-full bg-amber-400 dark:bg-amber-500"></div>
								</div>
								<p class="min-w-0 flex-1 text-sm text-muted-foreground">排队等待中</p>
							</div>
						{/if}

						<!-- Bottom info bar -->
						<div class="flex items-center gap-3 border-t border-border/40 px-4 py-2.5">
							{#if task.attachedPreviews && task.attachedPreviews.length > 0}
								<div class="flex gap-1">
									{#each task.attachedPreviews as preview, i}
										<button
											onclick={() => onOpenGallery(previewsToMediaResources(task.attachedPreviews || []), i, task.prompt)}
											class="overflow-hidden rounded-md border transition-opacity hover:opacity-80"
										>
											<img src={preview} alt="参考图 {i + 1}" class="h-8 w-8 object-cover" />
										</button>
									{/each}
								</div>
							{/if}
							<p class="min-w-0 flex-1 truncate text-xs text-muted-foreground">{task.prompt}</p>
							<span class="flex-shrink-0 text-xs text-muted-foreground/60">
								{new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
							</span>
						</div>
					</Card.Root>
				{/each}
			</div>
		{/if}

		<!-- Completed / errored tasks -->
		{#if completedTasks.length > 0}
			{#if activeTasks.length > 0}
				<div class="flex items-center gap-3 pt-2">
					<Separator class="flex-1 bg-border/50" />
					<span class="text-xs text-muted-foreground/70">已完成 {stats.success}</span>
					<Separator class="flex-1 bg-border/50" />
				</div>
			{/if}

			<div class="space-y-4">
				{#each completedTasks as task (task.id)}
					{#if task.status === 'error'}
						<!-- Error card -->
						<Card.Root class="group gap-0 rounded-2xl border-destructive/20 px-4 py-3 shadow-none">
							<div class="flex items-start gap-3">
								<div class="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-destructive/10">
									<X class="h-3.5 w-3.5 text-destructive" />
								</div>
								<div class="min-w-0 flex-1">
									<p class="text-sm">{task.prompt}</p>
									<p class="mt-1 text-xs text-destructive/80">{task.error}</p>
								</div>
								<div class="flex items-center gap-1">
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<Button {...props} variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-foreground" onclick={() => taskManager.retryTask(task.id)}>
													<RefreshCw class="h-3.5 w-3.5" />
												</Button>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content>重试</Tooltip.Content>
									</Tooltip.Root>
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<Button {...props} variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-destructive" onclick={() => taskManager.deleteTask(task.id)}>
													<Trash2 class="h-3.5 w-3.5" />
												</Button>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content>删除</Tooltip.Content>
									</Tooltip.Root>
								</div>
							</div>
							<!-- Error card meta: duration + time -->
							{#if formatDuration(task)}
								<div class="mt-2 flex items-center justify-end gap-2 border-t border-destructive/10 pt-2">
									<span class="flex items-center gap-1 text-xs text-muted-foreground">
										<Timer class="h-3 w-3" />
										{formatDuration(task)}
									</span>
								</div>
							{/if}
						</Card.Root>
					{:else if task.mediaResources.length > 0}
						<!-- Success card (unified layout) -->
						<div class="group">
							<div class="grid {gridCols(task.mediaResources.length)} gap-1.5 sm:gap-2">
								{#each task.mediaResources as resource, index}
									{#if resource.type === 'image'}
										<div class="group/item relative overflow-hidden rounded-xl border border-border/30 bg-card {task.mediaResources.length === 3 && index === 0 ? 'row-span-2' : ''}">
											<button class="block h-full w-full" onclick={() => onOpenGallery(mergedGallery(task), inputCount(task) + index, task.prompt)}>
												<img
													src={resource.data}
													alt={resource.filename || `生成的图片 ${index + 1}`}
													class="h-full w-full object-cover transition-transform duration-500 group-hover/item:scale-105"
													style="aspect-ratio: {task.mediaResources.length === 3 && index === 0 ? '1/2' : task.mediaResources.length === 1 ? 'auto' : '1/1'}; {task.mediaResources.length === 1 ? 'max-height: 500px;' : 'min-height: 120px;'}"
												/>
											</button>
											<div class="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity duration-200 group-hover/item:opacity-100">
												<div class="pointer-events-auto p-2">
													{@render downloadBtn(resource.data, resource.filename || `image-${index + 1}.png`, index, 'overlay')}
												</div>
											</div>
										</div>
									{:else if resource.type === 'video'}
										<div class="group/item relative overflow-hidden rounded-xl border border-border/30 bg-card {task.mediaResources.length === 3 && index === 0 ? 'row-span-2' : ''}">
											<button class="block h-full w-full" aria-label="查看视频" onclick={() => onOpenGallery(mergedGallery(task), inputCount(task) + index, task.prompt)}>
												<video src={resource.data} class="h-full w-full object-cover transition-transform duration-500 group-hover/item:scale-105" style="aspect-ratio: {task.mediaResources.length === 1 ? 'auto' : '1/1'}; {task.mediaResources.length === 1 ? 'max-height: 500px;' : 'min-height: 120px;'}">
													<track kind="captions" />
												</video>
											</button>
											<div class="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity duration-200 group-hover/item:opacity-100">
												<div class="pointer-events-auto p-2">
													{@render downloadBtn(resource.data, resource.filename || `video-${index + 1}`, index, 'overlay')}
												</div>
											</div>
										</div>
									{:else if resource.type === 'audio'}
										<div class="col-span-full flex items-center gap-3 rounded-xl border border-border/30 bg-card px-3 py-2.5">
											<audio src={resource.data} controls class="mt-1 h-8 w-full" preload="metadata">
												<track kind="captions" />
											</audio>
										</div>
									{:else}
										<div class="col-span-full flex items-center gap-3 rounded-xl border border-border/30 bg-card px-3 py-2.5">
											<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
												<FileIcon class="h-4 w-4 text-muted-foreground" />
											</div>
											<p class="min-w-0 flex-1 truncate text-xs text-muted-foreground">{resource.filename || `文件 ${index + 1}`}</p>
											{@render downloadBtn(resource.data, resource.filename || `file-${index + 1}`, index, 'inline')}
										</div>
									{/if}
								{/each}
							</div>

							<!-- Bottom meta info -->
							<div class="mt-1.5 flex items-center gap-2 px-1">
								{@render metaRefPreviews(task)}
								<p class="min-w-0 flex-1 truncate text-xs text-muted-foreground">{task.prompt}</p>
								<span class="flex-shrink-0 text-xs text-muted-foreground/70">
									{new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
								</span>
								{#if formatDuration(task)}
									<span class="flex flex-shrink-0 items-center gap-1 text-xs text-muted-foreground/70">
										<Timer class="h-3 w-3" />
										{formatDuration(task)}
									</span>
								{/if}
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<button
												{...props}
												class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
												onclick={() => copyPrompt(task.prompt)}
											>
												<Copy class="h-3 w-3" />
											</button>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content>复制提示词</Tooltip.Content>
								</Tooltip.Root>
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<button
												{...props}
												class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
												onclick={() => taskManager.cloneTask(task.id)}
											>
												<ClipboardCopy class="h-3 w-3" />
											</button>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content>再来一次</Tooltip.Content>
								</Tooltip.Root>
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<button
												{...props}
												class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-muted hover:text-destructive"
												onclick={() => taskManager.deleteTask(task.id)}
											>
												<Trash2 class="h-3 w-3" />
											</button>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content>删除</Tooltip.Content>
								</Tooltip.Root>
							</div>
						</div>
					{:else}
						<!-- Empty-result anomaly card: success but no media returned -->
						<Card.Root class="group gap-0 rounded-2xl border-amber-500/20 px-4 py-3 shadow-none">
							<div class="flex items-start gap-3">
								<div class="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
									<AlertTriangle class="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
								</div>
								<div class="min-w-0 flex-1">
									<p class="text-sm">{task.prompt}</p>
									<p class="mt-1 text-xs text-amber-600/80 dark:text-amber-400/80">请求已完成，但未返回任何资源</p>
								</div>
								<div class="flex items-center gap-1">
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<Button {...props} variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-foreground" onclick={() => taskManager.retryTask(task.id)}>
													<RefreshCw class="h-3.5 w-3.5" />
												</Button>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content>重试</Tooltip.Content>
									</Tooltip.Root>
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<Button {...props} variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-destructive" onclick={() => taskManager.deleteTask(task.id)}>
													<Trash2 class="h-3.5 w-3.5" />
												</Button>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content>删除</Tooltip.Content>
									</Tooltip.Root>
								</div>
							</div>
							{#if formatDuration(task)}
								<div class="mt-2 flex items-center justify-end gap-2 border-t border-amber-500/10 pt-2">
									<span class="flex items-center gap-1 text-xs text-muted-foreground">
										<Timer class="h-3 w-3" />
										{formatDuration(task)}
									</span>
								</div>
							{/if}
						</Card.Root>
					{/if}
				{/each}
			</div>

			<!-- Clear completed button at bottom -->
			<div class="flex justify-center pt-2">
				<Button
					variant="ghost"
					size="sm"
					class="h-8 gap-1.5 text-xs text-muted-foreground/50 hover:text-destructive"
					onclick={() => taskManager.clearCompleted()}
				>
					<Eraser class="h-3.5 w-3.5" />
					清空记录
				</Button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.shimmer {
		background: linear-gradient(
			90deg,
			transparent 0%,
			var(--color-muted) 50%,
			transparent 100%
		);
		background-size: 200% 100%;
		animation: shimmer 2s ease-in-out infinite;
	}

	@keyframes shimmer {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}
</style>

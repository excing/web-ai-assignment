<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import {
		Loader2,
		ImageIcon,
		Download,
		Trash2,
		RefreshCw,
		X,
		Clock,
	} from 'lucide-svelte';
	import { taskManager, type GenerationTask, type MediaResource } from '$lib/stores/task-manager.svelte';

	interface Props {
		tasks: GenerationTask[];
		activeTasks: GenerationTask[];
		completedTasks: GenerationTask[];
		stats: { success: number };
		onSwitchToTemplates: () => void;
		onOpenGallery: (images: MediaResource[], index: number) => void;
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
</script>

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
											onclick={() => onOpenGallery(previewsToMediaResources(task.attachedPreviews || []), i)}
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
					<div class="flex items-center gap-2">
						<span class="text-xs text-muted-foreground/70">已完成 {stats.success}</span>
						<Button variant="link" size="sm" class="h-auto p-0 text-xs text-muted-foreground/50 no-underline hover:text-foreground hover:underline" onclick={() => taskManager.clearCompleted()}>清空</Button>
					</div>
					<Separator class="flex-1 bg-border/50" />
				</div>
			{:else if stats.success > 0}
				<div class="flex items-center justify-end px-1">
					<Button variant="link" size="sm" class="h-auto p-0 text-xs text-muted-foreground/60 no-underline hover:text-foreground hover:underline" onclick={() => taskManager.clearCompleted()}>清空已完成</Button>
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
												<Button {...props} variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive" onclick={() => taskManager.deleteTask(task.id)}>
													<Trash2 class="h-3.5 w-3.5" />
												</Button>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content>删除</Tooltip.Content>
									</Tooltip.Root>
								</div>
							</div>
						</Card.Root>
					{:else if task.mediaResources.length > 0}
						<!-- Success card -->
						<div class="group">
							{#if task.mediaResources.length === 1}
								{@const resource = task.mediaResources[0]}
								<Card.Root class="gap-0 overflow-hidden rounded-2xl border-border/40 p-0 shadow-none">
									<button class="block w-full" onclick={() => onOpenGallery(task.mediaResources, 0)}>
										{#if resource.type === 'image'}
											<img
												src={resource.data}
												alt={resource.filename || '生成的图片'}
												class="w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
												style="max-height: 500px;"
											/>
										{:else if resource.type === 'video'}
											<video src={resource.data} class="w-full object-cover" style="max-height: 500px;"><track kind="captions" /></video>
										{/if}
									</button>
									<div class="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-end bg-gradient-to-t from-black/60 via-black/20 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
										<div class="pointer-events-auto flex items-center gap-1.5">
											<Tooltip.Root>
												<Tooltip.Trigger>
													{#snippet child({ props })}
														<button
															{...props}
															class="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
															onclick={(e) => { e.stopPropagation(); onDownloadImage(resource.data, resource.filename || 'image.png', 0); }}
														>
															<Download class="h-3.5 w-3.5" />
														</button>
													{/snippet}
												</Tooltip.Trigger>
												<Tooltip.Content>下载</Tooltip.Content>
											</Tooltip.Root>
											<Tooltip.Root>
												<Tooltip.Trigger>
													{#snippet child({ props })}
														<button
															{...props}
															class="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-red-500/60"
															onclick={(e) => { e.stopPropagation(); taskManager.deleteTask(task.id); }}
														>
															<Trash2 class="h-3.5 w-3.5" />
														</button>
													{/snippet}
												</Tooltip.Trigger>
												<Tooltip.Content>删除</Tooltip.Content>
											</Tooltip.Root>
										</div>
									</div>
								</Card.Root>
							{:else}
								<div class="grid grid-cols-2 gap-1.5 sm:gap-2">
									{#each task.mediaResources as resource, index}
										<div class="group/img relative overflow-hidden rounded-xl border border-border/30 bg-card {task.mediaResources.length === 3 && index === 0 ? 'row-span-2' : ''}">
											<button class="block h-full w-full" onclick={() => onOpenGallery(task.mediaResources, index)}>
												{#if resource.type === 'image'}
													<img
														src={resource.data}
														alt={resource.filename || `生成的图片 ${index + 1}`}
														class="h-full w-full object-cover transition-transform duration-500 group-hover/img:scale-105"
														style="aspect-ratio: {task.mediaResources.length === 3 && index === 0 ? '1/2' : '1/1'}; min-height: 120px;"
													/>
												{:else if resource.type === 'video'}
													<video src={resource.data} class="h-full w-full object-cover"><track kind="captions" /></video>
												{:else}
													<div class="flex aspect-square items-center justify-center"><ImageIcon class="h-8 w-8 text-muted-foreground" /></div>
												{/if}
											</button>
											<div class="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity duration-200 group-hover/img:opacity-100">
												<div class="pointer-events-auto p-2">
													<Tooltip.Root>
														<Tooltip.Trigger>
															{#snippet child({ props })}
																<button
																	{...props}
																	class="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
																	onclick={(e) => { e.stopPropagation(); onDownloadImage(resource.data, resource.filename || `image-${index + 1}.png`, index); }}
																>
																	<Download class="h-3 w-3" />
																</button>
															{/snippet}
														</Tooltip.Trigger>
														<Tooltip.Content>下载</Tooltip.Content>
													</Tooltip.Root>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}

							<!-- Bottom meta info -->
							<div class="mt-1.5 flex items-center gap-2 px-1">
								{#if task.attachedPreviews && task.attachedPreviews.length > 0}
									<div class="flex flex-shrink-0 gap-1">
										{#each task.attachedPreviews as preview, i}
											<button
												onclick={() => onOpenGallery(previewsToMediaResources(task.attachedPreviews || []), i)}
												class="overflow-hidden rounded-md border border-border/50 transition-opacity hover:opacity-80"
											>
												<img src={preview} alt="参考图 {i + 1}" class="h-6 w-6 object-cover" />
											</button>
										{/each}
									</div>
								{/if}
								<p class="min-w-0 flex-1 truncate text-xs text-muted-foreground/60">{task.prompt}</p>
								<span class="flex-shrink-0 text-xs text-muted-foreground/40">
									{new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
								</span>
								{#if task.mediaResources.length > 1}
									<Button variant="link" size="sm" class="h-auto flex-shrink-0 p-0 text-xs text-muted-foreground/40 no-underline hover:text-destructive hover:underline" onclick={() => taskManager.deleteTask(task.id)}>删除</Button>
								{/if}
							</div>
						</div>
					{/if}
				{/each}
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

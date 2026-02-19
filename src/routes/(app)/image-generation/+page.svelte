<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		Loader2,
		Send,
		ImageIcon,
		Download,
		Trash2,
		RefreshCw,
		Paperclip,
		X,
		Sparkles,
		Wand2,
		Layers,
		Flame,
		Clock,
		LayoutGrid,
		Cat,
		Mountain,
		Rocket,
		Paintbrush,
		Camera,
		Flower2,
		Palette,
		Drama,
		TreePine,
		Gem,
		Bot
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import { taskManager, type MediaResource } from '$lib/stores/task-manager.svelte';
	import ImageGallery from '$lib/components/image-gallery.svelte';
	import { CHAT_ATTACHMENTS, IMAGE_GEN, UI, type AspectRatio } from '$lib/config/constants';
	import { compressImage } from '$lib/utils/image-compress';
	import { cn } from '$lib/utils';
	import { setHeaderSlots, clearHeaderSlots } from '$lib/stores/page-header.svelte';

	// ── 状态 ──
	let activeTab = $state<'templates' | 'history'>('templates');
	let input = $state('');
	let galleryImages = $state<MediaResource[]>([]);
	let galleryInitialIndex = $state(0);
	let showGallery = $state(false);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let attachedFiles = $state<Array<{ id: string; file: File; previewUrl: string }>>([]);
	let isDragging = $state(false);
	let textareaRef = $state<HTMLTextAreaElement | null>(null);
	let selectedRatio = $state<AspectRatio>(IMAGE_GEN.DEFAULT_ASPECT_RATIO);

	onMount(() => {
		taskManager.loadFromHistory();
	});

	// ── Top Bar 注入 tab 切换 ──
	$effect(() => {
		setHeaderSlots({ center: headerCenter });
		return () => clearHeaderSlots();
	});

	// ── 模板数据 ──
	interface PromptTemplate {
		icon: typeof Sparkles;
		label: string;
		prompt: string;
		color: string;
	}

	const templates: PromptTemplate[] = [
		{ icon: Cat, label: '水彩猫咪', prompt: '一只可爱的猫咪在花园里玩耍，阳光洒落，水彩画风格', color: 'text-amber-500' },
		{ icon: Flame, label: '赛博朋克', prompt: '未来城市的夜景，霓虹灯闪烁，赛博朋克风格，高楼大厦', color: 'text-rose-500' },
		{ icon: Mountain, label: '油画风景', prompt: '宁静的湖边日落景色，远山倒影，油画质感，暖色调', color: 'text-emerald-500' },
		{ icon: Rocket, label: '太空幻想', prompt: '科幻风格的太空站，星空背景，太空人漂浮，精细渲染', color: 'text-violet-500' },
		{ icon: Paintbrush, label: '水墨画', prompt: '中国传统水墨画风格的山水画，留白意境，松树云雾', color: 'text-stone-500' },
		{ icon: Camera, label: '胶片质感', prompt: '复古胶片风格的街头摄影，柔和色调，自然光线，浅景深', color: 'text-orange-500' },
		{ icon: Flower2, label: '花卉微距', prompt: '一朵盛开的玫瑰花微距特写，水滴在花瓣上，背景虚化', color: 'text-pink-500' },
		{ icon: Palette, label: '波普艺术', prompt: '安迪·沃霍尔波普艺术风格，大胆的色彩拼贴，创意图案', color: 'text-yellow-500' },
		{ icon: Drama, label: '动漫角色', prompt: '日系动漫风格的角色设计，精致五官，动感姿态，高清', color: 'text-sky-500' },
		{ icon: TreePine, label: '梦幻森林', prompt: '魔幻风格的森林场景，萤火虫发光，神秘氛围，奇幻色彩', color: 'text-teal-500' },
		{ icon: Gem, label: '奢华珠宝', prompt: '精致的宝石珠宝，钻石切面闪光，黑色丝绒背景，产品摄影', color: 'text-indigo-500' },
		{ icon: Bot, label: '机甲战士', prompt: '精密的机甲战士设计图，金属质感，霓虹发光线条，暗色调', color: 'text-cyan-500' },
	];

	function useTemplate(prompt: string) {
		input = prompt;
		textareaRef?.focus();
	}

	// ── Gallery ──
	function openGallery(images: MediaResource[], index: number) {
		galleryImages = images;
		galleryInitialIndex = index;
		showGallery = true;
	}

	function closeGallery() {
		showGallery = false;
	}

	// ── 提交 ──
	function handleSubmit() {
		const trimmedInput = input.trim();
		if (!trimmedInput && attachedFiles.length === 0) {
			toast.error('请输入描述或上传图片');
			return;
		}

		taskManager.createTask(trimmedInput, attachedFiles.map((f) => f.file), selectedRatio);
		input = '';
		attachedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
		attachedFiles = [];
		selectedRatio = IMAGE_GEN.DEFAULT_ASPECT_RATIO;
		if (textareaRef) textareaRef.style.height = 'auto';

		// 提交后自动切到历史 tab
		activeTab = 'history';
		toast.success('已加入创作队列');
	}

	// ── 文件管理 ──
	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files) {
			addFiles(Array.from(target.files));
			target.value = '';
		}
	}

	async function addFiles(files: File[]) {
		for (const file of files) {
			if (attachedFiles.length >= IMAGE_GEN.MAX_REFERENCE_IMAGES) {
				toast.error(`最多同时上传 ${IMAGE_GEN.MAX_REFERENCE_IMAGES} 张参考图`);
				break;
			}
			if (!CHAT_ATTACHMENTS.ALLOWED_TYPES.includes(file.type)) {
				toast.error(`不支持的文件类型: ${file.type || '未知'}`);
				continue;
			}
			let processedFile = file;
			if (file.size > CHAT_ATTACHMENTS.MAX_FILE_SIZE) {
				try {
					processedFile = await compressImage(file);
				} catch (e) {
					toast.error(e instanceof Error ? e.message : `文件过大: ${file.name}`);
					continue;
				}
			}
			if (attachedFiles.some((f) => f.file.name === processedFile.name)) {
				toast.error(`文件已添加: ${processedFile.name}`);
				continue;
			}
			const id = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
			const previewUrl = URL.createObjectURL(processedFile);
			attachedFiles = [...attachedFiles, { id, file: processedFile, previewUrl }];
		}
	}

	function removeFile(id: string) {
		const item = attachedFiles.find((f) => f.id === id);
		if (item) URL.revokeObjectURL(item.previewUrl);
		attachedFiles = attachedFiles.filter((f) => f.id !== id);
	}

	function openFilePicker() {
		fileInputRef?.click();
	}

	// ── 拖放 ──
	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}
	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}
	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer?.files) {
			const images = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
			if (images.length > 0) addFiles(images);
		}
	}

	// ── 键盘 ──
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			handleSubmit();
		}
	}

	function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		const imageFiles: File[] = [];
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) imageFiles.push(file);
			}
		}
		if (imageFiles.length > 0) {
			e.preventDefault();
			addFiles(imageFiles);
		}
	}

	function autoResize() {
		if (textareaRef) {
			textareaRef.style.height = 'auto';
			textareaRef.style.height = Math.min(textareaRef.scrollHeight, UI.TEXTAREA_MAX_HEIGHT) + 'px';
		}
	}

	function downloadImage(data: string, filename: string, index: number) {
		const link = document.createElement('a');
		link.href = data;
		link.download = filename || `generated-image-${index + 1}.png`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		toast.success('下载成功');
	}

	// ── 派生状态 ──
	let stats = $derived(taskManager.stats);
	let tasks = $derived(taskManager.tasks);
	let activeTasks = $derived(tasks.filter((t) => t.status === 'pending' || t.status === 'loading'));
	let completedTasks = $derived(tasks.filter((t) => t.status === 'success' || t.status === 'error'));
	let hasActiveWork = $derived(activeTasks.length > 0);
</script>

<!-- ── Top Bar: Tab 切换 ── -->

{#snippet headerCenter()}
	<div class="flex items-center rounded-lg bg-muted/60 p-0.5">
		<button
			onclick={() => (activeTab = 'templates')}
			class={cn(
				'flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all',
				activeTab === 'templates'
					? 'bg-background text-foreground shadow-sm'
					: 'text-muted-foreground hover:text-foreground'
			)}
		>
			<LayoutGrid class="h-3.5 w-3.5" />
			模板
		</button>
		<button
			onclick={() => (activeTab = 'history')}
			class={cn(
				'relative flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all',
				activeTab === 'history'
					? 'bg-background text-foreground shadow-sm'
					: 'text-muted-foreground hover:text-foreground'
			)}
		>
			<Clock class="h-3.5 w-3.5" />
			历史
			{#if hasActiveWork}
				<span class="absolute -right-0.5 -top-0.5 flex h-2 w-2">
					<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
					<span class="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
				</span>
			{/if}
		</button>
	</div>
{/snippet}

<!-- ── 页面主体 ── -->

<div class="relative flex h-full flex-col">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="flex-1 overflow-y-auto"
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
	>
		<!-- 拖放覆盖层 -->
		{#if isDragging}
			<div class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-primary/5 backdrop-blur-[2px]">
				<div class="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-background/80 px-12 py-10">
					<ImageIcon class="h-10 w-10 text-primary/60" />
					<span class="text-sm font-medium text-primary/80">释放以添加参考图片</span>
				</div>
			</div>
		{/if}

		{#if activeTab === 'templates'}
			<!-- ══════════════════ 模板 Tab ══════════════════ -->
			<div class="mx-auto max-w-2xl px-4 py-5 lg:max-w-3xl">
				<!-- 页头 -->
				<div class="mb-5">
					<h2 class="text-lg font-semibold tracking-tight text-foreground">创作模板</h2>
					<p class="mt-0.5 text-sm text-muted-foreground">选择一个模板快速开始，或直接输入你的描述</p>
				</div>

				<!-- 模板网格 -->
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
					{#each templates as tpl, i}
						<button
							onclick={() => useTemplate(tpl.prompt)}
							class="group relative flex flex-col items-start gap-2.5 rounded-2xl border border-border/50 bg-card p-4 text-left transition-all hover:border-border hover:bg-accent/50 hover:shadow-sm active:scale-[0.97]"
							style="animation: fadeSlideIn 0.3s ease both; animation-delay: {i * 30}ms;"
						>
							<div class={cn(
								'flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-110',
								'bg-muted/70'
							)}>
								<tpl.icon class={cn('h-[18px] w-[18px]', tpl.color)} />
							</div>
							<div>
								<p class="text-sm font-medium text-foreground">{tpl.label}</p>
								<p class="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground/70">{tpl.prompt}</p>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<!-- ══════════════════ 历史 Tab ══════════════════ -->
			{#if tasks.length === 0}
				<!-- 空历史 -->
				<div class="flex h-full flex-col items-center justify-center px-4 pb-4">
					<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
						<Clock class="h-7 w-7 text-muted-foreground/40" />
					</div>
					<p class="mt-4 text-sm text-muted-foreground">还没有创作记录</p>
					<button
						onclick={() => (activeTab = 'templates')}
						class="mt-3 text-sm text-foreground/70 underline decoration-foreground/20 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground/50"
					>浏览模板开始创作</button>
				</div>
			{:else}
				<div class="mx-auto max-w-2xl space-y-3 p-4 pb-6 lg:max-w-3xl">
					<!-- 活跃任务（生成中 / 排队中） -->
					{#if activeTasks.length > 0}
						<div class="space-y-3">
							{#each activeTasks as task (task.id)}
								<div class="relative overflow-hidden rounded-2xl border border-border/60 bg-card">
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

									<!-- 底部信息栏 -->
									<div class="flex items-center gap-3 border-t border-border/40 px-4 py-2.5">
										{#if task.attachedPreviews && task.attachedPreviews.length > 0}
											<div class="flex gap-1">
												{#each task.attachedPreviews as preview, i}
													<button
														onclick={() => openGallery(task.attachedPreviews?.map((p, idx) => ({ type: 'image' as const, data: p, filename: `参考图 ${idx + 1}` })) || [], i)}
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
								</div>
							{/each}
						</div>
					{/if}

					<!-- 已完成 / 失败的任务 -->
					{#if completedTasks.length > 0}
						{#if activeTasks.length > 0}
							<div class="flex items-center gap-3 pt-2">
								<div class="h-px flex-1 bg-border/50"></div>
								<div class="flex items-center gap-2">
									<span class="text-xs text-muted-foreground/70">已完成 {stats.success}</span>
									<button
										onclick={() => taskManager.clearCompleted()}
										class="text-xs text-muted-foreground/50 transition-colors hover:text-foreground"
									>清空</button>
								</div>
								<div class="h-px flex-1 bg-border/50"></div>
							</div>
						{:else if stats.success > 0}
							<div class="flex items-center justify-end px-1">
								<button
									onclick={() => taskManager.clearCompleted()}
									class="text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
								>清空已完成</button>
							</div>
						{/if}

						<div class="space-y-4">
							{#each completedTasks as task (task.id)}
								{#if task.status === 'error'}
									<div class="group rounded-2xl border border-destructive/20 bg-card px-4 py-3">
										<div class="flex items-start gap-3">
											<div class="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-destructive/10">
												<X class="h-3.5 w-3.5 text-destructive" />
											</div>
											<div class="min-w-0 flex-1">
												<p class="text-sm">{task.prompt}</p>
												<p class="mt-1 text-xs text-destructive/80">{task.error}</p>
											</div>
											<div class="flex items-center gap-1">
												<Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-foreground" onclick={() => taskManager.retryTask(task.id)}>
													<RefreshCw class="h-3.5 w-3.5" />
												</Button>
												<Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive" onclick={() => taskManager.deleteTask(task.id)}>
													<Trash2 class="h-3.5 w-3.5" />
												</Button>
											</div>
										</div>
									</div>
								{:else if task.mediaResources.length > 0}
									<div class="group">
										{#if task.mediaResources.length === 1}
											{@const resource = task.mediaResources[0]}
											<div class="relative overflow-hidden rounded-2xl border border-border/40 bg-card">
												<button class="block w-full" onclick={() => openGallery(task.mediaResources, 0)}>
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
														<button
															class="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
															onclick={(e) => { e.stopPropagation(); downloadImage(resource.data, resource.filename || 'image.png', 0); }}
														>
															<Download class="h-3.5 w-3.5" />
														</button>
														<button
															class="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-red-500/60"
															onclick={(e) => { e.stopPropagation(); taskManager.deleteTask(task.id); }}
														>
															<Trash2 class="h-3.5 w-3.5" />
														</button>
													</div>
												</div>
											</div>
										{:else}
											<div class="grid grid-cols-2 gap-1.5 sm:gap-2">
												{#each task.mediaResources as resource, index}
													<div class="group/img relative overflow-hidden rounded-xl border border-border/30 bg-card {task.mediaResources.length === 3 && index === 0 ? 'row-span-2' : ''}">
														<button class="block h-full w-full" onclick={() => openGallery(task.mediaResources, index)}>
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
																<button
																	class="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
																	onclick={(e) => { e.stopPropagation(); downloadImage(resource.data, resource.filename || `image-${index + 1}.png`, index); }}
																>
																	<Download class="h-3 w-3" />
																</button>
															</div>
														</div>
													</div>
												{/each}
											</div>
										{/if}

										<!-- 底部元信息 -->
										<div class="mt-1.5 flex items-center gap-2 px-1">
											{#if task.attachedPreviews && task.attachedPreviews.length > 0}
												<div class="flex flex-shrink-0 gap-1">
													{#each task.attachedPreviews as preview, i}
														<button
															onclick={() => openGallery(task.attachedPreviews?.map((p, idx) => ({ type: 'image' as const, data: p, filename: `参考图 ${idx + 1}` })) || [], i)}
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
												<button
													class="flex-shrink-0 text-xs text-muted-foreground/40 transition-colors hover:text-destructive"
													onclick={() => taskManager.deleteTask(task.id)}
												>删除</button>
											{/if}
										</div>
									</div>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>

	<!-- ── 底部输入栏 ── -->
	<div class="border-t bg-background/95 px-4 py-3 backdrop-blur-sm">
		<form class="mx-auto max-w-2xl lg:max-w-3xl" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
			{#if attachedFiles.length > 0}
				<div class="mb-2 flex gap-2 overflow-x-auto pb-1">
					{#each attachedFiles as file (file.id)}
						<div class="group/thumb relative flex-shrink-0">
							<img src={file.previewUrl} alt={file.file.name} class="h-14 w-14 rounded-xl border border-border object-cover" />
							<button
								type="button"
								onclick={() => removeFile(file.id)}
								class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition-transform hover:scale-110"
							>
								<X class="h-3 w-3" />
							</button>
						</div>
					{/each}
				</div>

				<!-- 多图合成比例选择器 -->
				{#if attachedFiles.length >= 2}
					<div class="mb-2 flex items-center gap-2">
						<span class="text-xs text-muted-foreground/60">画布比例</span>
						<div class="flex items-center rounded-lg bg-muted/60 p-0.5">
							{#each IMAGE_GEN.ASPECT_RATIOS as ratio}
								<button
									type="button"
									onclick={() => (selectedRatio = ratio)}
									class={cn(
										'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
										selectedRatio === ratio
											? 'bg-background text-foreground shadow-sm'
											: 'text-muted-foreground hover:text-foreground'
									)}
								>
									{ratio}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			{/if}

			<div class={cn(
				'relative flex items-end gap-1.5 rounded-2xl border bg-card p-1.5 transition-all focus-within:border-foreground/20 focus-within:shadow-sm',
				isDragging && 'border-foreground/20 shadow-sm'
			)}>
				<button
					type="button"
					class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
					disabled={attachedFiles.length >= IMAGE_GEN.MAX_REFERENCE_IMAGES}
					onclick={openFilePicker}
				>
					<Paperclip class="h-4 w-4" />
				</button>

				<textarea
					bind:this={textareaRef}
					bind:value={input}
					oninput={autoResize}
					onkeydown={handleKeyDown}
					onpaste={handlePaste}
					placeholder="描述你想要的图片..."
					rows={1}
					class="min-h-[36px] max-h-[160px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50"
				></textarea>

				<Button
					type="submit"
					size="icon"
					class="h-9 w-9 flex-shrink-0 rounded-xl"
					disabled={!input.trim() && attachedFiles.length === 0}
				>
					<Send class="h-4 w-4" />
				</Button>
			</div>
			<p class="mt-1.5 text-center text-[11px] text-muted-foreground/40">
				⌘+Enter 生成 · 支持拖拽或粘贴参考图
			</p>
		</form>
	</div>
</div>

<input
	bind:this={fileInputRef}
	type="file"
	accept={CHAT_ATTACHMENTS.ALLOWED_TYPES.join(',')}
	multiple
	class="hidden"
	onchange={handleFileSelect}
/>

{#if showGallery}
	<ImageGallery images={galleryImages} initialIndex={galleryInitialIndex} onClose={closeGallery} />
{/if}

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

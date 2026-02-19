<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Skeleton } from '$lib/components/ui/skeleton';
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
		Clock,
		LayoutGrid
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import { taskManager, type MediaResource } from '$lib/stores/task-manager.svelte';
	import ImageGallery from '$lib/components/image-gallery.svelte';
	import { CHAT_ATTACHMENTS, IMAGE_GEN, UI, type AspectRatio } from '$lib/config/constants';
	import { compressImage } from '$lib/utils/image-compress';
	import { cn } from '$lib/utils';
	import { setHeaderSlots, clearHeaderSlots } from '$lib/stores/page-header.svelte';

	// ── 模板类型 ──
	interface ApiTemplate {
		id: string;
		name: string;
		category: string;
		prompt: string;
		previewImageUrl: string | null;
		description: string | null;
		imageCountMin: number;
		imageCountMax: number;
		assignmentId: string | null;
		featureKey: string | null;
		sortOrder: number;
		isPinned: boolean;
	}

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

	// ── 模板状态 ──
	let templates = $state<ApiTemplate[]>([]);
	let groupedTemplates = $state<Record<string, ApiTemplate[]>>({});
	let templatesLoading = $state(true);
	let selectedTemplate = $state<ApiTemplate | null>(null);
	let placeholderValues = $state<Record<string, string>>({});

	// ── 派生: 从选中模板提取占位符 ──
	let placeholders = $derived(
		selectedTemplate
			? [...(selectedTemplate.prompt.matchAll(/\{([^}]+)\}/g))].map(m => m[1])
			: []
	);

	// ── 派生: 将占位符替换为用户输入后的最终提示词 ──
	let resolvedPrompt = $derived(() => {
		if (!selectedTemplate) return input;
		if (placeholders.length === 0) return selectedTemplate.prompt;
		let result = selectedTemplate.prompt;
		for (const key of placeholders) {
			const val = placeholderValues[key]?.trim();
			if (val) {
				result = result.replaceAll(`{${key}}`, val);
			}
		}
		return result;
	});

	onMount(() => {
		taskManager.loadFromHistory();
		loadTemplates();
	});

	// ── Top Bar 注入 tab 切换 ──
	$effect(() => {
		setHeaderSlots({ center: headerCenter });
		return () => clearHeaderSlots();
	});

	// ── 加载模板 ──
	async function loadTemplates() {
		templatesLoading = true;
		try {
			const res = await fetch('/api/templates');
			if (res.ok) {
				const data = await res.json();
				templates = data.templates || [];
				groupedTemplates = data.grouped || {};
			}
		} catch {
			// 静默失败，模板不影响核心功能
		} finally {
			templatesLoading = false;
		}
	}

	// ── 选择模板 ──
	function selectTemplate(tpl: ApiTemplate) {
		if (selectedTemplate?.id === tpl.id) {
			// 取消选中
			selectedTemplate = null;
			placeholderValues = {};
			input = '';
			return;
		}
		selectedTemplate = tpl;
		placeholderValues = {};
		// 如果无占位符，直接填入 prompt
		const hasPlaceholders = /\{[^}]+\}/.test(tpl.prompt);
		if (!hasPlaceholders) {
			input = tpl.prompt;
		} else {
			input = '';
		}
		textareaRef?.focus();
	}

	// ── 图片数量校验 ──
	function validateImageCount(): string | null {
		if (!selectedTemplate) return null;
		const { imageCountMin, imageCountMax } = selectedTemplate;
		const count = attachedFiles.length;
		// 0-0 = 不限
		if (imageCountMin === 0 && imageCountMax === 0) return null;
		if (imageCountMin > 0 && count < imageCountMin) {
			return `该模板至少需要 ${imageCountMin} 张参考图`;
		}
		if (imageCountMax > 0 && count > imageCountMax) {
			return `该模板最多允许 ${imageCountMax} 张参考图`;
		}
		return null;
	}

	function formatImageCountHint(min: number, max: number): string {
		if (min === 0 && max === 0) return '';
		if (min === max) return `需要 ${min} 张参考图`;
		if (min > 0 && max === 0) return `至少需要 ${min} 张参考图`;
		if (min === 0 && max > 0) return `最多 ${max} 张参考图`;
		return `需要 ${min}-${max} 张参考图`;
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
		// 图片数量校验
		const imageError = validateImageCount();
		if (imageError) {
			toast.error(imageError);
			return;
		}

		// 构建最终提示词
		let finalPrompt: string;
		if (selectedTemplate && placeholders.length > 0) {
			finalPrompt = resolvedPrompt();
			// 检查是否有未填写的占位符
			if (/\{[^}]+\}/.test(finalPrompt)) {
				toast.error('请填写所有占位符');
				return;
			}
		} else {
			finalPrompt = input.trim();
		}

		if (!finalPrompt && attachedFiles.length === 0) {
			toast.error('请输入描述或上传图片');
			return;
		}

		const featureKey = selectedTemplate?.featureKey || undefined;
		taskManager.createTask(finalPrompt, attachedFiles.map((f) => f.file), selectedRatio, featureKey);
		input = '';
		selectedTemplate = null;
		placeholderValues = {};
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

				{#if templatesLoading}
					<!-- 加载骨架 -->
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
						{#each Array(6) as _}
							<Skeleton class="h-28 rounded-2xl" />
						{/each}
					</div>
				{:else if templates.length === 0}
					<!-- 空模板 -->
					<div class="flex flex-col items-center py-12 text-center">
						<Sparkles class="h-10 w-10 text-muted-foreground/30" />
						<p class="mt-3 text-sm text-muted-foreground">暂无模板，请直接输入描述</p>
					</div>
				{:else}
					<!-- 选中模板的占位符输入 -->
					{#if selectedTemplate && placeholders.length > 0}
						<div
							class="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4"
							style="animation: fadeSlideIn 0.2s ease both;"
						>
							<div class="mb-3 flex items-center justify-between">
								<div class="flex items-center gap-2">
									{#if selectedTemplate.previewImageUrl}
										<img
											src={selectedTemplate.previewImageUrl}
											alt={selectedTemplate.name}
											class="h-8 w-8 rounded-lg object-cover"
										/>
									{/if}
									<span class="text-sm font-medium">{selectedTemplate.name}</span>
								</div>
								<button
									onclick={() => { selectedTemplate = null; placeholderValues = {}; input = ''; }}
									class="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
								>
									<X class="h-3.5 w-3.5" />
								</button>
							</div>
							{#if selectedTemplate.description}
								<p class="mb-3 text-xs text-muted-foreground">{selectedTemplate.description}</p>
							{/if}
							<div class="space-y-2">
								{#each placeholders as placeholder}
									<div class="flex items-center gap-2">
										<span class="flex-shrink-0 text-xs text-muted-foreground/80 w-20 text-right">{placeholder}</span>
										<Input
											value={placeholderValues[placeholder] ?? ''}
											oninput={(e) => { placeholderValues = { ...placeholderValues, [placeholder]: (e.target as HTMLInputElement).value }; }}
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

					<!-- 按分类分组展示模板 -->
					{#each Object.entries(groupedTemplates) as [category, categoryTemplates], ci}
						<div class={ci > 0 ? 'mt-5' : ''}>
							{#if Object.keys(groupedTemplates).length > 1}
								<h3 class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">{category}</h3>
							{/if}
							<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
								{#each categoryTemplates as tpl, i}
									<button
										onclick={() => selectTemplate(tpl)}
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
											<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/70 transition-transform group-hover:scale-110">
												<Sparkles class="h-[18px] w-[18px] text-muted-foreground" />
											</div>
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
			<!-- 选中模板提示（无占位符时） -->
			{#if selectedTemplate && placeholders.length === 0}
				<div class="mb-2 flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-1.5">
					<span class="text-xs text-primary/80">模板: {selectedTemplate.name}</span>
					<button
						type="button"
						onclick={() => { selectedTemplate = null; input = ''; }}
						class="ml-auto text-muted-foreground hover:text-foreground"
					>
						<X class="h-3 w-3" />
					</button>
				</div>
			{/if}
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
					disabled={(!input.trim() && attachedFiles.length === 0 && !(selectedTemplate && placeholders.length > 0))}
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

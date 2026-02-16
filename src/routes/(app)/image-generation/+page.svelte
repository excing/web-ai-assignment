<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
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
		Palette,
		Mountain,
		Rocket
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { taskManager, type MediaResource } from '$lib/stores/task-manager.svelte';
	import ImageGallery from '$lib/components/image-gallery.svelte';
	import { CHAT_ATTACHMENTS, UI } from '$lib/config/constants';
	import { cn } from '$lib/utils';

	let input = $state('');
	let galleryImages = $state<MediaResource[]>([]);
	let galleryInitialIndex = $state(0);
	let showGallery = $state(false);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let attachedFiles = $state<Array<{ id: string; file: File; previewUrl: string }>>([]);
	let isDragging = $state(false);
	let textareaRef = $state<HTMLTextAreaElement | null>(null);

	function openGallery(images: MediaResource[], index: number) {
		galleryImages = images;
		galleryInitialIndex = index;
		showGallery = true;
	}

	function closeGallery() {
		showGallery = false;
	}

	function handleSubmit() {
		const trimmedInput = input.trim();
		console.log('handleSubmit called, input:', trimmedInput);

		if (!trimmedInput && attachedFiles.length === 0) {
			console.log('Input and files are empty, returning');
			toast.error('请输入描述或上传图片');
			return;
		}

		console.log('Creating task with prompt:', trimmedInput);
		taskManager.createTask(trimmedInput, attachedFiles.map((f) => f.file));
		input = '';

		// 清理附件预览 URL
		attachedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
		attachedFiles = [];

		toast.success('任务已添加到队列', {
			description: '正在后台生成，完成后会通知你'
		});
	}

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files) {
			addFiles(Array.from(target.files));
			target.value = '';
		}
	}

	function addFiles(files: File[]) {
		for (const file of files) {
			// 检查数量上限
			if (attachedFiles.length >= CHAT_ATTACHMENTS.MAX_FILES) {
				toast.error(`最多同时上传 ${CHAT_ATTACHMENTS.MAX_FILES} 张图片`);
				break;
			}

			// 验证文件类型
			if (!CHAT_ATTACHMENTS.ALLOWED_TYPES.includes(file.type)) {
				toast.error(`不支持的文件类型: ${file.type || '未知'}`);
				continue;
			}

			// 验证文件大小
			if (file.size > CHAT_ATTACHMENTS.MAX_FILE_SIZE) {
				toast.error(`文件过大: ${file.name}（上限 ${CHAT_ATTACHMENTS.MAX_SIZE_LABEL}）`);
				continue;
			}

			// 检查是否已添加（按名称+大小去重）
			if (attachedFiles.some((f) => f.file.name === file.name && f.file.size === file.size)) {
				toast.error(`文件已添加: ${file.name}`);
				continue;
			}

			// 添加文件
			const id = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
			const previewUrl = URL.createObjectURL(file);
			attachedFiles = [...attachedFiles, { id, file, previewUrl }];
		}
	}

	function removeFile(id: string) {
		const item = attachedFiles.find((f) => f.id === id);
		if (item) {
			URL.revokeObjectURL(item.previewUrl);
		}
		attachedFiles = attachedFiles.filter((f) => f.id !== id);
	}

	function openFilePicker() {
		fileInputRef?.click();
	}

	// ── 拖放支持 ──
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

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			handleSubmit();
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

	const quickPrompts = [
		{ icon: Palette, text: '可爱猫咪', prompt: '生成图片: 一只可爱的猫咪在花园里玩耍，水彩画风格' },
		{ icon: Sparkles, text: '未来城市', prompt: '生成图片: 未来城市的夜景，霓虹灯闪烁，赛博朋克' },
		{ icon: Mountain, text: '湖边日落', prompt: '生成图片: 宁静的湖边日落景色，油画质感' },
		{ icon: Rocket, text: '太空站', prompt: '生成图片: 科幻风格的太空站，星空背景' }
	];

	function useQuickPrompt(prompt: string) {
		input = prompt;
	}

	let stats = $derived(taskManager.stats);
	let tasks = $derived(taskManager.tasks);

</script>

<!-- ───── 全屏 flex 布局（与 chat 页一致） ───── -->
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
				<div class="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-background/80 px-10 py-8">
					<ImageIcon class="h-10 w-10 text-primary/60" />
					<span class="text-sm font-medium text-primary/80">释放以添加参考图片</span>
				</div>
			</div>
		{/if}

		{#if tasks.length === 0}
			<!-- ── 空状态 ── -->
			<div class="flex h-full flex-col items-center justify-center px-4">
				<div class="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
					<ImageIcon class="h-8 w-8 text-primary" />
				</div>
				<h1 class="mb-2 text-2xl font-semibold text-foreground">AI 图片创作</h1>
				<p class="mb-8 max-w-md text-center text-muted-foreground">
					描述你想要的画面，AI 将为你生成。支持上传参考图进行图生图创作。
				</p>
				<div class="flex flex-wrap justify-center gap-2">
					{#each quickPrompts as { icon: Icon, text, prompt }}
						<button
							onclick={() => useQuickPrompt(prompt)}
							class="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground"
						>
							<Icon class="h-4 w-4" />
							{text}
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<!-- ── 任务列表 ── -->
			<div class="mx-auto max-w-4xl space-y-4 p-4 pb-6">
				<!-- 统计栏 -->
				{#if stats.total > 0}
					<div class="flex items-center gap-3 px-1 text-xs text-muted-foreground">
						{#if stats.loading > 0}
							<span class="flex items-center gap-1.5 text-blue-500">
								<Loader2 class="h-3 w-3 animate-spin" />
								生成中 {stats.loading}
							</span>
						{/if}
						{#if stats.pending > 0}<span>等待 {stats.pending}</span>{/if}
						<div class="flex-1"></div>
						{#if stats.success > 0}
							<span>{stats.success} 已完成</span>
							<button
								onclick={() => taskManager.clearCompleted()}
								class="transition-colors hover:text-foreground"
							>清空已完成</button>
						{/if}
					</div>
				{/if}

				{#each tasks as task (task.id)}
					<div class="group rounded-2xl border bg-card p-4 transition-all hover:shadow-sm">
						<!-- 头部：状态圆点 + prompt + 时间 + 操作 -->
						<div class="flex items-start gap-3">
							<div
								class={cn(
									'mt-1.5 h-2 w-2 flex-shrink-0 rounded-full',
									task.status === 'loading' && 'animate-pulse bg-blue-500',
									task.status === 'success' && 'bg-green-500',
									task.status === 'error' && 'bg-red-500',
									task.status === 'pending' && 'bg-yellow-500'
								)}
							></div>
							<div class="min-w-0 flex-1">
								<p class="text-sm leading-relaxed">{task.prompt}</p>
								{#if task.attachedPreviews && task.attachedPreviews.length > 0}
									<div class="mt-2 flex gap-1.5">
										{#each task.attachedPreviews as preview, i}
											<img src={preview} alt="参考图 {i + 1}" class="h-10 w-10 rounded-lg border object-cover" />
										{/each}
									</div>
								{/if}
								{#if task.error}
									<p class="mt-2 text-sm text-destructive">{task.error}</p>
								{/if}
							</div>
							<div class="flex items-center gap-1">
								<span class="text-xs text-muted-foreground">
									{new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
								</span>
								{#if task.status === 'error'}
									<Button variant="ghost" size="icon" class="h-7 w-7 text-muted-foreground hover:text-foreground" onclick={() => taskManager.retryTask(task.id)}>
										<RefreshCw class="h-3.5 w-3.5" />
									</Button>
								{/if}
								<Button
									variant="ghost"
									size="icon"
									class="h-7 w-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
									onclick={() => taskManager.deleteTask(task.id)}
								>
									<Trash2 class="h-3.5 w-3.5" />
								</Button>
							</div>
						</div>

						<!-- 加载/排队提示 -->
						{#if task.status === 'loading'}
							<div class="mt-3 flex items-center gap-2 pl-5 text-sm text-muted-foreground">
								<Loader2 class="h-4 w-4 animate-spin text-blue-500" />
								正在生成...
							</div>
						{:else if task.status === 'pending'}
							<p class="mt-3 pl-5 text-xs text-muted-foreground">排队中...</p>
						{/if}

						<!-- 生成结果 -->
						{#if task.status === 'success' && task.mediaResources.length > 0}
							<div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
								{#each task.mediaResources as resource, index}
									<div class="group/img relative aspect-square overflow-hidden rounded-xl bg-muted">
										<button class="h-full w-full" onclick={() => openGallery(task.mediaResources, index)}>
											{#if resource.type === 'image'}
												<img src={resource.data} alt={resource.filename || `生成的图片 ${index + 1}`} class="h-full w-full object-cover transition-transform duration-300 group-hover/img:scale-105" />
											{:else if resource.type === 'video'}
												<video src={resource.data} class="h-full w-full object-cover"><track kind="captions" /></video>
											{:else}
												<div class="flex h-full items-center justify-center"><ImageIcon class="h-8 w-8 text-muted-foreground" /></div>
											{/if}
										</button>
										<div class="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover/img:opacity-100">
											<div class="pointer-events-auto flex w-full justify-end p-2">
												<button
													class="rounded-full bg-white/20 p-1.5 backdrop-blur-sm transition-colors hover:bg-white/40"
													onclick={(e) => { e.stopPropagation(); downloadImage(resource.data, resource.filename || `image-${index + 1}`, index); }}
												>
													<Download class="h-3.5 w-3.5 text-white" />
												</button>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- ── 固定底部输入栏 ── -->
	<div class="border-t bg-background px-4 py-3">
		<form class="mx-auto max-w-3xl" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
			{#if attachedFiles.length > 0}
				<div class="mb-2 flex flex-wrap gap-2">
					{#each attachedFiles as file (file.id)}
						<div class="group/thumb relative">
							<img src={file.previewUrl} alt={file.file.name} class="h-16 w-16 rounded-lg border border-border object-cover" />
							<button
								type="button"
								onclick={() => removeFile(file.id)}
								class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm opacity-0 transition-opacity group-hover/thumb:opacity-100"
							>
								<X class="h-3 w-3" />
							</button>
						</div>
					{/each}
				</div>
			{/if}

			<div class={cn(
				'relative flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20',
				isDragging && 'border-primary/50 ring-2 ring-primary/20'
			)}>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					class="h-10 w-10 flex-shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
					disabled={attachedFiles.length >= CHAT_ATTACHMENTS.MAX_FILES}
					onclick={openFilePicker}
				>
					<Paperclip class="h-4 w-4" />
				</Button>

				<Textarea
					bind:ref={textareaRef}
					bind:value={input}
					oninput={autoResize}
					onkeydown={handleKeyDown}
					placeholder="描述你想要的图片... (Ctrl+Enter 生成)"
					class="min-h-[44px] max-h-[200px] flex-1 resize-none border-0 bg-transparent p-2 shadow-none focus-visible:ring-0"
					rows={1}
				/>

				<Button
					type="submit"
					size="icon"
					class="h-10 w-10 flex-shrink-0 rounded-xl"
					disabled={!input.trim() && attachedFiles.length === 0}
				>
					<Send class="h-4 w-4" />
				</Button>
			</div>
			<p class="mt-2 text-center text-xs text-muted-foreground">
				支持拖拽或粘贴图片作为参考 · 多任务并发生成
			</p>
		</form>
	</div>
</div>

<!-- 隐藏的文件选择器 -->
<input
	bind:this={fileInputRef}
	type="file"
	accept={CHAT_ATTACHMENTS.ALLOWED_TYPES.join(',')}
	multiple
	class="hidden"
	onchange={handleFileSelect}
/>

<!-- 图片画廊 -->
{#if showGallery}
	<ImageGallery images={galleryImages} initialIndex={galleryInitialIndex} onClose={closeGallery} />
{/if}

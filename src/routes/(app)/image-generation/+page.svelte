<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Card } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Loader2,
		Send,
		ImageIcon,
		Download,
		ExternalLink,
		Trash2,
		RefreshCw,
		Clock,
		CheckCircle2,
		XCircle,
		Paperclip,
		X
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { taskManager, type MediaResource } from '$lib/stores/task-manager.svelte';
	import ImageGallery from '$lib/components/image-gallery.svelte';
	import { CHAT_ATTACHMENTS } from '$lib/config/constants';

	let input = $state('');
	let galleryImages = $state<MediaResource[]>([]);
	let galleryInitialIndex = $state(0);
	let showGallery = $state(false);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let attachedFiles = $state<Array<{ id: string; file: File; previewUrl: string }>>([]);
	let isDragging = $state(false);

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
		'一只可爱的猫咪在花园里玩耍',
		'未来城市的夜景，霓虹灯闪烁',
		'宁静的湖边日落景色',
		'科幻风格的太空站'
	];

	function useQuickPrompt(prompt: string) {
		input = prompt;
	}

	function getStatusIcon(status: string) {
		switch (status) {
			case 'pending':
				return Clock;
			case 'loading':
				return Loader2;
			case 'success':
				return CheckCircle2;
			case 'error':
				return XCircle;
			default:
				return Clock;
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'pending':
				return 'bg-yellow-500/10 text-yellow-500';
			case 'loading':
				return 'bg-blue-500/10 text-blue-500';
			case 'success':
				return 'bg-green-500/10 text-green-500';
			case 'error':
				return 'bg-red-500/10 text-red-500';
			default:
				return 'bg-gray-500/10 text-gray-500';
		}
	}

	function getStatusLabel(status: string) {
		switch (status) {
			case 'pending':
				return '等待中';
			case 'loading':
				return '生成中';
			case 'success':
				return '已完成';
			case 'error':
				return '失败';
			default:
				return '未知';
		}
	}

	let stats = $derived(taskManager.stats);
	let tasks = $derived(taskManager.tasks);

</script>

<div class="container mx-auto max-w-6xl p-6">
	<div class="mb-6 flex items-start justify-between">
		<div>
			<h1 class="mb-2 flex items-center gap-2 text-3xl font-bold">
				<ImageIcon class="h-8 w-8 text-primary" />
				AI 图片生成
			</h1>
			<p class="text-muted-foreground">使用 AI 生成精美图片，支持上传参考图片（图生图）和多任务并发</p>
		</div>

		<!-- 任务统计 -->
		{#if stats.total > 0}
			<div class="flex gap-2">
				{#if stats.loading > 0}
					<Badge variant="outline" class="gap-1">
						<Loader2 class="h-3 w-3 animate-spin" />
						生成中 {stats.loading}
					</Badge>
				{/if}
				{#if stats.pending > 0}
					<Badge variant="outline" class="gap-1">
						<Clock class="h-3 w-3" />
						等待 {stats.pending}
					</Badge>
				{/if}
				{#if stats.success > 0}
					<Badge variant="outline" class="gap-1 border-green-500/50 text-green-500">
						<CheckCircle2 class="h-3 w-3" />
						完成 {stats.success}
					</Badge>
				{/if}
				{#if stats.error > 0}
					<Badge variant="outline" class="gap-1 border-red-500/50 text-red-500">
						<XCircle class="h-3 w-3" />
						失败 {stats.error}
					</Badge>
				{/if}
			</div>
		{/if}
	</div>

	<!-- 输入区域 -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<Card
		class="mb-6 p-6 transition-colors {isDragging ? 'border-primary border-2 bg-primary/5' : ''}"
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
	>
		<div class="space-y-4">
			<div>
				<label for="prompt" class="mb-2 block text-sm font-medium">描述你想要的图片</label>
				<Textarea
					id="prompt"
					bind:value={input}
					onkeydown={handleKeyDown}
					placeholder="例如：一只可爱的猫咪在花园里玩耍&#10;&#10;提示：按 Ctrl/Cmd + Enter 快速生成，支持拖拽图片到此处"
					class="min-h-[120px] resize-none"
				/>
			</div>

			{#if isDragging}
				<div class="flex items-center justify-center rounded-lg border-2 border-dashed border-primary/50 py-6 text-sm text-primary">
					松开即可添加图片
				</div>
			{/if}

			<!-- 附件预览 -->
			{#if attachedFiles.length > 0}
				<div>
					<p class="mb-2 text-sm font-medium">
						已添加的图片 ({attachedFiles.length}/{CHAT_ATTACHMENTS.MAX_FILES})
					</p>
					<div class="flex flex-wrap gap-2">
						{#each attachedFiles as file}
							<div class="group relative h-20 w-20 overflow-hidden rounded-lg border">
								<img
									src={file.previewUrl}
									alt={file.file.name}
									class="h-full w-full object-cover"
								/>
								<button
									class="absolute right-1 top-1 rounded-full bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-100"
									onclick={() => removeFile(file.id)}
								>
									<X class="h-3 w-3 text-white" />
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- 快捷提示词 -->
			<div>
				<p class="mb-2 text-sm text-muted-foreground">快捷提示词：</p>
				<div class="flex flex-wrap gap-2">
					{#each quickPrompts as prompt}
						<Button
							variant="outline"
							size="sm"
							onclick={() => useQuickPrompt(prompt)}
						>
							{prompt}
						</Button>
					{/each}
				</div>
			</div>

			<div class="flex justify-end gap-2">
				{#if stats.success > 0}
					<Button
						variant="outline"
						size="sm"
						onclick={() => taskManager.clearCompleted()}
					>
						清空已完成
					</Button>
				{/if}
				<Button
					variant="outline"
					size="sm"
					onclick={openFilePicker}
					class="gap-2"
					type="button"
				>
					<Paperclip class="h-4 w-4" />
					添加图片
				</Button>
				<Button
					onclick={handleSubmit}
					disabled={!input.trim() && attachedFiles.length === 0}
					class="gap-2"
					type="button"
				>
					<Send class="h-4 w-4" />
					添加到队列
				</Button>
			</div>
		</div>
	</Card>

	<!-- 任务列表 -->
	{#if tasks.length > 0}
		<div class="space-y-6">
			{#each tasks as task (task.id)}
				{@const StatusIcon = getStatusIcon(task.status)}
				<Card id="task-{task.id}" class="overflow-hidden">
					<!-- 任务头部 -->
					<div class="border-b bg-muted/30 p-4">
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1">
								<div class="mb-2 flex items-center gap-2">
									<StatusIcon
										class="h-4 w-4 {task.status === 'loading' ? 'animate-spin' : ''}"
									/>
									<Badge class={getStatusColor(task.status)}>
										{getStatusLabel(task.status)}
									</Badge>
									<span class="text-xs text-muted-foreground">
										{new Date(task.createdAt).toLocaleTimeString()}
									</span>
								</div>
								<p class="text-sm">{task.prompt}</p>
								{#if task.attachedPreviews && task.attachedPreviews.length > 0}
									<div class="mt-2 flex gap-1.5">
										<span class="shrink-0 text-xs text-muted-foreground leading-[2.5rem]">参考图：</span>
										{#each task.attachedPreviews as preview, i}
											<img
												src={preview}
												alt="参考图 {i + 1}"
												class="h-10 w-10 rounded border object-cover"
											/>
										{/each}
									</div>
								{/if}
								{#if task.error}
									<p class="mt-2 text-sm text-red-500">{task.error}</p>
								{/if}
							</div>

							<div class="flex gap-2">
								{#if task.status === 'error'}
									<Button
										variant="outline"
										size="sm"
										onclick={() => taskManager.retryTask(task.id)}
										class="gap-1"
									>
										<RefreshCw class="h-3 w-3" />
										重试
									</Button>
								{/if}
								<Button
									variant="ghost"
									size="sm"
									onclick={() => taskManager.deleteTask(task.id)}
								>
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>
						</div>
					</div>

					<!-- 任务结果 -->
					{#if task.status === 'success' && task.mediaResources.length > 0}
						<div class="p-4">
							<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
								{#each task.mediaResources as resource, index}
									<div class="overflow-hidden rounded-lg border">
										<button
											class="relative aspect-square w-full bg-muted transition-transform hover:scale-105"
											onclick={() => openGallery(task.mediaResources, index)}
										>
											{#if resource.type === 'image'}
												<img
													src={resource.data}
													alt={resource.filename || `生成的图片 ${index + 1}`}
													class="h-full w-full object-cover"
												/>
											{:else if resource.type === 'video'}
												<video src={resource.data} class="h-full w-full object-cover">
													<track kind="captions" />
												</video>
											{:else if resource.type === 'audio'}
												<div class="flex h-full items-center justify-center p-4">
													<audio src={resource.data} controls class="w-full">
														<track kind="captions" />
													</audio>
												</div>
											{:else}
												<div class="flex h-full items-center justify-center">
													<ImageIcon class="h-16 w-16 text-muted-foreground" />
												</div>
											{/if}
											<!-- 悬停提示 -->
											<div class="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all hover:bg-black/20 hover:opacity-100">
												<span class="text-sm font-medium text-white">点击查看大图</span>
											</div>
										</button>

										<div class="p-3">
											<div class="mb-2 flex items-center justify-between">
												<div class="flex-1 truncate text-xs">
													{#if resource.filename}
														<p class="font-medium">{resource.filename}</p>
													{/if}
													{#if resource.mimeType}
														<p class="text-muted-foreground">{resource.mimeType}</p>
													{/if}
												</div>
											</div>

											<div class="flex gap-2">
												<Button
													variant="outline"
													size="sm"
													class="flex-1 gap-1"
													onclick={() =>
														downloadImage(
															resource.data,
															resource.filename || `image-${index + 1}`,
															index
														)}
												>
													<Download class="h-3 w-3" />
													下载
												</Button>
												{#if !resource.isBase64}
													<Button
														variant="outline"
														size="sm"
														onclick={() => window.open(resource.data, '_blank')}
													>
														<ExternalLink class="h-3 w-3" />
													</Button>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</Card>
			{/each}
		</div>
	{/if}

	<!-- 空状态 -->
	{#if tasks.length === 0}
		<Card class="p-12 text-center">
			<ImageIcon class="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
			<h3 class="mb-2 text-lg font-semibold">开始创作</h3>
			<p class="text-muted-foreground">输入描述或上传参考图片，让 AI 为你生成精美图片</p>
			<p class="mt-2 text-sm text-muted-foreground">支持图生图、多任务并发，可以切换到其他页面继续浏览</p>
		</Card>
	{/if}
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

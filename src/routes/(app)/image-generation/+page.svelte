<script lang="ts">
	import { ImageIcon, LayoutGrid, Clock } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import { taskManager, type MediaResource } from '$lib/stores/task-manager.svelte';
	import ImageGallery from '$lib/components/image-gallery.svelte';
	import { CHAT_ATTACHMENTS, IMAGE_GEN, type AspectRatio } from '$lib/config/constants';
	import { compressImage } from '$lib/utils/image-compress';
	import { setHeaderSlots, clearHeaderSlots } from '$lib/stores/page-header.svelte';
	import * as Tabs from '$lib/components/ui/tabs';
	import {
		TemplateGrid,
		HistoryList,
		ImageGenInputBar,
		type ApiTemplate,
		extractPlaceholders,
		resolvePrompt,
	} from '$lib/components/image-gen';

	// ── State ──
	let activeTab = $state<string>('templates');
	let input = $state('');
	let galleryImages = $state<MediaResource[]>([]);
	let galleryInitialIndex = $state(0);
	let showGallery = $state(false);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let attachedFiles = $state<Array<{ id: string; file: File; previewUrl: string }>>([]);
	let isDragging = $state(false);
	let textareaRef = $state<HTMLTextAreaElement | null>(null);
	let selectedRatio = $state<AspectRatio>(IMAGE_GEN.DEFAULT_ASPECT_RATIO);

	// ── Template state ──
	let templates = $state<ApiTemplate[]>([]);
	let groupedTemplates = $state<Record<string, ApiTemplate[]>>({});
	let templatesLoading = $state(true);
	let selectedTemplate = $state<ApiTemplate | null>(null);
	let placeholderValues = $state<Record<string, string>>({});

	// ── Derived ──
	let stats = $derived(taskManager.stats);
	let tasks = $derived(taskManager.tasks);
	let activeTasks = $derived(tasks.filter((t) => t.status === 'pending' || t.status === 'loading'));
	let completedTasks = $derived(tasks.filter((t) => t.status === 'success' || t.status === 'error'));
	let hasActiveWork = $derived(activeTasks.length > 0);

	onMount(() => {
		taskManager.loadFromHistory();
		loadTemplates();
	});

	// ── Header tab injection ──
	$effect(() => {
		setHeaderSlots({ center: headerCenter });
		return () => clearHeaderSlots();
	});

	// ── Template API ──
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
			// Silent - templates are not critical
		} finally {
			templatesLoading = false;
		}
	}

	function selectTemplate(tpl: ApiTemplate) {
		if (selectedTemplate?.id === tpl.id) {
			deselectTemplate();
			return;
		}
		selectedTemplate = tpl;
		placeholderValues = {};
		const hasPlaceholders = /\{[^}]+\}/.test(tpl.prompt);
		input = hasPlaceholders ? '' : tpl.prompt;
		textareaRef?.focus();
	}

	function deselectTemplate() {
		selectedTemplate = null;
		placeholderValues = {};
		input = '';
	}

	// ── Submit ──
	function handleSubmit() {
		if (selectedTemplate) {
			const { imageCountMin, imageCountMax } = selectedTemplate;
			const count = attachedFiles.length;
			if (!(imageCountMin === 0 && imageCountMax === 0)) {
				if (imageCountMin > 0 && count < imageCountMin) {
					toast.error(`该模板至少需要 ${imageCountMin} 张参考图`);
					return;
				}
				if (imageCountMax > 0 && count > imageCountMax) {
					toast.error(`该模板最多允许 ${imageCountMax} 张参考图`);
					return;
				}
			}
		}

		const placeholders = selectedTemplate ? extractPlaceholders(selectedTemplate.prompt) : [];
		let finalPrompt: string;
		if (selectedTemplate && placeholders.length > 0) {
			finalPrompt = resolvePrompt(selectedTemplate.prompt, placeholderValues);
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

		activeTab = 'history';
		toast.success('已加入创作队列');
	}

	// ── File management ──
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

	// ── Gallery ──
	function openGallery(images: MediaResource[], index: number) {
		galleryImages = images;
		galleryInitialIndex = index;
		showGallery = true;
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

	// ── Drag & Drop ──
	function handleDragOver(e: DragEvent) { e.preventDefault(); isDragging = true; }
	function handleDragLeave(e: DragEvent) { e.preventDefault(); isDragging = false; }
	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer?.files) {
			const images = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
			if (images.length > 0) addFiles(images);
		}
	}

	// ── Keyboard & Paste ──
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
</script>

<!-- ── Header: Tab switcher (plain buttons — rendered in AppTopBar, outside Tabs.Root context) ── -->

{#snippet headerCenter()}
	<div class="bg-muted text-muted-foreground inline-flex h-auto w-fit items-center justify-center rounded-lg bg-muted/60 p-0.5">
		<button
			class="inline-flex h-[calc(100%-1px)] items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-xs font-medium transition-[color,box-shadow] {activeTab === 'templates' ? 'bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30' : 'dark:text-muted-foreground'}"
			onclick={() => (activeTab = 'templates')}
		>
			<LayoutGrid class="h-3.5 w-3.5" />
			模板
		</button>
		<button
			class="relative inline-flex h-[calc(100%-1px)] items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-xs font-medium transition-[color,box-shadow] {activeTab === 'history' ? 'bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30' : 'dark:text-muted-foreground'}"
			onclick={() => (activeTab = 'history')}
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

<!-- ── Page body ── -->

<Tabs.Root bind:value={activeTab} class="relative flex h-full flex-col gap-0">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="flex-1 overflow-y-auto"
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
	>
		<!-- Drag overlay -->
		{#if isDragging}
			<div class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-primary/5 backdrop-blur-[2px]">
				<div class="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-background/80 px-12 py-10">
					<ImageIcon class="h-10 w-10 text-primary/60" />
					<span class="text-sm font-medium text-primary/80">释放以添加参考图片</span>
				</div>
			</div>
		{/if}

		<Tabs.Content value="templates" class="h-full">
			<TemplateGrid
				{templates}
				{groupedTemplates}
				loading={templatesLoading}
				{selectedTemplate}
				{placeholderValues}
				onSelectTemplate={selectTemplate}
				onDeselectTemplate={deselectTemplate}
				onPlaceholderChange={(key, value) => { placeholderValues = { ...placeholderValues, [key]: value }; }}
			/>
		</Tabs.Content>

		<Tabs.Content value="history" class="h-full">
			<HistoryList
				{tasks}
				{activeTasks}
				{completedTasks}
				{stats}
				onSwitchToTemplates={() => (activeTab = 'templates')}
				onOpenGallery={openGallery}
				onDownloadImage={downloadImage}
			/>
		</Tabs.Content>
	</div>

	<ImageGenInputBar
		{input}
		{attachedFiles}
		{selectedTemplate}
		{selectedRatio}
		{isDragging}
		onSubmit={handleSubmit}
		onRemoveFile={removeFile}
		onOpenFilePicker={() => fileInputRef?.click()}
		onSelectRatio={(ratio) => (selectedRatio = ratio)}
		onDeselectTemplate={deselectTemplate}
		onKeyDown={handleKeyDown}
		onPaste={handlePaste}
		onInput={(value) => { input = value; }}
		onTextareaRef={(el) => { textareaRef = el; }}
	/>
</Tabs.Root>

<input
	bind:this={fileInputRef}
	type="file"
	accept={CHAT_ATTACHMENTS.ALLOWED_TYPES.join(',')}
	multiple
	class="hidden"
	onchange={handleFileSelect}
/>

{#if showGallery}
	<ImageGallery images={galleryImages} initialIndex={galleryInitialIndex} onClose={() => (showGallery = false)} />
{/if}

<script lang="ts">
	import { ImageIcon, LayoutGrid, Clock } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import { taskManager } from '$lib/stores/image-gen/task-store.svelte';
	import { getCurrentUser } from '$lib/stores/auth.svelte';
	import { CHAT_ATTACHMENTS, IMAGE_GEN, type AspectRatio } from '$lib/config/constants';
	import { useFileManagement } from '$lib/composables/use-file-management.svelte';
	import { setHeaderSlots, clearHeaderSlots } from '$lib/stores/page-header.svelte';
	import { openGallery } from '$lib/stores/gallery.svelte';
	import * as Tabs from '$lib/components/ui/tabs';
	import {
		TemplateGrid,
		HistoryList,
		ImageGenInputBar,
		TemplatePlaceholderBar,
		type ApiTemplate,
		extractPlaceholders,
		resolvePrompt,
		formatImageCountHint,
	} from '$lib/components/image-gen';

	// ── State ──
	let activeTab = $state<string>('templates');
	let input = $state('');
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let textareaRef = $state<HTMLTextAreaElement | null>(null);
	let selectedRatio = $state<AspectRatio>(IMAGE_GEN.DEFAULT_ASPECT_RATIO);

	// ── File management (composable) ──
	const fileMgr = useFileManagement({
		maxFiles: IMAGE_GEN.MAX_REFERENCE_IMAGES,
		allowedTypes: CHAT_ATTACHMENTS.ALLOWED_TYPES,
		deduplicateByName: true,
	});

	// Alias for template compatibility
	let attachedFiles = $derived(fileMgr.pendingFiles);

	// ── Template state ──
	let templates = $state<ApiTemplate[]>([]);
	let templatesLoading = $state(true);
	let selectedTemplate = $state<ApiTemplate | null>(null);
	let placeholderValues = $state<Record<string, string>>({});
	let selectedCategory = $state<string | null>(null);

	// ── Derived ──
	let user = $derived(getCurrentUser());
	let stats = $derived(taskManager.stats);
	let tasks = $derived(taskManager.tasks);
	let activeTasks = $derived(tasks.filter((t) => t.status === 'pending' || t.status === 'loading'));
	let completedTasks = $derived(tasks.filter((t) => t.status === 'success' || t.status === 'error'));
	let hasActiveWork = $derived(activeTasks.length > 0);

	// ── Template category filter ──
	let categories = $derived([...new Set(templates.map((t) => t.category))]);
	let filteredTemplates = $derived(
		selectedCategory ? templates.filter((t) => t.category === selectedCategory) : templates
	);

	// ── Template-derived ──
	let placeholders = $derived(selectedTemplate ? extractPlaceholders(selectedTemplate.prompt) : []);
	let hasPlaceholders = $derived(placeholders.length > 0);
	let needsImages = $derived(
		selectedTemplate ? !(selectedTemplate.imageCountMin === 0 && selectedTemplate.imageCountMax === 0) : false
	);
	let imageCountHint = $derived(
		selectedTemplate ? formatImageCountHint(selectedTemplate.imageCountMin, selectedTemplate.imageCountMax) : ''
	);
	let currentResolvedPrompt = $derived(
		selectedTemplate && hasPlaceholders ? resolvePrompt(selectedTemplate.prompt, placeholderValues) : input
	);

	onMount(() => {
		loadTemplates();
	});

	// 响应式加载：用户变化时重新加载历史任务
	$effect(() => {
		if (user?.id) {
			taskManager.loadFromHistory();
		}
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
		const tplHasPlaceholders = /\{[^}]+\}/.test(tpl.prompt);
		input = tplHasPlaceholders ? '' : tpl.prompt;
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
		fileMgr.clearAll();
		selectedRatio = IMAGE_GEN.DEFAULT_ASPECT_RATIO;
		if (textareaRef) textareaRef.style.height = 'auto';

		activeTab = 'history';
		toast.success('已加入创作队列');
	}

	// ── File management (delegated to composable) ──
	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files) {
			fileMgr.addFiles(target.files);
			target.value = '';
		}
	}

	// ── Gallery ──
	function downloadImage(data: string, filename: string, index: number) {
		const link = document.createElement('a');
		link.href = data;
		link.download = filename || `generated-image-${index + 1}.png`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		toast.success('下载成功');
	}

	// ── Keyboard ──
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			handleSubmit();
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
		ondragover={fileMgr.handleDragOver}
		ondragleave={fileMgr.handleDragLeave}
		ondrop={fileMgr.handleDrop}
	>
		<!-- Drag overlay -->
		{#if fileMgr.isDragging}
			<div class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-primary/5 backdrop-blur-[2px]">
				<div class="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-background/80 px-12 py-10">
					<ImageIcon class="h-10 w-10 text-primary/60" />
					<span class="text-sm font-medium text-primary/80">释放以添加参考图片</span>
				</div>
			</div>
		{/if}

		<Tabs.Content value="templates" class="h-full">
			<TemplateGrid
				templates={filteredTemplates}
				{categories}
				{selectedCategory}
				onSelectCategory={(cat) => (selectedCategory = cat)}
				loading={templatesLoading}
				{selectedTemplate}
				onSelectTemplate={selectTemplate}
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

	<!-- Bottom bar: only on templates tab -->
	{#if activeTab === 'templates'}
		{#if selectedTemplate && hasPlaceholders}
			<TemplatePlaceholderBar
				template={selectedTemplate}
				{placeholders}
				{placeholderValues}
				resolvedPrompt={currentResolvedPrompt}
				{attachedFiles}
				{selectedRatio}
				{needsImages}
				{imageCountHint}
				isDragging={fileMgr.isDragging}
				onPlaceholderChange={(key, value) => { placeholderValues = { ...placeholderValues, [key]: value }; }}
				onSubmit={handleSubmit}
				onDeselectTemplate={deselectTemplate}
				onRemoveFile={fileMgr.removeFile}
				onOpenFilePicker={() => fileInputRef?.click()}
				onSelectRatio={(ratio) => (selectedRatio = ratio)}
				onKeyDown={handleKeyDown}
				onPaste={fileMgr.handlePaste}
			/>
		{:else}
			<ImageGenInputBar
				{input}
				{attachedFiles}
				{selectedTemplate}
				{selectedRatio}
				isDragging={fileMgr.isDragging}
				onSubmit={handleSubmit}
				onRemoveFile={fileMgr.removeFile}
				onOpenFilePicker={() => fileInputRef?.click()}
				onSelectRatio={(ratio) => (selectedRatio = ratio)}
				onDeselectTemplate={deselectTemplate}
				onKeyDown={handleKeyDown}
				onPaste={fileMgr.handlePaste}
				onInput={(value) => { input = value; }}
				onTextareaRef={(el) => { textareaRef = el; }}
			/>
		{/if}
	{/if}
</Tabs.Root>

<input
	bind:this={fileInputRef}
	type="file"
	accept={CHAT_ATTACHMENTS.ALLOWED_TYPES.join(',')}
	multiple
	class="hidden"
	onchange={handleFileSelect}
/>

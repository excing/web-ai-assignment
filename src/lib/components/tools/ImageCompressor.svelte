<script lang="ts">
	import { Upload, Download, Trash2, Image as ImageIcon, Loader2, RefreshCw } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import Compressor from 'compressorjs';

	// ── State ──
	interface ImageItem {
		id: string;
		file: File;
		previewUrl: string;
		compressed: Blob | null;
		compressedUrl: string | null;
		compressing: boolean;
		originalSize: number;
		compressedSize: number | null;
		isPng: boolean;
		toJpeg: boolean;
	}

	let items = $state<ImageItem[]>([]);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let quality = $state(0.8);
	let maxWidth = $state(1920);
	let scalePercent = $state(100);
	let isProcessingAll = $state(false);

	let hasFiles = $derived(items.length > 0);
	let hasUncompressed = $derived(items.some((i) => !i.compressed && !i.compressing));
	let hasCompressed = $derived(items.some((i) => i.compressed));
	let hasPng = $derived(items.some((i) => i.isPng));
	let totalOriginal = $derived(items.reduce((s, i) => s + i.originalSize, 0));
	let totalCompressed = $derived(
		items.reduce((s, i) => s + (i.compressedSize ?? i.originalSize), 0)
	);

	// ── Helpers ──
	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	function generateId(): string {
		return Math.random().toString(36).slice(2, 10);
	}

	// ── File handling ──
	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files) addFiles(target.files);
		target.value = '';
	}

	function addFiles(files: FileList | File[]) {
		for (const file of Array.from(files)) {
			if (!file.type.startsWith('image/')) {
				toast.error(`不支持的文件类型: ${file.name}`);
				continue;
			}
			const previewUrl = URL.createObjectURL(file);
			const isPng = file.type === 'image/png';
			items = [
				...items,
				{
					id: generateId(),
					file,
					previewUrl,
					compressed: null,
					compressedUrl: null,
					compressing: false,
					originalSize: file.size,
					compressedSize: null,
					isPng,
					toJpeg: false,
				},
			];
		}
	}

	function removeItem(id: string) {
		const item = items.find((i) => i.id === id);
		if (item) {
			URL.revokeObjectURL(item.previewUrl);
			if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
		}
		items = items.filter((i) => i.id !== id);
	}

	function clearAll() {
		for (const item of items) {
			URL.revokeObjectURL(item.previewUrl);
			if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
		}
		items = [];
	}

	// ── Compression ──
	function readImageSize(file: File): Promise<{ w: number; h: number }> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => {
				resolve({ w: img.naturalWidth, h: img.naturalHeight });
				URL.revokeObjectURL(img.src);
			};
			img.onerror = () => {
				URL.revokeObjectURL(img.src);
				reject(new Error('图片加载失败'));
			};
			img.src = URL.createObjectURL(file);
		});
	}

	async function compressOne(item: ImageItem): Promise<void> {
		const idx = items.findIndex((i) => i.id === item.id);
		if (idx === -1) return;

		items[idx].compressing = true;

		try {
			const { w: origW, h: origH } = await readImageSize(item.file);

			// Compute effective maxWidth: take the smaller of scalePercent-derived and maxWidth setting
			const scaleW = scalePercent < 100 ? Math.round(origW * scalePercent / 100) : Infinity;
			const limitW = maxWidth === 99999 ? Infinity : maxWidth;
			const effectiveMaxW = Math.min(scaleW, limitW);
			// Derive maxHeight proportionally so aspect ratio is preserved
			const effectiveMaxH = effectiveMaxW === Infinity
				? Infinity
				: Math.round(origH * (effectiveMaxW / origW));

			await new Promise<void>((resolve) => {
				new Compressor(item.file, {
					quality,
					maxWidth: effectiveMaxW === Infinity ? undefined : effectiveMaxW,
					maxHeight: effectiveMaxH === Infinity ? undefined : effectiveMaxH,
					mimeType: item.toJpeg ? 'image/jpeg' : 'auto',
					convertTypes: item.toJpeg ? ['image/png'] : [],
					convertSize: item.toJpeg ? 0 : Infinity,
					success(result) {
						const i = items.findIndex((x) => x.id === item.id);
						if (i === -1) { resolve(); return; }

						if (items[i].compressedUrl) URL.revokeObjectURL(items[i].compressedUrl!);

						const blob = result instanceof Blob ? result : new Blob([result]);
						items[i].compressed = blob;
						items[i].compressedUrl = URL.createObjectURL(blob);
						items[i].compressedSize = blob.size;
						items[i].compressing = false;
						resolve();
					},
					error(err) {
						const i = items.findIndex((x) => x.id === item.id);
						if (i !== -1) items[i].compressing = false;
						toast.error(`压缩失败: ${item.file.name}`);
						resolve();
					},
				});
			});
		} catch {
			const i = items.findIndex((x) => x.id === item.id);
			if (i !== -1) items[i].compressing = false;
			toast.error(`压缩失败: ${item.file.name}`);
		}
	}

	async function compressAll() {
		isProcessingAll = true;
		const uncompressed = items.filter((i) => !i.compressed && !i.compressing);
		await Promise.all(uncompressed.map((i) => compressOne(i)));
		isProcessingAll = false;
		toast.success('全部压缩完成');
	}

	function resetItem(item: ImageItem) {
		const i = items.findIndex((x) => x.id === item.id);
		if (i === -1) return;
		if (items[i].compressedUrl) URL.revokeObjectURL(items[i].compressedUrl!);
		items[i].compressed = null;
		items[i].compressedUrl = null;
		items[i].compressedSize = null;
	}

	async function recompressOne(item: ImageItem) {
		resetItem(item);
		await compressOne(item);
	}

	async function recompressAll() {
		isProcessingAll = true;
		const compressed = items.filter((i) => i.compressed && !i.compressing);
		for (const item of compressed) resetItem(item);
		await Promise.all(compressed.map((i) => compressOne(i)));
		isProcessingAll = false;
		toast.success('全部重新压缩完成');
	}

	function downloadOne(item: ImageItem) {
		if (!item.compressedUrl || !item.compressed) return;
		const a = document.createElement('a');
		a.href = item.compressedUrl;
		const mimeType = item.compressed.type || item.file.type;
		const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
		const baseName = item.file.name.replace(/\.[^.]+$/, '');
		a.download = `${baseName}_compressed.${ext}`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	function downloadAll() {
		const compressed = items.filter((i) => i.compressed);
		for (const item of compressed) {
			downloadOne(item);
		}
		toast.success(`已下载 ${compressed.length} 张图片`);
	}

	// ── Drag & Drop ──
	let isDragging = $state(false);

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
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="flex h-full flex-col"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	{#if isDragging}
		<div class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-primary/5 backdrop-blur-[2px]">
			<div class="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-background/80 px-12 py-10">
				<ImageIcon class="h-10 w-10 text-primary/60" />
				<span class="text-sm font-medium text-primary/80">释放以添加图片</span>
			</div>
		</div>
	{/if}

	<div class="flex-1 overflow-y-auto">
		{#if !hasFiles}
			<!-- Empty state -->
			<div class="flex h-full flex-col items-center justify-center gap-4 px-4">
				<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10">
					<ImageIcon class="h-8 w-8 text-blue-500" />
				</div>
				<div class="text-center">
					<p class="text-sm font-medium">选择或拖拽图片</p>
					<p class="mt-1 text-xs text-muted-foreground">支持 JPG、PNG、WebP 格式</p>
				</div>
				<Button variant="outline" size="sm" onclick={() => fileInputRef?.click()}>
					<Upload class="mr-1.5 h-3.5 w-3.5" />
					选择图片
				</Button>
			</div>
		{:else}
			<div class="mx-auto max-w-2xl space-y-4 px-4 py-4 sm:px-6">
				<!-- Settings bar -->
				<div class="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-card p-3 text-sm">
					<label class="flex items-center gap-2">
						<span class="text-xs text-muted-foreground">质量</span>
						<input
							type="range"
							min="0.1"
							max="1"
							step="0.05"
							bind:value={quality}
							class="h-1.5 w-20 accent-primary"
						/>
						<span class="w-9 text-right text-xs font-medium">{Math.round(quality * 100)}%</span>
					</label>
					<label class="flex items-center gap-2">
						<span class="text-xs text-muted-foreground">缩放</span>
						<input
							type="range"
							min="10"
							max="100"
							step="5"
							bind:value={scalePercent}
							class="h-1.5 w-20 accent-primary"
						/>
						<span class="w-9 text-right text-xs font-medium">{scalePercent}%</span>
					</label>
					<label class="flex items-center gap-2">
						<span class="text-xs text-muted-foreground">最大宽度</span>
						<select bind:value={maxWidth} class="rounded border bg-background px-2 py-0.5 text-xs">
							<option value={640}>640px</option>
							<option value={1280}>1280px</option>
							<option value={1920}>1920px</option>
							<option value={2560}>2560px</option>
							<option value={99999}>不限</option>
						</select>
					</label>
					{#if hasPng}
						<label class="flex cursor-pointer items-center gap-1.5">
							<input
								type="checkbox"
								checked={items.filter((i) => i.isPng).every((i) => i.toJpeg)}
								onchange={(e) => {
									const checked = (e.target as HTMLInputElement).checked;
									items = items.map((i) => i.isPng ? { ...i, toJpeg: checked } : i);
								}}
								class="h-3 w-3 accent-primary"
							/>
							<span class="text-xs text-muted-foreground">PNG 转 JPEG</span>
						</label>
					{/if}
					<div class="ml-auto flex items-center gap-2">
						<Button variant="outline" size="sm" class="h-7 text-xs" onclick={() => fileInputRef?.click()}>
							<Upload class="mr-1 h-3 w-3" />
							添加
						</Button>
						<Button variant="outline" size="sm" class="h-7 text-xs text-destructive hover:text-destructive" onclick={clearAll}>
							<Trash2 class="mr-1 h-3 w-3" />
							清空
						</Button>
					</div>
				</div>

				<!-- Stats -->
				{#if hasCompressed}
					<div class="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-xs">
						<span class="text-muted-foreground">
							原始 <strong class="text-foreground">{formatSize(totalOriginal)}</strong>
							→ 压缩后 <strong class="text-foreground">{formatSize(totalCompressed)}</strong>
						</span>
						<span class="font-medium text-emerald-600 dark:text-emerald-400">
							-{Math.round((1 - totalCompressed / totalOriginal) * 100)}%
						</span>
					</div>
				{/if}

				<!-- Image list -->
				<div class="space-y-2">
					{#each items as item (item.id)}
						<div class="flex items-center gap-3 rounded-lg border bg-card p-2.5">
							<div class="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
								<img
									src={item.compressedUrl ?? item.previewUrl}
									alt={item.file.name}
									class="h-full w-full object-cover"
								/>
								{#if item.compressing}
									<div class="absolute inset-0 flex items-center justify-center bg-background/60">
										<Loader2 class="h-5 w-5 animate-spin text-primary" />
									</div>
								{/if}
							</div>

							<div class="min-w-0 flex-1">
								<p class="truncate text-xs font-medium">{item.file.name}</p>
								<div class="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
									<span>{formatSize(item.originalSize)}</span>
									{#if item.compressedSize !== null}
										<span>→</span>
										<span class="font-medium text-emerald-600 dark:text-emerald-400">
											{formatSize(item.compressedSize)}
											({item.compressedSize < item.originalSize
												? `-${Math.round((1 - item.compressedSize / item.originalSize) * 100)}%`
												: '无变化'})
										</span>
									{/if}
								</div>
								{#if item.isPng}
									<label class="mt-1 flex w-fit cursor-pointer items-center gap-1.5">
										<input
											type="checkbox"
											bind:checked={item.toJpeg}
											class="h-3 w-3 accent-primary"
										/>
										<span class="text-[11px] text-muted-foreground">转为 JPEG</span>
									</label>
								{/if}
							</div>

							<div class="flex shrink-0 items-center gap-1">
								{#if item.compressed}
									<button
										onclick={() => recompressOne(item)}
										class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
										title="重新压缩"
									>
										<RefreshCw class="h-3.5 w-3.5" />
									</button>
									<button
										onclick={() => downloadOne(item)}
										class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
										title="下载"
									>
										<Download class="h-3.5 w-3.5" />
									</button>
								{:else if !item.compressing}
									<Button variant="ghost" size="sm" class="h-7 text-xs" onclick={() => compressOne(item)}>
										压缩
									</Button>
								{/if}
								<button
									onclick={() => removeItem(item.id)}
									class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
									title="移除"
								>
									<Trash2 class="h-3.5 w-3.5" />
								</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- Bottom action bar -->
	{#if hasFiles}
		<div class="border-t bg-background px-4 py-3">
			<div class="mx-auto flex max-w-2xl items-center justify-end gap-2">
				{#if hasUncompressed}
					<Button size="sm" onclick={compressAll} disabled={isProcessingAll}>
						{#if isProcessingAll}
							<Loader2 class="mr-1.5 h-3.5 w-3.5 animate-spin" />
							压缩中…
						{:else}
							全部压缩
						{/if}
					</Button>
				{/if}
				{#if hasCompressed && !hasUncompressed}
					<Button variant="outline" size="sm" onclick={recompressAll} disabled={isProcessingAll}>
						{#if isProcessingAll}
							<Loader2 class="mr-1.5 h-3.5 w-3.5 animate-spin" />
							压缩中…
						{:else}
							<RefreshCw class="mr-1.5 h-3.5 w-3.5" />
							全部重新压缩
						{/if}
					</Button>
				{/if}
				{#if hasCompressed}
					<Button variant="outline" size="sm" onclick={downloadAll}>
						<Download class="mr-1.5 h-3.5 w-3.5" />
						全部下载
					</Button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<input
	bind:this={fileInputRef}
	type="file"
	accept="image/jpeg,image/png,image/webp"
	multiple
	class="hidden"
	onchange={handleFileSelect}
/>

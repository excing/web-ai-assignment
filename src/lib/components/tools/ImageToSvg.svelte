<script lang="ts">
	import {
		Upload,
		Download,
		Trash2,
		Image as ImageIcon,
		Loader2,
		RefreshCw,
		Settings2,
		ChevronDown,
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';

	// ── Types ──
	type ClusteringMode = 'color' | 'binary';
	type Hierarchical = 'stacked' | 'cutout';
	type CurveMode = 'spline' | 'polygon' | 'none';

	interface ConvertParams {
		clusteringMode: ClusteringMode;
		hierarchical: Hierarchical;
		mode: CurveMode;
		filterSpeckle: number;
		colorPrecision: number;
		layerDifference: number;
		cornerThreshold: number;
		lengthThreshold: number;
		spliceThreshold: number;
		pathPrecision: number;
	}

	// ── State ──
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let canvasRef = $state<HTMLCanvasElement | null>(null);
	let wasmSvgContainerRef = $state<HTMLDivElement | null>(null);
	let sourceFile = $state<File | null>(null);
	let sourceUrl = $state<string | null>(null);
	let svgResult = $state<string | null>(null);
	let svgMarkup = $state<string | null>(null);
	let isConverting = $state(false);
	let progressValue = $state(0);
	let isDragging = $state(false);
	let showSettings = $state(false);
	let imageSize = $state<{ w: number; h: number } | null>(null);
	let svgSize = $state<number | null>(null);

	// ── Conversion Parameters ──
	let params = $state<ConvertParams>({
		clusteringMode: 'color',
		hierarchical: 'stacked',
		mode: 'spline',
		filterSpeckle: 4,
		colorPrecision: 6,
		layerDifference: 16,
		cornerThreshold: 60,
		lengthThreshold: 4,
		spliceThreshold: 45,
		pathPrecision: 8,
	});

	let hasSource = $derived(!!sourceFile);
	let hasResult = $derived(!!svgResult);

	// ── Helpers ──
	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	function deg2rad(deg: number): number {
		return (deg / 180) * Math.PI;
	}

	// ── File handling ──
	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			loadImage(target.files[0]);
		}
		target.value = '';
	}

	function loadImage(file: File) {
		if (!file.type.startsWith('image/')) {
			toast.error(`不支持的文件类型: ${file.name}`);
			return;
		}
		cleanup();
		sourceFile = file;
		sourceUrl = URL.createObjectURL(file);
	}

	function cleanup() {
		if (sourceUrl) URL.revokeObjectURL(sourceUrl);
		sourceFile = null;
		sourceUrl = null;
		svgResult = null;
		svgMarkup = null;
		svgSize = null;
		imageSize = null;
		progressValue = 0;
	}

	// ── WASM Conversion ──
	async function convert() {
		if (!sourceUrl || !canvasRef || !wasmSvgContainerRef) return;

		isConverting = true;
		progressValue = 0;
		svgResult = null;
		svgMarkup = null;
		svgSize = null;

		try {
			// Load image into canvas
			const img = new Image();
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () => reject(new Error('图片加载失败'));
				img.src = sourceUrl!;
			});

			const width = img.naturalWidth;
			const height = img.naturalHeight;
			imageSize = { w: width, h: height };

			canvasRef.width = width;
			canvasRef.height = height;
			const ctx = canvasRef.getContext('2d')!;
			ctx.drawImage(img, 0, 0, width, height);

			// Prepare hidden SVG element for WASM to write into
			const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svgEl.setAttribute('id', '__vtracer_svg__');
			svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
			svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
			wasmSvgContainerRef.innerHTML = '';
			wasmSvgContainerRef.appendChild(svgEl);

			// Ensure canvas has id for WASM
			canvasRef.id = '__vtracer_canvas__';

			// Build converter params
			const converterParams = JSON.stringify({
				canvas_id: '__vtracer_canvas__',
				svg_id: '__vtracer_svg__',
				mode: params.mode,
				clustering_mode: params.clusteringMode,
				hierarchical: params.hierarchical,
				corner_threshold: deg2rad(params.cornerThreshold),
				length_threshold: params.lengthThreshold,
				max_iterations: 10,
				splice_threshold: deg2rad(params.spliceThreshold),
				filter_speckle: params.filterSpeckle * params.filterSpeckle,
				color_precision: 8 - params.colorPrecision,
				layer_difference: params.layerDifference,
				path_precision: params.pathPrecision,
			});

			// Dynamic import WASM module (client-side only)
			const vtracer = await import('vtracer-webapp');

			const ConverterClass =
				params.clusteringMode === 'color'
					? vtracer.ColorImageConverter
					: vtracer.BinaryImageConverter;

			const converter = ConverterClass.new_with_string(converterParams);
			converter.init();

			// Run conversion in non-blocking ticks
			await new Promise<void>((resolve) => {
				function tick() {
					if (!converter) {
						resolve();
						return;
					}
					let done = false;
					const startTick = performance.now();
					while (!(done = converter.tick()) && performance.now() - startTick < 25) {
						// batch ticks within 25ms for smoother UI
					}
					progressValue = converter.progress();
					if (done || progressValue >= 100) {
						converter.free();
						resolve();
					} else {
						setTimeout(tick, 1);
					}
				}
				setTimeout(tick, 1);
			});

			// Extract SVG string from the hidden WASM container
			const svgOutput = wasmSvgContainerRef.querySelector('svg');
			if (svgOutput) {
				const serializer = new XMLSerializer();
				const rawSvg = serializer.serializeToString(svgOutput);
				svgMarkup = rawSvg;
				svgResult =
					`<?xml version="1.0" encoding="UTF-8"?>\n` +
					`<!-- Generator: visioncortex VTracer -->\n` +
					rawSvg;
				svgSize = new Blob([svgResult]).size;
			}

			toast.success('转换完成');
		} catch (err) {
			console.error('VTracer conversion failed:', err);
			toast.error('转换失败，请重试');
		} finally {
			isConverting = false;
		}
	}

	function downloadSvg() {
		if (!svgResult || !sourceFile) return;
		const blob = new Blob([svgResult], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const baseName = sourceFile.name.replace(/\.[^.]+$/, '');
		a.download = `${baseName}.svg`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	async function reconvert() {
		svgResult = null;
		svgMarkup = null;
		svgSize = null;
		await convert();
	}

	// ── Drag & Drop ──
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
		const files = e.dataTransfer?.files;
		if (files && files[0]) {
			const file = Array.from(files).find((f) => f.type.startsWith('image/'));
			if (file) loadImage(file);
		}
	}

	// ── Clipboard Paste ──
	function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of Array.from(items)) {
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) {
					loadImage(file);
					e.preventDefault();
					return;
				}
			}
		}
	}
</script>

<svelte:window onpaste={handlePaste} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="flex h-full flex-col"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	{#if isDragging}
		<div
			class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-primary/5 backdrop-blur-[2px]"
		>
			<div
				class="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-background/80 px-12 py-10"
			>
				<ImageIcon class="h-10 w-10 text-primary/60" />
				<span class="text-sm font-medium text-primary/80">释放以添加图片</span>
			</div>
		</div>
	{/if}

	<div class="flex-1 overflow-y-auto">
		{#if !hasSource}
			<!-- Empty state -->
			<div class="flex h-full flex-col items-center justify-center gap-4 px-4">
				<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10">
					<ImageIcon class="h-8 w-8 text-violet-500" />
				</div>
				<div class="text-center">
					<p class="text-sm font-medium">选择或拖拽图片</p>
					<p class="mt-1 text-xs text-muted-foreground">
						支持 JPG、PNG、WebP 格式，可粘贴剪贴板图片
					</p>
				</div>
				<Button variant="outline" size="sm" onclick={() => fileInputRef?.click()}>
					<Upload class="mr-1.5 h-3.5 w-3.5" />
					选择图片
				</Button>
			</div>
		{:else}
			<div class="mx-auto max-w-2xl space-y-4 px-4 py-4 sm:px-6">
				<!-- Settings panel -->
				<div class="rounded-lg border bg-card">
					<button
						onclick={() => (showSettings = !showSettings)}
						class="flex w-full items-center justify-between p-3 text-sm"
					>
						<div class="flex items-center gap-2">
							<Settings2 class="h-3.5 w-3.5 text-muted-foreground" />
							<span class="text-xs font-medium">转换参数</span>
						</div>
						<ChevronDown
							class="h-3.5 w-3.5 text-muted-foreground transition-transform {showSettings
								? 'rotate-180'
								: ''}"
						/>
					</button>

					{#if showSettings}
						<div class="space-y-3 border-t px-3 pb-3 pt-3">
							<!-- Clustering Mode -->
							<div class="flex items-center gap-3">
								<span class="w-20 shrink-0 text-xs text-muted-foreground">聚类模式</span>
								<div class="flex gap-1">
									{#each [{ value: 'color', label: '彩色' }, { value: 'binary', label: '黑白' }] as opt}
										<button
											onclick={() => (params.clusteringMode = opt.value as ClusteringMode)}
											class="rounded-md px-2.5 py-1 text-xs transition-colors {params.clusteringMode ===
											opt.value
												? 'bg-primary text-primary-foreground'
												: 'bg-muted text-muted-foreground hover:text-foreground'}"
										>
											{opt.label}
										</button>
									{/each}
								</div>
							</div>

							<!-- Hierarchical (color mode only) -->
							{#if params.clusteringMode === 'color'}
								<div class="flex items-center gap-3">
									<span class="w-20 shrink-0 text-xs text-muted-foreground">层次模式</span>
									<div class="flex gap-1">
										{#each [{ value: 'stacked', label: '堆叠' }, { value: 'cutout', label: '切割' }] as opt}
											<button
												onclick={() => (params.hierarchical = opt.value as Hierarchical)}
												class="rounded-md px-2.5 py-1 text-xs transition-colors {params.hierarchical ===
												opt.value
													? 'bg-primary text-primary-foreground'
													: 'bg-muted text-muted-foreground hover:text-foreground'}"
											>
												{opt.label}
											</button>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Curve Fitting -->
							<div class="flex items-center gap-3">
								<span class="w-20 shrink-0 text-xs text-muted-foreground">曲线拟合</span>
								<div class="flex gap-1">
									{#each [{ value: 'spline', label: '样条' }, { value: 'polygon', label: '多边形' }, { value: 'none', label: '像素' }] as opt}
										<button
											onclick={() => (params.mode = opt.value as CurveMode)}
											class="rounded-md px-2.5 py-1 text-xs transition-colors {params.mode ===
											opt.value
												? 'bg-primary text-primary-foreground'
												: 'bg-muted text-muted-foreground hover:text-foreground'}"
										>
											{opt.label}
										</button>
									{/each}
								</div>
							</div>

							<!-- Sliders -->
							<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
								<label class="flex items-center gap-2">
									<span class="w-20 shrink-0 text-xs text-muted-foreground">过滤斑点</span>
									<input
										type="range"
										min="0"
										max="16"
										step="1"
										bind:value={params.filterSpeckle}
										class="h-1.5 flex-1 accent-primary"
									/>
									<span class="w-6 text-right text-xs font-medium">{params.filterSpeckle}</span
									>
								</label>

								{#if params.clusteringMode === 'color'}
									<label class="flex items-center gap-2">
										<span class="w-20 shrink-0 text-xs text-muted-foreground">色彩精度</span>
										<input
											type="range"
											min="1"
											max="8"
											step="1"
											bind:value={params.colorPrecision}
											class="h-1.5 flex-1 accent-primary"
										/>
										<span class="w-6 text-right text-xs font-medium"
											>{params.colorPrecision}</span
										>
									</label>

									<label class="flex items-center gap-2">
										<span class="w-20 shrink-0 text-xs text-muted-foreground">层差值</span>
										<input
											type="range"
											min="0"
											max="255"
											step="1"
											bind:value={params.layerDifference}
											class="h-1.5 flex-1 accent-primary"
										/>
										<span class="w-6 text-right text-xs font-medium"
											>{params.layerDifference}</span
										>
									</label>
								{/if}

								<label class="flex items-center gap-2">
									<span class="w-20 shrink-0 text-xs text-muted-foreground">路径精度</span>
									<input
										type="range"
										min="1"
										max="10"
										step="1"
										bind:value={params.pathPrecision}
										class="h-1.5 flex-1 accent-primary"
									/>
									<span class="w-6 text-right text-xs font-medium">{params.pathPrecision}</span
									>
								</label>

								{#if params.mode === 'spline'}
									<label class="flex items-center gap-2">
										<span class="w-20 shrink-0 text-xs text-muted-foreground">拐角阈值</span>
										<input
											type="range"
											min="0"
											max="180"
											step="1"
											bind:value={params.cornerThreshold}
											class="h-1.5 flex-1 accent-primary"
										/>
										<span class="w-6 text-right text-xs font-medium"
											>{params.cornerThreshold}</span
										>
									</label>

									<label class="flex items-center gap-2">
										<span class="w-20 shrink-0 text-xs text-muted-foreground">线段长度</span>
										<input
											type="range"
											min="0"
											max="20"
											step="0.5"
											bind:value={params.lengthThreshold}
											class="h-1.5 flex-1 accent-primary"
										/>
										<span class="w-6 text-right text-xs font-medium"
											>{params.lengthThreshold}</span
										>
									</label>

									<label class="flex items-center gap-2">
										<span class="w-20 shrink-0 text-xs text-muted-foreground">拼接阈值</span>
										<input
											type="range"
											min="0"
											max="180"
											step="1"
											bind:value={params.spliceThreshold}
											class="h-1.5 flex-1 accent-primary"
										/>
										<span class="w-6 text-right text-xs font-medium"
											>{params.spliceThreshold}</span
										>
									</label>
								{/if}
							</div>
						</div>
					{/if}
				</div>

				<!-- Stats -->
				{#if hasResult && sourceFile && svgSize}
					<div class="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-xs">
						<span class="text-muted-foreground">
							原始 <strong class="text-foreground">{formatSize(sourceFile.size)}</strong>
							{#if imageSize}
								<span class="text-muted-foreground/70">
									({imageSize.w} x {imageSize.h})
								</span>
							{/if}
							&nbsp;→&nbsp; SVG <strong class="text-foreground">{formatSize(svgSize)}</strong>
						</span>
					</div>
				{/if}

				<!-- Progress -->
				{#if isConverting}
					<div class="rounded-lg border bg-card px-3 py-3">
						<div class="mb-2 flex items-center gap-2">
							<Loader2 class="h-3.5 w-3.5 animate-spin text-primary" />
							<span class="text-xs text-muted-foreground">正在转换…</span>
							<span class="ml-auto text-xs font-medium">{Math.min(progressValue, 100)}%</span>
						</div>
						<div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
							<div
								class="h-full rounded-full bg-primary transition-all duration-200"
								style="width: {Math.min(progressValue, 100)}%"
							></div>
						</div>
					</div>
				{/if}

				<!-- Preview area -->
				<div class="overflow-hidden rounded-lg border bg-card">
					{#if hasResult && svgMarkup}
						<!-- SVG Preview rendered from serialized string -->
						{@html svgMarkup}
					{:else if sourceUrl}
						<!-- Source image preview -->
							<img
								src={sourceUrl}
								alt="原图预览"
							/>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Bottom action bar -->
	{#if hasSource}
		<div class="border-t bg-background px-4 py-3">
			<div class="mx-auto flex max-w-2xl items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						class="h-7 text-xs"
						onclick={() => fileInputRef?.click()}
					>
						<Upload class="mr-1 h-3 w-3" />
						更换
					</Button>
					<Button
						variant="outline"
						size="sm"
						class="h-7 text-xs text-destructive hover:text-destructive"
						onclick={cleanup}
					>
						<Trash2 class="mr-1 h-3 w-3" />
						清空
					</Button>
				</div>
				<div class="flex items-center gap-2">
					{#if hasResult}
						<Button variant="outline" size="sm" onclick={reconvert} disabled={isConverting}>
							<RefreshCw class="mr-1.5 h-3.5 w-3.5" />
							重新转换
						</Button>
						<Button size="sm" onclick={downloadSvg}>
							<Download class="mr-1.5 h-3.5 w-3.5" />
							下载 SVG
						</Button>
					{:else}
						<Button size="sm" onclick={convert} disabled={isConverting}>
							{#if isConverting}
								<Loader2 class="mr-1.5 h-3.5 w-3.5 animate-spin" />
								转换中…
							{:else}
								开始转换
							{/if}
						</Button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Hidden elements for WASM processing (always in DOM) -->
<canvas bind:this={canvasRef} class="hidden"></canvas>
<div bind:this={wasmSvgContainerRef} class="hidden"></div>

<input
	bind:this={fileInputRef}
	type="file"
	accept="image/jpeg,image/png,image/webp,image/bmp,image/gif"
	class="hidden"
	onchange={handleFileSelect}
/>

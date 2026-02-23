<script lang="ts">
	import { Upload, Download, Trash2, Image as ImageIcon, Loader2, RotateCcw } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { onMount } from 'svelte';

	// ── State ──
	let leftFile = $state<{ file: File; previewUrl: string } | null>(null);
	let rightFile = $state<{ file: File; previewUrl: string } | null>(null);
	let leftInputRef = $state<HTMLInputElement | null>(null);
	let rightInputRef = $state<HTMLInputElement | null>(null);
	let resultUrl = $state<string | null>(null);
	let isGenerating = $state(false);
	let dividerWidth = $state(4);

	// ── Interactive preview state ──
	let previewContainer = $state<HTMLDivElement | null>(null);
	/** Divider position as fraction 0–1 (0.5 = center) */
	let splitPos = $state(0.5);
	let isDraggingDivider = $state(false);

	let canGenerate = $derived(!!leftFile && !!rightFile && !isGenerating);
	let bothLoaded = $derived(!!leftFile && !!rightFile);

	// ── File handling ──
	function setFile(side: 'left' | 'right', file: File) {
		if (!file.type.startsWith('image/')) {
			toast.error('请选择图片文件');
			return;
		}
		const previewUrl = URL.createObjectURL(file);
		const entry = { file, previewUrl };

		if (side === 'left') {
			if (leftFile) URL.revokeObjectURL(leftFile.previewUrl);
			leftFile = entry;
		} else {
			if (rightFile) URL.revokeObjectURL(rightFile.previewUrl);
			rightFile = entry;
		}

		if (resultUrl) {
			URL.revokeObjectURL(resultUrl);
			resultUrl = null;
		}
		splitPos = 0.5;
	}

	function handleFileSelect(side: 'left' | 'right', e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files?.[0]) setFile(side, target.files[0]);
		target.value = '';
	}

	function clearSide(side: 'left' | 'right') {
		if (side === 'left' && leftFile) {
			URL.revokeObjectURL(leftFile.previewUrl);
			leftFile = null;
		}
		if (side === 'right' && rightFile) {
			URL.revokeObjectURL(rightFile.previewUrl);
			rightFile = null;
		}
		if (resultUrl) {
			URL.revokeObjectURL(resultUrl);
			resultUrl = null;
		}
	}

	function clearAll() {
		if (leftFile) URL.revokeObjectURL(leftFile.previewUrl);
		if (rightFile) URL.revokeObjectURL(rightFile.previewUrl);
		if (resultUrl) URL.revokeObjectURL(resultUrl);
		leftFile = null;
		rightFile = null;
		resultUrl = null;
		splitPos = 0.5;
	}

	function resetSplit() {
		splitPos = 0.5;
	}

	// ── Drop handlers per side ──
	let draggingSide = $state<'left' | 'right' | null>(null);

	function handleSideDragOver(side: 'left' | 'right', e: DragEvent) {
		e.preventDefault();
		draggingSide = side;
	}

	function handleSideDragLeave(e: DragEvent) {
		e.preventDefault();
		draggingSide = null;
	}

	function handleSideDrop(side: 'left' | 'right', e: DragEvent) {
		e.preventDefault();
		draggingSide = null;
		const file = Array.from(e.dataTransfer?.files ?? []).find((f) => f.type.startsWith('image/'));
		if (file) setFile(side, file);
	}

	// ── Divider drag logic ──
	function startDividerDrag(e: PointerEvent) {
		isDraggingDivider = true;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
		updateSplitFromPointer(e);
	}

	function onDividerMove(e: PointerEvent) {
		if (!isDraggingDivider) return;
		updateSplitFromPointer(e);
	}

	function stopDividerDrag() {
		isDraggingDivider = false;
	}

	function updateSplitFromPointer(e: PointerEvent) {
		if (!previewContainer) return;
		const rect = previewContainer.getBoundingClientRect();
		const x = e.clientX - rect.left;
		splitPos = Math.max(0.05, Math.min(0.95, x / rect.width));
	}

	// ── Touch support for divider ──
	function handleTouchStart(e: TouchEvent) {
		if (e.touches.length !== 1) return;
		isDraggingDivider = true;
		updateSplitFromTouch(e.touches[0]);
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isDraggingDivider || e.touches.length !== 1) return;
		e.preventDefault();
		updateSplitFromTouch(e.touches[0]);
	}

	function handleTouchEnd() {
		isDraggingDivider = false;
	}

	function updateSplitFromTouch(touch: Touch) {
		if (!previewContainer) return;
		const rect = previewContainer.getBoundingClientRect();
		const x = touch.clientX - rect.left;
		splitPos = Math.max(0.05, Math.min(0.95, x / rect.width));
	}

	// ── Canvas generation ──
	function loadImage(src: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error('图片加载失败'));
			img.src = src;
		});
	}

	async function generate() {
		if (!leftFile || !rightFile) return;
		isGenerating = true;

		try {
			const [imgL, imgR] = await Promise.all([
				loadImage(leftFile.previewUrl),
				loadImage(rightFile.previewUrl),
			]);

			// Use the larger height as reference, max 2048
			const targetH = Math.min(Math.max(imgL.naturalHeight, imgR.naturalHeight), 2048);

			// Scale both images to targetH, use full width
			const scaleL = targetH / imgL.naturalHeight;
			const scaleR = targetH / imgR.naturalHeight;
			const fullW_L = Math.round(imgL.naturalWidth * scaleL);
			const fullW_R = Math.round(imgR.naturalWidth * scaleR);

			// Use the larger width as output width
			const outputW = Math.max(fullW_L, fullW_R);

			// Split position determines how much of each image to show
			const leftVisibleW = Math.round(outputW * splitPos);
			const rightVisibleW = outputW - leftVisibleW - dividerWidth;

			const totalW = leftVisibleW + dividerWidth + rightVisibleW;

			const canvas = document.createElement('canvas');
			canvas.width = totalW;
			canvas.height = targetH;
			const ctx = canvas.getContext('2d')!;

			// Draw left image — show left portion up to splitPos
			const srcLCropW = (leftVisibleW / fullW_L) * imgL.naturalWidth;
			ctx.drawImage(
				imgL,
				0, 0, srcLCropW, imgL.naturalHeight,
				0, 0, leftVisibleW, targetH
			);

			// Draw right image — show right portion from splitPos
			const srcRStartX = ((outputW * splitPos + dividerWidth) / fullW_R) * imgR.naturalWidth;
			const srcRCropW = imgR.naturalWidth - srcRStartX;
			ctx.drawImage(
				imgR,
				srcRStartX, 0, srcRCropW, imgR.naturalHeight,
				leftVisibleW + dividerWidth, 0, rightVisibleW, targetH
			);

			// Divider line
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(leftVisibleW, 0, dividerWidth, targetH);

			const blob = await new Promise<Blob>((resolve, reject) => {
				canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('生成失败'))), 'image/png');
			});

			if (resultUrl) URL.revokeObjectURL(resultUrl);
			resultUrl = URL.createObjectURL(blob);
			toast.success('对比图已生成');
		} catch (err) {
			toast.error('生成失败，请重试');
			console.error(err);
		} finally {
			isGenerating = false;
		}
	}

	function downloadResult() {
		if (!resultUrl) return;
		const a = document.createElement('a');
		a.href = resultUrl;
		a.download = `compare_${Date.now()}.png`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		toast.success('已下载');
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex-1 overflow-y-auto">
		<div class="mx-auto max-w-2xl space-y-4 px-4 py-4 sm:px-6">
			<!-- Two upload slots -->
			<div class="grid grid-cols-2 gap-3">
				{#each [{ side: 'left' as const, label: '左图', data: leftFile }, { side: 'right' as const, label: '右图', data: rightFile }] as slot (slot.side)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="relative flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-3 transition-colors {draggingSide === slot.side ? 'border-primary bg-primary/5' : 'border-muted-foreground/20'}"
						ondragover={(e) => handleSideDragOver(slot.side, e)}
						ondragleave={handleSideDragLeave}
						ondrop={(e) => handleSideDrop(slot.side, e)}
					>
						<span class="text-[11px] font-medium text-muted-foreground">{slot.label}</span>

						{#if slot.data}
							<div class="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
								<img
									src={slot.data.previewUrl}
									alt={slot.label}
									class="h-full w-full object-contain"
								/>
								<button
									onclick={() => clearSide(slot.side)}
									class="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow-sm transition-colors hover:bg-destructive/10 hover:text-destructive"
								>
									<Trash2 class="h-3 w-3" />
								</button>
							</div>
							<Button
								variant="ghost"
								size="sm"
								class="h-7 text-xs"
								onclick={() => (slot.side === 'left' ? leftInputRef : rightInputRef)?.click()}
							>
								更换图片
							</Button>
						{:else}
							<button
								onclick={() => (slot.side === 'left' ? leftInputRef : rightInputRef)?.click()}
								class="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg bg-muted/40 transition-colors hover:bg-muted"
							>
								<Upload class="h-6 w-6 text-muted-foreground/60" />
								<span class="text-xs text-muted-foreground">点击或拖拽</span>
							</button>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Interactive preview with draggable divider -->
			{#if bothLoaded}
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<p class="text-xs font-medium text-muted-foreground">拖动分隔线预览对比</p>
						{#if Math.abs(splitPos - 0.5) > 0.01}
							<button
								onclick={resetSplit}
								class="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
							>
								<RotateCcw class="h-3 w-3" />
								还原居中
							</button>
						{/if}
					</div>

					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						bind:this={previewContainer}
						class="relative select-none overflow-hidden rounded-xl border bg-muted/30"
						style="touch-action: none;"
						onpointerdown={startDividerDrag}
						onpointermove={onDividerMove}
						onpointerup={stopDividerDrag}
						onpointercancel={stopDividerDrag}
					>
						<!-- Left image (full, clipped by container) -->
						<div class="relative w-full">
							<img
								src={leftFile!.previewUrl}
								alt="左图"
								class="block w-full"
								draggable="false"
							/>
						</div>

						<!-- Right image overlay, clipped from splitPos -->
						<div
							class="absolute inset-0 overflow-hidden"
							style="clip-path: inset(0 0 0 {splitPos * 100}%);"
						>
							<img
								src={rightFile!.previewUrl}
								alt="右图"
								class="block w-full"
								draggable="false"
							/>
						</div>

						<!-- Divider handle -->
						<div
							class="absolute top-0 bottom-0 z-10"
							style="left: calc({splitPos * 100}% - {dividerWidth / 2}px); width: {dividerWidth}px;"
						>
							<div class="h-full w-full bg-white shadow-md"></div>
						</div>

						<!-- Drag handle knob -->
						<div
							class="absolute top-1/2 z-20 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-background shadow-lg transition-transform {isDraggingDivider ? 'scale-110' : ''}"
							style="left: {splitPos * 100}%; cursor: ew-resize;"
						>
							<svg width="12" height="12" viewBox="0 0 12 12" class="text-muted-foreground">
								<line x1="3" y1="2" x2="3" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
								<line x1="9" y1="2" x2="9" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
							</svg>
						</div>
					</div>
				</div>
			{/if}

			<!-- Settings -->
			<div class="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
				<label class="flex items-center gap-2">
					<span class="text-xs text-muted-foreground">分隔线宽度</span>
					<input
						type="range"
						min="1"
						max="12"
						step="1"
						bind:value={dividerWidth}
						class="h-1.5 w-20 accent-primary"
					/>
					<span class="w-6 text-right text-xs font-medium">{dividerWidth}px</span>
				</label>
			</div>

			<!-- Result preview -->
			{#if resultUrl}
				<div class="space-y-2">
					<p class="text-xs font-medium text-muted-foreground">生成结果</p>
					<div class="overflow-hidden rounded-xl border bg-muted/30">
						<img src={resultUrl} alt="对比结果" class="w-full" />
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Bottom action bar -->
	<div class="border-t bg-background px-4 py-3">
		<div class="mx-auto flex max-w-2xl items-center justify-end gap-2">
			{#if leftFile || rightFile}
				<Button variant="ghost" size="sm" onclick={clearAll} class="text-xs text-muted-foreground">
					清空
				</Button>
			{/if}
			<Button size="sm" onclick={generate} disabled={!canGenerate}>
				{#if isGenerating}
					<Loader2 class="mr-1.5 h-3.5 w-3.5 animate-spin" />
					生成中…
				{:else}
					生成对比图
				{/if}
			</Button>
			{#if resultUrl}
				<Button variant="outline" size="sm" onclick={downloadResult}>
					<Download class="mr-1.5 h-3.5 w-3.5" />
					下载
				</Button>
			{/if}
		</div>
	</div>
</div>

<input
	bind:this={leftInputRef}
	type="file"
	accept="image/jpeg,image/png,image/webp"
	class="hidden"
	onchange={(e) => handleFileSelect('left', e)}
/>
<input
	bind:this={rightInputRef}
	type="file"
	accept="image/jpeg,image/png,image/webp"
	class="hidden"
	onchange={(e) => handleFileSelect('right', e)}
/>

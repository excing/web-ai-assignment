<script lang="ts">
	import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from 'lucide-svelte';
	import type { MediaResource } from '$lib/stores/task-manager.svelte';

	interface Props {
		images: MediaResource[];
		initialIndex?: number;
		onClose: () => void;
	}

	let { images, initialIndex = 0, onClose }: Props = $props();

	let currentIndex = $state(initialIndex);
	let currentImage = $derived(images[currentIndex]);

	// ── 缩放与平移 ──
	const MIN_SCALE = 0.5;
	const MAX_SCALE = 5;
	const ZOOM_STEP = 0.25;

	let scale = $state(1);
	let translateX = $state(0);
	let translateY = $state(0);
	let isDragging = $state(false);
	let dragStartX = $state(0);
	let dragStartY = $state(0);
	let lastTranslateX = $state(0);
	let lastTranslateY = $state(0);

	// ── 触摸手势状态 ──
	let isTouching = $state(false);
	let touchCount = $state(0);
	let touchStartDistance = $state(0);
	let touchStartScale = $state(1);

	// 滑动切换检测
	let swipeStartX = $state(0);
	let swipeStartY = $state(0);
	let swipeStartTime = $state(0);
	const SWIPE_THRESHOLD = 50;
	const SWIPE_VELOCITY = 0.3;

	let isZoomed = $derived(scale !== 1);
	let scalePercent = $derived(Math.round(scale * 100));
	let isReferenceImage = $derived(currentImage?.filename?.startsWith('参考图'));

	// ── UI 显隐 ──
	let chromeVisible = $state(true);

	function resetTransform() {
		scale = 1;
		translateX = 0;
		translateY = 0;
	}

	function zoomIn() {
		scale = Math.min(scale + ZOOM_STEP, MAX_SCALE);
		if (scale === 1) { translateX = 0; translateY = 0; }
	}

	function zoomOut() {
		scale = Math.max(scale - ZOOM_STEP, MIN_SCALE);
		if (scale <= 1) { translateX = 0; translateY = 0; }
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		if (e.deltaY < 0) zoomIn();
		else zoomOut();
	}

	function handleDoubleClick() {
		if (isZoomed) {
			resetTransform();
		} else {
			scale = 2;
		}
	}

	// ── 单击图片切换 UI 显隐（区分单击与双击） ──
	let clickTimer: ReturnType<typeof setTimeout> | null = null;

	function handleImageClick(e: MouseEvent) {
		e.stopPropagation();
		if (clickTimer) {
			// 双击：取消单击定时器，执行双击逻辑
			clearTimeout(clickTimer);
			clickTimer = null;
			handleDoubleClick();
		} else {
			// 等待判断是否为双击
			clickTimer = setTimeout(() => {
				clickTimer = null;
				chromeVisible = !chromeVisible;
			}, 250);
		}
	}

	// ── 拖拽平移（鼠标，仅缩放时） ──
	function handlePointerDown(e: PointerEvent) {
		if (e.pointerType === 'touch') return; // 触摸由 touch 事件处理
		if (!isZoomed) return;
		isDragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		lastTranslateX = translateX;
		lastTranslateY = translateY;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (e.pointerType === 'touch') return;
		if (!isDragging) return;
		translateX = lastTranslateX + (e.clientX - dragStartX);
		translateY = lastTranslateY + (e.clientY - dragStartY);
	}

	function handlePointerUp(e: PointerEvent) {
		if (e.pointerType === 'touch') return;
		isDragging = false;
	}

	// ── 触摸手势 ──
	function getTouchDistance(t1: Touch, t2: Touch): number {
		const dx = t1.clientX - t2.clientX;
		const dy = t1.clientY - t2.clientY;
		return Math.sqrt(dx * dx + dy * dy);
	}

	function handleTouchStart(e: TouchEvent) {
		touchCount = e.touches.length;

		if (e.touches.length === 2) {
			// 双指：捏合缩放
			e.preventDefault();
			touchStartDistance = getTouchDistance(e.touches[0], e.touches[1]);
			touchStartScale = scale;
			isTouching = true;
		} else if (e.touches.length === 1) {
			const touch = e.touches[0];
			// 记录滑动起点（无论是否缩放）
			swipeStartX = touch.clientX;
			swipeStartY = touch.clientY;
			swipeStartTime = Date.now();

			if (isZoomed) {
				// 缩放状态：单指拖拽平移
				dragStartX = touch.clientX;
				dragStartY = touch.clientY;
				lastTranslateX = translateX;
				lastTranslateY = translateY;
				isTouching = true;
			}
		}
	}

	function handleTouchMove(e: TouchEvent) {
		if (e.touches.length === 2) {
			// 捏合缩放
			e.preventDefault();
			const dist = getTouchDistance(e.touches[0], e.touches[1]);
			const ratio = dist / touchStartDistance;
			scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, touchStartScale * ratio));
			if (scale <= 1) {
				translateX = 0;
				translateY = 0;
			}
		} else if (e.touches.length === 1 && isZoomed && isTouching) {
			// 缩放时单指平移
			e.preventDefault();
			const touch = e.touches[0];
			translateX = lastTranslateX + (touch.clientX - dragStartX);
			translateY = lastTranslateY + (touch.clientY - dragStartY);
		}
	}

	function handleTouchEnd(e: TouchEvent) {
		// 滑动切换检测（单指、未缩放）
		if (e.changedTouches.length === 1 && !isZoomed && touchCount === 1) {
			const touch = e.changedTouches[0];
			const dx = touch.clientX - swipeStartX;
			const dy = touch.clientY - swipeStartY;
			const dt = Date.now() - swipeStartTime;
			const velocity = Math.abs(dx) / dt;

			if (
				Math.abs(dx) > SWIPE_THRESHOLD &&
				Math.abs(dx) > Math.abs(dy) * 2 &&
				velocity > SWIPE_VELOCITY
			) {
				if (dx > 0) prevImage();
				else nextImage();
			}
		}

		isTouching = false;
		touchCount = e.touches.length;
	}

	// ── 导航 ──
	function nextImage() {
		currentIndex = (currentIndex + 1) % images.length;
		resetTransform();
	}

	function prevImage() {
		currentIndex = (currentIndex - 1 + images.length) % images.length;
		resetTransform();
	}

	// ── 背景点击：直接关闭画廊 ──
	function handleBackdropClick() {
		onClose();
	}

	function handleKeyDown(e: KeyboardEvent) {
		switch (e.key) {
			case 'Escape': onClose(); break;
			case 'ArrowRight': nextImage(); break;
			case 'ArrowLeft': prevImage(); break;
			case '+': case '=': e.preventDefault(); zoomIn(); break;
			case '-': e.preventDefault(); zoomOut(); break;
			case '0': e.preventDefault(); resetTransform(); break;
		}
	}

	function downloadImage() {
		const link = document.createElement('a');
		link.href = currentImage.data;
		link.download = currentImage.filename || `image-${currentIndex + 1}.png`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- 背景遮罩 -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl"
	onclick={handleBackdropClick}
	onkeydown={(e) => e.key === 'Enter' && onClose()}
>
	<!-- ── 图片区域（铺满整个视口） ── -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="absolute inset-0 flex items-center justify-center overflow-hidden"
		onwheel={handleWheel}
		role="button"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="relative select-none"
			style="touch-action: none; transform: scale({scale}) translate({translateX / scale}px, {translateY / scale}px); transition: {isDragging || isTouching ? 'none' : 'transform 0.2s ease'};"
			onclick={handleImageClick}
			onkeydown={(e) => e.stopPropagation()}
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			onpointercancel={handlePointerUp}
			ontouchstart={handleTouchStart}
			ontouchmove={handleTouchMove}
			ontouchend={handleTouchEnd}
			ontouchcancel={handleTouchEnd}
			role="button"
			tabindex="-1"
		>
			{#if currentImage.type === 'image'}
				<img
					src={currentImage.data}
					alt={currentImage.filename || `图片 ${currentIndex + 1}`}
					class="max-h-[100vh] max-w-[100vw] object-contain"
					draggable="false"
					style="cursor: {isZoomed ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'};"
				/>
			{:else if currentImage.type === 'video'}
				<video
					src={currentImage.data}
					controls
					class="max-h-[100vh] max-w-[100vw]"
					autoplay
				>
					<track kind="captions" />
				</video>
			{/if}
		</div>

		<!-- 导航按钮 -->
		{#if images.length > 1}
			<button
				class="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur-sm transition-all hover:bg-black/60 hover:text-white {chromeVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}"
				onclick={(e) => { e.stopPropagation(); prevImage(); }}
			>
				<ChevronLeft class="h-6 w-6" />
			</button>
			<button
				class="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur-sm transition-all hover:bg-black/60 hover:text-white {chromeVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}"
				onclick={(e) => { e.stopPropagation(); nextImage(); }}
			>
				<ChevronRight class="h-6 w-6" />
			</button>
		{/if}
	</div>

	<!-- ── 顶部工具栏（浮在图片上方） ── -->
	<div class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-3 transition-opacity duration-200 {chromeVisible ? 'opacity-100' : 'opacity-0'}">
		<!-- 左侧：图片计数 + 标签 -->
		<div class="pointer-events-auto flex min-w-[80px] items-center gap-2">
			{#if images.length > 1}
				<span class="text-sm tabular-nums text-white/70">
					{currentIndex + 1} / {images.length}
				</span>
			{/if}
			{#if isReferenceImage}
				<span class="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">参考图</span>
			{:else}
				<span class="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">生成图</span>
			{/if}
		</div>

		<!-- 中间：缩放控件 -->
		<div class="pointer-events-auto flex items-center gap-1 rounded-full bg-white/10 px-1 py-1 backdrop-blur-sm">
			<button
				onclick={(e) => { e.stopPropagation(); zoomOut(); }}
				disabled={scale <= MIN_SCALE}
				class="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:text-white/30"
			>
				<ZoomOut class="h-4 w-4" />
			</button>
			<button
				onclick={(e) => { e.stopPropagation(); resetTransform(); }}
				class="min-w-[52px] rounded-full px-2 py-1 text-center text-xs tabular-nums text-white/80 transition-colors hover:bg-white/10 hover:text-white"
			>
				{scalePercent}%
			</button>
			<button
				onclick={(e) => { e.stopPropagation(); zoomIn(); }}
				disabled={scale >= MAX_SCALE}
				class="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:text-white/30"
			>
				<ZoomIn class="h-4 w-4" />
			</button>
		</div>

		<!-- 右侧：下载 + 关闭 -->
		<div class="pointer-events-auto flex min-w-[80px] items-center justify-end gap-1">
			<button
				onclick={(e) => { e.stopPropagation(); downloadImage(); }}
				class="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
			>
				<Download class="h-5 w-5" />
			</button>
			<button
				onclick={(e) => { e.stopPropagation(); onClose(); }}
				class="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
			>
				<X class="h-5 w-5" />
			</button>
		</div>
	</div>

	<!-- ── 底部缩略图（浮在图片下方） ── -->
	{#if images.length > 1}
		<div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4 py-3 transition-opacity duration-200 {chromeVisible ? 'opacity-100' : 'opacity-0'}">
			<div class="pointer-events-auto flex gap-2 overflow-x-auto rounded-xl bg-white/5 p-2 backdrop-blur-sm">
				{#each images as image, index}
					{@const isRef = image.filename?.startsWith('参考图')}
					<button
						class="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all {index === currentIndex
							? 'border-white shadow-lg shadow-white/10'
							: 'border-transparent opacity-50 hover:opacity-80'}"
						onclick={(e) => {
							e.stopPropagation();
							currentIndex = index;
							resetTransform();
						}}
					>
						{#if image.type === 'image'}
							<img
								src={image.data}
								alt={`缩略图 ${index + 1}`}
								class="h-full w-full object-cover"
							/>
						{/if}
						{#if isRef}
							<span class="absolute bottom-0 left-0 right-0 bg-amber-500/70 text-center text-[8px] leading-[14px] text-white">参考</span>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

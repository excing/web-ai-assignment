<script lang="ts">
	import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, Copy } from 'lucide-svelte';
	import { copyToClipboard } from '$lib/utils/clipboard';
	import type { MediaResource } from '$lib/types/media';

	interface Props {
		images: MediaResource[];
		initialIndex?: number;
		caption?: string;
		onClose: () => void;
	}

	let { images, initialIndex = 0, caption, onClose }: Props = $props();

	let currentIndex = $state(initialIndex);
	let currentImage = $derived(images[currentIndex]);
	let prevIndex = $derived((currentIndex - 1 + images.length) % images.length);
	let nextIndex = $derived((currentIndex + 1) % images.length);

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

	// 滑动切换
	let swipeStartX = $state(0);
	let swipeStartY = $state(0);
	let swipeStartTime = $state(0);
	const SWIPE_VELOCITY = 0.3;

	// ── 轮播滑动 ──
	let slideOffset = $state(0);
	let slideTransition = $state(false);

	let isZoomed = $derived(scale !== 1);
	let scalePercent = $derived(Math.round(scale * 100));
	let isReferenceImage = $derived(currentImage?.filename?.startsWith('参考图'));

	// ── UI 显隐 ──
	let chromeVisible = $state(true);
	let captionExpanded = $state(false);

	async function copyCaption() {
		if (!caption) return;
		await copyToClipboard(caption);
	}

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
			clearTimeout(clickTimer);
			clickTimer = null;
			handleDoubleClick();
		} else {
			clickTimer = setTimeout(() => {
				clickTimer = null;
				chromeVisible = !chromeVisible;
			}, 250);
		}
	}

	// ── 拖拽平移（鼠标，仅缩放时） ──
	function handlePointerDown(e: PointerEvent) {
		if (e.pointerType === 'touch') return;
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
			e.preventDefault();
			touchStartDistance = getTouchDistance(e.touches[0], e.touches[1]);
			touchStartScale = scale;
			isTouching = true;
		} else if (e.touches.length === 1) {
			const touch = e.touches[0];
			swipeStartX = touch.clientX;
			swipeStartY = touch.clientY;
			swipeStartTime = Date.now();

			if (isZoomed) {
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
			e.preventDefault();
			const dist = getTouchDistance(e.touches[0], e.touches[1]);
			const ratio = dist / touchStartDistance;
			scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, touchStartScale * ratio));
			if (scale <= 1) {
				translateX = 0;
				translateY = 0;
			}
		} else if (e.touches.length === 1 && isZoomed && isTouching) {
			e.preventDefault();
			const touch = e.touches[0];
			translateX = lastTranslateX + (touch.clientX - dragStartX);
			translateY = lastTranslateY + (touch.clientY - dragStartY);
		} else if (e.touches.length === 1 && !isZoomed && images.length > 1) {
			const touch = e.touches[0];
			const dx = touch.clientX - swipeStartX;
			const dy = touch.clientY - swipeStartY;
			if (Math.abs(dx) > Math.abs(dy) * 1.5 || Math.abs(slideOffset) > 0) {
				e.preventDefault();
				slideOffset = dx;
			}
		}
	}

	function handleTouchEnd(e: TouchEvent) {
		if (e.changedTouches.length === 1 && !isZoomed && touchCount === 1 && Math.abs(slideOffset) > 0) {
			const dt = Date.now() - swipeStartTime;
			const velocity = Math.abs(slideOffset) / dt;

			slideTransition = true;
			if (Math.abs(slideOffset) > window.innerWidth / 4 || velocity > SWIPE_VELOCITY) {
				slideOffset = slideOffset > 0 ? window.innerWidth : -window.innerWidth;
			} else {
				slideOffset = 0;
			}
		}

		isTouching = false;
		touchCount = e.touches.length;
	}

	// ── 滑动动画结束 ──
	function handleSlideEnd(e: TransitionEvent) {
		if (e.target !== e.currentTarget) return;
		if (slideOffset < 0) {
			currentIndex = nextIndex;
		} else if (slideOffset > 0) {
			currentIndex = prevIndex;
		}
		slideTransition = false;
		slideOffset = 0;
		resetTransform();
	}

	// ── 导航 ──
	function nextImage() {
		if (images.length <= 1 || slideTransition) return;
		resetTransform();
		slideTransition = true;
		slideOffset = -window.innerWidth;
	}

	function prevImage() {
		if (images.length <= 1 || slideTransition) return;
		resetTransform();
		slideTransition = true;
		slideOffset = window.innerWidth;
	}

	function jumpToImage(index: number) {
		if (slideTransition) return;
		slideTransition = false;
		slideOffset = 0;
		currentIndex = index;
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

{#snippet slotMedia(resource: MediaResource)}
	{#if resource.type === 'image'}
		<img src={resource.data} alt="" class="max-h-full max-w-full object-contain" draggable="false" />
	{:else if resource.type === 'video'}
		<video src={resource.data} class="max-h-full max-w-full" preload="metadata"><track kind="captions" /></video>
	{/if}
{/snippet}

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
		class="absolute inset-0 overflow-hidden"
		onwheel={handleWheel}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
		ontouchcancel={handleTouchEnd}
	>
		<!-- 滑动轨道：三槽轮播 [上一张 | 当前 | 下一张] -->
		<div
			class="flex h-full"
			style="transform: translateX(calc(-100vw + {slideOffset}px)); {slideTransition ? 'transition: transform 300ms ease-out;' : ''}"
			ontransitionend={handleSlideEnd}
		>
			<!-- 上一张 -->
			<div class="flex h-full w-screen flex-shrink-0 items-center justify-center">
				{#if images.length > 1}
					{@render slotMedia(images[prevIndex])}
				{/if}
			</div>

			<!-- 当前（支持缩放/平移） -->
			<div class="flex h-full w-screen flex-shrink-0 items-center justify-center">
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="relative select-none"
					style="touch-action: none; transform: scale({scale}) translate({translateX / scale}px, {translateY / scale}px); transition: {isDragging || isTouching ? 'none' : 'transform 0.2s ease'};"
					onclick={handleImageClick}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chromeVisible = !chromeVisible; } }}
					onpointerdown={handlePointerDown}
					onpointermove={handlePointerMove}
					onpointerup={handlePointerUp}
					onpointercancel={handlePointerUp}
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
			</div>

			<!-- 下一张 -->
			<div class="flex h-full w-screen flex-shrink-0 items-center justify-center">
				{#if images.length > 1}
					{@render slotMedia(images[nextIndex])}
				{/if}
			</div>
		</div>
	</div>

	<!-- ── 导航按钮（独立浮层） ── -->
	{#if images.length > 1}
		<button
			class="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur-sm transition-all hover:bg-black/60 hover:text-white {chromeVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}"
			onclick={(e) => { e.stopPropagation(); prevImage(); }}
		>
			<ChevronLeft class="h-6 w-6" />
		</button>
		<button
			class="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur-sm transition-all hover:bg-black/60 hover:text-white {chromeVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}"
			onclick={(e) => { e.stopPropagation(); nextImage(); }}
		>
			<ChevronRight class="h-6 w-6" />
		</button>
	{/if}

	<!-- ── 顶部工具栏 ── -->
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

	<!-- ── 底部 caption ── -->
	{#if caption}
		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4 transition-opacity duration-200 {chromeVisible ? 'opacity-100' : 'opacity-0'}"
			style="padding-bottom: {images.length > 1 ? '5.8rem' : '0.75rem'}"
		>
			<div class="pointer-events-auto mx-auto flex max-w-2xl items-start gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-xl">
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="min-w-0 flex-1 cursor-pointer select-text"
					onclick={(e) => { e.stopPropagation(); captionExpanded = !captionExpanded; }}
					onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); captionExpanded = !captionExpanded; } }}
				>
					<p
						class="text-sm leading-relaxed text-white/90 {captionExpanded ? '' : 'line-clamp-1'}"
					>
						{caption}
					</p>
				</div>
				<button
					class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
					onclick={(e) => { e.stopPropagation(); copyCaption(); }}
				>
					<Copy class="h-3 w-3" />
				</button>
			</div>
		</div>
	{/if}

	<!-- ── 底部缩略图 ── -->
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
							jumpToImage(index);
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

<script lang="ts">
	import { X, ChevronLeft, ChevronRight, Download } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import type { MediaResource } from '$lib/stores/task-manager.svelte';

	interface Props {
		images: MediaResource[];
		initialIndex?: number;
		onClose: () => void;
	}

	let { images, initialIndex = 0, onClose }: Props = $props();

	let currentIndex = $state(initialIndex);
	let currentImage = $derived(images[currentIndex]);

	function nextImage() {
		currentIndex = (currentIndex + 1) % images.length;
	}

	function prevImage() {
		currentIndex = (currentIndex - 1 + images.length) % images.length;
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		} else if (e.key === 'ArrowRight') {
			nextImage();
		} else if (e.key === 'ArrowLeft') {
			prevImage();
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
<div
	class="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm"
	onclick={onClose}
	role="button"
	tabindex="-1"
	onkeydown={(e) => e.key === 'Enter' && onClose()}
>
	<!-- 关闭按钮 -->
	<Button
		variant="ghost"
		size="icon"
		class="absolute right-4 top-4 text-white hover:bg-white/10"
		onclick={onClose}
	>
		<X class="h-6 w-6" />
	</Button>

	<!-- 下载按钮 -->
	<Button
		variant="ghost"
		size="icon"
		class="absolute right-16 top-4 text-white hover:bg-white/10"
		onclick={(e) => {
			e.stopPropagation();
			downloadImage();
		}}
	>
		<Download class="h-6 w-6" />
	</Button>

	<!-- 图片计数 -->
	{#if images.length > 1}
		<div class="absolute left-4 top-4 rounded-full bg-black/50 px-4 py-2 text-sm text-white">
			{currentIndex + 1} / {images.length}
		</div>
	{/if}

	<!-- 图片容器 -->
	<div
		class="flex h-full items-center justify-center p-4"
		onclick={(e) => e.stopPropagation()}
		role="button"
		tabindex="-1"
		onkeydown={(e) => e.stopPropagation()}
	>
		<div class="relative max-h-full max-w-full">
			{#if currentImage.type === 'image'}
				<img
					src={currentImage.data}
					alt={currentImage.filename || `图片 ${currentIndex + 1}`}
					class="max-h-[90vh] max-w-[90vw] object-contain"
				/>
			{:else if currentImage.type === 'video'}
				<video
					src={currentImage.data}
					controls
					class="max-h-[90vh] max-w-[90vw]"
					autoplay
				>
					<track kind="captions" />
				</video>
			{/if}

			<!-- 图片信息 -->
			{#if currentImage.filename || currentImage.mimeType}
				<div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
					{#if currentImage.filename}
						<p class="text-sm font-medium text-white">{currentImage.filename}</p>
					{/if}
					{#if currentImage.mimeType}
						<p class="text-xs text-white/70">{currentImage.mimeType}</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- 导航按钮 -->
	{#if images.length > 1}
		<Button
			variant="ghost"
			size="icon"
			class="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
			onclick={(e) => {
				e.stopPropagation();
				prevImage();
			}}
		>
			<ChevronLeft class="h-8 w-8" />
		</Button>

		<Button
			variant="ghost"
			size="icon"
			class="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
			onclick={(e) => {
				e.stopPropagation();
				nextImage();
			}}
		>
			<ChevronRight class="h-8 w-8" />
		</Button>
	{/if}

	<!-- 缩略图导航 -->
	{#if images.length > 1}
		<div class="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 overflow-x-auto rounded-lg bg-black/50 p-2">
			{#each images as image, index}
				<button
					class="h-16 w-16 flex-shrink-0 overflow-hidden rounded border-2 transition-all {index === currentIndex
						? 'border-white'
						: 'border-transparent opacity-50 hover:opacity-100'}"
					onclick={(e) => {
						e.stopPropagation();
						currentIndex = index;
					}}
				>
					{#if image.type === 'image'}
						<img
							src={image.data}
							alt={`缩略图 ${index + 1}`}
							class="h-full w-full object-cover"
						/>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

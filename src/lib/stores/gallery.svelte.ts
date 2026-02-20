/**
 * Global gallery store — allows opening the ImageGallery overlay from anywhere.
 */

import type { MediaResource } from '$lib/types/media';

let images = $state<MediaResource[]>([]);
let initialIndex = $state(0);
let isOpen = $state(false);

export function openGallery(newImages: MediaResource[], index = 0) {
	images = newImages;
	initialIndex = index;
	isOpen = true;
}

export function closeGallery() {
	isOpen = false;
}

export function getGalleryState() {
	return {
		get images() { return images; },
		get initialIndex() { return initialIndex; },
		get isOpen() { return isOpen; },
	};
}

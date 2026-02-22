/**
 * Global gallery store — allows opening the ImageGallery overlay from anywhere.
 */

import type { MediaResource } from '$lib/types/media';

let images = $state<MediaResource[]>([]);
let initialIndex = $state(0);
let caption = $state<string | undefined>(undefined);
let isOpen = $state(false);

export function openGallery(newImages: MediaResource[], index = 0, newCaption?: string) {
	images = newImages;
	initialIndex = index;
	caption = newCaption;
	isOpen = true;
}

export function closeGallery() {
	isOpen = false;
}

export function getGalleryState() {
	return {
		get images() { return images; },
		get initialIndex() { return initialIndex; },
		get caption() { return caption; },
		get isOpen() { return isOpen; },
	};
}

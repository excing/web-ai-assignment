/**
 * 文件管理 Composable
 *
 * 统一 chat 和 image-gen 页面的文件选择、拖拽、粘贴、压缩逻辑。
 * 通过 options 参数适配两个功能的差异（maxFiles、去重策略等）。
 */

import { toast } from 'svelte-sonner';
import { compressImage } from '$lib/utils/image-compress';
import { generateUUID } from '$lib/utils/uuid';

export interface PendingFile {
	id: string;
	file: File;
	previewUrl: string;
}

export interface FileManagementOptions {
	maxFiles: number;
	maxFileSize: number;
	allowedTypes: string[];
	autoCompress: boolean;
	deduplicateByName: boolean;
}

export function useFileManagement(options: FileManagementOptions) {
	let pendingFiles = $state<PendingFile[]>([]);
	let isDragging = $state(false);

	function validateFile(file: File): string | null {
		if (!options.allowedTypes.includes(file.type)) {
			return `不支持的文件类型: ${file.type || '未知'}`;
		}
		return null;
	}

	async function addFiles(files: FileList | File[]) {
		for (const file of Array.from(files)) {
			if (pendingFiles.length >= options.maxFiles) {
				toast.error(`最多同时上传 ${options.maxFiles} 张图片`);
				break;
			}

			const error = validateFile(file);
			if (error) {
				toast.error(error);
				continue;
			}

			// 去重检查（image-gen 场景用）
			if (options.deduplicateByName && pendingFiles.some((f) => f.file.name === file.name)) {
				toast.error(`文件已添加: ${file.name}`);
				continue;
			}

			// 自动压缩超限图片
			let processedFile = file;
			if (options.autoCompress && file.size > options.maxFileSize) {
				try {
					processedFile = await compressImage(file);
				} catch (e) {
					toast.error(e instanceof Error ? e.message : `文件过大: ${file.name}`);
					continue;
				}
			}

			pendingFiles = [
				...pendingFiles,
				{
					id: generateUUID(),
					file: processedFile,
					previewUrl: URL.createObjectURL(processedFile),
				},
			];
		}
	}

	function removeFile(id: string) {
		const item = pendingFiles.find((f) => f.id === id);
		if (item) URL.revokeObjectURL(item.previewUrl);
		pendingFiles = pendingFiles.filter((f) => f.id !== id);
	}

	function clearAll() {
		for (const f of pendingFiles) {
			URL.revokeObjectURL(f.previewUrl);
		}
		pendingFiles = [];
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

	function fileToDataUrl(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	return {
		get pendingFiles() {
			return pendingFiles;
		},
		set pendingFiles(value: PendingFile[]) {
			pendingFiles = value;
		},
		get isDragging() {
			return isDragging;
		},
		addFiles,
		removeFile,
		clearAll,
		handlePaste,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		fileToDataUrl,
	};
}

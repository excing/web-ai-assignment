import { IMAGE_GEN, type AspectRatio } from '$lib/config/constants';

/**
 * 将多张图片合成到一张画布中（网格排列）。
 *
 * - 单图直接返回原文件，不做处理。
 * - 多图根据指定画布比例自动计算网格布局，等比缩放居中绘制。
 * - 输出 JPEG 格式。
 */
export async function compositeImages(
	files: File[],
	aspectRatio: AspectRatio = IMAGE_GEN.DEFAULT_ASPECT_RATIO
): Promise<File> {
	if (files.length === 0) throw new Error('至少需要一张图片');
	if (files.length === 1) return files[0];

	const images = await Promise.all(files.map(loadImage));

	const { cols, rows } = computeGrid(images.length);
	const { canvasWidth, canvasHeight, cellWidth, cellHeight } = computeLayout(
		cols,
		rows,
		aspectRatio
	);

	const canvas = document.createElement('canvas');
	canvas.width = canvasWidth;
	canvas.height = canvasHeight;

	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('无法创建 Canvas 上下文');

	// 白色背景
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, canvasWidth, canvasHeight);

	const gap = IMAGE_GEN.CANVAS_GAP;

	for (let i = 0; i < images.length; i++) {
		const img = images[i];
		const col = i % cols;
		const row = Math.floor(i / cols);

		// 格子的左上角坐标（含间距）
		const cellX = col * (cellWidth + gap) + gap;
		const cellY = row * (cellHeight + gap) + gap;

		// 可绘制区域
		const drawAreaW = cellWidth;
		const drawAreaH = cellHeight;

		// contain 缩放：保持比例，居中
		const imgRatio = img.naturalWidth / img.naturalHeight;
		const cellRatio = drawAreaW / drawAreaH;

		let drawW: number;
		let drawH: number;

		if (imgRatio > cellRatio) {
			// 图片更宽 → 以宽度为准
			drawW = drawAreaW;
			drawH = drawAreaW / imgRatio;
		} else {
			// 图片更高 → 以高度为准
			drawH = drawAreaH;
			drawW = drawAreaH * imgRatio;
		}

		const drawX = cellX + (drawAreaW - drawW) / 2;
		const drawY = cellY + (drawAreaH - drawH) / 2;

		ctx.drawImage(img, drawX, drawY, drawW, drawH);
	}

	// 释放图片 object URL
	images.forEach((img) => URL.revokeObjectURL(img.src));

	const blob = await canvasToBlob(canvas);
	return new File([blob], 'composite.jpg', {
		type: 'image/jpeg',
		lastModified: Date.now()
	});
}

// ── 内部工具函数 ──

function loadImage(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => {
			URL.revokeObjectURL(img.src);
			reject(new Error(`图片加载失败: ${file.name}`));
		};
		img.src = URL.createObjectURL(file);
	});
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) resolve(blob);
				else reject(new Error('Canvas toBlob 失败'));
			},
			'image/jpeg',
			IMAGE_GEN.CANVAS_QUALITY
		);
	});
}

/**
 * 根据图片数量计算最优网格布局。
 */
function computeGrid(count: number): { cols: number; rows: number } {
	const cols = Math.ceil(Math.sqrt(count));
	const rows = Math.ceil(count / cols);
	return { cols, rows };
}

/**
 * 根据网格和画布比例计算画布尺寸及单元格尺寸。
 */
function computeLayout(
	cols: number,
	rows: number,
	aspectRatio: AspectRatio
): {
	canvasWidth: number;
	canvasHeight: number;
	cellWidth: number;
	cellHeight: number;
} {
	const gap = IMAGE_GEN.CANVAS_GAP;
	const maxSide = IMAGE_GEN.CANVAS_MAX_SIDE;

	// 解析比例
	const [ratioW, ratioH] = aspectRatio.split(':').map(Number);

	// 计算画布尺寸（保证不超过 maxSide）
	let canvasWidth: number;
	let canvasHeight: number;

	if (ratioW >= ratioH) {
		canvasWidth = maxSide;
		canvasHeight = Math.round(maxSide * (ratioH / ratioW));
	} else {
		canvasHeight = maxSide;
		canvasWidth = Math.round(maxSide * (ratioW / ratioH));
	}

	// 扣除间距后计算单元格尺寸
	const cellWidth = Math.floor((canvasWidth - gap * (cols + 1)) / cols);
	const cellHeight = Math.floor((canvasHeight - gap * (rows + 1)) / rows);

	// 根据实际单元格尺寸重新计算画布尺寸（避免右/下方多余空白）
	canvasWidth = cellWidth * cols + gap * (cols + 1);
	canvasHeight = cellHeight * rows + gap * (rows + 1);

	return { canvasWidth, canvasHeight, cellWidth, cellHeight };
}

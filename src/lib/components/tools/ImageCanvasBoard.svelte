<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Brush,
		Eraser,
		Minus,
		Square,
		Circle,
		Type,
		Pipette,
		PaintBucket,
		MousePointer2,
		Hand,
		ZoomIn,
		ZoomOut,
		Settings2,
		Eye,
		EyeOff,
		Undo2,
		Redo2,
		Download,
		Trash2,
		Image as ImageIcon
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';

	import type {
		Canvas,
		Circle as FabricCircle,
		FabricImage,
		IText,
		Line as FabricLine,
		PencilBrush,
		Rect as FabricRect
	} from 'fabric';

	type ToolMode =
		| 'select'
		| 'hand'
		| 'brush'
		| 'eraser'
		| 'line'
		| 'rect'
		| 'circle'
		| 'text'
		| 'picker'
		| 'fill';

	let fabricMod: typeof import('fabric') | null = null;
	let fabricCanvas = $state<Canvas | null>(null);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let canvasViewportRef = $state<HTMLDivElement | null>(null);
	let backgroundInputRef = $state<HTMLInputElement | null>(null);

	let activeTool = $state<ToolMode>('brush');
	let strokeColor = $state('#000000');
	let fillColor = $state('#f97316');
	let strokeStyle = $state<'solid' | 'dashed' | 'dotted' | 'dash-dot'>('solid');
	let brushSize = $state(3);
	let shapeStrokeSize = $state(3);
	let fontSize = $state(28);

	let canvasWidth = $state(1200);
	let canvasHeight = $state(800);
	let sizeWidthDraft = $state(1200);
	let sizeHeightDraft = $state(800);
	let transparentBackground = $state(false);

	let isDrawingShape = $state(false);
	let shapeStart = $state<{ x: number; y: number } | null>(null);
	let shapeObj = $state<FabricRect | FabricCircle | FabricLine | null>(null);
	let shapeKind = $state<'line' | 'rect' | 'circle' | null>(null);

	let isLoading = $state(true);
	let isImportingImage = $state(false);
	let zoomPercent = $state(100);
	let isSpacePressed = $state(false);
	let isPanning = $state(false);
	let panLast = $state<{ x: number; y: number } | null>(null);
	let isPinching = $state(false);
	let pinchStartDistance = $state(0);
	let pinchStartZoom = $state(1);
	let pinchLastCenter = $state<{ x: number; y: number } | null>(null);
	let showSettingsPanel = $state(false);
	let showChrome = $state(true);
	let showShapeMenu = $state(false);

	let history = $state<string[]>([]);
	let historyIndex = $state(-1);
	let isRestoringHistory = false;
	const HISTORY_LIMIT = 80;

	let canUndo = $derived(historyIndex > 0);
	let canRedo = $derived(historyIndex >= 0 && historyIndex < history.length - 1);

	const toolItems: Array<{ key: ToolMode; label: string; icon: typeof Brush }> = [
		{ key: 'select', label: '选择', icon: MousePointer2 },
		{ key: 'hand', label: '手型', icon: Hand },
		{ key: 'brush', label: '画笔', icon: Brush },
		{ key: 'eraser', label: '橡皮', icon: Eraser },
		{ key: 'line', label: '直线', icon: Minus },
		{ key: 'rect', label: '矩形', icon: Square },
		{ key: 'circle', label: '圆形', icon: Circle },
		{ key: 'text', label: '文字', icon: Type },
		{ key: 'picker', label: '取色', icon: Pipette },
		{ key: 'fill', label: '填充', icon: PaintBucket }
	];
	const shapeTools: Array<{ key: 'line' | 'rect' | 'circle'; label: string; icon: typeof Brush }> = [
		{ key: 'line', label: '直线', icon: Minus },
		{ key: 'rect', label: '矩形', icon: Square },
		{ key: 'circle', label: '圆形', icon: Circle }
	];
	let activeToolLabel = $derived(toolItems.find((item) => item.key === activeTool)?.label ?? '画笔');
	let currentShapeTool = $derived(
		shapeTools.find((item) => item.key === activeTool) ?? shapeTools.find((item) => item.key === 'rect')!
	);
	const MIN_ZOOM = 20;
	const MAX_ZOOM = 400;

	function withAlpha(hex: string, alpha: number) {
		const rgb = hexToRgb(hex);
		if (!rgb) return hex;
		return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
	}

	function getStrokeDashArray(style: 'solid' | 'dashed' | 'dotted' | 'dash-dot') {
		if (style === 'solid') return undefined;
		if (style === 'dashed') return [14, 8];
		if (style === 'dotted') return [2, 8];
		return [18, 8, 2, 8];
	}

	function hexToRgb(hex: string): [number, number, number] | null {
		const raw = hex.trim().replace('#', '');
		const normalized = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
		if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
		return [
			Number.parseInt(normalized.slice(0, 2), 16),
			Number.parseInt(normalized.slice(2, 4), 16),
			Number.parseInt(normalized.slice(4, 6), 16)
		];
	}

	function rgbToHex(r: number, g: number, b: number) {
		const toHex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
		return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	}

	function captureHistory() {
		if (!fabricCanvas || isRestoringHistory) return;
		const snapshot = JSON.stringify(fabricCanvas.toObject(['meta']));
		if (historyIndex >= 0 && history[historyIndex] === snapshot) return;

		if (historyIndex < history.length - 1) {
			history = history.slice(0, historyIndex + 1);
		}

		history = [...history, snapshot];
		if (history.length > HISTORY_LIMIT) {
			const overflow = history.length - HISTORY_LIMIT;
			history = history.slice(overflow);
			historyIndex = history.length - 1;
			return;
		}
		historyIndex = history.length - 1;
	}

	async function restoreHistory(targetIndex: number) {
		if (!fabricCanvas || targetIndex < 0 || targetIndex >= history.length) return;
		isRestoringHistory = true;
		try {
			await fabricCanvas.loadFromJSON(history[targetIndex]);
			fabricCanvas.renderAll();
			historyIndex = targetIndex;
		} catch (error) {
			console.error(error);
			toast.error('历史记录恢复失败');
		} finally {
			isRestoringHistory = false;
		}
	}

	function undo() {
		if (!canUndo) return;
		restoreHistory(historyIndex - 1);
	}

	function redo() {
		if (!canRedo) return;
		restoreHistory(historyIndex + 1);
	}

	function applyToolConfig() {
		if (!fabricCanvas || !fabricMod) return;
		const upperCanvas = (fabricCanvas as Canvas & { upperCanvasEl?: HTMLCanvasElement }).upperCanvasEl;

		fabricCanvas.isDrawingMode = false;
		fabricCanvas.selection = activeTool === 'select';

		if (activeTool === 'brush' || activeTool === 'eraser') {
			const brush = new fabricMod.PencilBrush(fabricCanvas) as PencilBrush & {
				globalCompositeOperation?: string;
				strokeDashArray?: number[];
			};
			brush.width = brushSize;
			brush.color = activeTool === 'eraser' ? '#ffffff' : strokeColor;
			
			// 如果是橡皮擦模式，且画布支持透明，则使用 destination-out
			// 否则使用背景色（这里默认白色，因为 backgroundColor 初始化为 #ffffff）
			if (activeTool === 'eraser') {
				brush.globalCompositeOperation = transparentBackground ? 'destination-out' : 'source-over';
				brush.color = transparentBackground ? 'rgba(0,0,0,1)' : (fabricCanvas.backgroundColor as string || '#ffffff');
				brush.strokeDashArray = [];
			} else {
				brush.globalCompositeOperation = 'source-over';
				brush.strokeDashArray = getStrokeDashArray(strokeStyle) ?? [];
			}
			
			fabricCanvas.freeDrawingBrush = brush;
			fabricCanvas.isDrawingMode = true;
		}

		for (const obj of fabricCanvas.getObjects()) {
			obj.selectable = activeTool === 'select';
			obj.evented = activeTool === 'select';
		}

		fabricCanvas.discardActiveObject();
		fabricCanvas.requestRenderAll();

		if (upperCanvas) {
			let cursor = 'crosshair';
			if (activeTool === 'select') cursor = 'default';
			if (activeTool === 'hand') cursor = isPanning ? 'grabbing' : 'grab';
			if (activeTool === 'text') cursor = 'text';
			if (activeTool === 'picker') cursor = 'copy';
			if (activeTool === 'fill') cursor = 'cell';
			if (activeTool === 'eraser') cursor = 'cell';
			upperCanvas.style.cursor = cursor;
		}
	}

	function setTool(tool: ToolMode) {
		activeTool = tool;
		showShapeMenu = false;
		applyToolConfig();
	}

	function setBackgroundColor() {
		if (!fabricCanvas) return;
		fabricCanvas.backgroundColor = transparentBackground ? '' : '#ffffff';
		fabricCanvas.requestRenderAll();
		captureHistory();
	}

	function clampZoom(percent: number) {
		return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, percent));
	}

	function syncZoomPercent() {
		if (!fabricCanvas) return;
		zoomPercent = Math.round(fabricCanvas.getZoom() * 100);
	}

	function zoomTo(percent: number, center?: { x: number; y: number }) {
		if (!fabricCanvas || !fabricMod) return;
		const clamped = clampZoom(percent);
		const nextZoom = clamped / 100;
		const pointer = center
			? new fabricMod.Point(center.x, center.y)
			: new fabricMod.Point(fabricCanvas.getWidth() / 2, fabricCanvas.getHeight() / 2);
		fabricCanvas.zoomToPoint(pointer, nextZoom);
		fabricCanvas.requestRenderAll();
		syncZoomPercent();
	}

	function resetView() {
		if (!fabricCanvas) return;
		fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
		fabricCanvas.requestRenderAll();
		syncZoomPercent();
	}

	function fitToViewport() {
		if (!fabricCanvas || !canvasViewportRef) return;
		const viewportWidth = canvasViewportRef.clientWidth - 16;
		const viewportHeight = canvasViewportRef.clientHeight - 16;
		if (viewportWidth <= 0 || viewportHeight <= 0) return;
		const scale = Math.max(0.1, Math.min(viewportWidth / canvasWidth, viewportHeight / canvasHeight));
		const zoom = clampZoom(scale * 100) / 100;
		const tx = (viewportWidth - canvasWidth * zoom) / 2;
		const ty = (viewportHeight - canvasHeight * zoom) / 2;
		fabricCanvas.setViewportTransform([zoom, 0, 0, zoom, tx, ty]);
		fabricCanvas.requestRenderAll();
		syncZoomPercent();
	}

	function beginPan(clientX: number, clientY: number) {
		if (!fabricCanvas) return;
		isPanning = true;
		panLast = { x: clientX, y: clientY };
		fabricCanvas.discardActiveObject();
		fabricCanvas.selection = false;
		applyToolConfig();
	}

	function movePan(clientX: number, clientY: number) {
		if (!fabricCanvas || !isPanning || !panLast) return;
		const vpt = fabricCanvas.viewportTransform;
		if (!vpt) return;
		vpt[4] += clientX - panLast.x;
		vpt[5] += clientY - panLast.y;
		panLast = { x: clientX, y: clientY };
		fabricCanvas.requestRenderAll();
	}

	function endPan() {
		if (!fabricCanvas) return;
		isPanning = false;
		panLast = null;
		applyToolConfig();
	}

	function getTouchDistance(a: Touch, b: Touch) {
		return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
	}

	function getTouchCenter(a: Touch, b: Touch, el: HTMLElement) {
		const rect = el.getBoundingClientRect();
		return {
			x: (a.clientX + b.clientX) / 2 - rect.left,
			y: (a.clientY + b.clientY) / 2 - rect.top
		};
	}

	function getPointer(evt: unknown) {
		if (!fabricCanvas) return { x: 0, y: 0 };
		const pt = fabricCanvas.getScenePoint(evt as MouseEvent | TouchEvent | PointerEvent);
		return { x: pt.x, y: pt.y };
	}

	function startShape(point: { x: number; y: number }) {
		if (!fabricCanvas || !fabricMod) return;
		isDrawingShape = true;
		shapeStart = point;

		if (activeTool === 'line') {
			shapeKind = 'line';
			shapeObj = new fabricMod.Line([point.x, point.y, point.x, point.y], {
				stroke: strokeColor,
				strokeWidth: shapeStrokeSize,
				strokeDashArray: getStrokeDashArray(strokeStyle),
				selectable: false,
				evented: false
			}) as FabricLine;
		}

		if (activeTool === 'rect') {
			shapeKind = 'rect';
			shapeObj = new fabricMod.Rect({
				left: point.x,
				top: point.y,
				originX: 'left',
				originY: 'top',
				width: 1,
				height: 1,
				fill: withAlpha(fillColor, 0.25),
				stroke: strokeColor,
				strokeWidth: shapeStrokeSize,
				strokeDashArray: getStrokeDashArray(strokeStyle),
				selectable: false,
				evented: false
			}) as FabricRect;
		}

		if (activeTool === 'circle') {
			shapeKind = 'circle';
			shapeObj = new fabricMod.Circle({
				left: point.x,
				top: point.y,
				radius: 1,
				fill: withAlpha(fillColor, 0.25),
				stroke: strokeColor,
				strokeWidth: shapeStrokeSize,
				strokeDashArray: getStrokeDashArray(strokeStyle),
				originX: 'center',
				originY: 'center',
				selectable: false,
				evented: false
			}) as FabricCircle;
		}

		if (shapeObj) {
			fabricCanvas.add(shapeObj);
		}
	}

	function updateShape(point: { x: number; y: number }) {
		if (!shapeObj || !shapeStart || !fabricCanvas) return;

		if (shapeKind === 'line') {
			shapeObj.set({ x2: point.x, y2: point.y });
		}

		if (shapeKind === 'rect') {
			const left = Math.min(point.x, shapeStart.x);
			const top = Math.min(point.y, shapeStart.y);
			const width = Math.max(1, Math.abs(point.x - shapeStart.x));
			const height = Math.max(1, Math.abs(point.y - shapeStart.y));
			shapeObj.set({ left, top, width, height });
		}

		if (shapeKind === 'circle') {
			const radius = Math.max(1, Math.hypot(point.x - shapeStart.x, point.y - shapeStart.y));
			shapeObj.set({ left: shapeStart.x, top: shapeStart.y, radius });
		}

		shapeObj.setCoords();
		fabricCanvas.requestRenderAll();
	}

	function endShape() {
		if (!shapeObj || !fabricCanvas) {
			shapeObj = null;
			shapeStart = null;
			shapeKind = null;
			isDrawingShape = false;
			return;
		}

		shapeObj.selectable = activeTool === 'select';
		shapeObj.evented = activeTool === 'select';
		shapeObj.setCoords();
		fabricCanvas.requestRenderAll();

		shapeObj = null;
		shapeStart = null;
		shapeKind = null;
		isDrawingShape = false;
		captureHistory();
	}

	function pickColor(evt: unknown) {
		if (!fabricCanvas) return;
		const base = fabricCanvas.lowerCanvasEl;
		const ctx = base.getContext('2d', { willReadFrequently: true });
		if (!ctx) return;

		const vp = fabricCanvas.getViewportPoint(evt as MouseEvent | TouchEvent | PointerEvent);
		const scaleX = base.width / fabricCanvas.getWidth();
		const scaleY = base.height / fabricCanvas.getHeight();
		const x = Math.floor(Math.max(0, Math.min(base.width - 1, vp.x * scaleX)));
		const y = Math.floor(Math.max(0, Math.min(base.height - 1, vp.y * scaleY)));
		const pixel = ctx.getImageData(x, y, 1, 1).data;
		if (pixel[3] === 0) {
			toast.message('当前位置为透明像素');
			return;
		}

		const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
		strokeColor = hex;
		setTool('brush');
		toast.success('已拾取颜色');
	}

	function colorsClose(a: [number, number, number, number], b: [number, number, number, number], tolerance = 12) {
		return (
			Math.abs(a[0] - b[0]) <= tolerance &&
			Math.abs(a[1] - b[1]) <= tolerance &&
			Math.abs(a[2] - b[2]) <= tolerance &&
			Math.abs(a[3] - b[3]) <= tolerance
		);
	}

	function indexAt(x: number, y: number, width: number) {
		return (y * width + x) * 4;
	}

	async function fillAt(point: { x: number; y: number }) {
		if (!fabricCanvas || !fabricMod) return;
		const rgb = hexToRgb(fillColor);
		if (!rgb) return;
		const hitPoint = new fabricMod.Point(point.x, point.y);
		for (const obj of [...fabricCanvas.getObjects()].reverse()) {
			if (!obj.visible) continue;
			const rect = obj.getBoundingRect();
			const inRect =
				point.x >= rect.left &&
				point.x <= rect.left + rect.width &&
				point.y >= rect.top &&
				point.y <= rect.top + rect.height;
			if (!(inRect || obj.containsPoint(hitPoint))) continue;
			const item = obj as unknown as { type?: string; set: (k: string, v: unknown) => void };
			if (item.type === 'image') {
				continue;
			}
			if (item.type === 'line') {
				item.set('stroke', fillColor);
			} else {
				item.set('fill', fillColor);
			}
			fabricCanvas.requestRenderAll();
			captureHistory();
			toast.success('已填充');
			return;
		}

		const exportUrl = fabricCanvas.toDataURL({ format: 'png', multiplier: 1 });
		const imageEl = await new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new window.Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error('渲染快照失败'));
			img.src = exportUrl;
		});

		const width = fabricCanvas.getWidth();
		const height = fabricCanvas.getHeight();
		const offscreen = document.createElement('canvas');
		offscreen.width = width;
		offscreen.height = height;
		const ctx = offscreen.getContext('2d', { willReadFrequently: true });
		if (!ctx) return;

		ctx.drawImage(imageEl, 0, 0, width, height);
		const imageData = ctx.getImageData(0, 0, width, height);
		const src = imageData.data;

		const startX = Math.floor(Math.max(0, Math.min(width - 1, point.x)));
		const startY = Math.floor(Math.max(0, Math.min(height - 1, point.y)));
		const startIdx = indexAt(startX, startY, width);
		const target: [number, number, number, number] = [
			src[startIdx],
			src[startIdx + 1],
			src[startIdx + 2],
			src[startIdx + 3]
		];
		const replacement: [number, number, number, number] = [rgb[0], rgb[1], rgb[2], 255];

		if (colorsClose(target, replacement, 0)) {
			return;
		}

		const mask = new Uint8ClampedArray(width * height * 4);
		const visited = new Uint8Array(width * height);
		const stack: Array<[number, number]> = [[startX, startY]];

		while (stack.length > 0) {
			const [x, y] = stack.pop() as [number, number];
			if (x < 0 || x >= width || y < 0 || y >= height) continue;

			const visitIdx = y * width + x;
			if (visited[visitIdx] === 1) continue;
			visited[visitIdx] = 1;

			const idx = indexAt(x, y, width);
			const current: [number, number, number, number] = [
				src[idx],
				src[idx + 1],
				src[idx + 2],
				src[idx + 3]
			];
			if (!colorsClose(current, target, 24)) continue;

			mask[idx] = replacement[0];
			mask[idx + 1] = replacement[1];
			mask[idx + 2] = replacement[2];
			mask[idx + 3] = replacement[3];

			stack.push([x + 1, y]);
			stack.push([x - 1, y]);
			stack.push([x, y + 1]);
			stack.push([x, y - 1]);
		}

		const fillCanvas = document.createElement('canvas');
		fillCanvas.width = width;
		fillCanvas.height = height;
		const fillCtx = fillCanvas.getContext('2d');
		if (!fillCtx) return;

		fillCtx.putImageData(new ImageData(mask, width, height), 0, 0);
		const fillDataUrl = fillCanvas.toDataURL('image/png');
		const fillLayer = (await fabricMod.FabricImage.fromURL(fillDataUrl)) as FabricImage;

		fillLayer.set({
			left: 0,
			top: 0,
			selectable: false,
			evented: false
		});
		fabricCanvas.add(fillLayer);
		fabricCanvas.requestRenderAll();
		captureHistory();
		toast.success('已填充');
	}

	function onCanvasMouseDown(opt: { e: unknown }) {
		if (!fabricCanvas) return;
		const event = opt.e as MouseEvent;
		if ((activeTool === 'hand' || isSpacePressed) && 'clientX' in event) {
			beginPan(event.clientX, event.clientY);
			return;
		}
		const point = getPointer(opt.e);

		if (activeTool === 'line' || activeTool === 'rect' || activeTool === 'circle') {
			startShape(point);
			return;
		}

		if (activeTool === 'text') {
			if (!fabricMod) return;
			const text = new fabricMod.IText('双击编辑文本', {
				left: point.x,
				top: point.y,
				fontSize,
				fill: strokeColor,
				fontFamily: 'ui-sans-serif, system-ui, sans-serif',
				selectable: true,
				evented: true
			}) as IText;
			fabricCanvas.add(text);
			fabricCanvas.setActiveObject(text);
			text.enterEditing();
			fabricCanvas.requestRenderAll();
			captureHistory();
			return;
		}

		if (activeTool === 'picker') {
			pickColor(opt.e);
			return;
		}

		if (activeTool === 'fill') {
			fillAt(point).catch((error) => {
				console.error(error);
				toast.error('填充失败，请重试');
			});
		}
	}

	function onCanvasMouseMove(opt: { e: unknown }) {
		const event = opt.e as MouseEvent;
		if (isPanning && 'clientX' in event) {
			movePan(event.clientX, event.clientY);
			return;
		}
		if (!isDrawingShape) return;
		const point = getPointer(opt.e);
		updateShape(point);
	}

	function onCanvasMouseUp() {
		if (isPanning) {
			endPan();
			return;
		}
		if (!isDrawingShape) return;
		endShape();
	}

	async function importImageObject(file: File) {
		if (!fabricCanvas || !fabricMod) return;
		isImportingImage = true;
		try {
			if (!file.type.startsWith('image/')) {
				toast.error('请选择图片文件');
				return;
			}

			const dataUrl = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result));
				reader.onerror = () => reject(new Error('文件读取失败'));
				reader.readAsDataURL(file);
			});

			const image = (await fabricMod.FabricImage.fromURL(dataUrl)) as FabricImage;

			const width = fabricCanvas.getWidth();
			const height = fabricCanvas.getHeight();
			const imgWidth = image.width ?? width;
			const imgHeight = image.height ?? height;
			const scale = Math.min((width * 0.9) / imgWidth, (height * 0.9) / imgHeight, 1);

			image.set({
				left: (width - imgWidth * scale) / 2,
				top: (height - imgHeight * scale) / 2,
				scaleX: scale,
				scaleY: scale,
				selectable: true,
				evented: true
			});

			fabricCanvas.add(image);
			fabricCanvas.setActiveObject(image);
			fabricCanvas.requestRenderAll();
			captureHistory();
			toast.success('图片已导入');
		} catch (error) {
			console.error(error);
			toast.error('图片导入失败');
		} finally {
			isImportingImage = false;
		}
	}

	function handleBackgroundInputChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			importImageObject(file);
		}
		input.value = '';
	}

	function applyCanvasSize() {
		if (!fabricCanvas) return;
		const width = Number(sizeWidthDraft);
		const height = Number(sizeHeightDraft);
		if (!Number.isFinite(width) || !Number.isFinite(height) || width < 200 || height < 200) {
			toast.error('画布尺寸至少为 200x200');
			return;
		}

		canvasWidth = Math.floor(width);
		canvasHeight = Math.floor(height);
		fabricCanvas.setDimensions({ width: canvasWidth, height: canvasHeight });
		fabricCanvas.requestRenderAll();
		captureHistory();
		setTimeout(() => fitToViewport(), 0);
	}

	function clearCanvas() {
		if (!fabricCanvas) return;
		const objects = fabricCanvas.getObjects();
		if (objects.length === 0) return;

		for (const object of [...objects]) {
			fabricCanvas.remove(object);
		}
		fabricCanvas.discardActiveObject();
		fabricCanvas.requestRenderAll();
		captureHistory();
		toast.success('画板已清空');
	}

	function handleDeleteAction() {
		if (!fabricCanvas) return;
		const selected = fabricCanvas.getActiveObjects();
		if (selected.length > 0) {
			deleteSelectedObjects();
			return;
		}
		clearCanvas();
	}

	function deleteSelectedObjects() {
		if (!fabricCanvas) return;
		const selected = fabricCanvas.getActiveObjects();
		if (!selected.length) return;
		for (const object of selected) {
			fabricCanvas.remove(object);
		}
		fabricCanvas.discardActiveObject();
		fabricCanvas.requestRenderAll();
		captureHistory();
	}

	function exportPng() {
		if (!fabricCanvas) return;
		const dataUrl = fabricCanvas.toDataURL({ format: 'png', multiplier: 1 });
		const a = document.createElement('a');
		a.href = dataUrl;
		a.download = `canvas_${Date.now()}.png`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		toast.success('PNG 已导出');
	}

	$effect(() => {
		if (!fabricCanvas) return;
		if (activeTool === 'brush' || activeTool === 'eraser') {
			applyToolConfig();
		}
	});

	onMount(() => {
		let disposed = false;
		const teardownFns: Array<() => void> = [];

		const setup = async () => {
			if (!canvasEl) return;
			fabricMod = await import('fabric');
			if (disposed) return;

			const viewportWidth = canvasViewportRef?.clientWidth ?? window.innerWidth;
			const viewportHeight = canvasViewportRef?.clientHeight ?? window.innerHeight;
			const defaultWidth = Math.max(320, Math.floor(viewportWidth - 24));
			const defaultHeight = Math.max(320, Math.floor(viewportHeight - 24));
			canvasWidth = defaultWidth;
			canvasHeight = defaultHeight;
			sizeWidthDraft = defaultWidth;
			sizeHeightDraft = defaultHeight;

			const canvas = new fabricMod.Canvas(canvasEl, {
				width: defaultWidth,
				height: defaultHeight,
				backgroundColor: '#ffffff',
				selection: false,
				preserveObjectStacking: true,
				stopContextMenu: true
			});
			fabricCanvas = canvas;

			canvas.on('mouse:down', onCanvasMouseDown);
			canvas.on('mouse:move', onCanvasMouseMove);
			canvas.on('mouse:up', onCanvasMouseUp);
			canvas.on('mouse:wheel', (evt) => {
				const wheel = evt.e as WheelEvent;
				if (!(wheel.ctrlKey || wheel.metaKey)) return;
				wheel.preventDefault();
				wheel.stopPropagation();
				const factor = wheel.deltaY > 0 ? 0.9 : 1.1;
				const pointer = { x: wheel.offsetX, y: wheel.offsetY };
				zoomTo(zoomPercent * factor, pointer);
			});

			canvas.on('path:created', (evt) => {
				if (!evt.path) return;
				
				const isEraser = activeTool === 'eraser';
				evt.path.set({
					globalCompositeOperation: isEraser 
						? (transparentBackground ? 'destination-out' : 'source-over')
						: 'source-over',
					strokeDashArray: isEraser ? [] : getStrokeDashArray(strokeStyle),
					selectable: false,
					evented: false
				});
				captureHistory();
			});

			const historyEvents = ['object:added', 'object:modified', 'object:removed'];
			for (const eventName of historyEvents) {
				canvas.on(eventName as 'object:added', () => {
					if (!isRestoringHistory) captureHistory();
				});
			}

			applyToolConfig();
			captureHistory();
			setTimeout(() => fitToViewport(), 0);
			isLoading = false;

			const upperCanvas = (canvas as Canvas & { upperCanvasEl?: HTMLCanvasElement }).upperCanvasEl;
			if (upperCanvas) {
				const onTouchStart = (event: TouchEvent) => {
					if (event.touches.length !== 2) return;
					event.preventDefault();
					isPinching = true;
					const [a, b] = [event.touches[0], event.touches[1]];
					pinchStartDistance = getTouchDistance(a, b);
					pinchStartZoom = canvas.getZoom();
					pinchLastCenter = getTouchCenter(a, b, upperCanvas);
					beginPan(pinchLastCenter.x, pinchLastCenter.y);
				};
				const onTouchMove = (event: TouchEvent) => {
					if (!isPinching || event.touches.length !== 2) return;
					event.preventDefault();
					const [a, b] = [event.touches[0], event.touches[1]];
					const distance = getTouchDistance(a, b);
					if (pinchStartDistance <= 0) return;
					const center = getTouchCenter(a, b, upperCanvas);
					const nextZoom = (pinchStartZoom * distance) / pinchStartDistance;
					zoomTo(nextZoom * 100, center);
					movePan(center.x, center.y);
					pinchLastCenter = center;
				};
				const onTouchEnd = () => {
					isPinching = false;
					pinchStartDistance = 0;
					pinchLastCenter = null;
					if (isPanning) endPan();
				};
				upperCanvas.addEventListener('touchstart', onTouchStart, { passive: false });
				upperCanvas.addEventListener('touchmove', onTouchMove, { passive: false });
				upperCanvas.addEventListener('touchend', onTouchEnd);
				upperCanvas.addEventListener('touchcancel', onTouchEnd);
				teardownFns.push(() => upperCanvas.removeEventListener('touchstart', onTouchStart));
				teardownFns.push(() => upperCanvas.removeEventListener('touchmove', onTouchMove));
				teardownFns.push(() => upperCanvas.removeEventListener('touchend', onTouchEnd));
				teardownFns.push(() => upperCanvas.removeEventListener('touchcancel', onTouchEnd));
			}

			const onKeyDown = (event: KeyboardEvent) => {
				const target = event.target as HTMLElement | null;
				const isTypingTarget =
					!!target &&
					(target.tagName === 'INPUT' ||
						target.tagName === 'TEXTAREA' ||
						(target as HTMLElement).isContentEditable);
				if (isTypingTarget) return;
				if (event.code === 'Space') {
					isSpacePressed = true;
					event.preventDefault();
					return;
				}
				if (event.key === 'Delete' || event.key === 'Backspace') {
					if (isTypingTarget) return;
					event.preventDefault();
					deleteSelectedObjects();
					return;
				}
				const key = event.key.toLowerCase();
				if (!event.metaKey && !event.ctrlKey && !event.altKey) {
					if (key === 'v') setTool('select');
					if (key === 'h') setTool('hand');
					if (key === 'd' || key === 'b') setTool('brush');
					if (key === 'e') setTool('eraser');
					if (key === 'l') setTool('line');
					if (key === 'r') setTool('rect');
					if (key === 'o' || key === 'c') setTool('circle');
					if (key === 't') setTool('text');
					if (key === 'i') setTool('picker');
					if (key === 'f') setTool('fill');
				}
				if ((event.metaKey || event.ctrlKey) && key === 'z' && !event.shiftKey) {
					event.preventDefault();
					undo();
					return;
				}
				if ((event.metaKey || event.ctrlKey) && ((key === 'z' && event.shiftKey) || key === 'y')) {
					event.preventDefault();
					redo();
					return;
				}
				if ((event.metaKey || event.ctrlKey) && (event.key === '+' || event.key === '=')) {
					event.preventDefault();
					zoomTo(zoomPercent + 10);
				}
				if ((event.metaKey || event.ctrlKey) && event.key === '-') {
					event.preventDefault();
					zoomTo(zoomPercent - 10);
				}
				if ((event.metaKey || event.ctrlKey) && event.key === '0') {
					event.preventDefault();
					resetView();
				}
			};
			const onKeyUp = (event: KeyboardEvent) => {
				if (event.code === 'Space') {
					isSpacePressed = false;
					if (isPanning) endPan();
				}
			};
			window.addEventListener('keydown', onKeyDown);
			window.addEventListener('keyup', onKeyUp);
			teardownFns.push(() => window.removeEventListener('keydown', onKeyDown));
			teardownFns.push(() => window.removeEventListener('keyup', onKeyUp));
		};

		setup().catch((error) => {
			console.error(error);
			toast.error('画板初始化失败');
			isLoading = false;
		});

		return () => {
			disposed = true;
			for (const teardown of teardownFns) teardown();
			if (fabricCanvas) {
				fabricCanvas.dispose();
				fabricCanvas = null;
			}
		};
	});
</script>

<div class="relative h-full overflow-hidden bg-muted/30">
	<div
		bind:this={canvasViewportRef}
		class="absolute inset-0 overflow-auto bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0]"
	>
		<div class="flex min-h-full min-w-full items-center justify-center p-2">
			{#if isLoading}
				<div class="flex h-[320px] w-[520px] max-w-full items-center justify-center rounded-xl border bg-background/90 text-sm text-muted-foreground">
					画板初始化中...
				</div>
			{/if}
			<canvas
				bind:this={canvasEl}
				aria-label="画板画布"
				class="block touch-none rounded-lg bg-transparent shadow-[0_8px_30px_rgba(15,23,42,0.18)]"
				style="max-width: none; height: auto;"
			></canvas>
		</div>
	</div>

	<div class="pointer-events-none absolute inset-0">
		<button
			type="button"
			onclick={() => (showChrome = !showChrome)}
			class="pointer-events-auto absolute right-3 z-30 inline-flex h-9 items-center gap-1 rounded-lg border bg-background/95 px-2 text-xs text-muted-foreground shadow-md backdrop-blur hover:bg-muted hover:text-foreground max-md:top-3 md:bottom-3"
			title={showChrome ? '隐藏界面' : '显示界面'}
		>
			{#if showChrome}
				<EyeOff class="h-4 w-4" />
				<span class="hidden sm:inline">隐藏界面</span>
			{:else}
				<Eye class="h-4 w-4" />
				<span class="hidden sm:inline">显示界面</span>
			{/if}
		</button>

		{#if showChrome}
			<div class="pointer-events-auto absolute bottom-3 left-1/2 z-20 -translate-x-1/2 md:bottom-auto md:top-3">
			<div class="rounded-2xl border bg-background/95 p-1 shadow-lg backdrop-blur">
			<div class="flex items-center gap-1">
				{#each toolItems.filter((item) => !['line', 'rect', 'circle'].includes(item.key)) as item (item.key)}
					<button
						type="button"
						title={item.label}
						aria-label={item.label}
						onclick={() => setTool(item.key)}
						class="inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors {activeTool === item.key
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
					>
						<item.icon class="h-4 w-4" />
					</button>
				{/each}

				<div class="relative">
					<button
						type="button"
						title="形状"
						aria-label="形状"
						onclick={() => (showShapeMenu = !showShapeMenu)}
						class="inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors {['line', 'rect', 'circle'].includes(activeTool)
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
					>
						<currentShapeTool.icon class="h-4 w-4" />
					</button>

					{#if showShapeMenu}
						<div class="absolute left-1/2 z-30 w-32 -translate-x-1/2 rounded-lg border bg-background/95 p-1 shadow-lg backdrop-blur max-md:bottom-11 md:top-11">
							{#each shapeTools as shape (shape.key)}
								<button
									type="button"
									onclick={() => setTool(shape.key)}
									class="flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs transition-colors {activeTool === shape.key
										? 'bg-primary/10 text-primary'
										: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
								>
									<shape.icon class="h-3.5 w-3.5" />
									<span>{shape.label}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<Button
					variant="ghost"
					size="sm"
					class="h-10 w-10 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
					onclick={() => backgroundInputRef?.click()}
						disabled={isImportingImage}
						title="导入图片"
					>
						<ImageIcon class="h-4 w-4" />
					</Button>
				<button
					type="button"
					onclick={() => (showSettingsPanel = !showSettingsPanel)}
					class="absolute -top-11 right-0 inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-background/95 text-muted-foreground shadow-md backdrop-blur hover:bg-muted hover:text-foreground md:hidden"
					title="属性面板"
				>
					<Settings2 class="h-4 w-4" />
				</button>
				</div>
				</div>
				</div>

			<div class="pointer-events-auto absolute left-3 top-3 z-20 flex items-center gap-2">
				<div class="flex items-center gap-1 rounded-xl border bg-background/95 p-1 shadow-md backdrop-blur">
					<Button variant="ghost" size="sm" class="h-8 w-8 p-0" disabled={!canUndo} onclick={undo} title="撤销 (Ctrl/Cmd+Z)">
						<Undo2 class="h-4 w-4" />
					</Button>
					<Button variant="ghost" size="sm" class="h-8 w-8 p-0" disabled={!canRedo} onclick={redo} title="重做 (Ctrl/Cmd+Shift+Z)">
						<Redo2 class="h-4 w-4" />
					</Button>
					<div class="h-5 w-px bg-border"></div>
					<Button variant="ghost" size="sm" class="h-8 w-8 p-0" onclick={handleDeleteAction} title="删除选中 / 清空画布">
						<Trash2 class="h-4 w-4" />
					</Button>
					<Button variant="ghost" size="sm" class="h-8 w-8 p-0" onclick={exportPng} title="导出 PNG">
						<Download class="h-4 w-4" />
					</Button>
					<div class="h-5 w-px bg-border md:hidden"></div>
					<Button variant="ghost" size="sm" class="h-8 w-8 p-0 md:hidden" onclick={() => zoomTo(zoomPercent - 10)} title="缩小">
						<ZoomOut class="h-4 w-4" />
					</Button>
					<button
						type="button"
						class="h-8 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-muted md:hidden"
						onclick={resetView}
						title="重置缩放"
					>
						{zoomPercent}%
					</button>
					<Button variant="ghost" size="sm" class="h-8 w-8 p-0 md:hidden" onclick={() => zoomTo(zoomPercent + 10)} title="放大">
						<ZoomIn class="h-4 w-4" />
					</Button>
				</div>
				</div>

			<input bind:this={backgroundInputRef} type="file" accept="image/*" class="hidden" onchange={handleBackgroundInputChange} />

			<div
			class="pointer-events-auto absolute z-20 w-[260px] max-w-[calc(100vw-1.5rem)] rounded-2xl border bg-background/95 p-3 shadow-md backdrop-blur max-md:bottom-16 max-md:left-3 max-md:right-3 max-md:w-auto max-md:max-h-[52vh] max-md:overflow-auto md:right-3 md:top-3 {showSettingsPanel ? 'block' : 'hidden md:block'}"
			>
			<div class="mb-3 flex items-center justify-between">
				<p class="text-xs font-medium text-muted-foreground">属性 · {activeToolLabel}</p>
				<button
					type="button"
					onclick={() => (showSettingsPanel = !showSettingsPanel)}
					class="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
					title="画布设置"
				>
					<Settings2 class="h-4 w-4" />
				</button>
			</div>

			<div class="space-y-2">
				<label class="flex items-center justify-between gap-3 text-xs">
					<span class="text-muted-foreground">描边颜色</span>
					<input type="color" bind:value={strokeColor} class="h-8 w-12 cursor-pointer rounded border bg-transparent p-0.5" />
				</label>

				{#if activeTool === 'rect' || activeTool === 'circle' || activeTool === 'fill'}
					<label class="flex items-center justify-between gap-3 text-xs">
						<span class="text-muted-foreground">填充颜色</span>
						<input type="color" bind:value={fillColor} class="h-8 w-12 cursor-pointer rounded border bg-transparent p-0.5" />
					</label>
				{/if}

				{#if activeTool === 'brush' || activeTool === 'eraser'}
					<label class="block text-xs">
						<div class="mb-1 flex items-center justify-between text-muted-foreground">
							<span>笔触粗细</span><span>{brushSize}px</span>
						</div>
						<input type="range" min="1" max="64" bind:value={brushSize} class="w-full" />
					</label>
				{/if}

				{#if activeTool === 'line' || activeTool === 'rect' || activeTool === 'circle'}
					<label class="block text-xs">
						<div class="mb-1 flex items-center justify-between text-muted-foreground">
							<span>线条粗细</span><span>{shapeStrokeSize}px</span>
						</div>
						<input type="range" min="1" max="30" bind:value={shapeStrokeSize} class="w-full" />
					</label>
				{/if}

				{#if activeTool === 'brush' || activeTool === 'line' || activeTool === 'rect' || activeTool === 'circle'}
					<div class="text-xs">
						<div class="mb-1 text-muted-foreground">笔触样式</div>
						<div class="grid grid-cols-4 gap-1">
							{#each [
								{ key: 'solid' as const, label: '实线' },
								{ key: 'dashed' as const, label: '虚线' },
								{ key: 'dotted' as const, label: '点线' },
								{ key: 'dash-dot' as const, label: '点划' }
							] as item (item.key)}
								<button
									type="button"
									onclick={() => (strokeStyle = item.key)}
									class="h-8 rounded-md border px-1 text-[11px] transition-colors {strokeStyle === item.key
										? 'border-primary bg-primary/10 text-primary'
										: 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'}"
								>
									{item.label}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				{#if activeTool === 'text'}
					<label class="block text-xs">
						<div class="mb-1 flex items-center justify-between text-muted-foreground">
							<span>字号</span><span>{fontSize}px</span>
						</div>
						<input type="range" min="10" max="120" bind:value={fontSize} class="w-full" />
					</label>
				{/if}
			</div>

			{#if showSettingsPanel}
				<div class="mt-3 border-t pt-3">
					<div class="mb-2 text-xs font-medium text-muted-foreground">画布设置</div>
					<div class="grid grid-cols-2 gap-2">
						<label class="text-[11px] text-muted-foreground">
							<div class="mb-1">宽度</div>
							<input type="number" min="200" step="1" bind:value={sizeWidthDraft} class="h-8 w-full rounded border bg-background px-2 text-xs text-foreground" />
						</label>
						<label class="text-[11px] text-muted-foreground">
							<div class="mb-1">高度</div>
							<input type="number" min="200" step="1" bind:value={sizeHeightDraft} class="h-8 w-full rounded border bg-background px-2 text-xs text-foreground" />
						</label>
					</div>
					<div class="mt-2 flex items-center justify-between gap-2">
						<Button variant="outline" size="sm" class="h-8 text-xs" onclick={applyCanvasSize}>应用尺寸</Button>
						<label class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
							<input type="checkbox" bind:checked={transparentBackground} onchange={setBackgroundColor} />
							透明背景
						</label>
					</div>
				</div>
			{/if}
			</div>

			<div class="pointer-events-auto absolute bottom-3 left-3 z-20 hidden items-center gap-1 rounded-xl border bg-background/95 p-1 shadow-md backdrop-blur md:flex">
			<Button variant="ghost" size="sm" class="h-8 w-8 p-0" onclick={() => zoomTo(zoomPercent - 10)}>
				<ZoomOut class="h-4 w-4" />
			</Button>
			<button type="button" class="h-8 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted" onclick={resetView}>
				{zoomPercent}%
			</button>
			<Button variant="ghost" size="sm" class="h-8 w-8 p-0" onclick={() => zoomTo(zoomPercent + 10)}>
				<ZoomIn class="h-4 w-4" />
			</Button>
			<Button variant="ghost" size="sm" class="h-8 px-2 text-xs" onclick={fitToViewport}>适配</Button>
			</div>

			<div class="absolute bottom-3 left-1/2 z-20 hidden -translate-x-1/2 rounded-lg border bg-background/90 px-3 py-1.5 text-[11px] text-muted-foreground shadow md:block">
			V 选择 · H 手型 · D 画笔 · E 橡皮 · L 直线 · R 矩形 · O 圆形 · T 文字 · I 取色 · F 填充 · 空格拖拽
			</div>
		{/if}
		</div>
	</div>

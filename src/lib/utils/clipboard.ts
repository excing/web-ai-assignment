import { toast } from 'svelte-sonner';

/**
 * 将文本写入剪贴板（不弹 toast），带 execCommand 兼容回退。
 */
export async function writeClipboard(text: string): Promise<boolean> {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return true;
	}
	// fallback: 使用隐藏 textarea + execCommand
	const ta = document.createElement('textarea');
	ta.value = text;
	ta.style.position = 'fixed';
	ta.style.left = '-9999px';
	ta.style.opacity = '0';
	document.body.appendChild(ta);
	ta.select();
	const ok = document.execCommand('copy');
	document.body.removeChild(ta);
	if (!ok) throw new Error('execCommand copy failed');
	return true;
}

/**
 * 将文本复制到剪贴板，成功/失败自动弹出 toast。
 * @returns 是否复制成功
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await writeClipboard(text);
		toast.success('已复制到剪贴板');
		return true;
	} catch {
		toast.error('复制失败');
		return false;
	}
}

/**
 * 工具箱注册表
 *
 * 在此处注册所有可用工具。新增工具只需在 tools 数组中添加一项即可。
 */

import {
	Minimize2,
	Columns2,
	FileCode2,
	type Icon,
} from 'lucide-svelte';
import type { ComponentType } from 'svelte';

export interface ToolDefinition {
	/** 唯一标识，对应路由路径 /tools/{key} */
	key: string;
	/** 显示名称 */
	label: string;
	/** 简要描述 */
	description: string;
	/** 图标组件 */
	icon: ComponentType<Icon>;
	/** 图标背景色（Tailwind class） */
	iconBg: string;
	/** 图标文字色（Tailwind class） */
	iconColor: string;
}

export const tools: ToolDefinition[] = [
	{
		key: 'compress',
		label: '图片压缩',
		description: '压缩单张或多张图片，减小文件体积',
		icon: Minimize2,
		iconBg: 'bg-blue-500/10',
		iconColor: 'text-blue-500',
	},
	{
		key: 'compare',
		label: '图片对比',
		description: '将两张图片拼合为一张左右对比图',
		icon: Columns2,
		iconBg: 'bg-emerald-500/10',
		iconColor: 'text-emerald-500',
	},
	{
		key: 'svg',
		label: '图片转 SVG',
		description: '将位图转换为矢量 SVG 图形',
		icon: FileCode2,
		iconBg: 'bg-violet-500/10',
		iconColor: 'text-violet-500',
	},
];

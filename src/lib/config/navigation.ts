import {
	MessageCircle,
	Package,
	Ticket,
	Server,
	ImageIcon,
	LayoutTemplate,
	Wrench,
	type Icon,
} from 'lucide-svelte';
import type { ComponentType } from 'svelte';

// ─── 类型定义 ────────────────────────────────────────────

export interface NavItem {
	/** 路由标识 */
	key: string;
	/** 显示标签 */
	label: string;
	/** 图标组件 */
	icon: ComponentType<Icon>;
	/** 路由路径 */
	href: string;
}

export interface AdminNavItem extends NavItem {}

// ─── 功能导航（侧边栏 / 底部 Tab）────────────────────────

export const navItems: NavItem[] = [
	{ key: 'create', label: '图片生成', icon: ImageIcon, href: '/create' },
	{ key: 'chat', label: 'Chat', icon: MessageCircle, href: '/chat' },
	{ key: 'tools', label: '工具箱', icon: Wrench, href: '/tools' },
];

// ─── 管理后台导航（仅 Admin 可见）────────────────────────

export const adminNavItems: AdminNavItem[] = [
	{ key: 'admin-packages', label: '套餐管理', icon: Package, href: '/admin/packages' },
	{ key: 'admin-codes', label: '兑换码管理', icon: Ticket, href: '/admin/codes' },
	{ key: 'admin-ai-proxy', label: 'AI Proxy', icon: Server, href: '/admin/ai-proxy' },
	{ key: 'admin-templates', label: '模板管理', icon: LayoutTemplate, href: '/admin/templates' },
];

// ─── 默认路由 ─────────────────────────────────────────────

/** 登录后默认跳转的路由 */
export const defaultRoute = '/create';

// ─── 受保护路由前缀 ──────────────────────────────────────

/** 需要认证的路由前缀列表 */
export const protectedPrefixes = ['/chat', '/me', '/admin', '/create', '/tools'];

/** 认证相关页面（已登录用户会被重定向走） */
export const authPages = ['/sign-in', '/sign-up'];

// ─── API 路由认证配置 ────────────────────────────────────

/** 公开 API 路径（不需要认证） */
export const publicApiPaths = [
	'/api/auth' // Better Auth 处理器
];

/** 需要管理员权限的 API 路径前缀 */
export const adminApiPrefixes = [
	'/api/admin'
];

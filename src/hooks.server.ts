import { auth } from '$lib/server/auth';
import { redirect, type Handle, json } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/credits/admin';
import {
	billingPreCheck,
	billingPostPayment,
	wrapStreamingResponse,
} from '$lib/server/credits/billing-middleware';
import {
	protectedPrefixes,
	authPages,
	defaultRoute,
	publicApiPaths,
	adminApiPrefixes
} from '$lib/config/navigation';

export const handle: Handle = async ({ event, resolve }) => {
	// Get session from Better Auth
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.session = session;

	const { pathname } = event.url;

	// ─── API 路由认证 ────────────────────────────────────────
	if (pathname.startsWith('/api/')) {
		// 1. 检查是否是公开 API（不需要认证）
		const isPublicApi = publicApiPaths.some((path) => pathname.startsWith(path));
		if (!isPublicApi) {
			if (!session?.user) {
				return json({ error: '请先登录' }, { status: 401 });
			}
			// 2. 检查是否需要管理员权限
			const isAdminApi = adminApiPrefixes.some((prefix) => pathname.startsWith(prefix));
			if (isAdminApi) {
				if (!isAdmin(session.user.email)) {
					return json({ error: '无权限访问' }, { status: 403 });
				}
			}
		}
	}

	// ─── 页面路由认证 ────────────────────────────────────────

	// Redirect authenticated users away from auth pages
	if (session?.user && authPages.includes(pathname)) {
		throw redirect(302, defaultRoute);
	}

	// Protect app routes
	const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
	if (!session?.user && isProtected) {
		throw redirect(302, '/sign-in');
	}

	// Protect admin routes
	if (pathname.startsWith('/admin')) {
		if (!isAdmin(session?.user?.email)) {
			throw redirect(302, defaultRoute);
		}
	}

	// ── 计费预检 ──
	const billingBlock = await billingPreCheck(event);
	if (billingBlock) {
		return billingBlock; // 402 - 余额不足
	}

	// ── 执行请求 ──
	const response = await resolve(event);

	// ── 计费后付 ──
	const ctx = event.locals.billingContext;
	if (ctx && response.ok) {
		if (ctx.routeConfig.responseType === 'streaming') {
			return wrapStreamingResponse(response, event);
		} else {
			// 标准响应：固定计费无需用量数据，直接 resolve
			ctx.resolveUsageData();
			await billingPostPayment(event);
		}
	}

	return response;
};

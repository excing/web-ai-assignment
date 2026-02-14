import { auth } from '$lib/server/auth';
import { redirect, type Handle } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/credits/admin';
import {
	billingPreCheck,
	billingPostPayment,
	wrapStreamingResponse,
} from '$lib/server/credits/billing-middleware';

export const handle: Handle = async ({ event, resolve }) => {
	// Get session from Better Auth
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.session = session;

	const { pathname } = event.url;

	// Redirect authenticated users away from auth pages
	if (session?.user && ['/sign-in', '/sign-up'].includes(pathname)) {
		throw redirect(302, '/dashboard');
	}

	// Protect dashboard routes
	if (!session?.user && pathname.startsWith('/dashboard')) {
		throw redirect(302, '/sign-in');
	}

	// Protect admin routes
	if (pathname.startsWith('/dashboard/admin')) {
		if (!isAdmin(session?.user?.email)) {
			throw redirect(302, '/dashboard');
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

import type { BilledRouteConfig } from './billing-types';
import { chatBillingStrategy, uploadBillingStrategy } from './billing-strategies';

/**
 * 需要计费的路由注册表。
 *
 * 扩展方式：新增端点只需往此数组加一项，其他代码零改动。
 */
const billedRoutes: BilledRouteConfig[] = [
	{
		pathPattern: '/api/chat',
		method: 'POST',
		strategy: chatBillingStrategy,
		responseType: 'streaming',
	},
	{
		pathPattern: '/api/upload-image',
		method: 'POST',
		strategy: uploadBillingStrategy,
		responseType: 'standard',
	},
];

/**
 * 根据请求路径和方法查找计费配置。
 * 未匹配返回 null（该请求不需要计费）。
 */
export function findBilledRoute(
	pathname: string,
	method: string
): BilledRouteConfig | null {
	return (
		billedRoutes.find(
			(r) => r.pathPattern === pathname && r.method === method.toUpperCase()
		) ?? null
	);
}

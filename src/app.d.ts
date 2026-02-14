// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { Session } from '$lib/server/auth';
import type { BillingContext } from '$lib/server/credits/billing-types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: Session | null;
			billingContext?: BillingContext;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export { };


import type { LayoutServerLoad } from './$types';
import { isAdmin } from '$lib/server/credits/admin';
import { getBalance } from '$lib/server/credits/credit-service';

export const load: LayoutServerLoad = async ({ locals }) => {
    const user = locals.session?.user;
    return {
        isAdmin: user ? isAdmin(user.email) : false,
        creditBalance: user ? await getBalance(user.id) : 0,
    };
};

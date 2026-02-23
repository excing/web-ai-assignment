import type { LayoutServerLoad } from './$types';
import { isAdmin } from '$lib/server/credits/admin';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals }) => {
    const sessionUser = locals.session?.user;
    if (!sessionUser) {
        return { isAdmin: false, creditBalance: 0, userLevel: 0 };
    }

    const [row] = await db
        .select({ creditBalance: userTable.creditBalance, level: userTable.level })
        .from(userTable)
        .where(eq(userTable.id, sessionUser.id));

    return {
        isAdmin: isAdmin(sessionUser.email),
        creditBalance: row?.creditBalance ?? 0,
        userLevel: row?.level ?? 0,
    };
};

import { json, type RequestHandler } from '@sveltejs/kit';
import { getBalance } from '$lib/server/credits/credit-service';

export const GET: RequestHandler = async ({ locals }) => {
    const balance = await getBalance(locals.session!.user.id);
    return json({ balance });
};

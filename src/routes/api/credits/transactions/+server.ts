import { json, type RequestHandler } from '@sveltejs/kit';
import { getTransactionHistory } from '$lib/server/credits/credit-service';

export const GET: RequestHandler = async ({ locals }) => {
    const transactions = await getTransactionHistory(locals.session!.user.id);
    return json({ transactions });
};

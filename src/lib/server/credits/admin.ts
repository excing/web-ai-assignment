import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';

let _adminEmails: Set<string> | null = null;

function getAdminEmails(): Set<string> {
    if (_adminEmails) return _adminEmails;
    const raw = env.ADMIN_EMAILS ?? '';
    _adminEmails = new Set(
        raw.split(',')
            .map(e => e.trim().toLowerCase())
            .filter(Boolean)
    );
    return _adminEmails;
}

export function isAdmin(email: string | undefined | null): boolean {
    if (!email) return false;
    return getAdminEmails().has(email.toLowerCase());
}

export function guardAdmin(email: string | undefined | null): Response | null {
    if (isAdmin(email)) return null;
    return json({ error: '无权限访问' }, { status: 403 });
}

import { authClient } from '$lib/auth-client';

export type AuthUser = {
	id: string;
	name?: string | null;
	email: string;
	image?: string | null;
	[key: string]: unknown;
};

type SessionData = {
	user?: AuthUser | null;
	[key: string]: unknown;
};

let _user = $state<AuthUser | null>(null);
let _loaded = $state(false);
let _loading = $state(false);

let inFlight: Promise<AuthUser | null> | null = null;

export function getCurrentUser(): AuthUser | null {
	return _user;
}

export function getAuthLoaded(): boolean {
	return _loaded;
}

export function getAuthLoading(): boolean {
	return _loading;
}

export function setCurrentUser(user: AuthUser | null) {
	_user = user;
	_loaded = true;
}

/**
 * Initialize auth state from SvelteKit layout data.
 * `session` comes from `src/routes/+layout.server.ts`.
 */
export function initAuthFromLayout(session: unknown) {
	const sessionUser = (session as SessionData | null)?.user ?? null;

	// First initialization: trust the server session.
	if (!_loaded) {
		setCurrentUser(sessionUser);
		return;
	}

	// If server says "no session", clear local user.
	if (!sessionUser) {
		if (_user) setCurrentUser(null);
		else _loaded = true;
		return;
	}

	// If user changed (login as different user), replace.
	if (!_user || _user.id !== sessionUser.id) {
		setCurrentUser(sessionUser);
		return;
	}

	// Same user: merge in a way that preserves local patches (existing wins).
	_user = { ...sessionUser, ..._user };
	_loaded = true;
}

export function patchCurrentUser(patch: Partial<AuthUser>) {
	if (_user) {
		_user = { ..._user, ...patch } as AuthUser;
	}
}

export function clearAuthState() {
	setCurrentUser(null);
}

export async function refreshCurrentUser(): Promise<AuthUser | null> {
	_loading = true;
	try {
		const result = await authClient.getSession();
		const data = result as { data?: { user?: AuthUser | null } } | null;
		const user = data?.data?.user ?? null;
		setCurrentUser(user);
		return user;
	} catch (err) {
		console.error('Failed to refresh session:', err);
		setCurrentUser(null);
		return null;
	} finally {
		_loading = false;
	}
}

export async function ensureCurrentUserLoaded(): Promise<AuthUser | null> {
	if (_loaded) return _user;
	if (inFlight) return inFlight;
	inFlight = refreshCurrentUser().finally(() => {
		inFlight = null;
	});
	return inFlight;
}

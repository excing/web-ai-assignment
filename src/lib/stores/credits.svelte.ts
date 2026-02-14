let _balance = $state(0);
let _loaded = $state(false);
let _loading = $state(false);

export function getCreditBalance(): number {
    return _balance;
}

export function getCreditLoaded(): boolean {
    return _loaded;
}

export function setCreditBalance(balance: number) {
    _balance = balance;
    _loaded = true;
}

export async function fetchCreditBalance(): Promise<number> {
    if (_loading) return _balance;
    _loading = true;
    try {
        const res = await fetch('/api/credits/balance');
        if (res.ok) {
            const data = await res.json();
            setCreditBalance(data.balance);
            return data.balance;
        }
        return _balance;
    } catch {
        return _balance;
    } finally {
        _loading = false;
    }
}

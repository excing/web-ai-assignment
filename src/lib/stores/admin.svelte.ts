let _isAdmin = $state(false);

export function getIsAdmin(): boolean {
    return _isAdmin;
}

export function setIsAdmin(val: boolean) {
    _isAdmin = val;
}

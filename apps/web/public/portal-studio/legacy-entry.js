(async () => {
  const source = new URL(location.href);
  const token = localStorage.getItem('bobos.token');
  let role = token && localStorage.getItem('portal-account-role');
  if (token && !role && !source.searchParams.has('role')) {
    try {
      const response = await fetch('/api/identity/profile', {
        headers: { Authorization: 'Bearer ' + token },
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) {
        const { profile } = await response.json();
        role = profile.role;
        if (role) localStorage.setItem('portal-account-role', role);
      }
    } catch {
      // The Portal owns session recovery if this older session cannot be read.
    }
  }
  const destination = BobosPortalRoutes.siteEntry(source, {
    signedIn: Boolean(token),
    role,
  });
  location.replace(destination);
})();

(async () => {
  const old = new URL(location.href);
  const destination = new URL('/portal-studio/index.html', old);
  const query = new URLSearchParams(old.search);
  const screen = query.get('screen') || query.get('page') || 'overview';
  query.delete('embedded');
  query.delete('section');
  query.delete('screen');
  query.set('preview', 'live');

  if (['my-graduation', 'graduation-review', 'graduation-plans'].includes(screen)) {
    query.set('page', 'graduation-plans');
    if (screen === 'graduation-review') query.set('view', 'submitted');
  } else if (['overview', 'extra-hours', 'calendar-sync', 'login', 'forgot', 'reset'].includes(screen)) {
    query.set('page', screen);
  } else {
    query.set('page', 'academic-services');
    query.set('screen', screen);
  }
  if (['connected', 'error'].includes(query.get('calendar'))) query.set('page', 'calendar-sync');

  const token = localStorage.getItem('bobos.token');
  if (token) {
    try {
      const response = await fetch('/api/identity/profile', {
        headers: { Authorization: 'Bearer ' + token },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const { profile } = await response.json();
        query.set('role', profile.role);
        localStorage.setItem('portal-studio-preview-session', '1');
      }
    } catch { /* Portal can recover the session or prompt for sign-in. */ }
  }
  destination.search = query;
  destination.hash = old.hash;
  location.replace(destination);
})();

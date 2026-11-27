/* Shared by Portal, the site entry, and older workspace bookmarks. */
globalThis.BobosPortalRoutes = (() => {
  const servicePages = new Set([
    'advising', 'directory', 'financial-records', 'group-assignments',
    'mandatory-removals', 'offerings', 'pending-work', 'preferences',
    'schedule-activity', 'schedule-swap', 'slot-changes', 'student-schedules',
  ]);
  const directPages = new Set([
    ...servicePages, 'overview', 'my-schedule', 'my-courses', 'calendar-sync',
    'extra-hours', 'graduation-plans', 'my-submitted-plans', 'copy-offerings',
    'login', 'forgot', 'reset', 'courses', 'terms', 'templates',
    'profile', 'notifications', 'records', 'my-advisor', 'course-detail', 'student-detail', 'draft-schedule', 'template-detail',
    'manage-courses', 'manage-terms', 'manage-templates',
    'official-records', 'account-inbox', 'account-details',
  ]);
  const oldPaths = {
    '/dev-login': 'login', '/coordinator/assign-groups': 'group-assignments',
    '/schedule': 'my-schedule', '/schedules': 'student-schedules',
    '/courses': 'courses', '/swap': 'schedule-swap',
  };

  const legacyWorkflows = {
    profile: 'account-details', notifications: 'account-inbox',
    records: 'official-records',
  };

  function screenPage(screen, role) {
    if (screen === 'advisor-assignment') return 'my-advisor';
    if (screen === 'graduation-review') return role === 'advisor' ? 'my-submitted-plans' : 'graduation-plans';
    if (screen === 'my-graduation') return 'graduation-plans';
    return directPages.has(screen) ? screen : 'academic-services';
  }

  function normalize(query) {
    const page = query.get('page');
    const screen = query.get('screen');
    if (page === 'advisor-assignment' || page === 'my-advisor' ||
        (!page && (screen === 'advisor-assignment' || screen === 'my-advisor'))) {
      query.set('page', 'my-advisor');
      query.delete('screen');
      return;
    }
    if (page === 'academic-services' && !screen) {
      query.set('page', 'overview');
      return;
    }
    if (!screen || (page !== 'academic-services' && !servicePages.has(page))) return;
    // Older in-page navigation changed screen while leaving page untouched.
    const target = Object.hasOwn(legacyWorkflows, screen) ? legacyWorkflows[screen] : screenPage(screen, query.get('role'));
    if (target !== 'academic-services') {
      query.set('page', target);
      query.delete('screen');
    }
  }

  function siteEntry(source, { signedIn, role } = {}) {
    const target = new URL('/portal-studio/index.html', source);
    target.search = source.search;
    target.hash = source.hash;
    const query = target.searchParams;
    const legacyWorkspace = /\/(workspace|academic-services)\.html$/.test(source.pathname);
    if (role) query.set('role', role);
    query.delete('embedded');
    query.delete('section');
    query.set('preview', 'live');
    for (const key of ['designs', 'layout', 'palette', 'mode', 'feed-only', 'feed-layout']) query.delete(key);
    if (['connected', 'error'].includes(query.get('calendar'))) {
      query.set('page', 'calendar-sync');
      if (!query.has('role')) query.set('role', 'normalStudent');
    } else if (legacyWorkspace && (query.has('screen') || query.has('page'))) {
      const screen = ['login', 'forgot', 'reset'].includes(query.get('page')) ? query.get('page') : query.get('screen') || query.get('page');
      const page = Object.hasOwn(legacyWorkflows, screen) ? legacyWorkflows[screen] : screenPage(screen, query.get('role'));
      query.set('page', screen === 'academic-services' ? screen : page);
      if (page === 'academic-services' && screen !== 'academic-services') query.set('screen', screen);
      else if (!['academic-services', 'login', 'forgot', 'reset'].includes(screen)) query.delete('screen');
    } else if (!query.has('page')) {
      const path = source.pathname.replace(/\/$/, '');
      const oldPage = Object.hasOwn(oldPaths, path) && oldPaths[path]
        || (/^\/students\/[^/]+\/schedule\/?$/.test(source.pathname) ? 'student-schedules' : null)
        || (/^\/courses\/[^/]+\/?$/.test(source.pathname) ? 'courses' : null);
      query.set('page', oldPage || (signedIn ? 'overview' : 'login'));
    }
    normalize(query);
    if (query.get('page') !== 'academic-services' && !['login', 'forgot', 'reset'].includes(query.get('page'))) query.delete('screen');
    return target;
  }

  return { normalize, screenPage, siteEntry };
})();

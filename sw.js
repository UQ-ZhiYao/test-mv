/* ZY-Invest — root service worker */
// Bump this string whenever cached files (SHELL below, or anything the
// fetch handler has cached) need to be invalidated for everyone. The
// browser only re-checks this file for changes on its own schedule (at
// most once ~24h per the service worker spec) and only clears the old
// cache once it detects sw.js's own bytes changed.
const CACHE = 'zy-v5';
// member-api.js is NOT in this list on purpose. It used to be, and every
// time it changed, visitors kept getting the old copy for a while even
// after this cache was bumped — because the fetch handler below is
// network-first (`fetch(e.request)` before falling back to cache), and a
// plain `fetch()` still honors the page's normal HTTP cache-control
// headers. GitHub Pages serves static files with a several-minutes
// max-age, so the browser's *HTTP* cache — not this Cache Storage — was
// quietly serving the stale file regardless of CACHE. The actual fix is
// the versioned query string on member-api.js's <script src> tags (e.g.
// member-api.js?v=4): a changed URL is a cache miss everywhere, HTTP cache
// included. Bump that query string, not (only) this file, when
// member-api.js changes again.
const SHELL = ['/', 'index.html', 'login.html', 'desktop/dashboard.html', 'phone/login.html', 'manifest.webmanifest',
  'assets/css/site.css', 'assets/js/site.js', 'assets/js/supabase-auth.js',
  'assets/js/api.js',
  'assets/img/logo.png', 'assets/img/icon-192.png', 'assets/img/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      caches.open(CACHE).then(c => c.put(e.request, r.clone())).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request).then(h => h || caches.match('login.html')))
  );
});

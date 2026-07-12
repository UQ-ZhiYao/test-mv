/* ZY-Invest — root service worker */
// Bump this string whenever cached files (SHELL below, or anything the
// fetch handler has cached) need to be invalidated for everyone. The
// browser only re-checks this file for changes on its own schedule (at
// most once ~24h per the service worker spec) and only clears the old
// cache once it detects sw.js's own bytes changed — a code fix to a file
// in SHELL doesn't do that by itself. This is what actually happened after
// the Yahoo Finance CORS proxy fallback fix (member-api.js, in SHELL):
// the deployed fix was correct, but visitors with an already-installed
// worker kept serving the pre-fix member-api.js from the 'zy-v1' cache
// until this version bump forces a fresh install.
const CACHE = 'zy-v2';
const SHELL = ['/', 'index.html', 'login.html', 'desktop/dashboard.html', 'phone/login.html', 'manifest.webmanifest',
  'assets/css/site.css', 'assets/js/site.js', 'assets/js/supabase-auth.js',
  'assets/js/api.js', 'assets/js/member-api.js',
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

/* ZY-Invest — root service worker */
const CACHE = 'zy-v1';
const SHELL = ['/', 'login.html', 'members/desktop/dashboard.html', 'manifest.webmanifest',
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

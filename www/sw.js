// NEXORA – Service Worker: ruan vetëm skedarët e aplikacionit (jo listat, jo video)
const CACHE = 'nexora-shell-v8';
const SHELL = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/app.js', './js/m3u.js', './js/xtream.js', './js/epg.js', './js/cache.js',
  './js/player.js', './js/net.js', './js/store.js', './js/tvnav.js', './js/i18n.js',
  './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Rrjeti i pari për skedarët e aplikacionit; cache vetëm kur je offline.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/.netlify/')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});

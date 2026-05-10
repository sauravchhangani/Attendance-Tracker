const CACHE = 'bni-att-v3';
const BASE = '/Attendance-Tracker';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Just fetch from network, fall back to cache
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request).then(r => r || caches.match(BASE + '/index.html'))
    )
  );
});

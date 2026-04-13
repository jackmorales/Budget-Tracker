// Service worker that ensures fresh assets on every page load.
// All fetch requests go to the network first; cache is only a fallback.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Always go to network, no cache
  e.respondWith(fetch(e.request));
});

// Same-origin Service Worker for hash-addressed YOLO Arcade game bundles (#306).
// Content-hashed `/games/*.js` and `/assets/*.js` chunks stored in
// `yolo-arcade-games-v1` are served locally with zero network round-trip;
// `/games/manifest.json` stays network-first so updated game hashes are seen immediately.

const GAME_BUNDLE_CACHE = 'yolo-arcade-games-v1';
const IMMUTABLE_CHUNK_RE = /^\/(?:games|assets)\/[A-Za-z0-9._-]+\.(?:js|css)$/;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === '/games/manifest.json') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(GAME_BUNDLE_CACHE);
            await cache.put('/games/manifest.json', response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/games/manifest.json');
          if (cached) return cached;
          throw new Error('Game manifest unavailable offline');
        }),
    );
    return;
  }

  if (IMMUTABLE_CHUNK_RE.test(url.pathname)) {
    event.respondWith(
      caches.open(GAME_BUNDLE_CACHE).then(async (cache) => {
        const hit = await cache.match(url.pathname);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok && url.pathname.startsWith('/games/')) {
          await cache.put(url.pathname, response.clone());
        }
        return response;
      }),
    );
  }
});

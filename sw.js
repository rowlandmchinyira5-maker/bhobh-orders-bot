/* NyPadrox Service Worker — safe fetch handler
   Fixes: HTML being cached under image URLs (e.g. logo.png),
   which made every <img src="logo.png"> render as a broken image. */

const CACHE = 'nypadrox-v2';   // bumped: invalidates the poisoned v1 cache

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Only these extensions are ever cached — protects against HTML-as-image
const CACHEABLE_EXT = /\.(?:css|js|mjs|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|eot|json|mp4|webm)$/i;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (!url.protocol.startsWith('http')) return;
  if (url.pathname.startsWith('/api/')) return;

  const isNavigation     = req.mode === 'navigate';
  const isCacheableAsset = CACHEABLE_EXT.test(url.pathname);

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cache ONLY real, same-origin, 200 responses for real asset files.
        // HTML fallbacks for .png/.css/.js URLs never get cached again.
        if (res && res.status === 200 && res.type === 'basic' && isCacheableAsset) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => {
        // Offline: prefer the cache. Serve index.html ONLY for navigations,
        // never for images / stylesheets / scripts.
        return caches.match(req).then((cached) => {
          if (cached) return cached;
          if (isNavigation) return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'Offline' });
        });
      })
  );
});
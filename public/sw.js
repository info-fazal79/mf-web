/* MF Website service worker: fast repeat visits and a basic offline fallback.
   Pages: network first (always fresh), cached copy when offline.
   Built assets (/_astro/*, fonts, icons): cache first (they are versioned). */
const VERSION = 'mf-v1';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(['/', '/ebooks', '/tutorials'])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache the admin, account/reader data or third-party APIs
  if (url.origin !== location.origin) {
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
      e.respondWith(caches.open(STATIC).then(async (c) => (await c.match(req)) || fetch(req).then((r) => (c.put(req, r.clone()), r))));
    }
    return;
  }
  if (url.pathname.startsWith('/admin')) return;

  if (url.pathname.startsWith('/_astro/') || /\.(png|svg|webp|jpg|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.open(STATIC).then(async (c) => (await c.match(req)) || fetch(req).then((r) => (r.ok && c.put(req, r.clone()), r))));
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) caches.open(PAGES).then((c) => c.put(req, r.clone()));
          return r;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match('/')) || Response.error()),
    );
  }
});

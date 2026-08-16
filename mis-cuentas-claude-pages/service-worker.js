const CACHE_NAME = 'mis-cuentas-claude-v2';

const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];

// Librerías externas (CDN) que la app necesita para funcionar.
// Se cachean con no-cors porque son de otro origen (respuesta "opaca").
const EXTERNAL_SHELL = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.24.7/babel.min.js',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;1,500&family=IBM+Plex+Mono:wght@500;600&family=Inter:wght@400;500;600;700&display=swap',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.all(
        APP_SHELL.map(url => cache.add(url).catch(() => {}))
      );
      await Promise.all(
        EXTERNAL_SHELL.map(url =>
          fetch(url, { mode: 'no-cors' })
            .then(resp => cache.put(url, resp))
            .catch(() => {})
        )
      );
      self.skipWaiting();
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  const isGitHubApiCall =
    url.indexOf('api.github.com') !== -1 ||
    url.indexOf('githubusercontent.com') !== -1;

  if (isGitHubApiCall) {
    // La sincronización con la nube nunca debe servirse desde el caché.
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(resp => {
          if (resp && (resp.ok || resp.type === 'opaque')) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

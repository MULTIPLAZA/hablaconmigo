/* =========================================================
   HablaConmigo - Service Worker
   Network-first para HTML/JS/CSS (siempre lo mas nuevo),
   cache-first para imagenes y assets estaticos
   ========================================================= */

const CACHE_NAME = 'hablaconmigo-v10';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './seed-images/mama.svg',
  './seed-images/papa.svg',
  './seed-images/agua.svg',
  './seed-images/comer.svg',
  './seed-images/mas.svg',
  './seed-images/terminado.svg',
  './seed-images/biberon.svg',
  './seed-images/tele.svg',
  './seed-images/cama.svg',
  './seed-images/sillon.svg',
  './seed-images/jugar.svg',
  './seed-images/dame.svg',
  './seed-images/mira.svg',
  './seed-images/abrir.svg',
  './seed-images/sacar.svg',
  './seed-images/contento.svg',
  './seed-images/triste.svg',
  './seed-images/duele.svg',
  './seed-images/miedo.svg',
  './seed-images/afuera.svg',
  './seed-images/bano.svg',
  './seed-images/cocina.svg',
  './seed-images/auto.svg',
  './seed-images/si.svg',
  './seed-images/no.svg',
  './seed-images/menos.svg',
  './seed-images/basta.svg',
  './seed-images/bravo.svg',
  './seed-images/enojado.svg',
  './seed-images/caca.svg',
  './seed-images/moto.svg',
  './seed-images/te-amo.svg',
  './seed-images/mariano.svg',
  './seed-images/bueno.svg',
  './seed-images/malo.svg',
  './seed-images/portate-bien.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cacheamos uno por uno con allSettled para que un fallo
      // individual no rompa la instalacion entera
      const results = await Promise.allSettled(
        ASSETS.map(url => cache.add(new Request(url, { cache: 'reload' })))
      );
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.warn('[SW] No cacheado:', ASSETS[i], r.reason);
        }
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Estrategia: network-first para HTML/JS/CSS (apps siempre actualizadas),
   cache-first para imagenes/iconos/manifest (rapidos y offline).
   Fallback: si network falla, usar cache. */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const esHtmlOJs = /\.(html|js|css|json)$/i.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/');

  if (esHtmlOJs) {
    // network-first
    event.respondWith(
      fetch(event.request).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      }).catch(() => caches.match(event.request).then(c => c || caches.match('./index.html')))
    );
  } else {
    // cache-first para imagenes/svg/etc
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        });
      })
    );
  }
});

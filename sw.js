/* =========================================================
   HablaConmigo - Service Worker
   Cache-first para uso 100% offline
   ========================================================= */

const CACHE_NAME = 'hablaconmigo-v4';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  // basicas
  './seed-images/mama.svg',
  './seed-images/papa.svg',
  './seed-images/agua.svg',
  './seed-images/comer.svg',
  './seed-images/mas.svg',
  './seed-images/terminado.svg',
  // cosas
  './seed-images/biberon.svg',
  './seed-images/tele.svg',
  './seed-images/cama.svg',
  './seed-images/sillon.svg',
  './seed-images/jugar.svg',
  // acciones
  './seed-images/dame.svg',
  './seed-images/mira.svg',
  './seed-images/abrir.svg',
  './seed-images/sacar.svg',
  // sentimientos
  './seed-images/contento.svg',
  './seed-images/triste.svg',
  './seed-images/duele.svg',
  './seed-images/miedo.svg',
  // lugares
  './seed-images/afuera.svg',
  './seed-images/bano.svg',
  './seed-images/cocina.svg',
  './seed-images/auto.svg',
  // nucleo
  './seed-images/si.svg',
  './seed-images/no.svg',
  './seed-images/menos.svg',
  './seed-images/basta.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res && res.status === 200 && event.request.url.startsWith(self.location.origin)) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

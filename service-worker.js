/**
 * Service Worker — Sistema Reporte 40
 * Soporte Offline y Cache para PWA
 * Hecho por xzerox99
 */

const CACHE_NAME = "reporte40-v2.2";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./admin.html",
  "./validar.html",
  "./css/styles.css?v=2.2",
  "./js/config.js?v=2.2",
  "./js/utils.js?v=2.2",
  "./js/theme.js?v=2.2",
  "./js/auth.js?v=2.2",
  "./js/api.js?v=2.2",
  "./js/pwa.js?v=2.2",
  "./js/dashboard.js?v=2.2",
  "./js/admin.js?v=2.2",
  "./js/pdf-generator.js?v=2.2",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

function isHeavyData(url) {
  return /\/data\/demo_data\.(js|json)(\?|$)/.test(url);
}

// Instalación (cache individual para evitar que un recurso fallido aborte todo)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ASSETS_TO_CACHE.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn("Error al cachear recurso PWA:", asset, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

// Activación y limpieza de caches antiguos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Estrategia Network-First con fallback a Cache (omitiendo demo_data pesado en CacheStorage)
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = event.request.url;
  if (!url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && !isHeavyData(url)) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});

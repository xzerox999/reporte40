/**
 * Service Worker — Sistema Reporte 40
 * Soporte Offline y Cache para PWA
 * Hecho por xzerox99
 */

const CACHE_NAME = "reporte40-v1.2";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./admin.html",
  "./validar.html",
  "./css/styles.css",
  "./js/config.js",
  "./js/theme.js",
  "./js/auth.js",
  "./js/api.js",
  "./js/dashboard.js",
  "./js/admin.js",
  "./js/pdf-generator.js",
  "./data/demo_data.js",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

// Instalación
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("Error al cachear algunos recursos en PWA:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activación y limpieza de caches antiguos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia Network-First con fallback a Cache
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Guardar copia actualizada en cache
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback a cache si no hay conexión a internet
        return caches.match(event.request);
      })
  );
});


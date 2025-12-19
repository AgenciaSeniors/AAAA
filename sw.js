// sw.js - Service Worker Mejorado
const CACHE_NAME = 'bar-v2'; // Incrementamos versión para forzar actualización
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './css/modal.css',
  './css/admin.css', // Si lo usas
  './js/script.js',
  './js/config.js',
  './img/logo.png',
  './favicon.ico',
  './manifest.json'
];

// 1. Instalación: Guardar archivos estáticos "App Shell"
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // Fuerza al SW a activarse inmediatamente
});

// 2. Activación: Limpiar cachés viejos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim(); // Toma control de los clientes inmediatamente
});

// 3. Interceptación de Red (Estrategia: Cache First + Dynamic Caching)
self.addEventListener('fetch', (e) => {
  // Solo procesamos peticiones HTTP/HTTPS (evitamos chrome-extension://, etc)
  if (!e.request.url.startsWith('http')) return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      // A) Si está en caché, lo devolvemos
      if (cachedResponse) {
        return cachedResponse;
      }

      // B) Si no está, vamos a internet
      return fetch(e.request).then((networkResponse) => {
        // Verificamos que la respuesta sea válida
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
          return networkResponse;
        }

        // Clonamos la respuesta (porque el stream solo se puede consumir una vez)
        const responseToCache = networkResponse.clone();

        // Guardamos la copia en el caché para la próxima vez
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // C) Si falla internet y no estaba en caché (Offline total)
        // Podrías retornar una imagen placeholder aquí si quisieras
        // return caches.match('./img/offline-placeholder.png');
      });
    })
  );
});
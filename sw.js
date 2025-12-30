// sw.js - Versión enfocada en Red y solo Caché de Imágenes
const CACHE_NAME = 'bar-v4.2'; // Incrementamos versión

// 1. Instalación: Solo guardamos lo mínimo indispensable para el arranque
self.addEventListener('install', (e) => {
  self.skipWaiting(); 
});

// 2. Activación: Limpieza de versiones antiguas
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
  self.clients.claim();
});

// 3. Interceptación: Estrategia diferenciada
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  
  // A) SI ES UNA IMAGEN: Estrategia Cache First (Para ahorrar datos en Cuba)
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|svg|avif|webp)$/i)) {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        
        return fetch(e.request).then((networkResponse) => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
  } 
  // B) TODO LO DEMÁS (HTML, JS, CSS): Estrategia Network First (Siempre Online)
  else {
    e.respondWith(
      fetch(e.request).then((networkResponse) => {
        // Si hay internet, actualizamos el caché con lo nuevo y devolvemos la respuesta
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Si no hay internet, intentamos servir desde el caché
        return caches.match(e.request);
      })
    );
  }
});
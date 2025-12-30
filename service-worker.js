// LMG Vokabeltrainer Service Worker
// Leibniz Montessori Gymnasium Düsseldorf
// Version 1.0 - PWA Support

const CACHE_NAME = 'lmg-vocab-v1';
const RUNTIME_CACHE = 'lmg-vocab-runtime';

// Dateien die beim Install gecacht werden sollen
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/display.html',
  '/montigame.html',
  '/irrverbtrainer.html',
  '/teacher-dashboard.html',
  '/overview.html',
  '/images/montiwhite.png',
  '/images/montigame.jpg',
  '/images/montilanded.jpg',
  '/images/icons/icon-192.png',
  '/images/icons/icon-512.png'
];

// Vokabel-Dateien (werden on-demand gecacht)
const VOCAB_PATTERN = /\/vocab\/english\/voc\d+_4\.json/;
const GRAMMAR_PATTERN = /\/grammar\/irrverbs\d*\.json/;

// Install Event - Cache wichtige Dateien
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Pre-caching app shell');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[Service Worker] Pre-caching failed:', err);
      })
  );
});

// Activate Event - Cleanup alte Caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map(name => {
              console.log('[Service Worker] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch Event - Network First mit Fallback auf Cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignoriere Chrome Extensions und andere Protokolle
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Firebase Requests immer vom Netzwerk (Echtzeit-Daten!)
  if (url.hostname.includes('firebase')) {
    event.respondWith(fetch(request));
    return;
  }

  // Vokabel-Dateien: Network First, dann Cache
  if (VOCAB_PATTERN.test(url.pathname) || GRAMMAR_PATTERN.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache die erfolgreiche Response
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback auf Cache wenn offline
          return caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
              console.log('[Service Worker] Serving cached vocab:', url.pathname);
              return cachedResponse;
            }
            // Wenn auch kein Cache: Offline-Nachricht
            return new Response(
              JSON.stringify({ error: 'Offline - Vokabeln nicht verfügbar' }),
              { 
                headers: { 'Content-Type': 'application/json' },
                status: 503
              }
            );
          });
        })
    );
    return;
  }

  // Alle anderen Requests: Cache First, dann Network
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          console.log('[Service Worker] Serving from cache:', url.pathname);
          return cachedResponse;
        }

        return fetch(request)
          .then(response => {
            // Nur erfolgreiche GET Requests cachen
            if (!response || response.status !== 200 || request.method !== 'GET') {
              return response;
            }

            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(request, responseClone);
            });

            return response;
          })
          .catch(err => {
            console.error('[Service Worker] Fetch failed:', err);
            
            // Offline-Fallback-Seite (optional)
            if (request.destination === 'document') {
              return caches.match('/index.html');
            }
            
            return new Response('Offline', { 
              status: 503, 
              statusText: 'Service Unavailable' 
            });
          });
      })
  );
});

// Message Event - Für manuelles Cache-Update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(name => caches.delete(name))
        );
      })
    );
  }
});

console.log('[Service Worker] Script loaded successfully');

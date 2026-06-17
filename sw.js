const CACHE_NAME = 'tasklist-v2'; // Bumped version to force cache invalidation
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/firebase-db.js',
  './js/notifications.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/favicon.png'
];

// Install Event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Caching assets (Install)');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting()) // Force active service worker immediately
  );
});

// Activate Event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim()) // Claim clients immediately to use the new service worker
  );
});

// Fetch Event - Network First Strategy
self.addEventListener('fetch', event => {
  // Ignore non-HTTP and external API requests (e.g. Firebase websockets)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If we got a valid response, cache it
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // If network request fails (offline), return cached version
        return caches.match(event.request);
      })
  );
});

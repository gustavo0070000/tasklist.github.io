const CACHE_NAME = 'tasklist-v6';
const ASSETS = [
  './',
  './index.html',
  './painel.html',
  './css/style.css',
  './css/painel.css',
  './js/app.js',
  './js/painel.js',
  './js/agenda.js',
  './js/weather.js',
  './js/push.js',
  './js/firebase-db.js',
  './js/notifications.js',
  './js/ifttt-webhook.js',
  './js/illustrations.js',
  './js/effects.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/favicon.png'
];

// Install Event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network First Strategy (bypass stale HTTP cache)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then(response => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});

// ---------------------------------------------------------------------------
// Push (Firebase Cloud Messaging) — enviado pelo Google Apps Script.
// Mensagens "data-only": { data: { title, body, tag, url } }.
// A mesma tag 'tasklist-alert' das notificações locais evita duplicatas
// quando o app está aberto.
// ---------------------------------------------------------------------------
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) {
    payload = { data: { title: 'Tasklist', body: event.data ? event.data.text() : '' } };
  }
  const d = payload.data || payload.notification || payload;
  const title = d.title || 'Tasklist — Gustavo & Isabella';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || '',
      icon: 'assets/icon-192.png',
      badge: 'assets/favicon.png',
      tag: d.tag || 'tasklist-alert',
      renotify: true,
      data: { url: d.url || './index.html' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});

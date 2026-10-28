/**
 * sw.js — Progressive Web App Service Worker for JadwalSiaga
 * Menyediakan dukungan offline cache, background notifications,
 * dan instalasi PWA standar modern.
 */

const CACHE_NAME = 'jadwalsiaga-pwa-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './sound.js',
  './alarm.js',
  './manifest.json',
  './icon.svg'
];

// 1. Install Event: Simpan aset penting ke cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Bersihkan cache versi lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Stale-While-Revalidate untuk kecepatan & dukungan offline 100%
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Jangan tangani skema chrome-extension:// atau non-http(s)
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);

      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => {
        // Jika offline dan merupakan navigasi halaman web
        if (event.request.mode === 'navigate') {
          return cache.match('./index.html');
        }
        return null;
      });

      // Kembalikan versi cache jika ada, sambil memperbarui di latar belakang
      return cachedResponse || fetchPromise;
    })
  );
});

// 4. Notification Click Event: Buka kembali aplikasi saat notifikasi diklik
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});

// 5. Message Event: Dukungan komunikasi dari aplikasi
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/**
 * Photo Earn - Service Worker (sw.js)
 * High-Speed Caching & Offline PWA Acceleration
 */

const CACHE_NAME = "photoearn-cache-v1";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./admin.html",
  "./manifest.json",
  "./favicon.ico",
  "./css/style.css",
  "./js/config.js",
  "./js/db.js",
  "./js/app.js",
  "./images/logo-icon.png",
  "./images/favicon.png",
  "./images/og-preview.png"
];

// Install: Cache core static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate: Clean up old caches
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

// Fetch: Stale-While-Revalidate Strategy for fastest load speed
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip caching for external ad networks and Firebase API calls
  if (
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("bauval.org") ||
    url.hostname.includes("abscloud.org") ||
    url.hostname.includes("araplhn.org") ||
    req.method !== "GET"
  ) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});


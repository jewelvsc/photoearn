/**
 * Photo Earn - Service Worker (sw.js)
 * High-Speed Caching & Offline PWA Acceleration
 */

const CACHE_NAME = "photoearn-cache-v4";
const ASSETS_TO_CACHE = [
  "./manifest.json",
  "./favicon.ico",
  "./css/tailwind.min.css?v=2",
  "./css/style.css?v=3",
  "./images/logo-icon.png?v=6",
  "./images/favicon.png?v=2",
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

// Fetch: Bypass dynamic API & HTML so live server updates immediately; cache static assets
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip caching for API calls, HTML pages, ads, and non-GET requests
  if (
    req.method !== "GET" ||
    url.pathname.includes("api.php") ||
    url.pathname.endsWith(".html") ||
    url.pathname === "/" ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("bauval.org") ||
    url.hostname.includes("abscloud.org") ||
    url.hostname.includes("araplhn.org")
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


const CACHE_NAME = "risk-pilot-v3";
const URLS_TO_CACHE = [
  "/lot-app/",
  "/lot-app/index.html",
  "/lot-app/manifest.json",
  "/lot-app/icon-192.png",
  "/lot-app/icon-512.png",
  "/lot-app/app.js",   
  "/lot-app/style.css" 
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((response) => {
      return response || fetch(event.request);
    })
  );
});
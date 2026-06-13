const APP_VERSION = "2026.06.13.2";
const CACHE_NAME = `app-cache-v${APP_VERSION}`;
const STATIC_ASSETS = [
  "./src/styles-soft.e7e27bec5c.css",
  "./src/AppSoft.61c2f9ad87.tsx",
  "./vendor/react.production.d949f1c368.min.js",
  "./vendor/react-dom.production.35f4f974f4.min.js",
  "./vendor/babel.7f55bd5c3e.min.js",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-1024.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("app-cache-") && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/rest/v1/")) return;

  const isNavigation = request.mode === "navigate";
  const isFreshDocument =
    isNavigation ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/manifest.json") ||
    url.pathname.endsWith("/manifest.webmanifest");
  const isVersionFile = url.pathname.endsWith("/version.json");

  if (isVersionFile) {
    event.respondWith(fetch(request));
    return;
  }

  if (isFreshDocument) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("No cached response available");
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

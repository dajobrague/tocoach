// TopCoach Service Worker
// Handles app shell caching and offline functionality
// Updated: Excluded API routes and dynamic pages from caching
//
// IMPORTANT — bumping the cache version:
// When a deploy needs to invalidate cached bundles for all clients, bump
// the trailing version on BOTH constants below (e.g. v7 → v8). The activate
// handler deletes any cache whose name doesn't match these two, so the bump
// also frees up storage on the user's device.
// Pair this with the no-cache headers on /sw.js in next.config.js so the
// new sw.js bytes actually reach the browser.

const CACHE_NAME = "topcoach-v7";
const STATIC_CACHE_NAME = "topcoach-static-v7";

// App shell files to cache
// Note: Removed "/" from cache to allow dynamic routing to work properly
const STATIC_FILES = [
  "/manifest.json",
  "/icons/icon.svg",
  // Add more static assets as needed
];

// Install event - cache static files
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker");

  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Caching static files");
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log("[SW] Static files cached successfully");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("[SW] Failed to cache static files:", error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
              console.log("[SW] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("[SW] Service worker activated");
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith("http")) {
    return;
  }

  // IMPORTANT: Skip caching for API routes - always fetch fresh data
  if (event.request.url.includes("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  const url = new URL(event.request.url);

  // Network-only for ALL navigation requests (HTML pages).
  // Never cache HTML to avoid stale pages referencing old JS bundles after deployments.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          `<!DOCTYPE html>
            <html>
            <head>
              <title>TopCoach - Sin conexión</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { font-family: system-ui, sans-serif; text-align: center; padding: 2rem; color: #333; }
                .offline-message { max-width: 400px; margin: 2rem auto; }
                .icon { font-size: 4rem; margin-bottom: 1rem; }
                button { padding: 0.5rem 1.5rem; font-size: 1rem; cursor: pointer; border-radius: 8px; border: 1px solid #ccc; }
              </style>
            </head>
            <body>
              <div class="offline-message">
                <div class="icon">📱</div>
                <h1>Sin conexión</h1>
                <p>TopCoach necesita conexión a internet para funcionar. Verifica tu conexión e intenta de nuevo.</p>
                <button onclick="window.location.reload()">Intentar de nuevo</button>
              </div>
            </body>
            </html>`,
          { headers: { "Content-Type": "text/html" } }
        );
      })
    );
    return;
  }

  // Skip caching for _next/data (RSC/data fetches)
  if (url.pathname.startsWith("/_next/data/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first for static assets — ensures fresh code after deploys/rebuilds,
  // with cache fallback for offline use
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return new Response("", { status: 503 });
        });
      })
  );
});

// Handle background sync (future implementation)
self.addEventListener("sync", (event) => {
  console.log("[SW] Background sync event:", event.tag);
  // Implementation for offline data sync will be added in future phases
});

// Allow the page to ask this worker to activate immediately. Today the
// install handler already calls `self.skipWaiting()` unconditionally, so
// this message is a no-op in the current flow. It's here so we can later
// switch to a toast-based update UX ("nueva versión disponible — recargar")
// without having to redeploy the worker first: the page would call
//   navigator.serviceWorker.controller?.postMessage({ type: "SKIP_WAITING" })
// and the worker would activate when the user opts in.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Handle push notifications (future implementation)
self.addEventListener("push", (event) => {
  console.log("[SW] Push event received");
  // Implementation for push notifications will be added in future phases
});

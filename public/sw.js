// TopCoach Service Worker
// Handles app shell caching and offline functionality
// Updated: Excluded API routes and dynamic pages from caching

const CACHE_NAME = "topcoach-v2";
const STATIC_CACHE_NAME = "topcoach-static-v2";

// App shell files to cache
const STATIC_FILES = [
  "/",
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

  // Skip caching for dynamic pages that need fresh data
  if (
    event.request.url.includes("/trainer/dashboard") ||
    event.request.url.includes("/_next/data/")
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((response) => {
          // Don't cache non-successful responses
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }

          // Clone the response for caching
          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Return offline fallback for navigation requests
          if (event.request.mode === "navigate") {
            return (
              caches.match("/offline.html") ||
              new Response(
                `
                <!DOCTYPE html>
                <html>
                <head>
                  <title>TopCoach - Offline</title>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <style>
                    body { 
                      font-family: system-ui, sans-serif; 
                      text-align: center; 
                      padding: 2rem;
                      color: #333;
                    }
                    .offline-message {
                      max-width: 400px;
                      margin: 2rem auto;
                    }
                    .icon { font-size: 4rem; margin-bottom: 1rem; }
                  </style>
                </head>
                <body>
                  <div class="offline-message">
                    <div class="icon">📱</div>
                    <h1>You're offline</h1>
                    <p>TopCoach needs an internet connection to work properly. Please check your connection and try again.</p>
                    <button onclick="window.location.reload()">Try Again</button>
                  </div>
                </body>
                </html>
                `,
                { headers: { "Content-Type": "text/html" } }
              )
            );
          }
        });
    })
  );
});

// Handle background sync (future implementation)
self.addEventListener("sync", (event) => {
  console.log("[SW] Background sync event:", event.tag);
  // Implementation for offline data sync will be added in future phases
});

// Handle push notifications (future implementation)
self.addEventListener("push", (event) => {
  console.log("[SW] Push event received");
  // Implementation for push notifications will be added in future phases
});

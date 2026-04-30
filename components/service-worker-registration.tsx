"use client";

import { useEffect } from "react";

// Re-check for an updated service worker every 30 minutes while the tab is
// open. Combined with `visibilitychange` below, this guarantees that a user
// who keeps the PWA open for hours/days still picks up new deploys without
// having to fully close the app.
const UPDATE_INTERVAL_MS = 30 * 60 * 1000;

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let visibilityHandler: (() => void) | null = null;
    let cancelled = false;

    navigator.serviceWorker
      // `updateViaCache: "none"` tells the browser to bypass the HTTP cache
      // when fetching `/sw.js` to check for updates. Without this, an edge
      // CDN or browser cache can serve a stale `sw.js` and `update()` will
      // not detect any change → clients stay pinned to the old worker (and
      // therefore the old bundle cache) for up to 24h, the SW spec's hard
      // cap. Bypassing the cache here is the single biggest fix for
      // "PWA never updates" issues.
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        if (cancelled) return;

        console.log(
          "[SW] Service worker registered successfully:",
          registration.scope
        );

        // IMPORTANT: attach the `updatefound` listener BEFORE calling
        // `update()`. If a new worker is already pending (e.g. the browser's
        // own 24h refresh just landed a new sw.js byte-content), the event
        // can fire synchronously inside `update()`, and a listener attached
        // afterwards would miss it.
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;

          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state !== "installed") return;

            if (navigator.serviceWorker.controller) {
              // There was already a controlling SW → this is an update,
              // not a first install. Force a reload so the page picks up
              // the new bundle. The new SW already called `skipWaiting()`
              // in its install handler, so it's active immediately.
              console.warn("[SW] New content is available — reloading.");
              window.location.reload();
            } else {
              console.log("[SW] Content is cached for offline use.");
            }
          });
        });

        // Trigger an initial update check immediately on mount.
        registration.update().catch((err) => {
          console.warn("[SW] Initial update() failed:", err);
        });

        // Periodic update checks for long-lived sessions.
        intervalId = setInterval(() => {
          registration.update().catch((err) => {
            console.warn("[SW] Periodic update() failed:", err);
          });
        }, UPDATE_INTERVAL_MS);

        // Also check whenever the tab becomes visible again — covers the
        // common case of a user backgrounding the PWA for a while and
        // returning after a deploy.
        visibilityHandler = () => {
          if (document.visibilityState === "visible") {
            registration.update().catch((err) => {
              console.warn("[SW] Visibility update() failed:", err);
            });
          }
        };
        document.addEventListener("visibilitychange", visibilityHandler);
      })
      .catch((error) => {
        console.error("[SW] Service worker registration failed:", error);
      });

    return () => {
      cancelled = true;
      if (intervalId !== null) clearInterval(intervalId);
      if (visibilityHandler) {
        document.removeEventListener("visibilitychange", visibilityHandler);
      }
    };
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log(
            "[SW] Service worker registered successfully:",
            registration.scope
          );

          // Force check for updates on every page load
          registration.update();

          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;

            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed") {
                  if (navigator.serviceWorker.controller) {
                    console.warn("[SW] New content is available — reloading.");
                    window.location.reload();
                  } else {
                    console.log("[SW] Content is cached for offline use.");
                  }
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error("[SW] Service worker registration failed:", error);
        });
    }
  }, []);

  return null;
}

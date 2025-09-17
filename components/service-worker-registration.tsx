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

          // Check for updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;

            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed") {
                  if (navigator.serviceWorker.controller) {
                    // New update available
                    console.log(
                      "[SW] New content is available; please refresh."
                    );

                    // You could show a toast notification here
                    // asking the user to refresh the page
                  } else {
                    // Content is cached for the first time
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

"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function Error({ error }: { error: Error; reset: () => void }) {
  const [clearing, setClearing] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    /* eslint-disable no-console */
    console.error(error);

    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        pathname,
        tenantSlug: "global",
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      }),
    }).catch(() => {});
  }, [error, pathname]);

  const handleRetry = useCallback(async () => {
    setClearing(true);
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();

        await Promise.all(registrations.map((r) => r.unregister()));
      }
      const keys = await caches.keys();

      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {
      // Proceed even if cache clearing fails
    }
    window.location.reload();
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: "400px" }}>
        <h2
          style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}
        >
          Algo salió mal
        </h2>
        <p
          style={{
            fontSize: "0.875rem",
            color: "#6b7280",
            marginBottom: "1.5rem",
          }}
        >
          Ocurrió un error inesperado. Intenta de nuevo.
        </p>
        <button
          disabled={clearing}
          style={{
            padding: "0.625rem 1.5rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: clearing ? "wait" : "pointer",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            backgroundColor: "#fff",
            color: "#111827",
          }}
          onClick={handleRetry}
        >
          {clearing ? "Limpiando caché..." : "Intentar de nuevo"}
        </button>
        <p
          style={{
            fontSize: "0.7rem",
            color: "#9ca3af",
            marginTop: "1.5rem",
          }}
        >
          {error.message}
        </p>
      </div>
    </div>
  );
}

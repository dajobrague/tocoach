"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";

import {
  clearClientToken,
  getClientToken,
} from "@/lib/auth/client-token-storage";

export default function ClientError({
  error,
}: {
  error: Error;
  reset: () => void;
}) {
  const params = useParams();
  const pathname = usePathname();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const [reported, setReported] = useState(false);

  useEffect(() => {
    /* eslint-disable no-console */
    console.error("[Client App Error]", error);

    if (reported) return;
    setReported(true);

    let clientId: string | undefined;

    try {
      const token = getClientToken();

      if (token) {
        const parts = token.split(".");
        const payload = parts[1];

        if (payload) {
          const json = atob(
            payload.replace(/-/g, "+").replace(/_/g, "/") +
              "=".repeat((4 - (payload.length % 4)) % 4)
          );

          clientId = (JSON.parse(json) as { client_id?: string }).client_id;
        }
      }
    } catch {
      // ignore parse errors
    }

    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        pathname,
        tenantSlug: slug,
        clientId,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      }),
    }).catch(() => {});
  }, [error, pathname, slug, reported]);

  const handleRetry = useCallback(async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();

        await Promise.all(registrations.map((r) => r.unregister()));
      }
      const keys = await caches.keys();

      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {
      // proceed even if clearing fails
    }
    window.location.reload();
  }, []);

  const handleGoToLogin = useCallback(() => {
    clearClientToken();
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.clear();
      }
    } catch {
      // ignore
    }
    window.location.href = `/${slug}/login`;
  }, [slug]);

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
          Ocurrió un error inesperado. El error ha sido reportado
          automáticamente.
        </p>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <button
            style={{
              padding: "0.625rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              backgroundColor: "#fff",
              color: "#111827",
            }}
            onClick={handleRetry}
          >
            Intentar de nuevo
          </button>
          <button
            style={{
              padding: "0.625rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#111827",
              color: "#fff",
            }}
            onClick={handleGoToLogin}
          >
            Iniciar sesión de nuevo
          </button>
        </div>
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

"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";

import { ClientBottomNav } from "./bottom-nav";
import { useClientData } from "./client-data-provider";
import { ClientHeader } from "./client-header";
import { ClientPage } from "./client-page";

import { CenteredState } from "@/components/shared/centered-state";

export function CommunityContent() {
  const { communityUrl } = useClientData();

  // Empty state if no community URL configured
  if (!communityUrl) {
    return (
      <>
        <ClientPage title="Comunidad">
          <div className="px-4">
            <CenteredState
              icon="solar:users-group-rounded-linear"
              subtitle="Tu entrenador aún no ha configurado una comunidad."
              title="Comunidad no disponible"
            />
          </div>
        </ClientPage>
        <ClientBottomNav />
      </>
    );
  }

  return <CommunityIframeView communityUrl={communityUrl} />;
}

/**
 * Many community platforms (Go High Level, Skool, Circle, etc.) ship
 * `X-Frame-Options: DENY` or `Content-Security-Policy: frame-ancestors`
 * headers that prevent embedding. When that happens the iframe stays blank
 * and the user is stuck on a "loading…" state.
 *
 * This component starts a load timeout — if the iframe hasn't fired `onLoad`
 * after a few seconds, we replace it with a friendly empty-state explaining
 * what happened, with an "Abrir comunidad" external link as the escape hatch.
 * (There is deliberately NO standing open-in-new-tab button when the iframe
 * works — removed at José Carlos's request, Jul 13 2026.)
 */
function CommunityIframeView({ communityUrl }: { communityUrl: string }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Browsers that block embedding may never fire `onLoad`, or fire it on
    // an empty error page. 6s is a comfortable threshold for a real page to
    // appear on slow networks while still being responsive when blocked.
    timeoutRef.current = setTimeout(() => {
      if (!iframeLoaded) setLoadTimedOut(true);
    }, 6000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // We intentionally only run this once per mount — the timer is cancelled
    // by `onLoad` setting `iframeLoaded` and by the cleanup above.
  }, []);

  const handleIframeLoad = () => {
    setIframeLoaded(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const showFallback = loadTimedOut && !iframeLoaded;

  return (
    <>
      <div className="mx-auto max-w-lg bg-background">
        <ClientHeader title="Comunidad" />

        {/* Iframe a sangre bajo la barra, con alto fijo = viewport − barra
            (h-14 + borde + safe area) − hueco del nav inferior: solo el iframe
            hace scroll. Sin botón fijo de abrir fuera (José Carlos, Jul
            13); el fallback conserva "Abrir comunidad" como salida. */}
        {showFallback ? (
          <div className="px-4">
            <CenteredState
              action={
                <Button
                  as="a"
                  color="primary"
                  href={communityUrl}
                  rel="noopener noreferrer"
                  startContent={
                    <Icon icon="solar:square-top-down-linear" width={18} />
                  }
                  target="_blank"
                >
                  Abrir comunidad
                </Button>
              }
              icon="solar:users-group-rounded-linear"
              subtitle="La plataforma de comunidad no permite mostrarse dentro de la app. Ábrela en una pestaña nueva para acceder."
              title="No se pudo mostrar la comunidad aquí"
            />
          </div>
        ) : (
          <div className="relative h-[calc(100dvh-3.5rem-1px-env(safe-area-inset-top)-6rem)] w-full">
            {!iframeLoaded && (
              <div
                aria-hidden
                className="absolute inset-0 animate-pulse bg-default-100"
              />
            )}
            <iframe
              allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; payment"
              className="relative h-full w-full border-0"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              src={communityUrl}
              title="Comunidad"
              onLoad={handleIframeLoad}
            />
          </div>
        )}
      </div>
      <ClientBottomNav />
    </>
  );
}

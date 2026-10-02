"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

import { ClientBottomNav } from "./bottom-nav";
import { useClientData } from "./client-data-provider";
import { useCommunityFrame } from "./community-frame";
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
 * CommunityFrameHost runs a load timeout — if the iframe hasn't fired `onLoad`
 * after a few seconds, this page swaps in a friendly empty-state explaining
 * what happened, with an "Abrir comunidad" external link as the escape hatch.
 * (There is deliberately NO standing open-in-new-tab button when the iframe
 * works — removed at José Carlos's request, Jul 13 2026.)
 */
function CommunityIframeView({ communityUrl }: { communityUrl: string }) {
  // The iframe itself lives in CommunityFrameHost (client layout) so the
  // community login survives tab switches; this page only provides the slot.
  const {
    setSlot,
    loaded: iframeLoaded,
    timedOut: loadTimedOut,
  } = useCommunityFrame();

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
          <div
            className="relative w-full"
            style={{
              // viewport − barra (h-14 + borde + safe area) − hueco del nav
              height:
                "calc(100dvh - 3.5rem - 1px - env(safe-area-inset-top) - 6rem)",
            }}
          >
            {!iframeLoaded && (
              <div
                aria-hidden
                className="absolute inset-0 animate-pulse bg-default-100"
              />
            )}
            {/* El iframe vive en CommunityFrameHost y se posiciona (fixed)
                sobre este hueco; el placeholder queda debajo hasta cargar. */}
            <div ref={setSlot} className="h-full w-full" />
          </div>
        )}
      </div>
      <ClientBottomNav />
    </>
  );
}

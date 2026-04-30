"use client";

import { Button, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";

import { ClientBottomNav } from "./bottom-nav";
import { useClientData } from "./client-data-provider";
import { ClientHeader } from "./client-header";

export function CommunityContent() {
  const {
    clientId,
    firstName,
    logoUrl,
    trainerName,
    clientProfilePicture,
    tenantSlug,
    communityUrl,
  } = useClientData();

  // Empty state if no community URL configured
  if (!communityUrl) {
    return (
      <>
        <div className="min-h-screen bg-background pb-20">
          <ClientHeader
            clientId={clientId}
            clientProfilePicture={clientProfilePicture}
            firstName={firstName}
            logoUrl={logoUrl}
            tagline="Conecta con la comunidad"
            tenantSlug={tenantSlug}
            trainerName={trainerName}
          />

          <div className="max-w-lg mx-auto p-4">
            <Card className="bg-background border border-default-200">
              <CardBody className="p-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="bg-default-100 p-4 rounded-full mb-4">
                    <Icon
                      className="text-default-400 text-5xl"
                      icon="solar:users-group-rounded-linear"
                    />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">
                    Comunidad no disponible
                  </h3>
                  <p className="text-sm text-default-500">
                    Tu entrenador aún no ha configurado una comunidad.
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
        <ClientBottomNav />
      </>
    );
  }

  return (
    <CommunityIframeView
      clientId={clientId}
      clientProfilePicture={clientProfilePicture}
      communityUrl={communityUrl}
      firstName={firstName}
      logoUrl={logoUrl}
      tenantSlug={tenantSlug}
      trainerName={trainerName}
    />
  );
}

/**
 * Many community platforms (Go High Level, Skool, Circle, etc.) ship
 * `X-Frame-Options: DENY` or `Content-Security-Policy: frame-ancestors`
 * headers that prevent embedding. When that happens the iframe stays blank
 * and the user is stuck on a "loading…" state.
 *
 * This component:
 *   1. Always renders an "Abrir en pestaña nueva" button so the user has an
 *      escape hatch regardless of whether the iframe ends up loading.
 *   2. Starts a load timeout — if the iframe hasn't fired `onLoad` after a
 *      few seconds, we replace it with a friendly empty-state explaining
 *      what happened and pointing to the same external button.
 */
function CommunityIframeView({
  clientId,
  clientProfilePicture,
  communityUrl,
  firstName,
  logoUrl,
  tenantSlug,
  trainerName,
}: {
  clientId: string;
  clientProfilePicture: string;
  communityUrl: string;
  firstName: string;
  logoUrl: string;
  tenantSlug: string;
  trainerName: string;
}) {
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
      <div className="min-h-screen bg-background flex flex-col">
        <ClientHeader
          clientId={clientId}
          clientProfilePicture={clientProfilePicture}
          firstName={firstName}
          logoUrl={logoUrl}
          tagline="Conecta con la comunidad"
          tenantSlug={tenantSlug}
          trainerName={trainerName}
        />

        {/* External-open shortcut — always visible so the user has an exit
            even when the iframe loads correctly but crops the content. */}
        <div className="w-full max-w-lg mx-auto px-4 pt-3">
          <Button
            as="a"
            className="w-full"
            color="primary"
            href={communityUrl}
            rel="noopener noreferrer"
            startContent={
              <Icon icon="solar:square-top-down-linear" width={18} />
            }
            target="_blank"
            variant="flat"
          >
            Abrir comunidad en una pestaña nueva
          </Button>
        </div>

        {/* Embedded Community iframe (or fallback card if it never loads) */}
        <div className="flex-1 w-full max-w-lg mx-auto pb-16 pt-3 px-4">
          {showFallback ? (
            <Card className="bg-background border border-default-200">
              <CardBody className="p-8">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="bg-default-100 p-4 rounded-full mb-4">
                    <Icon
                      className="text-default-400 text-5xl"
                      icon="solar:users-group-rounded-linear"
                    />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">
                    No se pudo mostrar la comunidad aquí
                  </h3>
                  <p className="text-sm text-default-500 mb-4">
                    La plataforma de comunidad no permite mostrarse dentro de la
                    app. Ábrela en una pestaña nueva para acceder.
                  </p>
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
                </div>
              </CardBody>
            </Card>
          ) : (
            <iframe
              allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; payment"
              className="w-full h-full min-h-[calc(100vh-220px)] border-0"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              src={communityUrl}
              title="Comunidad"
              onLoad={handleIframeLoad}
            />
          )}
        </div>
      </div>
      <ClientBottomNav />
    </>
  );
}

"use client";

import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

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

        {/* Embedded Community iframe - full width below header, above nav */}
        <div className="flex-1 w-full max-w-lg mx-auto pb-16">
          <iframe
            allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; payment"
            className="w-full h-full min-h-[calc(100vh-180px)] border-0"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            src={communityUrl}
            title="Comunidad"
          />
        </div>
      </div>
      <ClientBottomNav />
    </>
  );
}

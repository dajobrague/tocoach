"use client";

import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { ClientHeader } from "@/components/client-dashboard/client-header";

interface ProgramsContentProps {
  firstName: string;
  logoUrl?: string;
  trainerName: string;
  clientProfilePicture?: string;
  clientId: string;
  tenantSlug: string;
}

export function ProgramsContent({
  firstName,
  logoUrl,
  trainerName,
  clientProfilePicture,
  clientId,
  tenantSlug,
}: ProgramsContentProps) {
  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-lg mx-auto">
          <ClientHeader
            clientId={clientId}
            clientProfilePicture={clientProfilePicture}
            firstName={firstName}
            logoUrl={logoUrl}
            showStreak={false}
            tenantSlug={tenantSlug}
            trainerName={trainerName}
          />

          {/* Page Title */}
          <div className="px-4 pb-4 pt-2">
            <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
              Programas
            </h1>
            <p className="text-default-500 font-body">
              Tus programas de entrenamiento
            </p>
          </div>

          <div className="px-4 space-y-6">
            {/* Empty State */}
            <Card>
              <CardBody className="py-12">
                <div className="text-center">
                  <Icon
                    className="text-default-300 text-6xl mx-auto mb-4"
                    icon="solar:dumbbell-line-duotone"
                  />
                  <h3 className="text-lg font-heading font-semibold mb-2">
                    Sin Programas Aún
                  </h3>
                  <p className="text-default-500 font-body text-sm">
                    Tu entrenador te asignará programas pronto
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
      <ClientBottomNav />
    </>
  );
}

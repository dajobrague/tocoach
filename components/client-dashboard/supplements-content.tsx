"use client";

import { Card, CardBody, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { ClientBottomNav } from "./bottom-nav";
import { ClientHeader } from "./client-header";

import { ClientSupplementAssignment } from "@/types/supplements";
import { useContrastColor } from "@/lib/utils/use-contrast-color";

interface SupplementsContentProps {
  clientId: string;
  firstName: string;
  logoUrl?: string;
  trainerName: string;
  clientProfilePicture?: string;
  tenantSlug: string;
}

export function SupplementsContent({
  clientId,
  firstName,
  logoUrl,
  trainerName,
  clientProfilePicture,
  tenantSlug,
}: SupplementsContentProps) {
  const [assignments, setAssignments] = useState<ClientSupplementAssignment[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);

  // Dynamic text colors for proper contrast - similar pattern to nutrition page
  const primaryTextLight = useContrastColor("primary", 0.05, {
    useThemeColor: true,
  }); // for bg-primary/5
  const primaryText = useContrastColor("primary", 0.1, { useThemeColor: true }); // for bg-primary/10
  const warningText = useContrastColor("warning", 0.1, { useThemeColor: true }); // for bg-warning/10

  useEffect(() => {
    fetchAssignments();
  }, [clientId]);

  const fetchAssignments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/client/supplements");
      const result = await response.json();

      if (result.success) {
        // Only show active supplements
        setAssignments(
          result.data.filter(
            (a: ClientSupplementAssignment) => a.status === "active"
          )
        );
      } else {
        console.error("Error fetching assignments:", result.error);
      }
    } catch (error) {
      console.error("Error fetching assignments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTimingIcon = (timing: string) => {
    if (timing.toLowerCase().includes("post")) return "solar:dumbbell-bold";
    if (timing.toLowerCase().includes("pre")) return "solar:alarm-bold";
    if (timing.toLowerCase().includes("desayuno")) return "solar:cup-hot-bold";
    if (
      timing.toLowerCase().includes("cena") ||
      timing.toLowerCase().includes("dormir")
    )
      return "solar:moon-bold";

    return "solar:clock-circle-bold";
  };

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <ClientHeader
          clientId={clientId}
          clientProfilePicture={clientProfilePicture}
          firstName={firstName}
          logoUrl={logoUrl}
          tagline="¡Listo para energizarte!"
          tenantSlug={tenantSlug}
          trainerName={trainerName}
        />

        <div className="max-w-lg mx-auto p-4">
          {/* Info Card - Dynamic contrast text color */}
          <Card className="mb-6 bg-primary/5 border border-primary/20">
            <CardBody className="p-4">
              <div className="flex items-start gap-3">
                <Icon
                  className="mt-0.5 flex-shrink-0"
                  icon="solar:info-circle-bold"
                  style={primaryTextLight.style}
                  width={20}
                />
                <div>
                  <p
                    className="text-sm font-semibold mb-1"
                    style={primaryTextLight.style}
                  >
                    Tu Protocolo de Suplementación
                  </p>
                  <p
                    className="text-xs"
                    style={primaryTextLight.secondaryStyle}
                  >
                    Sigue las indicaciones de tu entrenador para obtener los
                    mejores resultados.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <Spinner size="lg" />
            </div>
          )}

          {/* Supplements List */}
          {!isLoading && assignments.length > 0 && (
            <div className="space-y-4">
              {assignments.map((assignment) => {
                const supplement = assignment.supplement;
                const productImage = supplement?.images?.[0];

                return (
                  <Card
                    key={assignment.id}
                    className="bg-background border border-default-200"
                  >
                    <CardBody className="p-4">
                      {/* Header */}
                      <div className="flex items-start gap-3 mb-4">
                        {/* Product Image or Icon - Dynamic contrast */}
                        <div className="flex-shrink-0 w-14 h-14 bg-primary/10 rounded-xl overflow-hidden flex items-center justify-center">
                          {productImage ? (
                            <img
                              alt={assignment.supplement_name}
                              className="w-full h-full object-cover"
                              src={productImage}
                            />
                          ) : (
                            <Icon
                              className="text-2xl"
                              icon="solar:health-bold"
                              style={primaryText.style}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-foreground mb-1 truncate">
                            {assignment.supplement_name}
                          </h3>
                          {assignment.supplement_description && (
                            <p className="text-xs text-default-500 line-clamp-2">
                              {assignment.supplement_description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="space-y-3">
                        {/* Dosage & Frequency */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-3 bg-default-100 rounded-lg">
                            <p className="text-xs text-default-500 font-medium mb-1">
                              Dosificación
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                              {assignment.dosage}
                            </p>
                          </div>
                          <div className="p-3 bg-default-100 rounded-lg">
                            <p className="text-xs text-default-500 font-medium mb-1">
                              Frecuencia
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                              {assignment.frequency}
                            </p>
                          </div>
                        </div>

                        {/* Timing - Dynamic contrast */}
                        <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                          <Icon
                            icon={getTimingIcon(assignment.timing)}
                            style={primaryTextLight.style}
                            width={20}
                          />
                          <div className="flex-1">
                            <p
                              className="text-xs font-medium"
                              style={primaryTextLight.secondaryStyle}
                            >
                              Timing
                            </p>
                            <p
                              className="text-sm font-semibold"
                              style={primaryTextLight.style}
                            >
                              {assignment.timing}
                            </p>
                          </div>
                        </div>

                        {/* Notes - Dynamic contrast */}
                        {assignment.notes && (
                          <div className="p-3 bg-warning/10 rounded-lg border border-warning/20">
                            <div className="flex items-start gap-2">
                              <Icon
                                className="mt-0.5 flex-shrink-0"
                                icon="solar:clipboard-text-bold"
                                style={warningText.style}
                                width={16}
                              />
                              <div>
                                <p
                                  className="text-xs font-medium mb-0.5"
                                  style={warningText.style}
                                >
                                  Nota importante
                                </p>
                                <p
                                  className="text-xs"
                                  style={warningText.secondaryStyle}
                                >
                                  {assignment.notes}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && assignments.length === 0 && (
            <Card className="bg-background border border-default-200">
              <CardBody className="p-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="bg-default-100 p-4 rounded-full mb-4">
                    <Icon
                      className="text-default-400 text-5xl"
                      icon="solar:health-linear"
                    />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">
                    No tienes suplementos asignados
                  </h3>
                  <p className="text-sm text-default-500">
                    Tu entrenador aún no te ha asignado ningún suplemento
                  </p>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
      <ClientBottomNav />
    </>
  );
}

"use client";

import type { WorkoutProgram } from "@/types/training";

import { Button, Card, CardBody, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import { usePrograms } from "@/lib/hooks/use-client-queries";

export function ProgramsContent() {
  const pathname = usePathname();
  const slug = pathname.split("/")[1] || "";

  const {
    clientId,
    firstName,
    logoUrl,
    trainerName,
    clientProfilePicture,
    tenantSlug,
  } = useClientData();

  const {
    data: programs = [],
    isLoading,
    isError,
    error,
    refetch,
  } = usePrograms();

  const active = programs.filter((p: WorkoutProgram) => p.status === "active");
  const completed = programs.filter(
    (p: WorkoutProgram) => p.status === "completed"
  );

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-lg mx-auto">
          <ClientHeader
            clientId={clientId}
            clientProfilePicture={clientProfilePicture}
            firstName={firstName}
            logoUrl={logoUrl}
            tenantSlug={tenantSlug}
            trainerName={trainerName}
          />

          <div className="px-4 pb-4 pt-2">
            <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
              Programas
            </h1>
            <p className="text-default-500 font-body">
              Tus programas de entrenamiento
            </p>
          </div>

          <div className="px-4 space-y-6 pb-4">
            {isLoading && (
              <div className="flex justify-center py-16">
                <Spinner label="Cargando programas..." size="lg" />
              </div>
            )}

            {isError && !isLoading && (
              <Card className="border border-danger-200">
                <CardBody className="p-6 text-center">
                  <p className="text-danger text-sm font-body mb-3">
                    {(error as Error)?.message ||
                      "No se pudieron cargar los programas."}
                  </p>
                  <Button color="primary" size="sm" onPress={() => refetch()}>
                    Reintentar
                  </Button>
                </CardBody>
              </Card>
            )}

            {!isLoading && !isError && programs.length === 0 && (
              <Card>
                <CardBody className="py-12">
                  <div className="text-center">
                    <Icon
                      className="text-default-300 text-6xl mx-auto mb-4"
                      icon="solar:dumbbell-line-duotone"
                    />
                    <h3 className="text-lg font-heading font-semibold mb-2">
                      Sin programas aún
                    </h3>
                    <p className="text-default-500 font-body text-sm">
                      Tu entrenador te asignará programas pronto
                    </p>
                  </div>
                </CardBody>
              </Card>
            )}

            {!isLoading && !isError && programs.length > 0 && (
              <>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm text-foreground font-body">
                    Para ver el calendario de entrenos y registrar series, usa{" "}
                    <strong>Entrenamiento</strong> en la barra inferior.
                  </p>
                  <Button
                    as={Link}
                    className="mt-3 text-white font-semibold"
                    color="primary"
                    href={`/${slug}/ejercicio`}
                    size="sm"
                  >
                    Ir a Entrenamiento
                  </Button>
                </div>

                {active.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-default-600 uppercase tracking-wide">
                      Activos
                    </h2>
                    {active.map((p: WorkoutProgram) => (
                      <Card key={p.clientProgramId} className="shadow-sm">
                        <CardBody className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-heading font-bold text-foreground truncate">
                                {p.name}
                              </p>
                              <p className="text-xs text-default-500 mt-1">
                                {p.type} · {p.division} · {p.currentWeek}
                              </p>
                              <p className="text-xs text-default-500">
                                {p.sessions?.length ?? 0} sesiones en plantilla
                              </p>
                            </div>
                            <Chip color="success" size="sm" variant="flat">
                              Activo
                            </Chip>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                )}

                {completed.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-default-600 uppercase tracking-wide">
                      Completados
                    </h2>
                    {completed.map((p: WorkoutProgram) => (
                      <Card
                        key={p.clientProgramId}
                        className="shadow-sm opacity-80"
                      >
                        <CardBody className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-heading font-semibold text-foreground truncate">
                                {p.name}
                              </p>
                              <p className="text-xs text-default-500 mt-1">
                                {p.type} · {p.division}
                              </p>
                            </div>
                            <Chip size="sm" variant="bordered">
                              Completado
                            </Chip>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <ClientBottomNav />
    </>
  );
}

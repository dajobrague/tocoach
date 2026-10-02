"use client";

import type { WorkoutProgram } from "@/types/training";

import { Button, Card, CardBody, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import {
  ClientPage,
  SectionHeader,
} from "@/components/client-dashboard/client-page";
import { CenteredState } from "@/components/shared/centered-state";
import { OutlineChip } from "@/components/shared/outline-chip";
import { usePrograms } from "@/lib/hooks/use-client-queries";

export function ProgramsContent() {
  const pathname = usePathname();
  const slug = pathname.split("/")[1] || "";

  const {
    data: programs = [],
    isLoading,
    isError,
    error,
    refetch,
  } = usePrograms();

  const active = programs.filter((p: WorkoutProgram) => p.status === "active");
  const paused = programs.filter((p: WorkoutProgram) => p.status === "paused");
  const completed = programs.filter(
    (p: WorkoutProgram) => p.status === "completed"
  );

  return (
    <>
      <ClientPage title="Programas">
        <div className="px-4 space-y-6 pt-4 pb-4">
          {isLoading && (
            <div className="flex justify-center py-16">
              <Spinner label="Cargando programas..." size="lg" />
            </div>
          )}

          {isError && !isLoading && (
            <CenteredState
              action={
                <Button color="primary" size="sm" onPress={() => refetch()}>
                  Reintentar
                </Button>
              }
              icon="solar:danger-circle-linear"
              subtitle={
                (error as Error)?.message ||
                "No se pudieron cargar los programas."
              }
              title="Error al cargar programas"
            />
          )}

          {!isLoading && !isError && programs.length === 0 && (
            <CenteredState
              icon="solar:dumbbell-linear"
              subtitle="Tu entrenador te asignará programas pronto"
              title="Sin programas aún"
            />
          )}

          {!isLoading && !isError && programs.length > 0 && (
            <>
              {active.length > 0 && (
                <div className="space-y-3">
                  <SectionHeader className="mb-0" title="Activos" />
                  {active.map((p: WorkoutProgram) => (
                    // Toda la card lleva a Entrenamiento (calendario + registro).
                    <Link
                      key={p.clientProgramId}
                      aria-label={`${p.name}: ir a Entrenamiento`}
                      className="block rounded-large"
                      href={`/${slug}/ejercicio`}
                    >
                      <Card
                        className="transition-colors hover:bg-default-50"
                        shadow="sm"
                      >
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
                            <div className="flex shrink-0 items-center gap-1">
                              <OutlineChip tone="success">Activo</OutlineChip>
                              <Icon
                                className="text-default-400"
                                icon="solar:alt-arrow-right-linear"
                                width={18}
                              />
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}

              {paused.length > 0 && (
                <div className="space-y-3">
                  <SectionHeader className="mb-0" title="Pausados" />
                  <p className="text-xs text-default-500">
                    Tu entrenador pausó estos programas. Si quieres retomar
                    alguno, pídeselo y él lo reactivará.
                  </p>
                  {paused.map((p: WorkoutProgram) => (
                    <Card
                      key={p.clientProgramId}
                      className="opacity-80"
                      shadow="sm"
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
                            <p className="text-xs text-default-500">
                              {p.sessions?.length ?? 0} sesiones en plantilla
                            </p>
                          </div>
                          <OutlineChip tone="warning">Pausado</OutlineChip>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}

              {completed.length > 0 && (
                <div className="space-y-3">
                  <SectionHeader className="mb-0" title="Completados" />
                  {completed.map((p: WorkoutProgram) => (
                    <Card
                      key={p.clientProgramId}
                      className="opacity-80"
                      shadow="sm"
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
                          <OutlineChip tone="muted">Completado</OutlineChip>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </ClientPage>
      <ClientBottomNav />
    </>
  );
}

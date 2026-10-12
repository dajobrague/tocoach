"use client";

import type { WorkoutProgram } from "@/types/training";
import type { ReactNode } from "react";

import { Button, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { ClientPage } from "@/components/client-dashboard/client-page";
import { SessionTypeTile } from "@/components/client-dashboard/workouts/session-card";
import { CenteredState } from "@/components/shared/centered-state";
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
      <ClientPage showBack title="Programas">
        <div className="space-y-[26px] px-4 pb-4">
          {isLoading && (
            <div className="flex justify-center py-16">
              <Spinner label="Cargando programas..." size="lg" />
            </div>
          )}

          {isError && !isLoading && (
            <CenteredState
              action={
                <Button
                  className="mt-1.5 font-semibold"
                  radius="full"
                  size="sm"
                  variant="flat"
                  onPress={() => refetch()}
                >
                  Reintentar
                </Button>
              }
              icon="solar:danger-triangle-linear"
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
                <section>
                  <ProgramsHeading title="Activos" />
                  <ul className="divide-y divide-default-100 overflow-hidden rounded-large bg-content1 shadow-small">
                    {active.map((p: WorkoutProgram) => (
                      <li key={p.clientProgramId}>
                        {/* Toda la fila lleva a Entrenamiento (calendario + registro). */}
                        <Link
                          aria-label={`${p.name}: ir a Entrenamiento`}
                          className="block active:bg-default-100 [@media(hover:hover)]:hover:bg-default-50"
                          href={`/${slug}/ejercicio`}
                        >
                          <ProgramRow
                            chip={
                              <StatusChip
                                className="bg-success/15 text-success-700"
                                icon="solar:check-circle-bold"
                                label="Activo"
                              />
                            }
                            meta={joinMeta(p.type, p.division, p.currentWeek)}
                            program={p}
                            sessions={sessionsLabel(p)}
                            trailing={
                              <Icon
                                aria-hidden
                                className="shrink-0 text-default-400"
                                icon="solar:alt-arrow-right-linear"
                                width={18}
                              />
                            }
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {paused.length > 0 && (
                <section>
                  <ProgramsHeading title="Pausados" />
                  <p className="mx-1 -mt-1 mb-3 text-sm leading-normal text-default-500">
                    Tu entrenador pausó estos programas. Si quieres retomar
                    alguno, pídeselo y él lo reactivará.
                  </p>
                  <ul className="divide-y divide-default-100 overflow-hidden rounded-large bg-content1 shadow-small">
                    {paused.map((p: WorkoutProgram) => (
                      <li key={p.clientProgramId}>
                        <ProgramRow
                          chip={
                            <StatusChip
                              className="bg-warning/15 text-warning-700"
                              label="Pausado"
                            />
                          }
                          meta={joinMeta(p.type, p.division)}
                          program={p}
                          sessions={sessionsLabel(p)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {completed.length > 0 && (
                <section>
                  <ProgramsHeading title="Completados" />
                  <ul className="divide-y divide-default-100 overflow-hidden rounded-large bg-content1 shadow-small">
                    {completed.map((p: WorkoutProgram) => (
                      <li key={p.clientProgramId}>
                        <ProgramRow
                          chip={
                            <StatusChip
                              className="bg-default-100 text-default-500"
                              label="Completado"
                            />
                          }
                          meta={joinMeta(p.type, p.division)}
                          program={p}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </ClientPage>
      <ClientBottomNav />
    </>
  );
}

function ProgramsHeading({ title }: { title: string }) {
  return (
    <h2 className="mb-3 font-heading text-xl tracking-[-0.015em] text-foreground">
      {title}
    </h2>
  );
}

function ProgramRow({
  program,
  meta,
  sessions,
  chip,
  trailing,
}: {
  program: WorkoutProgram;
  meta: string;
  sessions?: string;
  chip: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-start gap-3 px-4 py-3">
      <SessionTypeTile
        sessionType={program.category === "cardio" ? "cardio" : "strength"}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-foreground">
          {program.name}
        </p>
        {meta ? (
          <p className="mt-0.5 text-[13px] leading-snug text-default-500">
            {meta}
          </p>
        ) : null}
        {sessions ? (
          <p className="text-[13px] leading-snug text-default-500">
            {sessions}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1 self-center">
        {chip}
        {trailing}
      </div>
    </div>
  );
}

function StatusChip({
  label,
  className,
  icon,
}: {
  label: string;
  className: string;
  icon?: string;
}) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${className}`}
    >
      {icon ? <Icon aria-hidden icon={icon} width={14} /> : null}
      {label}
    </span>
  );
}

function joinMeta(...parts: Array<string | null | undefined>): string {
  return parts.filter((part) => part != null && part !== "").join(" · ");
}

function sessionsLabel(p: WorkoutProgram): string {
  return `${p.sessions?.length ?? 0} sesiones en plantilla`;
}

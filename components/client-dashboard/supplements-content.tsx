"use client";

import { Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo } from "react";

import { ClientBottomNav } from "./bottom-nav";
import { useClientData } from "./client-data-provider";
import { ClientHeader } from "./client-header";

import { useSupplements } from "@/lib/hooks/use-client-queries";
import { ClientSupplementAssignment } from "@/types/supplements";

function getTimingIcon(timing: string): string {
  const lower = timing.toLowerCase();

  if (lower.includes("post")) return "solar:dumbbell-bold";
  if (lower.includes("pre")) return "solar:alarm-bold";
  if (lower.includes("desayuno")) return "solar:cup-hot-bold";
  if (lower.includes("cena") || lower.includes("dormir"))
    return "solar:moon-bold";

  return "solar:clock-circle-bold";
}

export function SupplementsContent() {
  const {
    clientId,
    clientProfilePicture,
    firstName,
    logoUrl,
    tenantSlug,
    trainerName,
  } = useClientData();

  const { data: allAssignments = [], isLoading } = useSupplements();

  const assignments = useMemo(
    () =>
      allAssignments.filter(
        (a: ClientSupplementAssignment) => a.status === "active"
      ),
    [allAssignments]
  );

  return (
    <>
      <div className="min-h-screen bg-background pb-32">
        <ClientHeader
          clientId={clientId}
          clientProfilePicture={clientProfilePicture}
          firstName={firstName}
          logoUrl={logoUrl}
          tagline="¡Listo para energizarte!"
          tenantSlug={tenantSlug}
          trainerName={trainerName}
        />

        <div className="mx-auto max-w-lg p-4">
          <div className="mb-4 flex items-baseline justify-between border-b border-default-200 pb-3">
            <h1
              className="text-2xl text-foreground"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}
            >
              Suplementos
            </h1>
            {!isLoading && assignments.length > 0 && (
              <span
                className="text-sm text-default-500"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {assignments.length}{" "}
                {assignments.length === 1 ? "activo" : "activos"}
              </span>
            )}
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          )}

          {!isLoading && assignments.length > 0 && (
            <div className="space-y-3">
              {assignments.map((assignment: ClientSupplementAssignment) => (
                <SupplementCard key={assignment.id} assignment={assignment} />
              ))}
            </div>
          )}

          {!isLoading && assignments.length === 0 && <EmptyState />}
        </div>
      </div>
      <ClientBottomNav />
    </>
  );
}

function SupplementCard({
  assignment,
}: {
  assignment: ClientSupplementAssignment;
}) {
  const productImage = assignment.supplement?.images?.[0];

  return (
    <article className="rounded-2xl border border-default-200 bg-content1 p-4 shadow-sm">
      <header className="flex items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-default-100">
          {productImage ? (
            <img
              alt={assignment.supplement_name}
              className="h-full w-full object-cover"
              loading="lazy"
              src={productImage}
            />
          ) : (
            <Icon
              className="text-3xl text-default-400"
              icon="solar:health-bold"
            />
          )}
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <h3
            className="truncate text-base text-foreground"
            style={{ fontFamily: "var(--font-heading)", fontWeight: 700 }}
          >
            {assignment.supplement_name}
          </h3>
          {assignment.supplement_description && (
            <p
              className="line-clamp-2 text-xs text-default-500"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {assignment.supplement_description}
            </p>
          )}
        </div>
      </header>

      <div className="my-4 border-t border-default-100" />

      <dl className="space-y-3">
        <MetadataRow
          icon="solar:scale-bold"
          label="Dosis"
          value={assignment.dosage}
        />
        <MetadataRow
          icon="solar:calendar-bold"
          label="Frecuencia"
          value={assignment.frequency}
        />
        <MetadataRow
          icon={getTimingIcon(assignment.timing)}
          label="Cuándo"
          value={assignment.timing}
        />
      </dl>

      {assignment.notes && (
        <div className="mt-4 rounded-xl border border-warning-100 bg-warning-50 p-3">
          <div className="flex items-start gap-2">
            <Icon
              className="mt-0.5 shrink-0 text-base text-warning-600"
              icon="solar:clipboard-text-bold"
            />
            <div className="min-w-0 flex-1">
              <p
                className="mb-0.5 text-xs text-warning-700"
                style={{ fontFamily: "var(--font-body)", fontWeight: 600 }}
              >
                Nota del entrenador
              </p>
              <p
                className="text-xs text-warning-700/90"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {assignment.notes}
              </p>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function MetadataRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="shrink-0 text-lg text-default-400" icon={icon} />
      <dt
        className="text-sm text-default-500"
        style={{ fontFamily: "var(--font-body)" }}
      >
        {label}
      </dt>
      <dd
        className="ml-auto text-right text-sm text-foreground"
        style={{ fontFamily: "var(--font-body)", fontWeight: 600 }}
      >
        {value}
      </dd>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon
        className="mb-5 text-default-300"
        height={64}
        icon="solar:health-linear"
        width={64}
      />
      <h3
        className="mb-2 text-base text-foreground"
        style={{ fontFamily: "var(--font-heading)", fontWeight: 700 }}
      >
        No tienes suplementos asignados
      </h3>
      <p
        className="max-w-xs text-sm text-default-500"
        style={{ fontFamily: "var(--font-body)" }}
      >
        Tu entrenador aún no te ha asignado ningún suplemento
      </p>
    </div>
  );
}

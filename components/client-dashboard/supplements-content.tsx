"use client";

import { Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo } from "react";

import { ClientBottomNav } from "./bottom-nav";
import { ClientPage } from "./client-page";

import { CenteredState } from "@/components/shared/centered-state";
import { useSupplements } from "@/lib/hooks/use-client-queries";
import { normalizeProductUrl } from "@/lib/supplements/product-url";
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
      <ClientPage title="Suplementos">
        <div className="px-4 pt-4">
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

          {!isLoading && assignments.length === 0 && (
            <CenteredState
              icon="solar:health-linear"
              subtitle="Tu entrenador aún no te ha asignado ningún suplemento"
              title="No tienes suplementos asignados"
            />
          )}
        </div>
      </ClientPage>
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
  const productUrl = normalizeProductUrl(
    assignment.supplement?.product_url ?? ""
  );

  return (
    <article className="rounded-large bg-content1 p-4 shadow-small">
      <header className="flex items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-default-100">
          {productImage ? (
            <img
              alt={assignment.supplement_name}
              className="h-full w-full object-cover"
              decoding="async"
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
          <h3 className="truncate font-heading text-base text-foreground">
            {assignment.supplement_name}
          </h3>
          {assignment.supplement_description && (
            <p className="line-clamp-2 text-xs text-default-500">
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
        <div className="mt-4 rounded-medium bg-default-100 p-3">
          <div className="flex items-start gap-2">
            <Icon
              className="mt-0.5 shrink-0 text-base text-primary"
              icon="solar:clipboard-text-linear"
            />
            <div className="min-w-0 flex-1">
              <p className="mb-0.5 text-xs font-semibold text-foreground">
                Nota del entrenador
              </p>
              <p className="text-xs text-default-600">{assignment.notes}</p>
            </div>
          </div>
        </div>
      )}

      {productUrl.length > 0 && (
        <a
          className="mt-4 flex items-center justify-center gap-2 rounded-medium bg-default-100 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-default-200"
          href={productUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Icon
            className="text-base text-default-500"
            icon="solar:link-linear"
          />
          Ver producto
        </a>
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
      <dt className="text-sm text-default-500">{label}</dt>
      <dd className="ml-auto text-right text-sm font-semibold text-foreground">
        {value}
      </dd>
    </div>
  );
}

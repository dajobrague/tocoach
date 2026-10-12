"use client";

import { Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo } from "react";

import { ClientBottomNav } from "./bottom-nav";
import { ClientPage } from "./client-page";

import { NutritionState } from "@/components/client-dashboard/meal-cycle/macro-ui";
import { useSupplements } from "@/lib/hooks/use-client-queries";
import { normalizeProductUrl } from "@/lib/supplements/product-url";
import { ClientSupplementAssignment } from "@/types/supplements";

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
      <ClientPage showBack title="Suplementos">
        <div className="px-4">
          {isLoading && (
            <div className="flex justify-center py-16" role="status">
              <Spinner color="default" />
            </div>
          )}

          {!isLoading && assignments.length > 0 && (
            <div className="flex flex-col gap-3.5">
              {assignments.map((assignment: ClientSupplementAssignment) => (
                <SupplementCard key={assignment.id} assignment={assignment} />
              ))}
            </div>
          )}

          {!isLoading && assignments.length === 0 && (
            <NutritionState
              icon="solar:pill-linear"
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
      <header className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-default-100">
          {productImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={assignment.supplement_name}
              className="h-full w-full object-cover"
              decoding="async"
              loading="lazy"
              src={productImage}
            />
          ) : (
            <Icon
              className="text-default-400"
              icon="solar:pill-linear"
              width={26}
            />
          )}
        </div>
        <h3 className="min-w-0 flex-1 text-[17px] font-semibold leading-snug text-foreground">
          {assignment.supplement_name}
        </h3>
      </header>

      {assignment.supplement_description && (
        <p className="mt-3 text-sm leading-snug text-default-500">
          {assignment.supplement_description}
        </p>
      )}

      <dl className="mt-3 divide-y divide-default-200/70 rounded-[14px] bg-default-100">
        <MetadataRow label="Dosis" value={assignment.dosage} />
        <MetadataRow label="Frecuencia" value={assignment.frequency} />
        <MetadataRow label="Cuándo" value={assignment.timing} />
      </dl>

      {assignment.notes && (
        <div className="mt-3 rounded-[14px] bg-primary/10 px-3.5 py-3">
          <p className="text-[13px] font-semibold text-primary">
            Nota del entrenador
          </p>
          <p className="mt-0.5 text-sm leading-snug text-foreground">
            {assignment.notes}
          </p>
        </div>
      )}

      {productUrl.length > 0 && (
        <a
          className="-mb-2 mt-1 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-primary active:opacity-60"
          href={productUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Ver producto
          <Icon icon="solar:arrow-right-up-linear" width={18} />
        </a>
      )}
    </article>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 px-3.5 py-2.5 text-sm">
      <dt className="text-default-500">{label}</dt>
      <dd className="text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}

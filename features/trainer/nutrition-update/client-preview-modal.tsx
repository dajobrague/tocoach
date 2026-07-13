"use client";

import type { ClientReadiness } from "./readiness-api";

import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { Icon } from "@iconify/react";

import { GoalsOnlyView } from "@/components/client-dashboard/meal-cycle/goals-only-view";
import { PdfDietView } from "@/components/client-dashboard/meal-cycle/pdf-diet-view";

interface ClientPreviewModalProps {
  /** The client being previewed, or null when closed. */
  client: ClientReadiness | null;
  onClose: () => void;
}

/**
 * "Así lo verá tu cliente" — the wizard's preview. Renders the REAL client
 * components (PdfDietView / GoalsOnlyView / the empty state) with the
 * client's real data, framed as a plain labelled panel on the trainer side.
 * Every verdict shows actual content — never a bare explanation.
 */
export function ClientPreviewModal({
  client,
  onClose,
}: ClientPreviewModalProps) {
  return (
    <Modal
      isOpen={client !== null}
      scrollBehavior="inside"
      size="2xl"
      onClose={onClose}
    >
      <ModalContent>
        {client === null ? null : (
          <>
            <ModalHeader className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">
                Así verá {client.name} su sección de Nutrición
              </span>
              <span className="text-xs font-normal text-gray-500">
                Vista con sus datos reales, tal como quedará tras el cambio.
              </span>
            </ModalHeader>
            <ModalBody className="pb-6">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="mx-auto w-full max-w-xl">
                  <PreviewBody client={client} />
                </div>
              </div>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

function PreviewBody({ client }: { client: ClientReadiness }) {
  if (client.verdict === "pdf" && client.pdf !== undefined) {
    return <PdfDietView name={client.pdf.name} url={client.pdf.url} />;
  }

  if (client.verdict === "goals") {
    return (
      <GoalsOnlyView
        goals={client.goals ?? null}
        presets={client.presets ?? []}
      />
    );
  }

  if (client.verdict === "plan_v2") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white px-6 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white">
          <Icon icon="solar:clipboard-check-linear" width={24} />
        </span>
        <p className="text-base font-semibold text-black">
          Verá su plan de comidas nuevo
        </p>
        <p className="max-w-sm text-sm text-gray-500">
          Este cliente ya tiene un plan v2 activo: verá sus menús del día,
          alternativas y objetivos — igual que en su pestaña de Nutrición actual
          del panel.
        </p>
      </div>
    );
  }

  // none / at_risk — render the SAME empty state the client page shows, so
  // the trainer sees literally what the client will get.
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
        <Icon className="text-gray-300" icon="solar:plate-linear" width={44} />
        <p className="text-lg font-semibold text-black">Sin plan activo</p>
        <p className="max-w-sm text-sm text-gray-500">
          Tu entrenador aún no te ha asignado un plan de comidas.
        </p>
      </div>
      {client.verdict === "at_risk" ? (
        <p className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 p-3 text-xs text-warning-700">
          <Icon
            className="mt-0.5 shrink-0"
            icon="solar:danger-triangle-bold"
            width={14}
          />
          Su plan estructurado antiguo no se muestra en la nueva versión. Créale
          un plan v2 o súbele un PDF antes de activar el cambio.
        </p>
      ) : null}
    </div>
  );
}

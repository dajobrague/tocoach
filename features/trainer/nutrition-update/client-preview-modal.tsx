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
 * "Así lo verá tu cliente" — the wizard's phone-frame preview. Renders the
 * REAL client components (PdfDietView / GoalsOnlyView) with the client's real
 * data inside a device mock: what the trainer sees here is literally what the
 * client gets after the switch. plan_v2/none verdicts get a text explanation
 * instead (the plan view needs live week data; the empty state is obvious).
 */
export function ClientPreviewModal({
  client,
  onClose,
}: ClientPreviewModalProps) {
  return (
    <Modal
      isOpen={client !== null}
      scrollBehavior="inside"
      size="xl"
      onClose={onClose}
    >
      <ModalContent>
        {client === null ? null : (
          <>
            <ModalHeader className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">
                Así verá {client.name} su sección de Nutrición
              </span>
              <span className="text-xs font-normal text-default-500">
                Vista previa con sus datos reales, tal como la verá tras el
                cambio.
              </span>
            </ModalHeader>
            <ModalBody className="items-center pb-6">
              <div className="h-[68vh] w-[380px] max-w-full overflow-y-auto rounded-[2.2rem] border-8 border-gray-900 bg-background shadow-xl">
                <div className="px-3 py-4">
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

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <Icon
        className="text-default-300"
        icon={
          client.verdict === "plan_v2"
            ? "solar:clipboard-check-linear"
            : "solar:plate-linear"
        }
        width={40}
      />
      <p className="text-sm font-semibold text-foreground">
        {client.verdict === "plan_v2"
          ? "Verá su plan de comidas nuevo"
          : "Verá el estado vacío"}
      </p>
      <p className="text-xs text-default-500">
        {client.verdict === "plan_v2"
          ? "Este cliente ya tiene un plan v2 activo — su vista es el plan completo con menús y alternativas."
          : client.verdict === "at_risk"
            ? "Su plan estructurado antiguo no se muestra en la nueva versión. Crea su plan v2 (o súbele un PDF) antes de activar."
            : "“Tu entrenador aún no te ha asignado un plan de comidas.”"}
      </p>
    </div>
  );
}

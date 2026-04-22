"use client";

import type { FormType } from "@/lib/forms/types";

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useState } from "react";

interface ApplyTemplateSectionProps {
  clientId: string;
  formType: FormType;
  /** Called after a successful apply, so the parent can refresh local data. */
  onApplied?: () => void;
}

type Step = "idle" | "warn" | "confirm";

const CONFIRM_WORD = "APLICAR";

const TYPE_LABELS: Record<FormType, string> = {
  checkins: "Check-in",
  habits: "Hábitos diarios",
};

/**
 * Compact button + two-step confirmation modal that overwrites this client's
 * form config with the tenant's active template for the given form type.
 *
 * Designed for the client profile → Formularios tab. The two-step flow
 * prevents accidental overwrites — the trainer must read the warning and
 * then type "APLICAR" to proceed.
 */
export function ApplyTemplateSection({
  clientId,
  formType,
  onApplied,
}: ApplyTemplateSectionProps) {
  const [step, setStep] = useState<Step>("idle");
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const close = useCallback(() => {
    setStep("idle");
    setConfirmText("");
    setSubmitting(false);
  }, []);

  const doApply = useCallback(async () => {
    setSubmitting(true);

    try {
      const res = await fetch(`/api/forms/configs/${clientId}/apply-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ form_type: formType }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.success) {
        throw new Error(json?.error ?? "Error al aplicar la plantilla");
      }

      addToast({
        title: "Plantilla aplicada",
        description: `La plantilla de ${TYPE_LABELS[formType]} se aplicó a este cliente.`,
        color: "success",
      });

      close();
      onApplied?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al aplicar la plantilla";

      addToast({
        title: "No se pudo aplicar",
        description: message,
        color: "danger",
      });
      setSubmitting(false);
    }
  }, [clientId, formType, onApplied, close]);

  const confirmEnabled =
    confirmText.trim().toUpperCase() === CONFIRM_WORD && !submitting;

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50/60 px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Icon
            className="flex-shrink-0 text-gray-500"
            icon="solar:copy-linear"
            width={16}
          />
          <span>
            ¿Quieres usar la plantilla de {TYPE_LABELS[formType]} de tu cuenta
            para este cliente?
          </span>
        </div>
        <Button
          color="default"
          size="sm"
          variant="flat"
          onPress={() => setStep("warn")}
        >
          Aplicar plantilla
        </Button>
      </div>

      {/* STEP 1 — warning */}
      <Modal
        isOpen={step === "warn"}
        size="md"
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Icon
              className="text-warning-600"
              icon="solar:shield-warning-bold"
              width={22}
            />
            Aplicar plantilla a este cliente
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-700">
              Vas a reemplazar la configuración actual de{" "}
              <strong>{TYPE_LABELS[formType]}</strong> de este cliente por la
              plantilla activa de tu cuenta. Esto sobrescribirá:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
              <li>Las preguntas configuradas actualmente</li>
              {formType === "checkins" && <li>El horario del check-in</li>}
            </ul>
            <p className="text-sm text-gray-600">
              Esta acción solo afecta a este cliente. Los demás clientes no
              cambian.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={close}>
              Cancelar
            </Button>
            <Button color="warning" onPress={() => setStep("confirm")}>
              Continuar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* STEP 2 — hard confirmation */}
      <Modal
        isOpen={step === "confirm"}
        size="md"
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Icon
              className="text-danger-600"
              icon="solar:danger-triangle-bold"
              width={22}
            />
            Confirmar reemplazo
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-700">
              Esta acción no se puede deshacer. Para continuar, escribe{" "}
              <strong>{CONFIRM_WORD}</strong> en el campo de abajo.
            </p>
            <Input
              autoFocus
              isDisabled={submitting}
              placeholder={CONFIRM_WORD}
              value={confirmText}
              onValueChange={setConfirmText}
            />
          </ModalBody>
          <ModalFooter>
            <Button isDisabled={submitting} variant="light" onPress={close}>
              Cancelar
            </Button>
            <Button
              color="danger"
              isDisabled={!confirmEnabled}
              isLoading={submitting}
              onPress={doApply}
            >
              Aplicar y reemplazar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

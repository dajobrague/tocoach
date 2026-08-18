"use client";

import type { CycleTemplateSummary } from "./cycle-api";

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

interface NewCycleModalProps {
  isOpen: boolean;
  pending: boolean;
  /** Tenant templates; empty hides the "Desde plantilla" mode entirely. */
  templates: CycleTemplateSummary[];
  onClose: () => void;
  onCreate: (input: {
    name: string;
    durationDays: number;
    startDate?: string;
  }) => void;
  onCreateFromTemplate: (input: {
    templateId: string;
    name: string;
    startDate?: string;
  }) => void;
  onDeleteTemplate: (templateId: string) => void;
}

const DURATIONS = [7, 14, 30];

export function NewCycleModal({
  isOpen,
  pending,
  templates,
  onClose,
  onCreate,
  onCreateFromTemplate,
  onDeleteTemplate,
}: NewCycleModalProps) {
  const [mode, setMode] = useState<"blank" | "template">("blank");
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("7");
  const [startDate, setStartDate] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);

  // Fresh form each open; a deleted-elsewhere template also clears selection.
  useEffect(() => {
    if (isOpen) {
      setMode("blank");
      setName("");
      setDuration("7");
      setStartDate("");
      setTemplateId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (
      templateId !== null &&
      templates.some((template) => template.id === templateId) === false
    ) {
      setTemplateId(null);
    }
  }, [templates, templateId]);

  const selectedTemplate =
    templates.find((template) => template.id === templateId) ?? null;
  const durationDays = Number(duration);
  const canSubmit =
    name.trim().length > 0 &&
    (mode === "blank"
      ? Number.isInteger(durationDays) && durationDays > 0
      : selectedTemplate !== null);

  const submit = () => {
    if (canSubmit === false || pending) return;
    const base = {
      name: name.trim(),
      ...(startDate.length > 0 ? { startDate } : {}),
    };

    if (mode === "template" && selectedTemplate !== null) {
      onCreateFromTemplate({ ...base, templateId: selectedTemplate.id });
    } else {
      onCreate({ ...base, durationDays });
    }
  };

  const pickTemplate = (template: CycleTemplateSummary) => {
    setTemplateId(template.id);
    // The template name is the natural default; keep any name already typed.
    setName((current) => (current.trim().length > 0 ? current : template.name));
  };

  return (
    <Modal
      isDismissable={pending === false}
      isOpen={isOpen}
      placement="center"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Icon
            className="text-gray-700"
            icon="solar:calendar-add-linear"
            width={20}
          />
          Nuevo plan
        </ModalHeader>
        <ModalBody className="gap-4">
          <p className="text-sm text-default-500">
            Un plan agrupa varios días con sus comidas, opciones y porciones.
          </p>

          {templates.length > 0 && (
            <div className="flex items-center gap-1 self-start rounded-large bg-gray-100 p-1">
              <button
                className={
                  mode === "blank"
                    ? "rounded-medium bg-white px-3 py-1.5 text-xs font-medium text-gray-900 shadow-sm"
                    : "rounded-medium px-3 py-1.5 text-xs font-medium text-default-500 hover:text-gray-900"
                }
                type="button"
                onClick={() => setMode("blank")}
              >
                En blanco
              </button>
              <button
                className={
                  mode === "template"
                    ? "rounded-medium bg-white px-3 py-1.5 text-xs font-medium text-gray-900 shadow-sm"
                    : "rounded-medium px-3 py-1.5 text-xs font-medium text-default-500 hover:text-gray-900"
                }
                type="button"
                onClick={() => setMode("template")}
              >
                Desde plantilla ({templates.length})
              </button>
            </div>
          )}

          {mode === "template" && (
            <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
              {templates.map((template) => {
                const selected = template.id === templateId;

                return (
                  <div
                    key={template.id}
                    className={`flex items-center gap-2 rounded-large border p-1 pr-2 ${
                      selected
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200"
                    }`}
                  >
                    <button
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-medium px-2 py-1.5 text-left"
                      type="button"
                      onClick={() => pickTemplate(template)}
                    >
                      <Icon
                        className={
                          selected ? "text-gray-900" : "text-default-300"
                        }
                        icon={
                          selected
                            ? "solar:check-circle-bold"
                            : "solar:record-circle-linear"
                        }
                        width={18}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">
                          {template.name}
                        </span>
                        <span className="block text-xs text-default-500">
                          {template.duration_days} días · {template.meals}{" "}
                          comidas
                        </span>
                      </span>
                    </button>
                    <button
                      aria-label={`Eliminar plantilla ${template.name}`}
                      className="shrink-0 rounded p-1 text-default-300 hover:text-danger"
                      type="button"
                      onClick={() => onDeleteTemplate(template.id)}
                    >
                      <Icon icon="solar:trash-bin-trash-linear" width={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <Input
            isRequired
            isDisabled={pending}
            label="Nombre del plan"
            placeholder={
              mode === "template"
                ? "Ej. Definición — Laura"
                : "Ej. Definición — Fase 1"
            }
            value={name}
            variant="bordered"
            onValueChange={setName}
          />

          {mode === "blank" && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-default-600">
                Duración
              </span>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((days) => (
                  <Button
                    key={days}
                    className={
                      duration === String(days) ? "bg-black text-white" : ""
                    }
                    size="sm"
                    variant={duration === String(days) ? "solid" : "bordered"}
                    onPress={() => setDuration(String(days))}
                  >
                    {days} días
                  </Button>
                ))}
                <Input
                  aria-label="Duración personalizada (días)"
                  className="max-w-[7rem]"
                  endContent={
                    <span className="text-xs text-default-400">días</span>
                  }
                  isDisabled={pending}
                  min={1}
                  size="sm"
                  type="number"
                  value={duration}
                  variant="bordered"
                  onValueChange={setDuration}
                />
              </div>
            </div>
          )}

          <Input
            isDisabled={pending}
            label="Fecha de inicio (opcional)"
            type="date"
            value={startDate}
            variant="bordered"
            onValueChange={setStartDate}
          />
        </ModalBody>
        <ModalFooter>
          <Button isDisabled={pending} variant="light" onPress={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-black text-white"
            color="primary"
            isDisabled={canSubmit === false}
            isLoading={pending}
            startContent={
              pending ? null : (
                <Icon icon="solar:arrow-right-linear" width={18} />
              )
            }
            onPress={submit}
          >
            {mode === "template" ? "Crear desde plantilla" : "Crear plan"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

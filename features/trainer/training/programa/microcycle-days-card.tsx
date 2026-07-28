"use client";

// Card "Días del microciclo": tiles Día 1..N con la sesión asignada (o
// Descanso). Tap en un tile abre un Popover con las sesiones del programa
// para asignar + "Descanso" para limpiar; cada asignación guarda al momento
// (sin botón Guardar). El modal "Duración y fecha" reusa el slider existente
// y conserva los dos guardarraíles de microcycle-config: aviso ámbar de
// truncado y confirmación al cambiar la fecha de inicio.

import type { MicrocycleState } from "./use-microcycle-state";
import type { ProgramCategory, WorkoutSession } from "./training-api";

import {
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { CATEGORY_VISUAL } from "./programa-format";

import MicrocycleDurationSelector from "@/components/trainer/microcycle/microcycle-duration-selector";

interface MicrocycleDaysCardProps {
  state: MicrocycleState;
  /** Sesiones del programa seleccionado (las asignables desde el popover). */
  sessions: WorkoutSession[];
  /** Categoría del programa seleccionado (tinta los nombres cardio en rosa). */
  category: ProgramCategory;
}

interface ResolvedSlot {
  name: string;
  isCardio: boolean;
}

export function MicrocycleDaysCard({
  state,
  sessions,
  category,
}: MicrocycleDaysCardProps) {
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsStep, setSettingsStep] = useState<"form" | "confirm">("form");
  const [durationDraft, setDurationDraft] = useState(state.durationDays);
  const [startDateDraft, setStartDateDraft] = useState(state.startDate);

  const resolveSlot = (sessionId: string): ResolvedSlot => {
    const own = sessions.find((session) => session.id === sessionId);

    if (own !== undefined) {
      return { name: own.name, isCardio: category === "cardio" };
    }

    // La asignación puede apuntar a una sesión de otro programa activo;
    // el endpoint del microciclo nos da nombre y tipo como fallback.
    const available = state.availableSessions.find(
      (session) => session.id === sessionId
    );

    if (available !== undefined) {
      return {
        name: available.name,
        isCardio: available.session_type === "cardio",
      };
    }

    return { name: "Sesión", isCardio: false };
  };

  const openSettings = () => {
    setDurationDraft(state.durationDays);
    setStartDateDraft(state.startDate);
    setSettingsStep("form");
    setSettingsOpen(true);
  };

  const submitSettings = () => {
    const startDateChanged =
      state.loadedStartDate !== null &&
      state.loadedStartDate !== startDateDraft;

    if (settingsStep === "form" && startDateChanged) {
      setSettingsStep("confirm");

      return;
    }

    state.applySettings(durationDraft, startDateDraft, () => {
      setSettingsOpen(false);
      setSettingsStep("form");
    });
  };

  const days = Array.from({ length: state.durationDays }, (_, i) => i + 1);

  return (
    <div className="rounded-large border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <Icon
            className="text-default-500"
            icon="solar:calendar-linear"
            width={16}
          />
          <h3 className="text-sm font-semibold text-gray-900">
            Días del microciclo
          </h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-default-600 tabular-nums">
            {state.assignedCount}/{state.durationDays}
          </span>
          {state.isSaving && <Spinner size="sm" />}
        </div>
        <Button
          size="sm"
          startContent={<Icon icon="solar:settings-bold" width={15} />}
          variant="bordered"
          onPress={openSettings}
        >
          Duración y fecha
        </Button>
      </div>

      <div className="p-5">
        {state.isError ? (
          <div className="flex items-center gap-2 rounded-large border border-danger-200 bg-danger-50 p-2.5 text-sm text-danger-700">
            <Icon icon="solar:danger-bold" width={16} />
            {state.errorMessage ?? "No se pudo cargar el microciclo"}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {days.map((day) => {
              const sessionId = state.slotByDay.get(day) ?? null;
              const resolved =
                sessionId !== null ? resolveSlot(sessionId) : null;

              return (
                <Popover
                  key={day}
                  isOpen={openDay === day}
                  placement="bottom"
                  onOpenChange={(isOpen) => setOpenDay(isOpen ? day : null)}
                >
                  <PopoverTrigger>
                    <button
                      className={`flex min-h-[4.5rem] flex-col items-start gap-1 rounded-large p-2.5 text-left transition-colors ${
                        resolved !== null
                          ? "border border-gray-200 bg-white shadow-sm hover:border-gray-300"
                          : "border border-dashed border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                      type="button"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-default-400">
                        Día {day}
                      </span>
                      <span
                        className={`line-clamp-2 text-xs font-medium ${
                          resolved === null
                            ? "text-default-400"
                            : resolved.isCardio
                              ? "text-rose-600"
                              : "text-gray-900"
                        }`}
                      >
                        {resolved?.name ?? "Descanso"}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-1.5">
                    <div className="flex w-full flex-col gap-0.5">
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-default-400">
                        Asignar al día {day}
                      </p>
                      {sessions.length === 0 && (
                        <p className="px-2 py-1.5 text-xs text-default-500">
                          Este programa aún no tiene sesiones.
                        </p>
                      )}
                      {sessions.map((session) => {
                        const visual = CATEGORY_VISUAL[category];

                        return (
                          <button
                            key={session.id}
                            className={`flex w-full items-center justify-between gap-2 rounded-medium px-2 py-1.5 text-left text-sm transition-colors hover:bg-gray-100 ${
                              sessionId === session.id
                                ? "bg-gray-50 font-medium"
                                : ""
                            }`}
                            type="button"
                            onClick={() => {
                              state.assign(day, session.id);
                              setOpenDay(null);
                            }}
                          >
                            <span className="truncate text-gray-900">
                              {session.name}
                            </span>
                            <Chip
                              className={`shrink-0 ${visual.square}`}
                              size="sm"
                              variant="flat"
                            >
                              <span className="text-[10px]">
                                {visual.label}
                              </span>
                            </Chip>
                          </button>
                        );
                      })}
                      <div className="my-0.5 border-t border-gray-100" />
                      <button
                        className="flex w-full items-center gap-2 rounded-medium px-2 py-1.5 text-left text-sm text-default-500 transition-colors hover:bg-gray-100"
                        type="button"
                        onClick={() => {
                          state.assign(day, null);
                          setOpenDay(null);
                        }}
                      >
                        <Icon icon="solar:moon-stars-linear" width={14} />
                        Descanso
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })}
          </div>
        )}

        {state.saveError !== null && (
          <div className="mt-3 flex items-center gap-2 rounded-large border border-danger-200 bg-danger-50 p-2.5 text-sm text-danger-700">
            <Icon icon="solar:danger-bold" width={16} />
            {state.saveError}
          </div>
        )}
      </div>

      <Modal
        isOpen={settingsOpen}
        placement="center"
        size="sm"
        onClose={() => {
          setSettingsOpen(false);
          setSettingsStep("form");
        }}
      >
        <ModalContent>
          {settingsStep === "form" ? (
            <>
              <ModalHeader className="flex items-center gap-2">
                <Icon
                  className="text-gray-700"
                  icon="solar:settings-bold"
                  width={20}
                />
                Duración y fecha
              </ModalHeader>
              <ModalBody className="gap-4">
                <MicrocycleDurationSelector
                  isDisabled={state.isSaving}
                  maxAssignedDay={state.maxAssignedDay}
                  value={durationDraft}
                  onChange={setDurationDraft}
                />
                <div>
                  <Input
                    isDisabled={state.isSaving}
                    label="Día 1 del microciclo"
                    type="date"
                    value={startDateDraft}
                    onValueChange={setStartDateDraft}
                  />
                  <p className="mt-1 text-[10px] text-gray-500">
                    El cliente entrenará la sesión del Día 1 a partir de esta
                    fecha. El ciclo se repite cada {durationDraft}{" "}
                    {durationDraft === 1 ? "día" : "días"}.
                  </p>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  isDisabled={state.isSaving}
                  variant="light"
                  onPress={() => setSettingsOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="bg-slate-900 text-white"
                  isDisabled={startDateDraft.length === 0}
                  isLoading={state.isSaving}
                  onPress={submitSettings}
                >
                  Guardar
                </Button>
              </ModalFooter>
            </>
          ) : (
            <>
              <ModalHeader>Cambiar fecha de inicio</ModalHeader>
              <ModalBody>
                <p className="text-sm text-default-700">
                  Esto borrará las prescripciones futuras pre-cargadas a partir
                  del <strong>{startDateDraft}</strong> y las recalculará con la
                  nueva alineación del microciclo. Las fechas en las que tu
                  cliente ya entrenó no se tocan.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button
                  isDisabled={state.isSaving}
                  variant="light"
                  onPress={() => setSettingsStep("form")}
                >
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  isLoading={state.isSaving}
                  onPress={submitSettings}
                >
                  Confirmar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

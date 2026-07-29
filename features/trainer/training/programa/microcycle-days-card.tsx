"use client";

// Card "Días del microciclo": tiles Día 1..N con la sesión asignada (o
// Descanso). Tap en un tile abre un Popover con las sesiones del programa
// para asignar + "Descanso" para limpiar; cada cambio guarda al momento.
// Interactivo como los días del plan en nutrición (pedido de David): un
// tile punteado "+ Día" agrega al final y cada día muestra una "×" al pasar
// el mouse para quitarlo (los siguientes se corren) — sin slider ni modal
// de ajustes. La fecha de inicio vive junto al título como pill editable;
// cambiarla conserva el guardarraíl de confirmación ("borrará las
// prescripciones futuras…") de la pantalla vieja.

import type { MicrocycleState } from "./use-microcycle-state";
import type { WorkoutSession } from "./training-api";

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

const MAX_DAYS = 28;

interface MicrocycleDaysCardProps {
  state: MicrocycleState;
  /** Sesiones del programa seleccionado (las asignables desde el popover). */
  sessions: WorkoutSession[];
}

interface ResolvedSlot {
  name: string;
  isCardio: boolean;
}

/** "2026-03-03" → "lun 3 mar 2026" (es-ES corto, sin puntos). */
function formatStartDate(ymd: string): string {
  const date = new Date(`${ymd}T00:00:00`);

  // Invalid Date no lanza — formatearía "Invalid Date" silenciosamente.
  if (Number.isNaN(date.getTime())) return ymd;

  return date
    .toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .replaceAll(".", "");
}

export function MicrocycleDaysCard({
  state,
  sessions,
}: MicrocycleDaysCardProps) {
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [dateDraft, setDateDraft] = useState(state.startDate);
  const [dateConfirm, setDateConfirm] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<number | null>(null);
  // Paginación como pidió David: máximo 10 tiles visibles; flechas para el
  // resto. El "+" vive junto al ÚLTIMO día, así que solo aparece cuando la
  // ventana alcanza el final.
  const [pageStart, setPageStart] = useState(1);

  const resolveSlot = (sessionId: string): ResolvedSlot => {
    const own = sessions.find((session) => session.id === sessionId);

    if (own !== undefined) {
      return { name: own.name, isCardio: own.sessionType === "cardio" };
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

  const submitDate = () => {
    const changed =
      state.loadedStartDate !== null && state.loadedStartDate !== dateDraft;

    if (changed && !dateConfirm) {
      setDateConfirm(true);

      return;
    }

    state.applySettings(state.durationDays, dateDraft, () => {
      setDateOpen(false);
      setDateConfirm(false);
    });
  };

  const confirmRemove = () => {
    if (removeTarget !== null) {
      state.removeDay(removeTarget);
      setRemoveTarget(null);
    }
  };

  const PAGE_SIZE = 10;
  // Clampea la ventana si la duración bajó (quitar días) o subió (agregar).
  const maxStart = Math.max(1, state.durationDays - PAGE_SIZE + 1);
  const windowStart = Math.min(pageStart, maxStart);
  const windowEnd = Math.min(windowStart + PAGE_SIZE - 1, state.durationDays);
  const canPageLeft = windowStart > 1;
  const canPageRight = windowEnd < state.durationDays;
  const lastDayVisible = windowEnd === state.durationDays;
  const days = Array.from(
    { length: windowEnd - windowStart + 1 },
    (_, i) => windowStart + i
  );

  const goToEnd = () =>
    setPageStart(Math.max(1, state.durationDays + 1 - PAGE_SIZE + 1));

  return (
    <div className="rounded-large border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-medium bg-blue-50 text-blue-600">
          <Icon icon="solar:calendar-bold" width={15} />
        </span>
        <h3 className="text-sm font-semibold text-gray-900">
          Días del microciclo
        </h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-default-600 tabular-nums">
          {state.assignedCount}/{state.durationDays}
        </span>

        {/* Fecha de inicio: visible siempre, editable en un popover chico. */}
        <Popover
          isOpen={dateOpen}
          placement="bottom-start"
          onOpenChange={(isOpen) => {
            setDateOpen(isOpen);
            if (isOpen) {
              setDateDraft(state.startDate);
              setDateConfirm(false);
            }
          }}
        >
          <PopoverTrigger>
            <button
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-100"
              type="button"
            >
              <Icon
                className="text-gray-600"
                icon="solar:calendar-date-linear"
                width={13}
              />
              empieza {formatStartDate(state.startDate)}
              <Icon
                className="text-gray-600"
                icon="solar:pen-linear"
                width={11}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3">
            <div className="flex w-full flex-col gap-2.5">
              <Input
                isDisabled={state.isSaving}
                label="Día 1 del microciclo"
                size="sm"
                type="date"
                value={dateDraft}
                variant="bordered"
                onValueChange={(value) => {
                  setDateDraft(value);
                  setDateConfirm(false);
                }}
              />
              {dateConfirm ? (
                <p className="rounded-large bg-amber-50 p-2.5 text-[11px] leading-snug text-amber-800">
                  Esto borrará las prescripciones futuras pre-cargadas a partir
                  del <strong>{dateDraft}</strong> y las recalculará con la
                  nueva alineación. Las fechas en las que tu cliente ya entrenó
                  no se tocan.
                </p>
              ) : (
                <p className="text-[10px] text-gray-500">
                  El cliente entrenará la sesión del Día 1 a partir de esta
                  fecha; el ciclo se repite cada {state.durationDays}{" "}
                  {state.durationDays === 1 ? "día" : "días"}.
                </p>
              )}
              <Button
                className="w-full bg-slate-900 text-white"
                isDisabled={dateDraft.length === 0}
                isLoading={state.isSaving}
                size="sm"
                onPress={submitDate}
              >
                {dateConfirm ? "Confirmar cambio" : "Guardar fecha"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <span className="flex-1" />
        {state.isSaving && <Spinner size="sm" />}
      </div>

      <div className="p-5">
        {state.isError ? (
          <div className="flex items-center gap-2 rounded-large border border-danger-200 bg-danger-50 p-2.5 text-sm text-danger-700">
            <Icon icon="solar:danger-bold" width={16} />
            {state.errorMessage ?? "No se pudo cargar el microciclo"}
          </div>
        ) : (
          <div className="flex items-stretch gap-3">
            {canPageLeft ? (
              <button
                aria-label="Días anteriores"
                className="flex w-8 shrink-0 items-center justify-center rounded-large border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                type="button"
                onClick={() =>
                  setPageStart(Math.max(1, windowStart - PAGE_SIZE))
                }
              >
                <Icon icon="solar:alt-arrow-left-linear" width={16} />
              </button>
            ) : null}

            {/* Grilla de fracciones iguales (receta del day-selector de
                nutrición): los tiles se achican a medida que hay más días. */}
            <div className="grid flex-1 auto-cols-fr grid-flow-col gap-2">
              {days.map((day) => {
                const sessionId = state.slotByDay.get(day) ?? null;
                const resolved =
                  sessionId !== null ? resolveSlot(sessionId) : null;

                return (
                  <div key={day} className="group relative">
                    <Popover
                      isOpen={openDay === day}
                      placement="bottom"
                      onOpenChange={(isOpen) => setOpenDay(isOpen ? day : null)}
                    >
                      <PopoverTrigger>
                        <button
                          className={`flex h-full w-full flex-col gap-0.5 rounded-large border px-3 py-3 text-left transition-all ${
                            openDay === day
                              ? "border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-500"
                              : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                          }`}
                          type="button"
                        >
                          <span className="truncate text-sm font-semibold text-gray-900">
                            Día {day}
                          </span>
                          <span
                            className={`line-clamp-2 text-xs ${
                              resolved === null
                                ? "text-default-400"
                                : resolved.isCardio
                                  ? "font-medium text-rose-600"
                                  : "font-medium text-gray-700"
                            }`}
                          >
                            {resolved?.name ?? "Descanso"}
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-1.5">
                        <div className="flex w-full flex-col gap-0.5">
                          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-default-500">
                            Asignar al día {day}
                          </p>
                          {sessions.length === 0 && (
                            <p className="px-2 py-1.5 text-xs text-default-500">
                              Este programa aún no tiene sesiones.
                            </p>
                          )}
                          {sessions.map((session) => {
                            const visual = CATEGORY_VISUAL[session.sessionType];

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

                    {/* × al hover — receta EXACTA del day-selector de
                        nutrición: 16px, sin círculo ni sombra, esquina
                        superior derecha. */}
                    {state.durationDays > 1 ? (
                      <button
                        aria-label={`Quitar día ${day}`}
                        className="absolute right-1 top-1 z-10 flex items-center justify-center rounded-full text-sm font-bold leading-none text-gray-400 opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                        style={{
                          height: 16,
                          width: 16,
                          minHeight: 0,
                          minWidth: 0,
                          padding: 0,
                        }}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (resolved !== null) {
                            setRemoveTarget(day);
                          } else {
                            state.removeDay(day);
                          }
                        }}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {canPageRight ? (
              <button
                aria-label="Días siguientes"
                className="flex w-8 shrink-0 items-center justify-center rounded-large border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                type="button"
                onClick={() =>
                  setPageStart(Math.min(maxStart, windowStart + PAGE_SIZE))
                }
              >
                <Icon icon="solar:alt-arrow-right-linear" width={16} />
              </button>
            ) : null}

            {/* "+" siempre junto al último día (visible solo cuando la
                ventana llega al final) — tile lateral como en nutrición. */}
            {lastDayVisible && state.durationDays < MAX_DAYS ? (
              <button
                aria-label="Agregar día"
                className="flex shrink-0 flex-col items-center justify-center gap-1 self-stretch rounded-large border border-dashed border-gray-300 px-4 text-xs font-medium text-default-500 transition-all hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-600"
                type="button"
                onClick={() => {
                  state.addDay();
                  goToEnd();
                }}
              >
                <Icon icon="solar:add-circle-linear" width={22} />
                Día
              </button>
            ) : null}
          </div>
        )}

        {state.saveError !== null && (
          <div className="mt-3 flex items-center gap-2 rounded-large border border-danger-200 bg-danger-50 p-2.5 text-sm text-danger-700">
            <Icon icon="solar:danger-bold" width={16} />
            {state.saveError}
          </div>
        )}
      </div>

      {/* Confirmación al quitar un día CON sesión asignada. */}
      <Modal
        isOpen={removeTarget !== null}
        placement="center"
        size="sm"
        onClose={() => setRemoveTarget(null)}
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-danger-50 text-danger">
              <Icon icon="solar:trash-bin-trash-linear" width={18} />
            </span>
            Quitar día {removeTarget}
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              Este día tiene una sesión asignada que se perderá; los días
              siguientes se correrán uno hacia atrás.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setRemoveTarget(null)}>
              Cancelar
            </Button>
            <Button
              color="danger"
              isLoading={state.isSaving}
              onPress={confirmRemove}
            >
              Quitar día
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

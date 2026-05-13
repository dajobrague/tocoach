// Orquestador de la pantalla "Microciclo" del trainer. Estado y reglas
// de edición delegados a useMicrocycleEditor; este archivo se ocupa solo
// del layout, fetching, mutación de guardado y composición de los
// sub-componentes presentacionales.

"use client";

import type { Session } from "@/types/training";

import { Button, Input, Skeleton, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";

import AvailableSessionsAside from "./available-sessions-aside";
import { useMicrocycleEditor } from "./hooks/use-microcycle-editor";
import { useSaveMicrocycle } from "./hooks/use-save-microcycle";
import { useTrainerMicrocycle } from "./hooks/use-trainer-microcycle";
import MicrocycleDurationSelector from "./microcycle-duration-selector";
import MicrocycleSlotRow from "./microcycle-slot-row";

interface Props {
  clientId: string;
}

export default function MicrocycleConfig({ clientId }: Props) {
  const { data, isLoading, isError, error, isSuccess } =
    useTrainerMicrocycle(clientId);
  const save = useSaveMicrocycle(clientId);

  const editor = useMicrocycleEditor(data?.microcycle, isSuccess);

  const handleSave = () => {
    save.mutate(
      {
        duration_days: editor.durationDays,
        start_date: editor.startDate,
        slots: editor.toPayloadSlots(),
      },
      {
        onSuccess: () => {
          addToast({
            title: "Microciclo guardado",
            description: "Tu cliente ya puede verlo como referencia en su app.",
          });
        },
        onError: (e) => {
          addToast({
            title: "Error al guardar",
            description:
              e instanceof Error
                ? e.message
                : "Error inesperado al guardar el microciclo",
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
        {error instanceof Error
          ? error.message
          : "No se pudo cargar el microciclo"}
      </div>
    );
  }

  const availableSessions = data?.available_sessions ?? [];
  const baseSessions: Session[] = availableSessions.map((s) => s);
  const noActiveProgram = !data?.program;
  const programHasNoSessions =
    !noActiveProgram && availableSessions.length === 0;

  const days = Array.from({ length: editor.durationDays }, (_, i) => i + 1);
  const isSaving = save.isPending;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-5 pb-5 border-b border-gray-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">Microciclo</h2>
            <p className="text-sm text-gray-500">
              Configura el orden ideal de la semana. Tu cliente lo verá como
              referencia y podrá hacer las sesiones en el orden que prefiera.
            </p>
          </div>
          <Button
            color="primary"
            isDisabled={noActiveProgram}
            isLoading={isSaving}
            startContent={
              isSaving ? null : <Icon icon="solar:diskette-bold" width={18} />
            }
            onPress={handleSave}
          >
            Guardar plan
          </Button>
        </div>
        {!noActiveProgram ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-end gap-6 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <MicrocycleDurationSelector
                  isDisabled={isSaving}
                  maxAssignedDay={editor.maxAssignedDay}
                  value={editor.durationDays}
                  onChange={editor.setDurationDays}
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                {/* Fecha en que cae el Día 1 del microciclo. Sin esta
                    columna el ancla del ciclo era client_program.start_date,
                    que el trainer no podía elegir. Ahora el trainer decide
                    explícitamente en qué fecha arranca la rutina semanal. */}
                <label
                  className="block text-xs text-gray-600 mb-1"
                  htmlFor="microcycle-start-date"
                >
                  Día 1 del microciclo
                </label>
                <Input
                  id="microcycle-start-date"
                  isDisabled={isSaving}
                  size="sm"
                  type="date"
                  value={editor.startDate}
                  onChange={(e) => editor.setStartDate(e.target.value)}
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  El cliente entrenará la sesión del Día 1 a partir de esta
                  fecha. El ciclo se repite cada {editor.durationDays}{" "}
                  {editor.durationDays === 1 ? "día" : "días"}.
                </p>
              </div>
              <div className="bg-blue-50 px-4 py-2 rounded-md min-w-[110px] shrink-0">
                <div className="text-base font-semibold text-blue-900 tabular-nums">
                  {editor.assignedCount} / {editor.durationDays}
                </div>
                <div className="text-[10px] text-blue-700 leading-tight">
                  días asignados
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {noActiveProgram ? (
        <div className="rounded-lg border border-warning-200 bg-warning-50 p-4 text-sm text-warning-800">
          Este cliente no tiene un programa activo. Asígnale uno desde la
          pestaña <strong>Entrenamientos</strong> para poder armar su plan
          semanal.
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row">
          <section className="flex-1 rounded-lg bg-white p-3 shadow-sm">
            {programHasNoSessions ? (
              <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                Este programa todavía no tiene sesiones. Agrégalas desde la
                pestaña <strong>Entrenamientos</strong> para poder asignarlas a
                los días del microciclo.
              </div>
            ) : null}
            <ul className="flex flex-col gap-1">
              {days.map((day) => (
                <li key={day}>
                  <MicrocycleSlotRow
                    availableSessions={baseSessions}
                    dayIndex={day}
                    isDisabled={isSaving}
                    isSelected={editor.selectedDay === day}
                    selectedSessionId={editor.slotByDay.get(day) ?? null}
                    onRemove={() => editor.removeSlot(day)}
                    onSelect={() => editor.selectDay(day)}
                  />
                </li>
              ))}
            </ul>
          </section>
          <aside className="lg:w-72 shrink-0">
            <AvailableSessionsAside
              highlighted={editor.selectedDay !== null}
              isDisabled={isSaving || availableSessions.length === 0}
              selectedDay={editor.selectedDay}
              sessions={availableSessions}
              onSelectSession={editor.selectSession}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

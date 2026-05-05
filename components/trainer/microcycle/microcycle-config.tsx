// Orquestador de la pantalla "Plan semanal" del trainer. Estado y reglas
// de edición delegados a useMicrocycleEditor; este archivo se ocupa solo
// del layout, fetching, mutación de guardado y composición de los
// sub-componentes presentacionales.

"use client";

import type { Session } from "@/types/training";

import { Button, Skeleton, addToast } from "@heroui/react";
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
        slots: editor.toPayloadSlots(),
      },
      {
        onSuccess: () => {
          addToast({
            title: "Plan semanal guardado",
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
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-gray-900">Plan semanal</h2>
          {data?.program ? (
            <p className="text-xs text-gray-500">
              Programa <span className="font-medium">{data.program.name}</span>
              {data.start_date ? (
                <>
                  {" · "}Inicio{" "}
                  <span className="font-medium">
                    {formatDate(data.start_date)}
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
          <p className="text-sm text-gray-500 max-w-md">
            Configura el orden ideal de la semana. Tu cliente lo verá como
            referencia y podrá hacer las sesiones en el orden que prefiera.
          </p>
        </div>
        <div className="flex items-end gap-3 w-full sm:w-auto sm:max-w-sm">
          <div className="flex-1">
            <MicrocycleDurationSelector
              isDisabled={noActiveProgram || isSaving}
              maxAssignedDay={editor.maxAssignedDay}
              value={editor.durationDays}
              onChange={editor.setDurationDays}
            />
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
            Guardar
          </Button>
        </div>
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
              sessions={availableSessions}
              onSelectSession={editor.selectSession}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

function formatDate(isoYmd: string): string {
  try {
    const d = new Date(`${isoYmd}T12:00:00Z`);

    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return isoYmd;
  }
}

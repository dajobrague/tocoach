// Orquestador de la pantalla "Plan semanal" del trainer. Layout: header
// con duration selector + botón Guardar arriba; lista de filas Día N
// (microcycle-slot-row) en la columna principal; sesiones disponibles
// como aside en desktop o sección debajo en mobile.

"use client";

import type { MicrocycleWithSlots, Session } from "@/types/training";

import { Button, Skeleton, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import AvailableSessionsAside from "./available-sessions-aside";
import { useSaveMicrocycle } from "./hooks/use-save-microcycle";
import { useTrainerMicrocycle } from "./hooks/use-trainer-microcycle";
import MicrocycleDurationSelector from "./microcycle-duration-selector";
import MicrocycleSlotRow from "./microcycle-slot-row";

const DEFAULT_DURATION_DAYS = 7;

interface Props {
  clientId: string;
}

export default function MicrocycleConfig({ clientId }: Props) {
  const { data, isLoading, isError, error } = useTrainerMicrocycle(clientId);
  const save = useSaveMicrocycle(clientId);

  const [durationDays, setDurationDays] = useState<number>(
    DEFAULT_DURATION_DAYS
  );
  const [slotByDay, setSlotByDay] = useState<Map<number, string | null>>(
    new Map()
  );
  const [hydrated, setHydrated] = useState(false);

  // Hidrata el estado local con el microciclo guardado la primera vez
  // que llega la data. Cambios posteriores del usuario son la fuente
  // de verdad hasta que guarde / recargue.
  useEffect(() => {
    if (!data || hydrated) return;
    const initial = buildInitialSlots(data.microcycle, DEFAULT_DURATION_DAYS);

    setDurationDays(initial.durationDays);
    setSlotByDay(initial.slotByDay);
    setHydrated(true);
  }, [data, hydrated]);

  const handleSave = () => {
    const slots = collectSlots(durationDays, slotByDay);

    save.mutate(
      { duration_days: durationDays, slots },
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

  const days = useMemo(
    () => Array.from({ length: durationDays }, (_, i) => i + 1),
    [durationDays]
  );

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

  const availableSessions: Session[] = data?.available_sessions ?? [];
  // El servidor devuelve program: null SOLO cuando el cliente no tiene
  // un programa activo asignado a este trainer. Programa con cero
  // sesiones todavía cuenta como "tiene programa" — el trainer puede
  // armar el microciclo (probablemente todo descanso) y volver luego
  // de crear sesiones desde Entrenamientos.
  const noActiveProgram = !data?.program;
  const programHasNoSessions =
    !noActiveProgram && availableSessions.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-default-800">
            Plan semanal
          </h2>
          {data?.program ? (
            <p className="text-xs text-default-500">
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
          <p className="text-sm text-default-500 max-w-md">
            Configura el orden ideal de la semana. Tu cliente lo verá como
            referencia y podrá hacer las sesiones en el orden que prefiera.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <MicrocycleDurationSelector
            isDisabled={noActiveProgram || save.isPending}
            value={durationDays}
            onChange={setDurationDays}
          />
          <Button
            color="primary"
            isDisabled={noActiveProgram}
            isLoading={save.isPending}
            startContent={
              save.isPending ? null : (
                <Icon icon="solar:diskette-bold" width={18} />
              )
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
          <section className="flex-1 rounded-lg bg-white p-4 shadow-sm">
            {programHasNoSessions ? (
              <div className="mb-4 rounded-md border border-default-200 bg-default-50 p-3 text-xs text-default-700">
                Este programa todavía no tiene sesiones. Agrégalas desde la
                pestaña <strong>Entrenamientos</strong> para poder asignarlas a
                los días del microciclo.
              </div>
            ) : null}
            <ul className="divide-y divide-gray-100">
              {days.map((day) => (
                <li key={day}>
                  <MicrocycleSlotRow
                    availableSessions={availableSessions}
                    dayIndex={day}
                    isDisabled={save.isPending}
                    selectedSessionId={slotByDay.get(day) ?? null}
                    onChange={(sessionId) => {
                      setSlotByDay((prev) => {
                        const next = new Map(prev);

                        next.set(day, sessionId);

                        return next;
                      });
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
          <aside className="lg:w-72 shrink-0">
            <AvailableSessionsAside sessions={availableSessions} />
          </aside>
        </div>
      )}
    </div>
  );
}

// Formatea una fecha ISO (YYYY-MM-DD) en es-ES corto. Hace el parsing
// como UTC noon para evitar deriva por TZ del navegador en la línea
// del día.
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

// Construye el estado inicial a partir del microciclo guardado. Días no
// listados explícitamente quedan como null (descanso) para que el UI
// muestre todas las filas con un valor concreto.
function buildInitialSlots(
  microcycle: MicrocycleWithSlots | null,
  fallbackDays: number
): { durationDays: number; slotByDay: Map<number, string | null> } {
  const durationDays = microcycle?.duration_days ?? fallbackDays;
  const map = new Map<number, string | null>();

  for (let day = 1; day <= durationDays; day++) {
    map.set(day, null);
  }

  for (const slot of microcycle?.slots ?? []) {
    if (slot.day_index >= 1 && slot.day_index <= durationDays) {
      map.set(slot.day_index, slot.session_id);
    }
  }

  return { durationDays, slotByDay: map };
}

// Convierte el Map del estado en el array que espera el endpoint, solo
// para los días dentro del rango actual (si el trainer redujo
// durationDays, los días sobrantes en el Map se descartan).
function collectSlots(
  durationDays: number,
  slotByDay: Map<number, string | null>
): Array<{ day_index: number; session_id: string | null }> {
  const result: Array<{ day_index: number; session_id: string | null }> = [];

  for (let day = 1; day <= durationDays; day++) {
    result.push({ day_index: day, session_id: slotByDay.get(day) ?? null });
  }

  return result;
}

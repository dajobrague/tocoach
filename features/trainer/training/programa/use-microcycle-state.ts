"use client";

// Estado local del microciclo para el surface "Programa". Hidrata una sola
// vez desde useTrainerMicrocycle y a partir de ahí el usuario es la fuente de
// verdad (mismo patrón que use-microcycle-editor). A diferencia de la
// pantalla vieja NO hay botón "Guardar": cada asignación de día y cada cambio
// de duración/fecha dispara el PUT completo (useSaveMicrocycle) al momento.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSaveMicrocycle } from "@/components/trainer/microcycle/hooks/use-save-microcycle";
import {
  useTrainerMicrocycle,
  type AvailableTrainerSession,
} from "@/components/trainer/microcycle/hooks/use-trainer-microcycle";

const DEFAULT_DURATION_DAYS = 7;

function todayYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${d.getFullYear()}-${mm}-${dd}`;
}

export interface MicrocycleState {
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  durationDays: number;
  /** Fecha (YYYY-MM-DD) en que cae el "Día 1" del ciclo. */
  startDate: string;
  /** Fecha cargada del servidor — para detectar el cambio que exige confirm. */
  loadedStartDate: string | null;
  slotByDay: Map<number, string | null>;
  /** day_index más alto con sesión asignada; 0 si nada asignado. */
  maxAssignedDay: number;
  assignedCount: number;
  /** Sesiones que el endpoint del microciclo considera asignables (fallback de nombres). */
  availableSessions: AvailableTrainerSession[];
  isSaving: boolean;
  saveError: string | null;
  /** Asigna una sesión (o null = descanso) a un día y guarda al instante. */
  assign: (day: number, sessionId: string | null) => void;
  /** Aplica duración + fecha de inicio y guarda (truncando días sobrantes). */
  applySettings: (
    durationDays: number,
    startDate: string,
    onSuccess?: () => void
  ) => void;
  /** Agrega un día al final del ciclo (máx 28) y guarda. */
  addDay: () => void;
  /** Quita un día; los siguientes se corren uno hacia atrás (mín 1). */
  removeDay: (day: number) => void;
}

export function useMicrocycleState(clientId: string): MicrocycleState {
  const query = useTrainerMicrocycle(clientId);
  const save = useSaveMicrocycle(clientId);

  const [durationDays, setDurationDays] = useState(DEFAULT_DURATION_DAYS);
  const [startDate, setStartDate] = useState<string>(() => todayYmd());
  const [slotByDay, setSlotByDay] = useState<Map<number, string | null>>(
    () => new Map()
  );
  const [hydrated, setHydrated] = useState(false);
  const loadedStartDateRef = useRef<string | null>(null);

  useEffect(() => {
    if (query.isSuccess === false || hydrated) return;

    const microcycle = query.data?.microcycle ?? null;
    const days = microcycle?.duration_days ?? DEFAULT_DURATION_DAYS;
    const start = microcycle?.start_date ?? todayYmd();
    const map = new Map<number, string | null>();

    for (let day = 1; day <= days; day++) map.set(day, null);
    for (const slot of microcycle?.slots ?? []) {
      if (slot.day_index >= 1 && slot.day_index <= days) {
        map.set(slot.day_index, slot.session_id);
      }
    }

    setDurationDays(days);
    setStartDate(start);
    setSlotByDay(map);
    loadedStartDateRef.current = microcycle?.start_date ?? null;
    setHydrated(true);
  }, [query.isSuccess, query.data, hydrated]);

  const maxAssignedDay = useMemo(() => {
    let max = 0;

    for (const [day, sessionId] of slotByDay.entries()) {
      if (sessionId !== null && day > max) max = day;
    }

    return max;
  }, [slotByDay]);

  const assignedCount = useMemo(() => {
    let count = 0;

    for (const [day, sessionId] of slotByDay.entries()) {
      if (sessionId !== null && day >= 1 && day <= durationDays) count += 1;
    }

    return count;
  }, [slotByDay, durationDays]);

  const buildPayloadSlots = useCallback(
    (map: Map<number, string | null>, days: number) =>
      Array.from({ length: days }, (_, index) => ({
        day_index: index + 1,
        session_id: map.get(index + 1) ?? null,
      })),
    []
  );

  const assign = useCallback(
    (day: number, sessionId: string | null) => {
      const next = new Map(slotByDay);

      next.set(day, sessionId);
      setSlotByDay(next);
      save.mutate({
        duration_days: durationDays,
        start_date: startDate,
        slots: buildPayloadSlots(next, durationDays),
      });
    },
    [slotByDay, durationDays, startDate, save, buildPayloadSlots]
  );

  const applySettings = useCallback(
    (nextDays: number, nextStart: string, onSuccess?: () => void) => {
      // Poda los días fuera del nuevo rango para que un crecimiento posterior
      // no "resucite" asignaciones que el servidor ya descartó.
      const next = new Map<number, string | null>();

      for (let day = 1; day <= nextDays; day++) {
        next.set(day, slotByDay.get(day) ?? null);
      }

      setDurationDays(nextDays);
      setStartDate(nextStart);
      setSlotByDay(next);
      save.mutate(
        {
          duration_days: nextDays,
          start_date: nextStart,
          slots: buildPayloadSlots(next, nextDays),
        },
        {
          onSuccess: () => {
            loadedStartDateRef.current = nextStart;
            onSuccess?.();
          },
        }
      );
    },
    [slotByDay, save, buildPayloadSlots]
  );

  const addDay = useCallback(() => {
    if (durationDays >= 28) return;
    applySettings(durationDays + 1, startDate);
  }, [durationDays, startDate, applySettings]);

  const removeDay = useCallback(
    (day: number) => {
      if (durationDays <= 1 || day < 1 || day > durationDays) return;
      // Los días posteriores al quitado se corren uno hacia atrás — igual
      // que quitar un día del plan en nutrición.
      const nextDays = durationDays - 1;
      const next = new Map<number, string | null>();

      for (let d = 1; d <= nextDays; d++) {
        const source = d < day ? d : d + 1;

        next.set(d, slotByDay.get(source) ?? null);
      }

      setDurationDays(nextDays);
      setSlotByDay(next);
      save.mutate({
        duration_days: nextDays,
        start_date: startDate,
        slots: buildPayloadSlots(next, nextDays),
      });
    },
    [durationDays, slotByDay, startDate, save, buildPayloadSlots]
  );

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    errorMessage:
      query.error instanceof Error
        ? query.error.message
        : query.isError
          ? "No se pudo cargar el microciclo"
          : null,
    durationDays,
    startDate,
    loadedStartDate: loadedStartDateRef.current,
    slotByDay,
    maxAssignedDay,
    assignedCount,
    availableSessions: query.data?.available_sessions ?? [],
    isSaving: save.isPending,
    saveError:
      save.error instanceof Error
        ? save.error.message
        : save.isError
          ? "Error al guardar el microciclo"
          : null,
    assign,
    applySettings,
    addDay,
    removeDay,
  };
}

// Hook con la lógica de edición del Microciclo: estado de duración,
// asignación slot↔sesión, slot seleccionado, y el flujo de auto-fill
// que guía al trainer al "siguiente vacío" tras cada asignación.
//
// Reglas de auto-fill (Trabajo 3 §5.6):
//   1. Si hay un slot seleccionado y el trainer toca una sesión del
//      panel, esa sesión se asigna al slot seleccionado.
//   2. Si NO hay slot seleccionado y toca una sesión del panel, se
//      asigna al primer slot vacío (menor day_index).
//   3. Tras asignar, si quedan slots vacíos por delante, se selecciona
//      automáticamente el siguiente vacío. Si no, se deselecciona.
//   4. × en un slot asignado → vuelve a vacío. NO selecciona el slot
//      automáticamente.

import type { MicrocycleWithSlots } from "@/types/training";

import { useEffect, useMemo, useState } from "react";

const DEFAULT_DURATION_DAYS = 7;

export interface MicrocycleEditorState {
  durationDays: number;
  slotByDay: Map<number, string | null>;
  selectedDay: number | null;
  /** day_index más alto con sesión asignada (no null). 0 si nada asignado. */
  maxAssignedDay: number;
  /** Cuántos slots dentro del rango actual tienen sesión asignada (no null). */
  assignedCount: number;
  setDurationDays: (next: number) => void;
  selectDay: (day: number | null) => void;
  selectSession: (sessionId: string) => void;
  removeSlot: (day: number) => void;
  /** payload listo para enviar a PUT /api/clients/:id/microcycle */
  toPayloadSlots: () => Array<{
    day_index: number;
    session_id: string | null;
  }>;
}

export function useMicrocycleEditor(
  loaded: MicrocycleWithSlots | null | undefined,
  isDataReady: boolean
): MicrocycleEditorState {
  const [durationDays, setDurationDaysState] = useState<number>(
    DEFAULT_DURATION_DAYS
  );
  const [slotByDay, setSlotByDay] = useState<Map<number, string | null>>(
    new Map()
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hidratación inicial. Cambios posteriores del usuario son la fuente
  // de verdad hasta que recargue la página.
  useEffect(() => {
    if (!isDataReady || hydrated) return;
    const initial = buildInitialSlots(loaded ?? null, DEFAULT_DURATION_DAYS);

    setDurationDaysState(initial.durationDays);
    setSlotByDay(initial.slotByDay);
    setHydrated(true);
  }, [isDataReady, hydrated, loaded]);

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

  const setDurationDays = (next: number) => {
    setDurationDaysState(next);
    if (selectedDay !== null && selectedDay > next) setSelectedDay(null);
  };

  const selectDay = (day: number | null) => {
    setSelectedDay((prev) => (prev === day ? null : day));
  };

  const selectSession = (sessionId: string) => {
    const target = selectedDay ?? findFirstEmpty(slotByDay, durationDays);

    if (target === null) {
      // Nada vacío para asignar; ignora silenciosamente.
      return;
    }

    setSlotByDay((prev) => {
      const next = new Map(prev);

      next.set(target, sessionId);

      return next;
    });

    // Avanza al siguiente vacío después del recién asignado.
    setSelectedDay(findFirstEmptyAfter(slotByDay, durationDays, target));
  };

  const removeSlot = (day: number) => {
    setSlotByDay((prev) => {
      const next = new Map(prev);

      next.set(day, null);

      return next;
    });
    // No autoseleccionar: el trainer puede haber querido limpiar y
    // seguir con otro slot.
  };

  const toPayloadSlots = () => {
    const result: Array<{ day_index: number; session_id: string | null }> = [];

    for (let day = 1; day <= durationDays; day++) {
      result.push({
        day_index: day,
        session_id: slotByDay.get(day) ?? null,
      });
    }

    return result;
  };

  return {
    durationDays,
    slotByDay,
    selectedDay,
    maxAssignedDay,
    assignedCount,
    setDurationDays,
    selectDay,
    selectSession,
    removeSlot,
    toPayloadSlots,
  };
}

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

function findFirstEmpty(
  map: Map<number, string | null>,
  durationDays: number
): number | null {
  for (let day = 1; day <= durationDays; day++) {
    if (!map.get(day)) return day;
  }

  return null;
}

function findFirstEmptyAfter(
  prevMap: Map<number, string | null>,
  durationDays: number,
  justFilledDay: number
): number | null {
  // Considera el slot recién llenado como ocupado para esta búsqueda.
  for (let day = justFilledDay + 1; day <= durationDays; day++) {
    if (!prevMap.get(day)) return day;
  }
  // Wrap-around: ningún vacío después → buscar antes del recién llenado.
  for (let day = 1; day < justFilledDay; day++) {
    if (!prevMap.get(day)) return day;
  }

  return null;
}

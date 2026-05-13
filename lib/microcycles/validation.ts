// Validación del payload de PUT /api/clients/[clientId]/microcycle.
// Vive aparte del route handler para mantenerlo enfocado en orquestación
// y para poder reusarse desde la UI del entrenador si hace falta validar
// antes de enviar.

export interface MicrocycleSlotInput {
  day_index: number;
  session_id: string | null;
}

export interface MicrocyclePutInput {
  duration_days: number;
  /**
   * Fecha (YYYY-MM-DD) que el trainer eligió como "Día 1" del ciclo.
   * El resolver del cliente la usa como ancla del modulo.
   */
  start_date: string;
  slots: MicrocycleSlotInput[];
}

export interface ValidationFailure {
  ok: false;
  error: string;
}

export interface ValidationSuccess {
  ok: true;
  value: MicrocyclePutInput;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

const MIN_DURATION_DAYS = 1;
const MAX_DURATION_DAYS = 28;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateMicrocyclePutBody(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Body inválido" };
  }

  const body = raw as Record<string, unknown>;

  const durationDays = body.duration_days;

  if (
    typeof durationDays !== "number" ||
    !Number.isInteger(durationDays) ||
    durationDays < MIN_DURATION_DAYS ||
    durationDays > MAX_DURATION_DAYS
  ) {
    return {
      ok: false,
      error: `duration_days debe ser un entero entre ${MIN_DURATION_DAYS} y ${MAX_DURATION_DAYS}`,
    };
  }

  // start_date es obligatoria desde la migración 108. Aceptamos sólo
  // YYYY-MM-DD y verificamos que sea una fecha real (Date.parse no
  // alcanza porque tolera strings raros como "2026-13-99"). Sin upper/
  // lower bound — el trainer puede anclar el ciclo a cualquier fecha,
  // incluso futura ("la rutina empieza el lunes que viene").
  const startDate = body.start_date;

  if (typeof startDate !== "string" || !YMD_RE.test(startDate)) {
    return {
      ok: false,
      error: "start_date debe tener formato YYYY-MM-DD",
    };
  }
  const parsed = new Date(`${startDate}T00:00:00Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== startDate
  ) {
    return {
      ok: false,
      error: "start_date no es una fecha válida",
    };
  }

  if (!Array.isArray(body.slots)) {
    return { ok: false, error: "slots debe ser un array" };
  }

  const slots: MicrocycleSlotInput[] = [];
  const seenDays = new Set<number>();

  for (const [i, raw_slot] of body.slots.entries()) {
    if (!raw_slot || typeof raw_slot !== "object") {
      return { ok: false, error: `slots[${i}] inválido` };
    }

    const slot = raw_slot as Record<string, unknown>;

    if (
      typeof slot.day_index !== "number" ||
      !Number.isInteger(slot.day_index) ||
      slot.day_index < 1
    ) {
      return {
        ok: false,
        error: `slots[${i}].day_index debe ser un entero ≥ 1`,
      };
    }

    if (slot.day_index > durationDays) {
      return {
        ok: false,
        error: `slots[${i}].day_index (${slot.day_index}) excede duration_days (${durationDays})`,
      };
    }

    if (seenDays.has(slot.day_index)) {
      return {
        ok: false,
        error: `slots[${i}].day_index (${slot.day_index}) duplicado`,
      };
    }
    seenDays.add(slot.day_index);

    const sessionId = slot.session_id;

    if (sessionId !== null && typeof sessionId !== "string") {
      return {
        ok: false,
        error: `slots[${i}].session_id debe ser string o null`,
      };
    }

    slots.push({ day_index: slot.day_index, session_id: sessionId });
  }

  return {
    ok: true,
    value: { duration_days: durationDays, start_date: startDate, slots },
  };
}

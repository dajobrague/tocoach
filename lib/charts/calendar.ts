/**
 * Calendario de entrenamiento — lógica pura para el chart_type
 * `calendar` (feedback JC sep-2026).
 *
 * Entrada: buckets `daily` del adapter training_breakdown (cada uno con
 * `ymd` y `value: { strength, cardio }`). Salida: filas = semanas L→D
 * con un día por celda, más los totales del rango.
 *
 * Reglas de negocio (decididas, no ajustar sin hablarlo):
 *   - fuerza = día con ≥1 registro no-cardio; cardio = día con ≥1 cardio;
 *     descanso = día sin ningún registro.
 *   - Día con fuerza Y cardio cuenta en AMBOS totales, así la suma de los
 *     tres puede superar los días del rango. Es lo que JC quiere enseñar:
 *     el cómputo global aunque una semana haya ido mal.
 */

import type { BucketedPoint } from "./types";

export type TrainingDayKind = "strength" | "cardio" | "both" | "rest";

export interface TrainingCalendarDay {
  ymd: string;
  label: string;
  kind: TrainingDayKind;
}

export interface TrainingCalendar {
  /** Filas = semanas, 7 celdas L→D. `null` = fuera del rango. */
  weeks: Array<Array<TrainingCalendarDay | null>>;
  /** Días de cada clase en el rango (mixtos cuentan en fuerza y cardio). */
  totals: { strength: number; cardio: number; rest: number };
}

/** Lunes = 0 … Domingo = 6. */
function weekdayMondayFirst(ymd: string): number {
  return (new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7;
}

function dayKind(value: BucketedPoint["value"]): TrainingDayKind {
  if (typeof value !== "object" || value === null) return "rest";
  const strength = (value.strength ?? 0) > 0;
  const cardio = (value.cardio ?? 0) > 0;

  if (strength && cardio) return "both";
  if (strength) return "strength";
  if (cardio) return "cardio";

  return "rest";
}

export function buildTrainingCalendar(
  buckets: ReadonlyArray<BucketedPoint>
): TrainingCalendar {
  const totals = { strength: 0, cardio: 0, rest: 0 };
  const weeks: Array<Array<TrainingCalendarDay | null>> = [];
  let row: Array<TrainingCalendarDay | null> | null = null;

  for (const b of buckets) {
    if (b.ymd === undefined) continue; // no es un bucket daily
    const kind = dayKind(b.value);

    if (kind === "strength" || kind === "both") totals.strength += 1;
    if (kind === "cardio" || kind === "both") totals.cardio += 1;
    if (kind === "rest") totals.rest += 1;

    const col = weekdayMondayFirst(b.ymd);

    if (row === null || col === 0) {
      row = Array.from({ length: 7 }, () => null);
      weeks.push(row);
    }
    row[col] = { ymd: b.ymd, label: b.label, kind };
  }

  return { weeks, totals };
}

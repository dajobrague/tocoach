// Formateo y derivaciones de presentación de la rebanada "Progreso".
// Puro y sin React: la sección solo pinta lo que sale de acá.
//
// Todo en es-ES (coma decimal) y con una sola cifra decimal: un e1RM de
// 112,3157 kg no es más preciso que 112,3 — es solo más ruidoso.

import type { ProgressionPoint, ProgressionRepMax } from "./progreso-api";

/** 97.5 → "97,5" (sin unidad). */
export function formatKgValue(value: number): string {
  return value.toLocaleString("es-ES", { maximumFractionDigits: 1 });
}

/** 97.5 → "97,5 kg". */
export function formatKg(value: number): string {
  return `${formatKgValue(value)} kg`;
}

/** 12480 → "12.480" (volumen: los decimales no aportan nada). */
export function formatVolume(value: number): string {
  return Math.round(value).toLocaleString("es-ES");
}

/** "2026-07-14" → "14 jul 2026". */
export function formatLongDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "2026-07-14" → "14 jul" (etiqueta del eje X). */
export function formatTickDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

/** Bucket de reps a etiqueta: "12+" se muestra tal cual. */
export function repsLabel(bucket: string): string {
  return bucket === "12+" ? "12+" : bucket;
}

/** Días transcurridos entre dos fechas YYYY-MM-DD (0 si alguna no parsea). */
function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();

  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;

  return Math.round((b - a) / 86_400_000);
}

/** ¿La fecha cae dentro de los últimos `days` días? */
export function isRecent(date: string, days: number): boolean {
  const ts = new Date(`${date}T00:00:00`).getTime();

  if (!Number.isFinite(ts)) return false;

  return Date.now() - ts <= days * 86_400_000;
}

export interface Trend {
  /** Positivo = mejora. */
  deltaKg: number;
  /** "en 3 meses", "en 1 mes", "en 12 días". */
  spanLabel: string;
}

/**
 * Tendencia del e1RM contra el punto más cercano a "hace 3 meses" DENTRO de la
 * serie. Se etiqueta con el lapso REAL entre esos dos puntos (no con un "3
 * meses" fijo): si el cliente solo tiene 5 semanas de historia, decirle "en 3
 * meses" sería mentir. null cuando no hay dos puntos que comparar.
 */
export function computeTrend(series: ProgressionPoint[]): Trend | null {
  const last = series[series.length - 1];

  if (last === undefined || series.length < 2) return null;

  const targetDays = 90;
  let reference = series[0] as ProgressionPoint;
  let bestGap = Number.POSITIVE_INFINITY;

  // Se excluye el último punto: compararlo consigo mismo no es una tendencia.
  for (let i = 0; i < series.length - 1; i += 1) {
    const point = series[i];

    if (point === undefined) continue;
    const gap = Math.abs(daysBetween(point.date, last.date) - targetDays);

    if (gap < bestGap) {
      bestGap = gap;
      reference = point;
    }
  }

  const span = daysBetween(reference.date, last.date);

  if (span <= 0) return null;

  const deltaKg = last.e1rm - reference.e1rm;

  // Un delta que redondea a "0,0 kg" no es una tendencia; mejor no decir nada
  // que anunciar "↑ +0 kg".
  if (Math.abs(deltaKg) < 0.05) return null;

  const months = Math.round(span / 30.44);
  const spanLabel =
    span >= 60
      ? `en ${months} meses`
      : span >= 30
        ? "en 1 mes"
        : `en ${span} ${span === 1 ? "día" : "días"}`;

  return { deltaKg, spanLabel };
}

/** Récord con el e1RM más alto — la "mejor serie" de todo el historial. */
export function bestRepMax(
  repMaxes: ProgressionRepMax[]
): ProgressionRepMax | null {
  let best: ProgressionRepMax | null = null;

  for (const record of repMaxes) {
    if (best === null || record.e1rm > best.e1rm) best = record;
  }

  return best;
}

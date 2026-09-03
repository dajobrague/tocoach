/**
 * Calendar renderer — entrenamiento como calendario de puntos.
 *
 * Multi-dim, solo `training_breakdown`, siempre buckets daily. Filas =
 * semanas (L→D), un punto por día: fuerza (serie 0), cardio (serie 1),
 * descanso (gris) y fuerza+cardio como punto partido medio/medio. Bajo
 * la grilla, los totales del rango (los mixtos cuentan doble — ver
 * lib/charts/calendar.ts).
 *
 * La densidad se adapta sola al rango: el punto encoge con el número de
 * filas (7d = 1 fila grande; 12m = 52 filas diminutas). Sin navegación
 * mes a mes — JC la descartó; manda el selector de rango.
 */

"use client";

import type { BucketedPoint, ColorToken } from "@/lib/charts/types";

import { useMemo } from "react";

import {
  buildTrainingCalendar,
  type TrainingDayKind,
} from "@/lib/charts/calendar";
import { resolveColor } from "@/lib/charts/palette";

interface SeriesSpec {
  id: string;
  label: string;
}

interface Props {
  buckets: BucketedPoint[];
  /** [fuerza, cardio] — mismo orden que `series` del adapter. */
  colors: ColorToken[];
  series: ReadonlyArray<SeriesSpec>;
}

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

export function CalendarRenderer({ buckets, colors, series }: Props) {
  const cal = useMemo(() => buildTrainingCalendar(buckets), [buckets]);
  const strength = resolveColor(colors[0] ?? "training-blue");
  const cardio = resolveColor(colors[1] ?? "cardio-rose");
  const strengthLabel = series[0]?.label ?? "Fuerza";
  const cardioLabel = series[1]?.label ?? "Cardio";

  // Punto entre 5px (12m, 52 filas) y 22px (7d, 1-2 filas); la grilla
  // completa se queda en ~200px de alto sea cual sea el rango.
  const rows = Math.max(1, cal.weeks.length);
  const dot = Math.max(5, Math.min(22, Math.floor(200 / rows) - 2));
  const gap = dot >= 12 ? 6 : 2;
  const hasMixed = cal.weeks.some((w) => w.some((d) => d?.kind === "both"));

  const background = (kind: TrainingDayKind): string | undefined => {
    if (kind === "strength") return strength.stroke;
    if (kind === "cardio") return cardio.stroke;
    if (kind === "both") {
      return `linear-gradient(90deg, ${strength.stroke} 50%, ${cardio.stroke} 50%)`;
    }

    return undefined; // rest → clase bg-default-200
  };
  const kindLabel = (kind: TrainingDayKind): string =>
    kind === "strength"
      ? strengthLabel
      : kind === "cardio"
        ? cardioLabel
        : kind === "both"
          ? `${strengthLabel} + ${cardioLabel}`
          : "Descanso";

  return (
    <div className="mt-1">
      <div className="grid grid-cols-7 text-center text-[9px] font-medium text-foreground/40 mb-1">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="flex flex-col" style={{ gap }}>
        {cal.weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 justify-items-center">
            {week.map((day, di) =>
              day ? (
                <span
                  key={di}
                  className={`rounded-full ${day.kind === "rest" ? "bg-default-200" : ""}`}
                  style={{
                    width: dot,
                    height: dot,
                    background: background(day.kind),
                  }}
                  title={`${day.label} · ${kindLabel(day.kind)}`}
                />
              ) : (
                <span key={di} style={{ width: dot, height: dot }} />
              )
            )}
          </div>
        ))}
      </div>

      {/* Leyenda + totales del rango. Los mixtos cuentan en fuerza Y
          cardio, así que la suma puede superar los días del rango. */}
      <div className="flex items-start justify-center gap-5 mt-3 flex-wrap">
        <LegendStat
          color={strength.stroke}
          count={cal.totals.strength}
          label={strengthLabel}
        />
        <LegendStat
          color={cardio.stroke}
          count={cal.totals.cardio}
          label={cardioLabel}
        />
        <LegendStat count={cal.totals.rest} label="Descanso" />
      </div>
      {hasMixed ? (
        <p className="flex items-center justify-center gap-1.5 mt-2 text-[10px] text-foreground/40">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: background("both") }}
          />
          {strengthLabel} + {cardioLabel} el mismo día (cuenta en ambos)
        </p>
      ) : null}
    </div>
  );
}

function LegendStat({
  color,
  count,
  label,
}: {
  color?: string;
  count: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2.5 h-2.5 rounded-full ${color ? "" : "bg-default-200"}`}
          style={color ? { backgroundColor: color } : undefined}
        />
        <span className="text-[10px] text-foreground/50">{label}</span>
      </div>
      <span className="text-sm font-bold tabular-nums text-foreground">
        {count}
        <span className="text-[10px] font-normal text-foreground/40 ml-1">
          {count === 1 ? "día" : "días"}
        </span>
      </span>
    </div>
  );
}

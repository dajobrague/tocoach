// Geometría de la "firma" de la sesión (diseño D, 7 oct): una barra por
// serie, agrupadas por ejercicio. Altura = carga de la serie (kg × reps); el
// cardio es un tramo de barras bajas. Puro, para poder probarlo sin Satori.

import type { ShareCardSignatureGroup } from "@/lib/training/share-card-stats";

export interface SignatureBar {
  x: number;
  width: number;
  /** 0–1 de la altura disponible. */
  height: number;
  record: boolean;
  cardio: boolean;
}

// Espacio entre barras y entre ejercicios, en anchos de barra.
const BAR_GAP = 0.6;
const GROUP_GAP = 2.4;
const MAX_BAR = 40;

export function layoutSignature(
  groups: ShareCardSignatureGroup[],
  width: number
): SignatureBar[] {
  const columns: PendingBar[][] = groups.map((group) =>
    group.kind === "cardio"
      ? // Un tramo de 6–14 barras según los minutos.
        Array.from(
          { length: Math.min(14, Math.max(6, Math.round(group.minutes / 2))) },
          (_, i) => ({
            height: 0.34 + 0.07 * Math.sin(i * 1.3),
            record: false,
            cardio: true,
          })
        )
      : strengthHeights(group.sets)
  );
  const maxLoad = Math.max(
    1,
    ...groups.flatMap((group) =>
      group.kind === "strength"
        ? group.sets.map((set) => set.weightKg * set.reps)
        : []
    )
  );
  const bars = columns.flat();

  if (bars.length === 0) return [];

  // Las alturas de fuerza son relativas a la serie más cargada de la sesión.
  for (const bar of bars) {
    if (bar.load !== undefined)
      bar.height = 0.16 + 0.84 * Math.sqrt(bar.load / maxLoad);
  }

  const gaps =
    (bars.length - columns.length) * BAR_GAP + (columns.length - 1) * GROUP_GAP;
  const barWidth = Math.min(MAX_BAR, width / (bars.length + gaps));
  const out: SignatureBar[] = [];
  let x = 0;

  columns.forEach((column, c) => {
    column.forEach((bar, i) => {
      out.push({
        x,
        width: barWidth,
        height: bar.height,
        record: bar.record,
        cardio: bar.cardio,
      });
      x += barWidth * (i < column.length - 1 ? 1 + BAR_GAP : 1);
    });
    if (c < columns.length - 1) x += barWidth * GROUP_GAP;
  });

  return out;
}

type PendingBar = {
  height: number;
  record: boolean;
  cardio: boolean;
  load?: number;
};

function strengthHeights(
  sets: Extract<ShareCardSignatureGroup, { kind: "strength" }>["sets"]
): PendingBar[] {
  // Sin peso en todo el ejercicio (dominadas, plancha…): altura por reps
  // dentro del propio ejercicio, para que no salgan todas al mínimo.
  // ponytail: escala aparte de las cargas; unificar si hay peso corporal real.
  if (sets.every((set) => set.weightKg === 0)) {
    const maxReps = Math.max(1, ...sets.map((set) => set.reps));

    return sets.map((set) => ({
      height: 0.16 + 0.44 * (set.reps / maxReps),
      record: set.record,
      cardio: false,
    }));
  }

  return sets.map((set) => ({
    height: 0,
    load: set.weightKg * set.reps,
    record: set.record,
    cardio: false,
  }));
}

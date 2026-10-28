// Mapa muscular para la tarjeta: los mismos trazos que MuscleMap, pero con
// colores explícitos (un SVG exportado a PNG no ve las clases de Tailwind)
// e intensidad por músculo en vez de principal/secundario.

import type { MuscleId } from "@/lib/training/muscles";

import { MUSCLE_MAP } from "@/lib/training/muscle-map-data";

export type MapMode = "auto" | "both" | "none";

type View = "front" | "back";

const ASPECT = 650 / 1272; // ancho/alto de cada vista en MUSCLE_MAP

/** Vistas a pintar: "auto" enseña solo el lado trabajado. */
export function figureViews(
  heat: Partial<Record<MuscleId, number>>,
  mode: MapMode
): View[] {
  if (mode === "none") return [];
  const worked = (view: View) =>
    MUSCLE_MAP[view].segments.some((segment) => (heat[segment.m] ?? 0) > 0);
  const front = worked("front");
  const back = worked("back");

  if (mode === "both" || front === back) return ["front", "back"];

  return front ? ["front"] : ["back"];
}

/** Alto que ocupa la figura con un ancho dado. */
export function figureHeight(views: View[], width: number): number {
  if (views.length === 0) return 0;
  const gap = views.length > 1 ? width * 0.08 : 0;
  const each = (width - gap) / views.length;

  return each / ASPECT;
}

export function BodyFigure({
  id,
  views,
  heat,
  x,
  y,
  width,
  ink,
  accent,
}: {
  /** Prefijo único para los clipPath (varias tarjetas en la página). */
  id: string;
  views: View[];
  heat: Partial<Record<MuscleId, number>>;
  x: number;
  y: number;
  width: number;
  ink: string;
  accent: string;
}) {
  const gap = views.length > 1 ? width * 0.08 : 0;
  const each = (width - gap) / views.length;
  const height = each / ASPECT;

  return (
    <g>
      {views.map((view, index) => {
        const data = MUSCLE_MAP[view];

        return (
          <svg
            key={view}
            height={height}
            viewBox={data.viewBox}
            width={each}
            x={x + index * (each + gap)}
            y={y}
          >
            <defs>
              {data.segments.map((segment, key) =>
                segment.clip ? (
                  <clipPath key={key} id={`${id}-${view}-${key}`}>
                    <polygon points={segment.clip} />
                  </clipPath>
                ) : null
              )}
            </defs>
            {data.base.map((d, i) => (
              <path key={i} d={d} fill={ink} fillOpacity={0.1} />
            ))}
            {data.segments
              .map((segment, key) => ({ segment, key }))
              .filter(({ segment }) => (heat[segment.m] ?? 0) > 0)
              // Lo más trabajado encima donde las zonas se pisan.
              .sort(
                (a, b) => (heat[a.segment.m] ?? 0) - (heat[b.segment.m] ?? 0)
              )
              .map(({ segment, key }) => (
                <path
                  key={key}
                  clipPath={
                    segment.clip ? `url(#${id}-${view}-${key})` : undefined
                  }
                  d={data.base[segment.i]}
                  fill={accent}
                  fillOpacity={0.35 + 0.65 * (heat[segment.m] ?? 0)}
                />
              ))}
            <path
              d={data.outline}
              fill="none"
              stroke={ink}
              strokeOpacity={0.45}
              strokeWidth={3}
            />
          </svg>
        );
      })}
    </g>
  );
}

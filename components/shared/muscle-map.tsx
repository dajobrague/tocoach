"use client";

import type { MuscleId } from "@/lib/training/muscles";

import {
  MUSCLE_MAP,
  type MuscleMapSegment,
} from "@/lib/training/muscle-map-data";

interface MuscleMapProps {
  primary: readonly MuscleId[];
  secondary: readonly MuscleId[];
  /** Makes visible muscles tappable (deep ones are only pickable from a list). */
  onToggle?: (id: MuscleId) => void;
  /** Muscle under the pointer, for a caller-side label. */
  onHover?: (id: MuscleId | null) => void;
  /** Lightly marks one muscle, e.g. the chip being hovered. */
  highlight?: MuscleId | null;
  /** "Frente" / "Espalda" captions; off for thumbnails. */
  labels?: boolean;
  /** Silhouette outline in screen pixels; thinner for small thumbnails. */
  outlineWidth?: number;
  className?: string;
}

const VIEWS = [
  ["front", "Frente"],
  ["back", "Espalda"],
] as const;

/**
 * Front and back body with worked muscles in the theme's primary color:
 * solid for primary, light for secondary. Pure SVG so it also renders on
 * the server and inside the share card.
 */
export function MuscleMap({
  primary,
  secondary,
  onToggle,
  onHover,
  highlight = null,
  labels = true,
  outlineWidth = 2,
  className = "",
}: MuscleMapProps) {
  const rank = (segment: MuscleMapSegment) =>
    primary.includes(segment.m) ? 2 : secondary.includes(segment.m) ? 1 : 0;

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {VIEWS.map(([view, label]) => {
        const data = MUSCLE_MAP[view];
        // Primary paints last where zones overlap (deep muscles over their cover).
        const segments = data.segments
          .map((segment, key) => ({ segment, key }))
          .sort((a, b) => rank(a.segment) - rank(b.segment));

        return (
          <figure key={view} className="m-0 flex flex-col items-center gap-1">
            <svg
              aria-label={`Cuerpo de ${label.toLowerCase()}`}
              className="h-auto w-full"
              role="img"
              viewBox={data.viewBox}
            >
              <defs>
                {data.segments.map((segment, key) =>
                  segment.clip ? (
                    <clipPath key={key} id={`mm-${view}-${key}`}>
                      <polygon points={segment.clip} />
                    </clipPath>
                  ) : null
                )}
              </defs>
              {data.base.map((d, i) => (
                <path key={i} className="fill-default-200" d={d} />
              ))}
              {segments.map(({ segment, key }) => {
                const level = rank(segment);
                const hinted = level === 0 && highlight === segment.m;
                const interactive = onToggle !== undefined && !segment.deep;

                return (
                  <path
                    key={key}
                    className={`fill-primary transition-[fill-opacity] duration-150 ${
                      interactive ? "cursor-pointer" : "pointer-events-none"
                    }`}
                    clipPath={
                      segment.clip ? `url(#mm-${view}-${key})` : undefined
                    }
                    d={data.base[segment.i]}
                    fillOpacity={
                      level === 2 ? 1 : level === 1 ? 0.38 : hinted ? 0.16 : 0
                    }
                    onClick={
                      interactive ? () => onToggle(segment.m) : undefined
                    }
                    onPointerEnter={
                      interactive && onHover
                        ? () => onHover(segment.m)
                        : undefined
                    }
                    onPointerLeave={
                      interactive && onHover ? () => onHover(null) : undefined
                    }
                  />
                );
              })}
              <path
                className="fill-none stroke-default-400"
                d={data.outline}
                strokeWidth={outlineWidth}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {labels && (
              <figcaption className="text-[11px] font-semibold uppercase tracking-wider text-default-500">
                {label}
              </figcaption>
            )}
          </figure>
        );
      })}
    </div>
  );
}

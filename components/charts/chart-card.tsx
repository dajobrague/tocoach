/**
 * <ChartCard>
 *
 * The wrapping card that <ChartSurface> repeats per chart in the grid.
 * Owns the visible header (label, current value, icon) and dispatches to
 * one of three states: skeleton (loading), orphan (deleted source), or the
 * rendered chart. When the rendered chart has no data we keep the chart
 * silhouette visible and overlay a "Sin datos aún" watermark on top —
 * never collapse to a blank card.
 *
 * Inputs:
 *   config       — the ChartConfig (label, source, chart_type, color, …)
 *   buckets      — undefined while loading; an array (possibly empty) once loaded
 *   orphan       — true when the source can't be resolved (form question deleted)
 *   icon         — overrides the icon shown in the header (catalog adapter
 *                  metadata.icon); falls back to `iconForChartType(config.chart_type)`
 *   unit         — optional unit suffix (from the resolved adapter)
 *   series       — multi-dim adapter series list (required for stacked_bar/ring)
 *   editable     — when true, mounts the edit overlay children (rendered above
 *                  the card body). Phase 5 wires this up.
 *   editOverlay  — the edit-overlay node (pencil/up/down/delete buttons)
 */

"use client";

import type {
  BucketedPoint,
  ChartConfig,
  PhotoPoint,
} from "@/lib/charts/types";

import { Icon } from "@iconify/react";
import { Card, CardBody } from "@heroui/react";
import { useMemo } from "react";

import { ChartErrorBoundary } from "./error-boundary";
import { ChartRenderer } from "./chart-renderer";
import { PhotoTimelineRenderer } from "./renderers/photo-timeline";
import { headerStatValue, type HeaderStatMode } from "./header-stat";
import { useHeaderStatPref } from "./use-header-stat-pref";
import { iconForChartType, isBucketsEmpty, formatNumber } from "./utils";

import { IconTile } from "@/components/shared/icon-tile";
import { sentenceCaseIfShouting } from "@/lib/utils";
import { RATING_MAX } from "@/lib/forms/types";
import { resolveColor } from "@/lib/charts/palette";

interface Props {
  config: ChartConfig;
  buckets: BucketedPoint[] | undefined;
  /**
   * Photo timeline payload — set when `config.chart_type === "photo_timeline"`.
   * `undefined` means loading; an empty array means "no photos in range".
   */
  photos?: ReadonlyArray<PhotoPoint>;
  orphan?: boolean;
  icon?: string;
  unit?: string;
  /** Forwarded to the renderer; comes from adapter.metadata.y_max. */
  yMax?: number;
  /** Valoración 1–RATING_MAX (adapter.metadata.rating): estrellas en el header. */
  rating?: boolean;
  series?: ReadonlyArray<{ id: string; label: string }>;
  editable?: boolean;
  editOverlay?: React.ReactNode;
  /**
   * "client" = look del portal del cliente (tile de marca, toggle en la
   * cabecera, número en la fuente de títulos + pie "Media de …"). Opt-in:
   * el trainer (chart-surface) sigue con el look por defecto.
   */
  variant?: "default" | "client";
  /** Solo variant="client": período visible para el pie ("7 días"). */
  periodLabel?: string;
}

function CardSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-3 w-1/2 bg-default-100 rounded animate-pulse" />
      <div className="h-8 w-1/3 bg-default-100 rounded animate-pulse" />
      <div className="h-[140px] w-full bg-default-100 rounded animate-pulse" />
    </div>
  );
}

function NoDataOverlay() {
  // Sits absolutely on top of the rendered chart silhouette (axes + grid)
  // when all values are null/0, so the user sees the chart shape with a
  // "no hay datos aún" hint instead of a fully empty box.
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none rounded-md bg-content1/55 backdrop-blur-[1px]">
      <Icon
        className="text-foreground/30"
        icon="solar:chart-2-linear"
        width={26}
      />
      <p className="text-[11px] font-medium text-default-500">Sin datos aún</p>
    </div>
  );
}

/**
 * Toggle Media/Último junto al número grande. Es preferencia del
 * ESPECTADOR (cliente o trainer), por gráfica, vía useHeaderStatPref —
 * no config del trainer. Media va primero: es lo que se consulta a
 * diario; Último es para consultas puntuales (JC, sep-2026).
 */
function HeaderStatToggle({
  mode,
  onChange,
  client = false,
}: {
  mode: HeaderStatMode;
  onChange: (mode: HeaderStatMode) => void;
  client?: boolean;
}) {
  const segment = (target: HeaderStatMode, label: string) => (
    <button
      aria-pressed={mode === target}
      className={`${
        client
          ? "h-[26px] px-2.5 rounded-[7px] active:scale-[0.97] motion-reduce:active:scale-100"
          : "px-1.5 py-0.5 rounded-md"
      } transition-colors ${
        mode === target
          ? "bg-content1 text-foreground shadow-sm"
          : client
            ? "text-default-500"
            : "text-foreground/45"
      }`}
      type="button"
      onClick={() => onChange(target)}
    >
      {label}
    </button>
  );

  return (
    <div
      aria-label="Valor mostrado"
      className={
        client
          ? "flex items-center rounded-[9px] bg-default-100 p-0.5 text-xs font-semibold flex-shrink-0"
          : "flex items-center rounded-lg bg-default-100 p-0.5 text-[10px] font-medium flex-shrink-0 mb-1"
      }
      role="group"
    >
      {segment("average", "Media")}
      {segment("latest", "Último")}
    </div>
  );
}

/**
 * Valoración 1–RATING_MAX con las MISMAS estrellas que el formulario del
 * cliente (dynamic-form-modal: `solar:star-bold`, warning = llena,
 * default-300 = vacía). El valor exacto va al lado porque una media de
 * 3,6 y una de 4,4 redondean a la misma estrella.
 */
function RatingStars({ value, muted }: { value: number; muted: boolean }) {
  const filled = Math.round(Math.max(0, Math.min(RATING_MAX, value)));

  return (
    <span
      aria-label={`${formatNumber(value, 1)} de ${RATING_MAX}`}
      className="inline-flex items-center gap-1.5"
      role="img"
    >
      <span className="flex items-center">
        {Array.from({ length: RATING_MAX }, (_, i) => (
          <Icon
            key={i}
            className={`text-2xl ${
              i < filled
                ? muted
                  ? "text-warning/40"
                  : "text-warning"
                : "text-default-300"
            }`}
            icon="solar:star-bold"
          />
        ))}
      </span>
      <span className="text-base text-foreground/40 font-medium tabular-nums">
        {formatNumber(value, 1)}
      </span>
    </span>
  );
}

function CardOrphan() {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-foreground/40">
      <Icon icon="solar:close-circle-bold" width={28} />
      <p className="text-xs font-medium">Esta pregunta ya no existe</p>
      <p className="text-[10px] text-foreground/30">
        Edita la gráfica para elegir otra fuente
      </p>
    </div>
  );
}

export function ChartCard({
  config,
  buckets,
  photos,
  orphan,
  icon,
  unit,
  yMax,
  rating,
  series,
  editable,
  editOverlay,
  variant = "default",
  periodLabel,
}: Props) {
  const isClient = variant === "client";
  const isPhotoTimeline = config.chart_type === "photo_timeline";
  // Los charts 1-D (line/area/bar) llevan el toggle Último/Media del
  // header — ring/stacked/kpi tienen su propia semántica de valor.
  const hasStatToggle =
    config.chart_type === "line" ||
    config.chart_type === "area" ||
    config.chart_type === "bar";
  const [statMode, setStatMode] = useHeaderStatPref(config.id);
  // Unidad y rating vienen de la metadata de la fuente (form_templates),
  // resuelta por chart-surface / charts-section. Nada se adivina por id.
  const displayUnit = unit;
  const isRating = rating === true;
  // The header's stat is viewer-selectable for 1-D charts (latest non-null
  // or the range mean — same avgNonNull as the dashed reference line);
  // ring (range_total) shows the sum of its series; kpi shows nothing in
  // the header (the body is already the big number).
  const headerValue = useMemo(() => {
    if (!buckets || buckets.length === 0) return null;
    if (config.chart_type === "ring") {
      const b = buckets[0];

      if (b && typeof b.value === "object" && b.value !== null) {
        let total = 0;

        for (const v of Object.values(
          b.value as Record<string, number | null | undefined>
        )) {
          if (typeof v === "number") total += v;
        }

        return total === 0 ? null : Math.round(total);
      }

      return null;
    }
    if (
      config.chart_type === "stacked_bar" ||
      config.chart_type === "kpi" ||
      config.chart_type === "calendar"
    ) {
      return null;
    }

    return headerStatValue(buckets, statMode);
  }, [buckets, config.chart_type, statMode]);

  // Header icon: prefer an explicit metadata icon, fall back to the chart-type one.
  const resolvedIcon = icon ?? iconForChartType(config.chart_type);
  // Fallback a `neutral-slate` si el array está vacío (config corrupta
  // del trainer). Antes era `[0]!` que puede dar undefined en runtime
  // y crashear `resolveColor` — ahora degrada gracefully al gris neutro.
  const colorToken = Array.isArray(config.color)
    ? (config.color[0] ?? "neutral-slate")
    : config.color;
  const palette = resolveColor(colorToken);

  // Photo timeline has its own loading/empty path — the renderer shows
  // an "Aún sin fotos" placeholder. For numeric charts the chart still
  // renders its silhouette (axes/grid) when empty, with a NoDataOverlay
  // watermark.
  const isLoading = isPhotoTimeline
    ? photos === undefined
    : buckets === undefined;
  const noData =
    !isPhotoTimeline &&
    !isLoading &&
    !orphan &&
    Array.isArray(buckets) &&
    isBucketsEmpty(buckets);

  const showStatToggle = hasStatToggle && !isLoading && !orphan && !noData;
  const hasValueRow =
    config.chart_type !== "kpi" &&
    config.chart_type !== "calendar" &&
    !isPhotoTimeline;
  const valueText =
    headerValue === null
      ? isLoading
        ? ""
        : "—"
      : formatNumber(headerValue, headerValue >= 100 ? 0 : 1);

  // State branches.
  // We intentionally render the chart silhouette even when there is
  // no data — Recharts draws axes + grid for null values, and the
  // ring/kpi renderers have their own empty-state visuals. The
  // watermark sits on top via <NoDataOverlay /> so the card never
  // collapses to "blank". Photo timeline dispatches to its own
  // renderer which handles its own empty state.
  const body = orphan ? (
    <CardOrphan />
  ) : isLoading ? (
    <CardSkeleton />
  ) : isPhotoTimeline ? (
    <ChartErrorBoundary chartId={config.id}>
      <PhotoTimelineRenderer photos={photos ?? []} />
    </ChartErrorBoundary>
  ) : (
    <div className="relative">
      <ChartErrorBoundary chartId={config.id}>
        <ChartRenderer
          buckets={buckets!}
          config={config}
          ink={isClient}
          {...(series !== undefined ? { series } : {})}
          {...(yMax !== undefined
            ? { yMax }
            : isRating
              ? { yMax: RATING_MAX }
              : {})}
        />
      </ChartErrorBoundary>
      {noData ? <NoDataOverlay /> : null}
    </div>
  );

  if (isClient) {
    const caption =
      showStatToggle && headerValue !== null
        ? statMode === "average"
          ? periodLabel
            ? `Media de ${periodLabel}`
            : "Media del período"
          : "Último registro"
        : null;

    return (
      <div className="relative rounded-large bg-content1 p-4 shadow-small">
        <div className="flex min-h-8 items-center gap-2.5">
          <IconTile
            className="!h-8 !w-8 !rounded-[10px]"
            icon={resolvedIcon}
            size="sm"
          />
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">
            {sentenceCaseIfShouting(config.label)}
          </p>
          {showStatToggle ? (
            <HeaderStatToggle client mode={statMode} onChange={setStatMode} />
          ) : null}
        </div>
        {hasValueRow ? (
          <div className="mt-3.5">
            {headerValue !== null && isRating ? (
              <RatingStars muted={noData} value={headerValue} />
            ) : (
              <p className="flex items-baseline gap-1.5">
                <span
                  className={`font-heading text-[34px] leading-none tracking-[-0.02em] tabular-nums ${
                    noData ? "text-foreground/30" : "text-foreground"
                  }`}
                >
                  {valueText}
                </span>
                {headerValue !== null && displayUnit ? (
                  <span className="text-base font-semibold text-default-500">
                    {displayUnit}
                  </span>
                ) : null}
              </p>
            )}
            {caption ? (
              <p className="mt-1 text-[13px] text-default-500">{caption}</p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-3">{body}</div>
      </div>
    );
  }

  return (
    <Card className="relative" radius="lg" shadow="sm">
      <CardBody>
        {/* Header: icon (left) + label + current value below. Edit overlay
            sits to the right of the label, separate from the metric icon. */}
        <div className="flex items-center justify-between mb-1 gap-2 min-h-[28px]">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="p-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: palette.soft }}
            >
              <Icon
                icon={resolvedIcon}
                style={{ color: palette.stroke }}
                width={16}
              />
            </div>
            <p className="text-sm font-medium text-foreground truncate">
              {config.label}
            </p>
            {config.visibility === "trainer_only" ? (
              // Solo se ve en la vista del trainer: el server filtra estos
              // charts antes de enviárselos al cliente, así que renderizar
              // este badge incondicionalmente no fuga nada — si el chart
              // está en pantalla, el caller es trainer.
              <span
                className="flex items-center gap-0.5 text-[9px] uppercase tracking-wider text-foreground/55 bg-default-100 px-1.5 py-0.5 rounded flex-shrink-0"
                title="Solo visible para ti"
              >
                <Icon icon="solar:lock-bold" width={9} />
                Privado
              </span>
            ) : null}
          </div>
          {editable && editOverlay ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              {editOverlay}
            </div>
          ) : null}
        </div>
        {/* calendar lleva sus totales bajo la grilla; el número grande
            sobra ahí. */}
        {hasValueRow ? (
          <div className="flex items-end justify-between gap-2 mb-3">
            {headerValue !== null && isRating ? (
              <RatingStars muted={noData} value={headerValue} />
            ) : (
              <p
                className={`text-4xl font-bold tabular-nums ${
                  noData ? "text-foreground/30" : "text-foreground"
                }`}
              >
                {valueText}
                {headerValue !== null && displayUnit ? (
                  <span className="text-base text-foreground/40 ml-1 font-medium">
                    {displayUnit}
                  </span>
                ) : null}
              </p>
            )}
            {showStatToggle ? (
              <HeaderStatToggle mode={statMode} onChange={setStatMode} />
            ) : null}
          </div>
        ) : null}

        {body}
      </CardBody>
    </Card>
  );
}

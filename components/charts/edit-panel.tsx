/**
 * <ChartEditPanel>
 *
 * Slide-in panel that edits a single ChartConfig. Mounts to the right
 * (Drawer) on desktop, bottom-sheet style on mobile. All "Rich tier"
 * controls are inline here:
 *   - data-source picker (catalog + numeric form questions)
 *   - label
 *   - chart-type pills (validates against source.dimensions)
 *   - color picker (palette tokens)
 *   - target-zone editor (line/area/bar only)
 *   - aggregation picker (ring forces range_total)
 *   - average-line toggle (line/area/bar only)
 *
 * Edits are pushed back to the surface via `onChange` immediately;
 * the surface owns autosave semantics.
 */

"use client";

import type {
  Aggregation,
  ChartConfig,
  ChartDataSource,
  ChartType,
  ColorToken,
  DataSourceRef,
} from "@/lib/charts/types";

import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Input,
  Select,
  SelectItem,
  Switch,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo } from "react";

import { COLOR_TOKENS, resolveColor } from "@/lib/charts/palette";
import { parseFormQuestionAdapterId } from "@/lib/charts/adapters/form-question";

const CHART_TYPES: {
  id: ChartType;
  label: string;
  icon: string;
  multi: boolean;
}[] = [
  { id: "line", label: "Línea", icon: "solar:chart-bold", multi: false },
  { id: "area", label: "Área", icon: "solar:chart-bold", multi: false },
  { id: "bar", label: "Barras", icon: "solar:chart-square-bold", multi: false },
  {
    id: "stacked_bar",
    label: "Apiladas",
    icon: "solar:chart-square-bold",
    multi: true,
  },
  { id: "ring", label: "Anillo", icon: "solar:chart-2-bold", multi: true },
  { id: "kpi", label: "Número", icon: "solar:hashtag-bold", multi: false },
];

// Mantenemos paridad 1:1 con el `Aggregation` type union de
// lib/charts/types.ts. biweekly y monthly se añadieron primero como
// runtime overrides (snapshot endpoint las inyecta para 6m/12m sin
// que el trainer las elija), pero las exponemos también acá por dos
// razones: (1) el trainer puede elegirlas explícitamente si quiere
// fijar un chart de "tendencia bi-mensual" sin depender del rango;
// (2) si una migración o el sistema guarda un chart con esas
// aggregations, el dropdown debe poder mostrarlas correctamente y no
// caer al primer item silenciosamente al renderizar `selectedKeys`
// con un valor que el Select no conoce.
const AGGREGATIONS: { id: Aggregation; label: string }[] = [
  { id: "daily", label: "Diaria" },
  { id: "weekly", label: "Semanal" },
  { id: "biweekly", label: "Cada 2 semanas" },
  { id: "monthly", label: "Mensual" },
  { id: "checkin_period", label: "Por check-in" },
  { id: "range_total", label: "Total del rango" },
];

interface Props {
  isOpen: boolean;
  config: ChartConfig | null;
  sources: ChartDataSource[];
  saveState: "idle" | "saving" | "saved" | "error";
  onChange: (next: ChartConfig) => void;
  onClose: () => void;
  /** "Discard" reverts the local edits to the last saved version. */
  onDiscard?: () => void;
}

function dataSourceRefKey(ref: DataSourceRef): string {
  if (ref.kind === "catalog") return `catalog:${ref.id}`;

  return `form_q:${ref.form_type}:${ref.question_id}`;
}

function adapterKey(source: ChartDataSource): string {
  // For form-question sources, the id already encodes form_type and is
  // identical to what `dataSourceRefKey` produces for the corresponding
  // DataSourceRef — no reconstruction needed. Catalog ids get the prefix
  // here so the two namespaces don't collide in the Select.
  if (source.id.startsWith("form_q:")) return source.id;

  return `catalog:${source.id}`;
}

function refFromAdapter(source: ChartDataSource): DataSourceRef {
  if (source.id.startsWith("form_q:")) {
    const parsed = parseFormQuestionAdapterId(source.id);

    if (!parsed) {
      // Defensive — the data-sources endpoint should never emit malformed
      // ids. Falling back to a catalog ref would silently swap source kind,
      // so throw instead so the UI surfaces it loudly.
      throw new Error(`Malformed form-question adapter id: ${source.id}`);
    }

    return {
      kind: "form_question",
      form_type: parsed.formType,
      question_id: parsed.questionId,
    };
  }

  return {
    kind: "catalog",
    id: source.id as ChartConfig["source"] extends infer S
      ? S extends { kind: "catalog"; id: infer I }
        ? I
        : never
      : never,
  };
}

export function ChartEditPanel({
  isOpen,
  config,
  sources,
  saveState,
  onChange,
  onClose,
  onDiscard,
}: Props) {
  // Find the resolved adapter for the current config (for series count, unit, etc.)
  const currentSource = useMemo(() => {
    if (!config) return undefined;
    const key = dataSourceRefKey(config.source);

    return sources.find((s) => adapterKey(s) === key);
  }, [config, sources]);

  if (!config) return null;

  const isMulti = currentSource?.dimensions === "multi";

  const update = (patch: Partial<ChartConfig>): void => {
    onChange({ ...config, ...patch });
  };

  const handleSourceChange = (newKey: string): void => {
    const newSource = sources.find((s) => adapterKey(s) === newKey);

    if (!newSource) return;
    const ref = refFromAdapter(newSource);
    // When switching dimensionality, normalize chart_type + color.
    const wantsMulti = newSource.dimensions === "multi";
    const newChartType: ChartType = wantsMulti
      ? newSource.default_chart_type === "ring" ||
        newSource.default_chart_type === "stacked_bar"
        ? newSource.default_chart_type
        : "stacked_bar"
      : newSource.default_chart_type === "ring" ||
          newSource.default_chart_type === "stacked_bar"
        ? "area"
        : newSource.default_chart_type;
    const newColor = newSource.default_color;
    const newAggregation: Aggregation =
      newChartType === "ring" ? "range_total" : config.aggregation;

    // Drop target_zone / show_average_line on the multi-dim path by
    // destructuring them out of the spread (omit-key semantics under
    // exactOptionalPropertyTypes).
    if (wantsMulti) {
      const { target_zone: _tz, show_average_line: _avg, ...rest } = config;

      void _tz;
      void _avg;
      onChange({
        ...rest,
        source: ref,
        chart_type: newChartType,
        color: newColor,
        aggregation: newAggregation,
        label: config.label || newSource.label.toUpperCase(),
      });

      return;
    }
    onChange({
      ...config,
      source: ref,
      chart_type: newChartType,
      color: newColor,
      aggregation: newAggregation,
      label: config.label || newSource.label.toUpperCase(),
    });
  };

  const handleChartTypeChange = (next: ChartType): void => {
    const nextWantsMulti = next === "ring" || next === "stacked_bar";

    if (nextWantsMulti && !isMulti) return; // disabled — should be visually
    if (!nextWantsMulti && isMulti) return;

    // Aggregation reset rules:
    //   - ring REQUIRES range_total
    //   - kpi tolerates any aggregation
    //   - everything else requires a time-bucketed aggregation, so any
    //     "range_total" carry-over from a previous chart_type must be
    //     reset to "checkin_period". This was the bug that caused 422s
    //     when switching ring → stacked_bar.
    const nextAggregation: Aggregation =
      next === "ring"
        ? "range_total"
        : config.aggregation === "range_total" && next !== "kpi"
          ? "checkin_period"
          : config.aggregation;

    const nextColor: ColorToken | ColorToken[] = nextWantsMulti
      ? Array.isArray(config.color)
        ? config.color
        : ((currentSource?.default_color as ColorToken[]) ?? [])
      : Array.isArray(config.color)
        ? ((currentSource?.default_color as ColorToken) ?? config.color[0]!)
        : config.color;

    if (next !== "line" && next !== "area" && next !== "bar") {
      const { target_zone: _tz, show_average_line: _avg, ...rest } = config;

      void _tz;
      void _avg;
      onChange({
        ...rest,
        chart_type: next,
        aggregation: nextAggregation,
        color: nextColor,
      });

      return;
    }
    update({
      chart_type: next,
      aggregation: nextAggregation,
      color: nextColor,
    });
  };

  const handleColorChange = (token: ColorToken, index?: number): void => {
    if (isMulti) {
      const arr = Array.isArray(config.color) ? [...config.color] : [];

      if (index !== undefined) arr[index] = token;
      update({ color: arr });
    } else {
      update({ color: token });
    }
  };

  const allowsTargetZone =
    config.chart_type === "line" ||
    config.chart_type === "area" ||
    config.chart_type === "bar";

  return (
    <Drawer isOpen={isOpen} placement="right" size="md" onClose={onClose}>
      <DrawerContent>
        <DrawerHeader className="flex flex-col gap-1">
          <p className="text-sm font-semibold">Editar gráfica</p>
          <p className="text-xs text-foreground/50">
            {saveState === "saving"
              ? "Guardando…"
              : saveState === "saved"
                ? "Guardado"
                : saveState === "error"
                  ? "Error al guardar"
                  : "Los cambios se guardan automáticamente"}
          </p>
        </DrawerHeader>
        <DrawerBody className="gap-4">
          {/* DATA SOURCE */}
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-foreground/50 uppercase mb-1.5">
              Métrica
            </p>
            <Select
              aria-label="Fuente de datos"
              selectedKeys={[dataSourceRefKey(config.source)]}
              size="sm"
              onChange={(e) => handleSourceChange(e.target.value)}
            >
              {sources.map((s) => (
                <SelectItem key={adapterKey(s)} textValue={s.label}>
                  <div className="flex items-center gap-2">
                    {s.icon ? <Icon icon={s.icon} width={14} /> : null}
                    <span>{s.label}</span>
                    {s.unit ? (
                      <span className="text-foreground/40 text-[10px]">
                        ({s.unit})
                      </span>
                    ) : null}
                  </div>
                </SelectItem>
              ))}
            </Select>
          </div>

          {/* LABEL */}
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-foreground/50 uppercase mb-1.5">
              Etiqueta
            </p>
            <Input
              aria-label="Etiqueta visible"
              size="sm"
              value={config.label}
              onValueChange={(v) => update({ label: v })}
            />
          </div>

          {/* CHART TYPE — split into two sections so the constraint is
              obvious. Multi-series types (Apiladas / Anillo) need a
              multi-series source (today: Macros, Entrenamiento). */}
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-foreground/50 uppercase mb-1.5">
              Tipo de gráfica
            </p>

            <div className="flex flex-wrap gap-1.5">
              {CHART_TYPES.filter((t) => !t.multi).map((t) => {
                const active = config.chart_type === t.id;
                const compatible = !isMulti;

                return (
                  <button
                    key={t.id}
                    aria-label={t.label}
                    aria-pressed={active}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border transition-colors ${
                      active
                        ? "bg-default-200 border-foreground/30 text-foreground"
                        : compatible
                          ? "bg-default-50 border-default-200 hover:bg-default-100"
                          : "opacity-40 cursor-not-allowed border-default-100 line-through"
                    }`}
                    disabled={!compatible}
                    title={
                      compatible
                        ? undefined
                        : "Esta métrica es de varias series — usa Apiladas o Anillo"
                    }
                    type="button"
                    onClick={() => handleChartTypeChange(t.id)}
                  >
                    <Icon icon={t.icon} width={12} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <p className="text-[10px] font-semibold tracking-wider text-foreground/40 uppercase mt-3 mb-1.5">
              Varias series
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CHART_TYPES.filter((t) => t.multi).map((t) => {
                const active = config.chart_type === t.id;
                const compatible = isMulti;

                return (
                  <button
                    key={t.id}
                    aria-label={t.label}
                    aria-pressed={active}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border transition-colors ${
                      active
                        ? "bg-default-200 border-foreground/30 text-foreground"
                        : compatible
                          ? "bg-default-50 border-default-200 hover:bg-default-100"
                          : "opacity-40 cursor-not-allowed border-default-100 line-through"
                    }`}
                    disabled={!compatible}
                    title={
                      compatible
                        ? undefined
                        : "Solo disponible con métricas de varias series (p. ej. Macros, Entrenamiento)"
                    }
                    type="button"
                    onClick={() => handleChartTypeChange(t.id)}
                  >
                    <Icon icon={t.icon} width={12} />
                    {t.label}
                  </button>
                );
              })}
            </div>
            {!isMulti ? (
              <p className="text-[10px] text-foreground/40 mt-2 leading-relaxed">
                <Icon
                  className="inline mr-0.5 -mt-0.5"
                  icon="solar:info-circle-bold"
                  width={11}
                />
                Apiladas y Anillo necesitan una métrica de varias series. Cambia
                primero la métrica a <strong>Macros</strong> o{" "}
                <strong>Entrenamiento</strong> para activarlas.
              </p>
            ) : null}
            {!isMulti &&
            (config.chart_type === "ring" ||
              config.chart_type === "stacked_bar") ? (
              <p className="text-[10px] text-warning mt-1">
                Combinación inválida — selecciona un tipo de una serie.
              </p>
            ) : null}
          </div>

          {/* COLOR(S) */}
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-foreground/50 uppercase mb-1.5">
              {isMulti ? "Colores (uno por serie)" : "Color"}
            </p>
            {isMulti && Array.isArray(config.color) ? (
              <div className="space-y-2">
                {config.color.map((token, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] text-foreground/50 w-16">
                      {currentSource?.series?.[i]?.label ?? `Serie ${i + 1}`}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {COLOR_TOKENS.map((c) => {
                        const palette = resolveColor(c);
                        const active = token === c;

                        return (
                          <button
                            key={c}
                            aria-label={c}
                            className={`w-5 h-5 rounded-full border-2 ${
                              active
                                ? "border-foreground/70"
                                : "border-transparent"
                            }`}
                            style={{ backgroundColor: palette.stroke }}
                            type="button"
                            onClick={() => handleColorChange(c, i)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {COLOR_TOKENS.map((c) => {
                  const palette = resolveColor(c);
                  const active = config.color === c;

                  return (
                    <button
                      key={c}
                      aria-label={c}
                      className={`w-6 h-6 rounded-md border-2 ${
                        active ? "border-foreground/70" : "border-transparent"
                      }`}
                      style={{ backgroundColor: palette.stroke }}
                      type="button"
                      onClick={() => handleColorChange(c)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* TARGET ZONE */}
          {allowsTargetZone ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-semibold tracking-wider text-foreground/50 uppercase">
                  Rango objetivo
                </p>
                <Switch
                  aria-label="Activar rango objetivo"
                  isSelected={!!config.target_zone}
                  size="sm"
                  onValueChange={(on) => {
                    if (on) {
                      update({ target_zone: { min: 0, max: 10 } });
                    } else {
                      const { target_zone: _tz, ...rest } = config;

                      void _tz;
                      onChange(rest as ChartConfig);
                    }
                  }}
                />
              </div>
              {config.target_zone ? (
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    aria-label="Mínimo"
                    label="Mín"
                    labelPlacement="outside"
                    size="sm"
                    type="number"
                    value={String(config.target_zone.min)}
                    onValueChange={(v) =>
                      update({
                        target_zone: {
                          ...config.target_zone!,
                          min: Number(v),
                        },
                      })
                    }
                  />
                  <Input
                    aria-label="Máximo"
                    label="Máx"
                    labelPlacement="outside"
                    size="sm"
                    type="number"
                    value={String(config.target_zone.max)}
                    onValueChange={(v) =>
                      update({
                        target_zone: {
                          ...config.target_zone!,
                          max: Number(v),
                        },
                      })
                    }
                  />
                  <Input
                    aria-label="Margen amarillo"
                    label="Margen"
                    labelPlacement="outside"
                    size="sm"
                    type="number"
                    value={String(config.target_zone.margin ?? 0)}
                    onValueChange={(v) => {
                      const num = Number(v);

                      update({
                        target_zone: {
                          ...config.target_zone!,
                          ...(num > 0 ? { margin: num } : { margin: 0 }),
                        },
                      });
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {/* AGGREGATION */}
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-foreground/50 uppercase mb-1.5">
              Agrupación
            </p>
            <Select
              aria-label="Agrupación"
              isDisabled={config.chart_type === "ring"}
              selectedKeys={[config.aggregation]}
              size="sm"
              onChange={(e) =>
                update({ aggregation: e.target.value as Aggregation })
              }
            >
              {AGGREGATIONS.map((a) => (
                <SelectItem
                  key={a.id}
                  isDisabled={
                    a.id === "range_total" &&
                    config.chart_type !== "ring" &&
                    config.chart_type !== "kpi"
                  }
                >
                  {a.label}
                </SelectItem>
              ))}
            </Select>
            {config.chart_type === "ring" ? (
              <p className="text-[10px] text-foreground/40 mt-1">
                Las gráficas de anillo se calculan sobre todo el rango.
              </p>
            ) : null}
          </div>

          {/* AVG LINE */}
          {allowsTargetZone ? (
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold tracking-wider text-foreground/50 uppercase">
                Línea de media
              </p>
              <Switch
                aria-label="Línea de media"
                isSelected={!!config.show_average_line}
                size="sm"
                onValueChange={(on) => {
                  if (on) {
                    update({ show_average_line: true });
                  } else {
                    const { show_average_line: _avg, ...rest } = config;

                    void _avg;
                    onChange(rest as ChartConfig);
                  }
                }}
              />
            </div>
          ) : null}
        </DrawerBody>
        <DrawerFooter>
          {onDiscard ? (
            <Button size="sm" variant="light" onPress={onDiscard}>
              Descartar
            </Button>
          ) : null}
          <Button color="primary" size="sm" onPress={onClose}>
            Cerrar
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

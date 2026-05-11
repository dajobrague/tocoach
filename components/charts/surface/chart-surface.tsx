/**
 * <ChartSurface>
 *
 * Top-level component used by all three chart UIs. Differentiated by `mode`:
 *
 *   - "trainer-template" — edits the trainer's chart template
 *     (autosaves to /api/charts/template). Uses synthesized demo data.
 *   - "trainer-client"   — edits a per-client override (autosaves to
 *     /api/charts/clients/[clientId]). Uses real client data via the
 *     snapshot endpoint. First save creates an override row.
 *   - "client-readonly"  — renders charts only, no edit affordances.
 *     Uses real client data via the snapshot endpoint. (Wired in Phase 7.)
 *
 * Owns:
 *   - the editable in-memory document
 *   - the autosave loop (ETag + debounce)
 *   - add / reorder / delete (these flush immediately)
 *   - the edit panel state (which chart is being edited)
 *   - the apply-to-all dialog (template mode only)
 *   - the reset-to-template confirmation (per-client mode only)
 */

"use client";

import type {
  BucketedPoint,
  ChartConfig,
  ChartDataSource,
  ChartsDocument,
} from "@/lib/charts/types";

import { Button, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import { ApplyToAllConfirm } from "./apply-to-all-confirm";
import { useAutosave, type AutosaveSaveFn } from "./use-autosave";

import { ChartCard } from "@/components/charts/chart-card";
import { ChartEditPanel } from "@/components/charts/edit-panel";
import { synthesizeDemoBuckets } from "@/components/charts/demo-data";
import {
  useChartTemplate,
  useClientCharts,
  useClientSnapshot,
  useDataSources,
  useResetClientCharts,
  useUpdateChartTemplate,
  useUpdateClientCharts,
  type ChartRange,
} from "@/lib/charts/hooks";
import { getEffectiveAggregation } from "@/lib/charts/aggregation";
import { resolveAdapter } from "@/lib/charts/registry";
import { parseFormQuestionAdapterId } from "@/lib/charts/adapters/form-question";
import { buildStarterDocument } from "@/lib/charts/starter";

type SurfaceMode = "trainer-template" | "trainer-client" | "client-readonly";

interface Props {
  mode: SurfaceMode;
  /** Required for trainer-client and client-readonly. Ignored otherwise. */
  clientId?: number | string;
}

function newChartId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `c-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function buildAddChartConfig(
  source: ChartDataSource,
  position: number
): ChartConfig {
  const isMulti = source.dimensions === "multi";
  let ref: ChartConfig["source"];

  if (source.id.startsWith("form_q:")) {
    const parsed = parseFormQuestionAdapterId(source.id);

    if (!parsed) {
      throw new Error(`Malformed form-question adapter id: ${source.id}`);
    }
    ref = {
      kind: "form_question",
      form_type: parsed.formType,
      question_id: parsed.questionId,
    };
  } else {
    ref = { kind: "catalog", id: source.id as never };
  }

  return {
    id: newChartId(),
    position,
    label: source.label.toUpperCase(),
    source: ref,
    chart_type: source.default_chart_type,
    color: source.default_color,
    aggregation:
      isMulti && source.default_chart_type === "ring"
        ? "range_total"
        : "checkin_period",
  };
}

function formTypeLabel(source: ChartDataSource): string | null {
  if (!source.id.startsWith("form_q:")) return null;
  if (source.category === "checkin") return "Check-in";
  if (source.category === "habit") return "Hábitos";

  return null;
}

export function ChartSurface({ mode, clientId }: Props) {
  // Period selector for trainer-client / client-readonly. Trainer-template
  // never queries the snapshot — it always renders synthesized demo data.
  const [range, setRange] = useState<ChartRange>("30d");

  // ─── Data hooks (call all of them; they no-op when not needed) ─────────
  // The template query is only meaningful in `trainer-template` mode.
  // Disabling it elsewhere prevents 500 noise when the trainer has no
  // template row yet (orphan tenant_host) — it's a wasted fetch otherwise.
  const tplQuery = useChartTemplate({ enabled: mode === "trainer-template" });
  const clientQuery = useClientCharts(clientId ?? "");
  const sourcesQuery = useDataSources();
  // Real client data via snapshot — only relevant for trainer-client /
  // client-readonly. Disabled when no clientId.
  const snapshotQuery = useClientSnapshot(clientId ?? "", range);

  // Mutation hooks — same caveat: call unconditionally, pick the right one.
  const tplMut = useUpdateChartTemplate();
  const clientMut = useUpdateClientCharts(clientId ?? "");
  const resetMut = useResetClientCharts(clientId ?? "");

  // Local editable doc state.
  const [doc, setDoc] = useState<ChartsDocument | null>(null);
  const [etag, setEtag] = useState<string>("");
  const [autoApply, setAutoApply] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showApplyToAll, setShowApplyToAll] = useState(false);
  const [editMode, setEditMode] = useState(mode === "trainer-template");

  // Pick the active query based on mode for initial load.
  const activeQuery = mode === "trainer-template" ? tplQuery : clientQuery;
  const sourceFlag =
    mode === "trainer-client" && clientQuery.data
      ? clientQuery.data.source
      : null;

  // Initial sync from query → local state.
  useEffect(() => {
    if (mode === "trainer-template" && tplQuery.data && doc === null) {
      setDoc(tplQuery.data.charts);
      setEtag(tplQuery.data.updated_at);
      setAutoApply(tplQuery.data.auto_apply_to_new_clients);
    } else if (
      mode !== "trainer-template" &&
      clientQuery.data &&
      doc === null
    ) {
      setDoc(clientQuery.data.charts);
      setEtag(clientQuery.data.updated_at);
    }
  }, [tplQuery.data, clientQuery.data, mode]);

  // Build the saver function for autosave. Disabled in client-readonly.
  const save: AutosaveSaveFn = useMemo(
    () => async (vars) => {
      if (mode === "trainer-template") {
        const r = await tplMut.mutateAsync(vars);

        if (r.etagConflict) return { etagConflict: r.etagConflict };

        return {
          data: {
            charts: r.data.charts,
            updated_at: r.data.updated_at,
          },
        };
      }
      if (mode === "trainer-client") {
        // Per-client mutate doesn't accept auto_apply_to_new_clients.
        const { auto_apply_to_new_clients: _drop, ...rest } = vars;

        void _drop;
        const r = await clientMut.mutateAsync(rest);

        if (r.etagConflict) return { etagConflict: r.etagConflict };

        return {
          data: {
            charts: r.data.charts,
            updated_at: r.data.updated_at,
          },
        };
      }

      // client-readonly never saves.
      return {};
    },
    [mode, tplMut, clientMut]
  );

  const autosave = useAutosave({
    doc: doc ?? { version: 1, charts: [] },
    etag,
    paused: doc === null || mode === "client-readonly",
    save,
    ...(mode === "trainer-template"
      ? { autoApplyToNewClients: autoApply }
      : {}),
    onSaved: setEtag,
    onConflict: () => {
      void activeQuery.refetch().then((res) => {
        if (res.data) {
          setDoc(
            "charts" in res.data
              ? res.data.charts
              : (res.data as ChartsDocument)
          );
          setEtag(res.data.updated_at);
        }
      });
    },
  });

  const sources = sourcesQuery.data ?? [];
  const sourceById = useMemo(() => {
    const m = new Map<string, ChartDataSource>();

    for (const s of sources) m.set(s.id, s);

    return m;
  }, [sources]);

  const editing = useMemo(() => {
    if (!doc || !editingId) return null;

    return doc.charts.find((c) => c.id === editingId) ?? null;
  }, [doc, editingId]);

  // Compute renderable buckets per chart. Tres caminos según mode:
  //
  // - trainer-template: SIEMPRE demo data (no hay clientId, no hay
  //   snapshot). Aplicamos `getEffectiveAggregation` antes de
  //   sintetizar para que la preview refleje la granularidad real
  //   que tendrá el cliente al cambiar de tab de período.
  //
  // - trainer-client / client-readonly: SOLO datos reales del
  //   snapshot. Si el chart no tiene aún un bucket en el snapshot
  //   (recién agregado, no terminó el autosave + refetch), pasamos
  //   `buckets: undefined` que ChartCard renderiza como skeleton —
  //   antes caíamos a demo data y se veía un flicker raro de valores
  //   sintéticos antes del refresh. Ahora hay un loading state limpio.
  const renderData = useMemo(() => {
    if (!doc) return [];
    const snapshotBuckets = snapshotQuery.data?.buckets;

    return doc.charts.map((chart) => {
      const adapter = resolveAdapter(chart.source);
      let buckets: BucketedPoint[] | undefined;

      if (mode === "trainer-template") {
        const effectiveAgg = getEffectiveAggregation(
          range,
          chart.aggregation,
          chart.chart_type
        );
        const effectiveChart =
          effectiveAgg === chart.aggregation
            ? chart
            : { ...chart, aggregation: effectiveAgg };

        buckets = synthesizeDemoBuckets(effectiveChart, adapter?.metadata);
      } else if (snapshotBuckets?.[chart.id]) {
        buckets = snapshotBuckets[chart.id]!.buckets as BucketedPoint[];
      } else {
        // Sin demo: undefined → skeleton en ChartCard.
        buckets = undefined;
      }

      const series = adapter?.metadata.series?.map((s) => ({
        id: s.id,
        label: s.label,
      }));

      return { chart, adapter, buckets, series };
    });
  }, [doc, snapshotQuery.data, mode, range]);

  // ─── Editing handlers ──────────────────────────────────────────────────

  const handleChartChange = (next: ChartConfig): void => {
    if (!doc) return;
    const idx = doc.charts.findIndex((c) => c.id === next.id);

    if (idx < 0) return;
    const prev = doc.charts[idx];
    const wasPrivate = prev?.visibility === "trainer_only";
    const isPrivate = next.visibility === "trainer_only";

    // When the trainer toggles "Privado", auto-move the chart to the end
    // of its NEW section so it appears predictably at the bottom of
    // "Privadas" / "Compartidas" instead of staying buried in the middle
    // of the previous section.
    if (wasPrivate !== isPrivate) {
      const without = doc.charts.filter((c) => c.id !== next.id);
      const repositioned = [...without, next].map((c, i) => ({
        ...c,
        position: i,
      }));

      setDoc({ ...doc, charts: repositioned });

      return;
    }
    const charts = [...doc.charts];

    charts[idx] = { ...next, position: idx };
    setDoc({ ...doc, charts });
  };

  const handleAdd = async (
    sourceId: string,
    visibility?: "trainer_only"
  ): Promise<void> => {
    if (!doc) return;
    const source = sourceById.get(sourceId);

    if (!source) return;
    const newChart = buildAddChartConfig(source, doc.charts.length);

    if (visibility === "trainer_only") {
      newChart.visibility = "trainer_only";
    }
    const next: ChartsDocument = {
      ...doc,
      charts: [...doc.charts, newChart],
    };

    setDoc(next);
    await autosave.flushNow();
  };

  const handleDelete = async (chartId: string): Promise<void> => {
    if (!doc) return;
    const next: ChartsDocument = {
      ...doc,
      charts: doc.charts
        .filter((c) => c.id !== chartId)
        .map((c, i) => ({ ...c, position: i })),
    };

    setDoc(next);
    if (editingId === chartId) setEditingId(null);
    await autosave.flushNow();
  };

  const handleMove = async (chartId: string, dir: -1 | 1): Promise<void> => {
    if (!doc) return;
    const idx = doc.charts.findIndex((c) => c.id === chartId);

    if (idx < 0) return;
    const current = doc.charts[idx];

    if (!current) return;
    const currentIsPrivate = current.visibility === "trainer_only";

    // Move only within the same visibility group: find the nearest
    // chart in the same section (skipping over charts from the other
    // group). This keeps the up/down arrows in "Compartidas" from
    // accidentally crossing into "Privadas" and vice versa.
    let target = -1;

    if (dir === -1) {
      for (let i = idx - 1; i >= 0; i--) {
        const c = doc.charts[i];

        if (!c) continue;
        if ((c.visibility === "trainer_only") === currentIsPrivate) {
          target = i;
          break;
        }
      }
    } else {
      for (let i = idx + 1; i < doc.charts.length; i++) {
        const c = doc.charts[i];

        if (!c) continue;
        if ((c.visibility === "trainer_only") === currentIsPrivate) {
          target = i;
          break;
        }
      }
    }
    if (target < 0) return;
    const charts = [...doc.charts];
    const a = charts[idx];
    const b = charts[target];

    if (!a || !b) return;
    charts[idx] = b;
    charts[target] = a;
    const renumbered = charts.map((c, i) => ({ ...c, position: i }));

    setDoc({ ...doc, charts: renumbered });
    await autosave.flushNow();
  };

  const handleResetToTemplate = async (): Promise<void> => {
    if (mode !== "trainer-client") return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Esto eliminará la personalización de este cliente y volverá a aplicar la plantilla del trainer. ¿Continuar?"
      )
    ) {
      return;
    }
    try {
      await resetMut.mutateAsync();
      // Refetch client config to pick up the (now templated) doc.
      const res = await clientQuery.refetch();

      if (res.data) {
        setDoc(res.data.charts);
        setEtag(res.data.updated_at);
      }
    } catch (err) {
      console.error("[charts] reset to template failed:", err);
    }
  };

  const isLoading =
    sourcesQuery.isLoading ||
    (mode === "trainer-template"
      ? tplQuery.isLoading
      : clientQuery.isLoading) ||
    doc === null;

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} radius="lg" shadow="sm">
            <CardBody>
              <div className="h-3 w-1/2 bg-default-100 rounded animate-pulse mb-2" />
              <div className="h-8 w-1/3 bg-default-100 rounded animate-pulse mb-3" />
              <div className="h-[140px] w-full bg-default-100 rounded animate-pulse" />
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  // Banner: per-client mode, when source is "template" (no override yet).
  // Tells the trainer "any edit will create a customization for this client."
  const showInheritanceBanner =
    mode === "trainer-client" && sourceFlag === "template";
  const showOverrideBanner =
    mode === "trainer-client" && sourceFlag === "override";

  const isReadOnly = mode === "client-readonly";

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-xs text-foreground/50">
          {mode === "trainer-template"
            ? "Las gráficas que verán todos tus clientes por defecto."
            : mode === "trainer-client"
              ? "Personalización de gráficas para este cliente."
              : "Tus gráficas."}
          {!isReadOnly ? (
            <>
              {" "}
              <span
                className={
                  autosave.state === "saving"
                    ? "text-foreground/70"
                    : autosave.state === "saved"
                      ? "text-emerald-600"
                      : autosave.state === "error"
                        ? "text-danger"
                        : "text-foreground/40"
                }
              >
                {autosave.state === "saving"
                  ? "Guardando…"
                  : autosave.state === "saved"
                    ? "Cambios guardados"
                    : autosave.state === "error"
                      ? "Error al guardar"
                      : "Cambios automáticos activados"}
              </span>
            </>
          ) : null}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector — visible en los 3 modos. En
              trainer-client / client-readonly cambia el query del
              snapshot. En trainer-template afecta la demo data via
              `getEffectiveAggregation` aplicado en `renderData`,
              permitiéndole al trainer previsualizar cómo se ve la
              plantilla en cada rango sin tener que abrir un cliente
              real. */}
          <PeriodSelector value={range} onChange={setRange} />
          {!isReadOnly ? (
            <Button
              size="sm"
              startContent={
                <Icon
                  icon={editMode ? "solar:eye-bold" : "solar:pen-bold"}
                  width={14}
                />
              }
              variant="bordered"
              onPress={() => setEditMode((v) => !v)}
            >
              {editMode ? "Vista previa" : "Editar"}
            </Button>
          ) : null}
          {!isReadOnly && mode === "trainer-template" ? (
            <>
              <Button
                size="sm"
                startContent={<Icon icon="solar:restart-bold" width={14} />}
                variant="bordered"
                onPress={() => {
                  if (
                    typeof window !== "undefined" &&
                    !window.confirm(
                      "Esto reemplazará tu plantilla actual con las gráficas por defecto. ¿Continuar?"
                    )
                  ) {
                    return;
                  }
                  const starter = buildStarterDocument();

                  setDoc(starter);
                  void autosave.flushNow();
                }}
              >
                Restaurar default
              </Button>
              <Button
                color="warning"
                size="sm"
                startContent={<Icon icon="solar:refresh-bold" width={14} />}
                variant="flat"
                onPress={() => setShowApplyToAll(true)}
              >
                Aplicar a todos
              </Button>
            </>
          ) : null}
          {!isReadOnly &&
          mode === "trainer-client" &&
          sourceFlag === "override" ? (
            <Button
              size="sm"
              startContent={<Icon icon="solar:restart-bold" width={14} />}
              variant="bordered"
              onPress={() => void handleResetToTemplate()}
            >
              Restablecer a plantilla
            </Button>
          ) : null}
        </div>
      </div>

      {/* Inheritance banner (per-client mode) */}
      {showInheritanceBanner && editMode ? (
        <div className="mb-4 px-3 py-2 rounded-lg bg-default-50 border border-default-200 text-xs text-foreground/70 flex items-start gap-2">
          <Icon
            className="mt-0.5 flex-shrink-0"
            icon="solar:info-circle-bold"
            width={14}
          />
          <span>
            Este cliente está usando la plantilla por defecto. Cualquier cambio
            que hagas aquí creará una versión personalizada para él, sin afectar
            a tus otros clientes.
          </span>
        </div>
      ) : null}
      {showOverrideBanner && editMode ? (
        <div className="mb-4 px-3 py-2 rounded-lg bg-default-50 border border-default-200 text-xs text-foreground/70 flex items-start gap-2">
          <Icon
            className="mt-0.5 flex-shrink-0"
            icon="solar:user-id-bold"
            width={14}
          />
          <span>
            Este cliente tiene una configuración personalizada. Los cambios que
            hagas en la plantilla del trainer no le afectarán hasta que pulses
            "Restablecer a plantilla".
          </span>
        </div>
      ) : null}

      {/* Partition by visibility — two sections with distinct headers.
          The split is purely a render concern; the underlying doc.charts
          array stays a single flat list, and visibility is a property on
          each chart (handleMove and handleChartChange respect the group). */}
      {(() => {
        const sharedRender = renderData.filter(
          (d) => d.chart.visibility !== "trainer_only"
        );
        const privateRender = renderData.filter(
          (d) => d.chart.visibility === "trainer_only"
        );

        const renderCard = (
          d: (typeof renderData)[number],
          localIdx: number,
          localCount: number
        ) => {
          const { chart, adapter, buckets, series } = d;
          const overlay =
            editMode && !isReadOnly ? (
              <>
                <button
                  aria-label="Subir"
                  className="w-6 h-6 rounded-full bg-default-100 hover:bg-default-200 flex items-center justify-center disabled:opacity-30"
                  disabled={localIdx === 0}
                  type="button"
                  onClick={() => void handleMove(chart.id, -1)}
                >
                  <Icon icon="solar:alt-arrow-up-bold" width={10} />
                </button>
                <button
                  aria-label="Bajar"
                  className="w-6 h-6 rounded-full bg-default-100 hover:bg-default-200 flex items-center justify-center disabled:opacity-30"
                  disabled={localIdx === localCount - 1}
                  type="button"
                  onClick={() => void handleMove(chart.id, 1)}
                >
                  <Icon icon="solar:alt-arrow-down-bold" width={10} />
                </button>
                <button
                  aria-label="Editar"
                  className="w-6 h-6 rounded-full bg-default-100 hover:bg-default-200 flex items-center justify-center"
                  type="button"
                  onClick={() => setEditingId(chart.id)}
                >
                  <Icon icon="solar:pen-bold" width={10} />
                </button>
                <button
                  aria-label="Eliminar"
                  className="w-6 h-6 rounded-full bg-default-100 hover:bg-danger/10 hover:text-danger flex items-center justify-center text-foreground/60"
                  type="button"
                  onClick={() => void handleDelete(chart.id)}
                >
                  <Icon icon="solar:trash-bin-trash-bold" width={10} />
                </button>
              </>
            ) : null;

          return (
            <ChartCard
              key={chart.id}
              buckets={buckets}
              config={chart}
              editOverlay={overlay}
              editable={editMode && !isReadOnly}
              {...(chart.icon !== undefined
                ? { icon: chart.icon }
                : adapter?.metadata.icon !== undefined
                  ? { icon: adapter.metadata.icon }
                  : {})}
              {...(adapter?.metadata.unit !== undefined
                ? { unit: adapter.metadata.unit }
                : {})}
              {...(adapter?.metadata.y_max !== undefined
                ? { yMax: adapter.metadata.y_max }
                : {})}
              orphan={!adapter}
              {...(series !== undefined ? { series } : {})}
            />
          );
        };

        // Each section appears when EITHER it has charts OR we're in edit
        // mode (so the trainer always has a clear "Añadir" affordance for
        // both groups). The private section is suppressed entirely on the
        // read-only client surface — the server already filters those
        // charts out, so this just avoids rendering an empty header.
        const showShared = sharedRender.length > 0 || (editMode && !isReadOnly);
        const showPrivate =
          !isReadOnly && (privateRender.length > 0 || editMode);

        return (
          <>
            {showShared ? (
              <section className="mb-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-full bg-default-100 flex-shrink-0 mt-0.5">
                      <Icon
                        className="text-foreground/60"
                        icon="solar:users-group-rounded-bold"
                        width={14}
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground">
                        Compartidas con cliente
                      </h3>
                      <p className="text-[11px] text-foreground/50 leading-snug">
                        Tu cliente ve estas gráficas en su dashboard.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-foreground/40 flex-shrink-0 mt-1 uppercase tracking-wider">
                    {sharedRender.length}{" "}
                    {sharedRender.length === 1 ? "gráfica" : "gráficas"}
                  </span>
                </div>
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                  {sharedRender.map((d, i) =>
                    renderCard(d, i, sharedRender.length)
                  )}
                  {editMode && !isReadOnly ? (
                    <AddChartCard
                      isLoading={sourcesQuery.isLoading}
                      sources={sources}
                      onAdd={(id) => handleAdd(id)}
                      {...(sourcesQuery.error
                        ? { error: sourcesQuery.error as Error }
                        : {})}
                    />
                  ) : null}
                </div>
              </section>
            ) : null}

            {showPrivate ? (
              <section>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-full bg-amber-100/60 dark:bg-amber-500/15 flex-shrink-0 mt-0.5">
                      <Icon
                        className="text-amber-700 dark:text-amber-400"
                        icon="solar:lock-bold"
                        width={14}
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground">
                        Solo para ti · Privadas
                      </h3>
                      <p className="text-[11px] text-foreground/50 leading-snug">
                        El cliente no las ve. Útiles para notas internas o
                        métricas de seguimiento.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-foreground/40 flex-shrink-0 mt-1 uppercase tracking-wider">
                    {privateRender.length}{" "}
                    {privateRender.length === 1 ? "gráfica" : "gráficas"}
                  </span>
                </div>
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                  {privateRender.map((d, i) =>
                    renderCard(d, i, privateRender.length)
                  )}
                  {editMode && !isReadOnly ? (
                    <AddChartCard
                      private
                      isLoading={sourcesQuery.isLoading}
                      sources={sources}
                      onAdd={(id) => handleAdd(id, "trainer_only")}
                      {...(sourcesQuery.error
                        ? { error: sourcesQuery.error as Error }
                        : {})}
                    />
                  ) : null}
                </div>
              </section>
            ) : null}
          </>
        );
      })()}

      {/* Empty state */}
      {doc.charts.length === 0 && !editMode ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-foreground/50">
          <Icon icon="solar:chart-2-linear" width={36} />
          <p className="text-sm">
            {mode === "trainer-template"
              ? "Tu plantilla está vacía."
              : "Sin gráficas configuradas."}
          </p>
          {!isReadOnly ? (
            <Button size="sm" variant="flat" onPress={() => setEditMode(true)}>
              Empezar a editar
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Edit panel */}
      <ChartEditPanel
        config={editing}
        isOpen={!!editing}
        saveState={autosave.state}
        sources={sources}
        onChange={handleChartChange}
        onClose={() => setEditingId(null)}
      />

      {/* Apply-to-all (template only) */}
      <ApplyToAllConfirm
        isOpen={showApplyToAll}
        onClose={() => setShowApplyToAll(false)}
      />
    </div>
  );
}

// ─── Period selector ───────────────────────────────────────────────────────

const PERIOD_OPTIONS: ReadonlyArray<{ value: ChartRange; label: string }> = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "3m" },
  { value: "6m", label: "6m" },
  { value: "12m", label: "12m" },
];

function PeriodSelector({
  value,
  onChange,
}: {
  value: ChartRange;
  onChange: (next: ChartRange) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-default-200 bg-default-50 p-0.5">
      {PERIOD_OPTIONS.map((opt) => {
        const active = opt.value === value;

        return (
          <button
            key={opt.value}
            aria-pressed={active}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors ${
              active
                ? "bg-foreground text-background"
                : "text-foreground/60 hover:text-foreground/90"
            }`}
            type="button"
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Add chart card ────────────────────────────────────────────────────────

function AddChartCard({
  sources,
  isLoading,
  error,
  onAdd,
  private: isPrivateAdd,
}: {
  sources: ChartDataSource[];
  isLoading: boolean;
  error?: Error | null;
  onAdd: (sourceId: string) => Promise<void>;
  /**
   * When true, the dashed card hints visually (lock icon + label) that
   * any chart added here will land in the trainer-private section. The
   * actual visibility flag is applied by the caller via `onAdd`.
   */
  private?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const filtered = useMemo(
    () =>
      sources.filter((s) =>
        s.label.toLowerCase().includes(filter.toLowerCase())
      ),
    [sources, filter]
  );

  if (!open) {
    return (
      <button
        className={
          isPrivateAdd
            ? "rounded-xl border-2 border-dashed border-amber-300/70 dark:border-amber-500/40 bg-amber-50/40 dark:bg-amber-500/[0.04] hover:border-amber-500/60 hover:bg-amber-50 dark:hover:bg-amber-500/10 p-6 flex flex-col items-center justify-center gap-2 text-amber-700/70 dark:text-amber-400/70 hover:text-amber-800 transition-colors min-h-[200px] cursor-pointer"
            : "rounded-xl border-2 border-dashed border-default-300 bg-default-50 hover:border-foreground/30 hover:bg-default-100 p-6 flex flex-col items-center justify-center gap-2 text-foreground/50 hover:text-foreground/70 transition-colors min-h-[200px] cursor-pointer"
        }
        type="button"
        onClick={() => setOpen(true)}
      >
        <Icon
          icon={isPrivateAdd ? "solar:lock-bold" : "solar:add-circle-bold"}
          width={32}
        />
        <span className="text-sm font-medium">
          {isPrivateAdd ? "Añadir gráfica privada" : "Añadir gráfica"}
        </span>
        {isPrivateAdd ? (
          <span className="text-[10px] text-current opacity-70 leading-tight text-center max-w-[180px]">
            El cliente no la verá
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <Card className="min-h-[200px]" radius="lg" shadow="sm">
      <CardBody className="gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold">Elegir métrica</p>
          <button
            aria-label="Cancelar"
            className="text-foreground/50 hover:text-foreground"
            type="button"
            onClick={() => setOpen(false)}
          >
            <Icon icon="solar:close-circle-bold" width={18} />
          </button>
        </div>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-foreground/40">
            <Icon
              className="animate-spin"
              icon="solar:loading-bold"
              width={20}
            />
            <span className="text-xs">Cargando métricas…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-danger/80">
            <Icon icon="solar:danger-triangle-bold" width={20} />
            <span className="text-xs font-medium">
              No se pudieron cargar las métricas
            </span>
            <span className="text-[10px] text-foreground/40">
              {error.message}
            </span>
          </div>
        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-foreground/40">
            <Icon icon="solar:info-circle-bold" width={20} />
            <span className="text-xs">
              No hay métricas disponibles todavía.
            </span>
          </div>
        ) : (
          <>
            <input
              aria-label="Buscar métrica"
              className="w-full text-xs px-2 py-1 rounded border border-default-200 focus:border-foreground/40 outline-none"
              placeholder="Buscar…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="overflow-y-auto max-h-[180px] -mx-1">
              {filtered.map((s) => {
                const ft = formTypeLabel(s);

                return (
                  <button
                    key={s.id}
                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-default-100 rounded text-left text-xs"
                    type="button"
                    onClick={() => {
                      void onAdd(s.id);
                      setOpen(false);
                      setFilter("");
                    }}
                  >
                    {s.icon ? <Icon icon={s.icon} width={14} /> : null}
                    <span className="flex-1">{s.label}</span>
                    {ft ? (
                      <span className="text-[9px] uppercase tracking-wider text-foreground/50 bg-default-100 px-1.5 py-0.5 rounded">
                        {ft}
                      </span>
                    ) : null}
                    {s.unit ? (
                      <span className="text-foreground/40 text-[10px]">
                        {s.unit}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {filtered.length === 0 ? (
                <p className="text-xs text-foreground/40 text-center py-3">
                  Ninguna coincidencia.
                </p>
              ) : null}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

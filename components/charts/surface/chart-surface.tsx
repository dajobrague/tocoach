/**
 * <ChartSurface>
 *
 * Top-level component used by all three chart UIs (trainer template,
 * per-client editor, client read-only). Differentiated by `mode`:
 *
 *   - "trainer-template" — edits the trainer's chart template
 *     (autosaves to /api/charts/template). Uses synthesized demo data.
 *   - "trainer-client"   — edits a per-client override (Phase 6).
 *   - "client-readonly"  — renders charts only, no edit affordances (Phase 7).
 *
 * Owns:
 *   - the editable in-memory document
 *   - the autosave loop (ETag + debounce)
 *   - add / reorder / delete (these flush immediately)
 *   - the edit panel state (which chart is being edited)
 *   - the apply-to-all dialog
 */

"use client";

import type {
  ChartConfig,
  ChartDataSource,
  ChartsDocument,
} from "@/lib/charts/types";

import { Button, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import { ApplyToAllConfirm } from "./apply-to-all-confirm";
import { useAutosave } from "./use-autosave";

import { ChartCard } from "@/components/charts/chart-card";
import { ChartEditPanel } from "@/components/charts/edit-panel";
import { synthesizeDemoBuckets } from "@/components/charts/demo-data";
import { useChartTemplate, useDataSources } from "@/lib/charts/hooks";
import { resolveAdapter } from "@/lib/charts/registry";

type SurfaceMode = "trainer-template" | "trainer-client" | "client-readonly";

interface Props {
  mode: SurfaceMode;
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
  const ref = source.id.startsWith("form_q:")
    ? {
        kind: "form_question" as const,
        form_type:
          source.category === "checkin"
            ? ("checkins" as const)
            : ("habits" as const),
        question_id: source.id.replace(/^form_q:/, ""),
      }
    : { kind: "catalog" as const, id: source.id as never };

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

export function ChartSurface({ mode }: Props) {
  const tplQuery = useChartTemplate();
  const sourcesQuery = useDataSources();

  // Local editable doc — mirrors the server's, but we apply optimistic
  // edits here and let useAutosave ship them.
  const [doc, setDoc] = useState<ChartsDocument | null>(null);
  const [etag, setEtag] = useState<string>("");
  const [autoApply, setAutoApply] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showApplyToAll, setShowApplyToAll] = useState(false);
  const [editMode, setEditMode] = useState(true);

  // Initial sync from query → local state.
  useEffect(() => {
    if (tplQuery.data && doc === null) {
      setDoc(tplQuery.data.charts);
      setEtag(tplQuery.data.updated_at);
      setAutoApply(tplQuery.data.auto_apply_to_new_clients);
    }
  }, [tplQuery.data]);

  const autosave = useAutosave({
    doc: doc ?? { version: 1, charts: [] },
    etag,
    paused: doc === null || mode !== "trainer-template",
    autoApplyToNewClients: autoApply,
    onSaved: setEtag,
    onConflict: () => {
      // Refetch and replace local doc; in-flight edits are lost. The spec
      // outlines a richer "merge" UX that will land later.
      void tplQuery.refetch().then((res) => {
        if (res.data) {
          setDoc(res.data.charts);
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

  const handleChartChange = (next: ChartConfig): void => {
    if (!doc) return;
    const idx = doc.charts.findIndex((c) => c.id === next.id);

    if (idx < 0) return;
    const charts = [...doc.charts];

    charts[idx] = { ...next, position: idx };
    setDoc({ ...doc, charts });
  };

  const handleAdd = async (sourceId: string): Promise<void> => {
    if (!doc) return;
    const source = sourceById.get(sourceId);

    if (!source) return;
    const next: ChartsDocument = {
      ...doc,
      charts: [...doc.charts, buildAddChartConfig(source, doc.charts.length)],
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
    const target = idx + dir;

    if (target < 0 || target >= doc.charts.length) return;
    const charts = [...doc.charts];
    const [moved] = charts.splice(idx, 1);

    charts.splice(target, 0, moved!);
    const renumbered = charts.map((c, i) => ({ ...c, position: i }));

    setDoc({ ...doc, charts: renumbered });
    await autosave.flushNow();
  };

  const isLoading =
    tplQuery.isLoading || sourcesQuery.isLoading || doc === null;

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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Plantilla de gráficas</h2>
          <p className="text-xs text-foreground/50">
            Las gráficas que verán todos tus clientes por defecto.{" "}
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
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          {mode === "trainer-template" ? (
            <Button
              color="warning"
              size="sm"
              startContent={<Icon icon="solar:refresh-bold" width={14} />}
              variant="flat"
              onPress={() => setShowApplyToAll(true)}
            >
              Aplicar a todos
            </Button>
          ) : null}
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {doc.charts.map((chart, idx) => {
          const adapter = resolveAdapter(chart.source);
          const buckets = synthesizeDemoBuckets(chart, adapter?.metadata);
          const series = adapter?.metadata.series?.map((s) => ({
            id: s.id,
            label: s.label,
          }));
          const overlay = editMode ? (
            <>
              <button
                aria-label="Subir"
                className="w-7 h-7 rounded-full bg-default-100 hover:bg-default-200 flex items-center justify-center disabled:opacity-30"
                disabled={idx === 0}
                type="button"
                onClick={() => void handleMove(chart.id, -1)}
              >
                <Icon icon="solar:alt-arrow-up-bold" width={12} />
              </button>
              <button
                aria-label="Bajar"
                className="w-7 h-7 rounded-full bg-default-100 hover:bg-default-200 flex items-center justify-center disabled:opacity-30"
                disabled={idx === doc.charts.length - 1}
                type="button"
                onClick={() => void handleMove(chart.id, 1)}
              >
                <Icon icon="solar:alt-arrow-down-bold" width={12} />
              </button>
              <button
                aria-label="Editar"
                className="w-7 h-7 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center"
                type="button"
                onClick={() => setEditingId(chart.id)}
              >
                <Icon icon="solar:pen-bold" width={12} />
              </button>
              <button
                aria-label="Eliminar"
                className="w-7 h-7 rounded-full bg-danger/10 hover:bg-danger/20 flex items-center justify-center text-danger"
                type="button"
                onClick={() => void handleDelete(chart.id)}
              >
                <Icon icon="solar:trash-bin-trash-bold" width={12} />
              </button>
            </>
          ) : null;

          return (
            <ChartCard
              key={chart.id}
              buckets={buckets}
              config={chart}
              editOverlay={overlay}
              editable={editMode}
              {...(adapter?.metadata.icon !== undefined
                ? { icon: adapter.metadata.icon }
                : {})}
              {...(adapter?.metadata.unit !== undefined
                ? { unit: adapter.metadata.unit }
                : {})}
              orphan={!adapter}
              {...(series !== undefined ? { series } : {})}
            />
          );
        })}
        {editMode ? <AddChartCard sources={sources} onAdd={handleAdd} /> : null}
      </div>

      {/* Empty state when zero charts */}
      {doc.charts.length === 0 && !editMode ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-foreground/50">
          <Icon icon="solar:chart-2-linear" width={36} />
          <p className="text-sm">Tu plantilla está vacía.</p>
          <Button size="sm" variant="flat" onPress={() => setEditMode(true)}>
            Empezar a editar
          </Button>
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

      {/* Apply-to-all */}
      <ApplyToAllConfirm
        isOpen={showApplyToAll}
        onClose={() => setShowApplyToAll(false)}
      />
    </div>
  );
}

// ─── Add chart card ────────────────────────────────────────────────────────

function AddChartCard({
  sources,
  onAdd,
}: {
  sources: ChartDataSource[];
  onAdd: (sourceId: string) => Promise<void>;
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
        className="rounded-xl border-2 border-dashed border-default-200 hover:border-primary/40 hover:bg-primary/5 p-6 flex flex-col items-center justify-center gap-2 text-foreground/50 hover:text-foreground/70 transition-colors min-h-[200px]"
        type="button"
        onClick={() => setOpen(true)}
      >
        <Icon icon="solar:add-circle-bold" width={32} />
        <span className="text-sm font-medium">Añadir gráfica</span>
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
        <input
          aria-label="Buscar métrica"
          className="w-full text-xs px-2 py-1 rounded border border-default-200 focus:border-primary outline-none"
          placeholder="Buscar…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="overflow-y-auto max-h-[180px] -mx-1">
          {filtered.map((s) => (
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
              {s.unit ? (
                <span className="text-foreground/40 text-[10px]">{s.unit}</span>
              ) : null}
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="text-xs text-foreground/40 text-center py-3">
              Ninguna coincidencia.
            </p>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

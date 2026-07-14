"use client";

import type { NutritionMetrics } from "@/lib/nutrition/admin/nutrition-metrics";

import { Card, CardBody, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

/** A big headline number with a label and icon. */
function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: string;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardBody className="gap-1">
        <div className="flex items-center gap-2 text-slate-500">
          <Icon icon={icon} width={18} />
          <span className="text-xs font-semibold uppercase tracking-wide">
            {label}
          </span>
        </div>
        <p className="text-3xl font-bold text-slate-900">{value}</p>
        {hint !== undefined ? (
          <p className="text-xs text-slate-400">{hint}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}

/** Vertical bar chart of weekly logging — simple CSS bars, no chart lib. */
function WeeklyTrend({ metrics }: { metrics: NutritionMetrics }) {
  const weeks = metrics.logging.weeks;
  const maxLogs = Math.max(1, ...weeks.map((w) => w.logs));

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardBody className="gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Registros por semana
          </h2>
          <span className="text-xs text-slate-400">
            últimas {metrics.windowWeeks} semanas
          </span>
        </div>

        <div className="flex h-40 items-end gap-1.5" data-testid="weekly-trend">
          {weeks.map((week) => (
            <div
              key={week.weekStart}
              className="flex flex-1 flex-col items-center gap-1"
              title={`${week.weekStart}: ${week.logs} registros · ${week.distinctClients} clientes`}
            >
              <div
                className="w-full rounded-t bg-emerald-500/80"
                style={{
                  height: `${Math.round((week.logs / maxLogs) * 100)}%`,
                  minHeight: week.logs > 0 ? 4 : 1,
                }}
              />
              <span className="text-[9px] leading-none text-slate-400">
                {week.weekStart.slice(5)}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {metrics.logging.totalLogs} registros ·{" "}
          {metrics.logging.distinctClients} clientes distintos en la ventana
        </p>
      </CardBody>
    </Card>
  );
}

function AdoptionCard({ metrics }: { metrics: NutritionMetrics }) {
  const { enabledCount, usingCount } = metrics.adoption;
  const pct =
    enabledCount > 0 ? Math.round((usingCount / enabledCount) * 100) : 0;

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardBody className="gap-3">
        <h2 className="text-base font-bold text-slate-900">
          Adopción de entrenadores
        </h2>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-900">
            {usingCount}
          </span>
          <span className="text-slate-500">
            / {enabledCount} activos lo usan
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-slate-400">
          {pct}% de los entrenadores con la función habilitada tienen ≥1 receta
          o ciclo.
        </p>
      </CardBody>
    </Card>
  );
}

function LibraryCard({ metrics }: { metrics: NutritionMetrics }) {
  const { totalRecipes, avgRecipesPerActiveTrainer, distribution } =
    metrics.library;
  const maxTrainers = Math.max(1, ...distribution.map((b) => b.trainers));

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardBody className="gap-3">
        <h2 className="text-base font-bold text-slate-900">
          Profundidad de la biblioteca
        </h2>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-900">
            {totalRecipes}
          </span>
          <span className="text-slate-500">recetas en total</span>
        </div>
        <p className="text-xs text-slate-400">
          Promedio {avgRecipesPerActiveTrainer} por entrenador activo
        </p>
        <div className="flex flex-col gap-1.5 pt-1">
          {distribution.map((band) => (
            <div key={band.label} className="flex items-center gap-2">
              <span className="w-12 text-xs text-slate-500">{band.label}</span>
              <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
                <div
                  className="h-full rounded bg-amber-500"
                  style={{
                    width: `${Math.round((band.trainers / maxTrainers) * 100)}%`,
                  }}
                />
              </div>
              <span className="w-6 text-right text-xs text-slate-500">
                {band.trainers}
              </span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

/** The complaint-trend hook — no data source yet, marked "coming soon". */
function ComplaintCard({ note }: { note: string }) {
  return (
    <Card className="border border-dashed border-slate-300 bg-slate-50 shadow-none">
      <CardBody className="gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-500">
            Tendencia de quejas
          </h2>
          <Chip color="default" size="sm" variant="flat">
            Próximamente
          </Chip>
        </div>
        <p className="text-xs text-slate-400">{note}</p>
      </CardBody>
    </Card>
  );
}

export default function NutritionMetricsPage() {
  const [metrics, setMetrics] = React.useState<NutritionMetrics | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/admin/nutrition-metrics");
        const body = await res.json();

        if (!res.ok || !body.success) {
          throw new Error(body.error ?? `request_failed (${res.status})`);
        }

        if (active) {
          setMetrics(body.data as NutritionMetrics);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Error inesperado");
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  if (error !== null) {
    return (
      <div className="p-8">
        <p className="text-sm text-rose-600">
          No se pudieron cargar las métricas: {error}
        </p>
      </div>
    );
  }

  if (metrics === null) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Spinner color="primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Nutrición v2 · Métricas de éxito
        </h1>
        <p className="text-sm text-slate-500">
          Señales de la plataforma (todos los inquilinos).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          hint="con nutrition_v2 activado"
          icon="solar:users-group-rounded-bold-duotone"
          label="Entrenadores"
          value={metrics.adoption.enabledCount}
        />
        <StatCard
          hint="con ≥1 receta o ciclo"
          icon="solar:check-circle-bold-duotone"
          label="Usando"
          value={metrics.adoption.usingCount}
        />
        <StatCard
          icon="solar:book-bold-duotone"
          label="Recetas"
          value={metrics.library.totalRecipes}
        />
        <StatCard
          hint="en la ventana"
          icon="solar:clipboard-list-bold-duotone"
          label="Clientes registrando"
          value={metrics.logging.distinctClients}
        />
      </div>

      <WeeklyTrend metrics={metrics} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdoptionCard metrics={metrics} />
        <LibraryCard metrics={metrics} />
      </div>

      <ComplaintCard note={metrics.complaints.note} />
    </div>
  );
}

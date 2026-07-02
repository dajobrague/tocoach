"use client";

import type { CycleTree } from "./cycle-api";
import type { MacroTotals } from "./cycle-math";

import { Button, Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo, useRef, useState } from "react";

import { cycleMetrics, pct } from "./cycle-math";
import { CYCLE_STATUS, formatStartDate } from "./cycle-format";
import { ProgressBar } from "./progress-bar";

interface CycleSummaryCardProps {
  cycle: CycleTree;
  isUpdating: boolean;
  activateError: string | null;
  onActivate: () => void;
  onArchive: () => void;
  onRename: (name: string) => void;
  onChangeStartDate: (date: string) => void;
  targets: MacroTotals;
}

interface Metric {
  label: string;
  value: string;
  sub: string;
  bar: { value: number; color: string } | null;
}

export function CycleSummaryCard({
  cycle,
  isUpdating,
  activateError,
  onActivate,
  onArchive,
  onRename,
  onChangeStartDate,
  targets,
}: CycleSummaryCardProps) {
  const status = CYCLE_STATUS[cycle.status];
  const metrics = useMemo(() => cycleMetrics(cycle), [cycle]);
  const t = targets;

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [editingDate, setEditingDate] = useState(false);
  // Set on Escape so the field's blur handler skips the commit.
  const cancelName = useRef(false);

  const startEditName = () => {
    setNameDraft(cycle.name);
    setEditingName(true);
  };

  const commitName = () => {
    const next = nameDraft.trim();

    if (next.length > 0 && next !== cycle.name) onRename(next);
    setEditingName(false);
  };

  const cols: Metric[] = [
    {
      label: "Promedio diario",
      value: `${metrics.avgKcal} kcal`,
      sub: `de ${t.kcal} kcal`,
      bar: { value: pct(metrics.avgKcal, t.kcal), color: "bg-emerald-500" },
    },
    {
      label: "Proteína promedio",
      value: `${metrics.avgProtein} g`,
      sub: `de ${t.protein_g} g`,
      bar: {
        value: pct(metrics.avgProtein, t.protein_g),
        color: "bg-blue-500",
      },
    },
    {
      label: "Carbohidratos prom.",
      value: `${metrics.avgCarbs} g`,
      sub: `de ${t.carbs_g} g`,
      bar: { value: pct(metrics.avgCarbs, t.carbs_g), color: "bg-emerald-500" },
    },
    {
      label: "Grasa promedio",
      value: `${metrics.avgFat} g`,
      sub: `de ${t.fat_g} g`,
      bar: { value: pct(metrics.avgFat, t.fat_g), color: "bg-amber-500" },
    },
    {
      label: "Días completos",
      value: `${metrics.completedDays} / ${metrics.totalDays}`,
      sub: "días",
      bar: {
        value: pct(metrics.completedDays, metrics.totalDays),
        color: "bg-violet-500",
      },
    },
    {
      label: "Comidas planificadas",
      value: `${metrics.plannedMeals}`,
      sub: "comidas",
      bar: null,
    },
  ];

  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardBody className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Icon icon="solar:cup-hot-bold" width={24} />
            </span>
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {editingName ? (
                  <input
                    autoFocus
                    aria-label="Nombre del plan"
                    className="min-w-0 rounded-medium border border-blue-400 bg-white px-2 py-0.5 text-base font-bold text-gray-900 outline-none"
                    value={nameDraft}
                    onBlur={() => {
                      if (cancelName.current) {
                        cancelName.current = false;
                        setEditingName(false);

                        return;
                      }
                      commitName();
                    }}
                    onChange={(event) => setNameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      else if (event.key === "Escape") {
                        cancelName.current = true;
                        event.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <button
                    className="group/name -mx-1.5 flex min-w-0 items-center gap-1.5 rounded-medium px-1.5 py-0.5 text-left transition-colors hover:bg-gray-100"
                    title="Editar nombre"
                    type="button"
                    onClick={startEditName}
                  >
                    <h2 className="truncate text-base font-bold text-gray-900 decoration-gray-300 decoration-dotted underline-offset-4 group-hover/name:underline">
                      {cycle.name}
                    </h2>
                    <Icon
                      className="shrink-0 text-default-400 transition-colors group-hover/name:text-default-700"
                      icon="solar:pen-2-linear"
                      width={14}
                    />
                  </button>
                )}
                <Chip color={status.color} size="sm" variant="flat">
                  {status.label}
                </Chip>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-default-600">
                <span className="font-medium">
                  {cycle.duration_days} días · Inicio:
                </span>
                {editingDate ? (
                  <input
                    autoFocus
                    aria-label="Fecha de inicio"
                    className="rounded-medium border border-blue-400 bg-white px-1.5 py-0.5 text-xs outline-none"
                    defaultValue={cycle.start_date.slice(0, 10)}
                    type="date"
                    onBlur={() => setEditingDate(false)}
                    onChange={(event) => {
                      if (event.target.value.length > 0) {
                        onChangeStartDate(event.target.value);
                      }
                    }}
                  />
                ) : (
                  <button
                    className="group/date inline-flex items-center gap-1 rounded-medium border border-gray-200 bg-gray-50 px-2 py-0.5 font-medium text-default-700 transition-colors hover:border-gray-300 hover:bg-gray-100"
                    title="Editar fecha de inicio"
                    type="button"
                    onClick={() => setEditingDate(true)}
                  >
                    <Icon
                      className="text-default-400"
                      icon="solar:calendar-linear"
                      width={12}
                    />
                    {formatStartDate(cycle.start_date)}
                    <Icon
                      className="text-default-400 transition-colors group-hover/date:text-default-700"
                      icon="solar:pen-2-linear"
                      width={12}
                    />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {cycle.status !== "active" && (
              <Button
                className="bg-slate-900 text-white"
                color="primary"
                isDisabled={isUpdating}
                size="sm"
                startContent={
                  <Icon icon="solar:play-circle-linear" width={15} />
                }
                onPress={onActivate}
              >
                Activar
              </Button>
            )}
            {cycle.status !== "archived" && (
              <Button
                isDisabled={isUpdating}
                size="sm"
                startContent={<Icon icon="solar:archive-linear" width={15} />}
                variant="light"
                onPress={onArchive}
              >
                Archivar
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
          {cols.map((col) => (
            <div
              key={col.label}
              className="flex flex-col gap-1 xl:border-l xl:border-gray-100 xl:pl-5 xl:first:border-l-0 xl:first:pl-0"
            >
              <span className="text-xs font-medium text-default-600">
                {col.label}
              </span>
              <span className="text-lg font-bold text-gray-900 tabular-nums">
                {col.value}
              </span>
              <span className="text-xs text-default-500">{col.sub}</span>
              {col.bar !== null && (
                <div className="mt-1 flex items-center gap-2">
                  <ProgressBar color={col.bar.color} value={col.bar.value} />
                  <span className="shrink-0 text-[10px] font-semibold text-default-600 tabular-nums">
                    {col.bar.value}%
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardBody>

      {activateError !== null && (
        <div className="mx-5 mb-4 flex items-center gap-2 rounded-large border border-danger-200 bg-danger-50 p-2.5 text-sm text-danger-700">
          <Icon icon="solar:danger-triangle-linear" width={16} />
          {activateError}
        </div>
      )}
    </Card>
  );
}

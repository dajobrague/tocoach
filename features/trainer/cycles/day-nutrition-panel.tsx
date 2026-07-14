"use client";

import type { GoalPreset } from "./cycle-api";
import type { DayStatus, MacroTotals } from "./cycle-math";

import { Card, CardBody, Select, SelectItem } from "@heroui/react";
import { Icon } from "@iconify/react";

import { pct } from "./cycle-math";
import { ProgressBar } from "./progress-bar";

const DEFAULT_TARGET_KEY = "__default__";

interface DayNutritionPanelProps {
  totals: MacroTotals;
  target: MacroTotals;
  status: DayStatus;
  plannedMeals: number;
  disabled: boolean;
  onClear: () => void;
  onDuplicate?: () => void;
  onCopyFrom?: () => void;
  /** Named objectives available for this client (day-target selector). */
  presets?: GoalPreset[];
  /** Preset assigned to this day, or null → default goals. */
  assignedPresetId?: string | null;
  onAssignPreset?: (presetId: string | null) => void;
}

export function DayNutritionPanel({
  totals,
  target,
  status,
  plannedMeals,
  disabled,
  onClear,
  onDuplicate,
  onCopyFrom,
  presets,
  assignedPresetId = null,
  onAssignPreset,
}: DayNutritionPanelProps) {
  const kcalPct = pct(totals.kcal, target.kcal);
  // A deleted preset leaves a dangling id — show it as the default fallback.
  const selectedKey =
    assignedPresetId !== null &&
    (presets ?? []).some((preset) => preset.id === assignedPresetId)
      ? assignedPresetId
      : DEFAULT_TARGET_KEY;

  const macros = [
    {
      label: "Proteína",
      dot: "bg-blue-500",
      bar: "bg-blue-500",
      value: pct(totals.protein_g, target.protein_g),
    },
    {
      label: "Carbohidratos",
      dot: "bg-emerald-500",
      bar: "bg-emerald-500",
      value: pct(totals.carbs_g, target.carbs_g),
    },
    {
      label: "Grasas",
      dot: "bg-amber-500",
      bar: "bg-amber-500",
      value: pct(totals.fat_g, target.fat_g),
    },
  ];

  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardBody className="gap-5 p-5">
        <div className="flex items-center gap-2">
          <Icon
            className="text-emerald-600"
            icon="solar:pie-chart-2-linear"
            width={18}
          />
          <h3 className="text-sm font-semibold text-gray-900">
            Nutrición del día
          </h3>
        </div>

        {onAssignPreset !== undefined && (
          <Select
            aria-label="Objetivo del día"
            isDisabled={disabled}
            label="Objetivo del día"
            labelPlacement="outside"
            placeholder="Metas por defecto"
            selectedKeys={[selectedKey]}
            size="sm"
            variant="bordered"
            onSelectionChange={(keys) => {
              const key = Array.from(keys)[0];

              if (key === undefined) return;
              onAssignPreset(key === DEFAULT_TARGET_KEY ? null : String(key));
            }}
          >
            {[
              <SelectItem key={DEFAULT_TARGET_KEY}>
                Metas por defecto
              </SelectItem>,
              ...(presets ?? []).map((preset) => (
                <SelectItem key={preset.id} textValue={preset.name}>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate">{preset.name}</span>
                    <span className="shrink-0 text-xs text-default-400 tabular-nums">
                      {preset.kcal} kcal
                    </span>
                  </span>
                </SelectItem>
              )),
            ]}
          </Select>
        )}

        <div className="flex items-center gap-4">
          <Ring value={kcalPct} />
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold text-gray-900 tabular-nums">
              {totals.kcal.toLocaleString("es")}{" "}
              <span className="text-sm font-medium text-default-400">
                / {target.kcal.toLocaleString("es")} kcal
              </span>
            </p>
            <p className="text-xs text-default-500">
              {kcalPct}% del objetivo diario
            </p>
            <ProgressBar
              className="mt-2"
              color="bg-emerald-500"
              value={kcalPct}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {macros.map((macro) => (
            <div key={macro.label} className="flex items-center gap-3">
              <span className={`h-2 w-2 shrink-0 rounded-full ${macro.dot}`} />
              <span className="w-24 shrink-0 text-xs text-default-600">
                {macro.label}
              </span>
              <ProgressBar color={macro.bar} value={macro.value} />
              <span className="w-9 shrink-0 text-right text-xs font-medium text-default-500 tabular-nums">
                {macro.value}%
              </span>
            </div>
          ))}
        </div>

        <StatusBox plannedMeals={plannedMeals} status={status} />

        <div className="flex flex-col border-t border-gray-100">
          <ActionRow
            disabled={disabled || onDuplicate === undefined}
            icon="solar:copy-linear"
            label="Duplicar día"
            onPress={onDuplicate}
          />
          <ActionRow
            disabled={disabled || onCopyFrom === undefined}
            icon="solar:import-linear"
            label="Copiar desde otro día"
            onPress={onCopyFrom}
          />
          <ActionRow
            danger
            disabled={disabled || plannedMeals === 0}
            icon="solar:trash-bin-trash-linear"
            label="Eliminar comidas del día"
            onPress={onClear}
          />
        </div>
      </CardBody>
    </Card>
  );
}

function Ring({ value }: { value: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);

  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
        <circle
          cx="32"
          cy="32"
          fill="none"
          r={radius}
          stroke="#E5E7EB"
          strokeWidth="5"
        />
        <circle
          cx="32"
          cy="32"
          fill="none"
          r={radius}
          stroke="#22C55E"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="5"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-emerald-500">
        <Icon icon="solar:fire-bold" width={22} />
      </span>
    </div>
  );
}

function StatusBox({
  status,
  plannedMeals,
}: {
  status: DayStatus;
  plannedMeals: number;
}) {
  const meta =
    status === "complete"
      ? {
          wrap: "bg-emerald-50",
          fg: "text-emerald-700",
          icon: "solar:check-circle-bold",
          iconColor: "text-emerald-600",
          title: "Completo",
        }
      : status === "incomplete"
        ? {
            wrap: "bg-amber-50",
            fg: "text-amber-700",
            icon: "solar:clock-circle-linear",
            iconColor: "text-amber-600",
            title: "Incompleto",
          }
        : {
            wrap: "bg-gray-100",
            fg: "text-default-600",
            icon: "solar:plate-linear",
            iconColor: "text-default-400",
            title: "Sin comidas",
          };

  return (
    <div className={`flex items-center gap-2.5 rounded-large p-3 ${meta.wrap}`}>
      <Icon className={meta.iconColor} icon={meta.icon} width={20} />
      <div className="flex flex-col">
        <span className={`text-sm font-semibold ${meta.fg}`}>{meta.title}</span>
        <span className="text-xs text-default-500">
          {plannedMeals}{" "}
          {plannedMeals === 1 ? "comida planificada" : "comidas planificadas"}
        </span>
      </div>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  danger,
  disabled,
}: {
  icon: string;
  label: string;
  onPress?: (() => void) | undefined;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={`flex items-center gap-2.5 border-t border-gray-100 py-2.5 text-left text-sm first:border-t-0 disabled:opacity-40 ${
        danger ? "text-danger" : "text-gray-700"
      } ${disabled ? "cursor-not-allowed" : "hover:text-gray-900"}`}
      disabled={disabled === true}
      title={onPress === undefined ? "Próximamente" : undefined}
      type="button"
      onClick={() => onPress?.()}
    >
      <Icon icon={icon} width={17} />
      {label}
    </button>
  );
}

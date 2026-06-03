"use client";

import type { CycleDay } from "@/lib/nutrition/cycles/cycle-day";
import type { MealSlotOptionRow } from "@/lib/nutrition/cycles/meal-slot-option-service";

import { Card, CardBody, Chip, Divider, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState, type ReactNode } from "react";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import { resolveMealCycleViewState } from "@/components/client-dashboard/meal-cycle/meal-cycle-view-state";
import { useClientMealCycle } from "@/lib/hooks/use-client-queries";
import { shouldShowMacrosToClient } from "@/lib/nutrition/cycles/macro-visibility";

/** Page chrome shared by every branch (header + bottom nav). */
function MealCycleShell({ children }: { children: ReactNode }) {
  const {
    firstName,
    logoUrl,
    trainerName,
    clientProfilePicture,
    clientId,
    tenantSlug,
  } = useClientData();

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <ClientHeader
          clientId={clientId}
          clientProfilePicture={clientProfilePicture}
          firstName={firstName}
          logoUrl={logoUrl}
          tagline="Tu plan de comidas"
          tenantSlug={tenantSlug}
          trainerName={trainerName}
        />
        <main className="mx-auto w-full max-w-2xl px-4 py-4">{children}</main>
      </div>
      <ClientBottomNav />
    </>
  );
}

function CenteredState({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <Card className="mt-6">
      <CardBody className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <Icon className="text-default-400" icon={icon} width={44} />
        <p className="text-lg font-semibold text-foreground">{title}</p>
        {subtitle !== undefined ? (
          <p className="max-w-sm text-sm text-default-500">{subtitle}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function macroLine(option: MealSlotOptionRow): string {
  const t = option.item_snapshot.totals;

  return [
    `${Math.round(t.kcal)} kcal`,
    `P ${Math.round(t.protein_g)} g`,
    `C ${Math.round(t.carbs_g)} g`,
    `G ${Math.round(t.fat_g)} g`,
  ].join(" · ");
}

function OptionCard({
  option,
  index,
  showMacros,
}: {
  option: MealSlotOptionRow;
  index: number;
  showMacros: boolean;
}) {
  const snapshot = option.item_snapshot;

  return (
    <div className="rounded-xl border border-default-200 bg-content1 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-default-400">
            Opción {index + 1}
          </p>
          <p className="truncate text-sm font-semibold text-foreground">
            {snapshot.name}
          </p>
        </div>
        <Chip
          className="shrink-0"
          color={snapshot.sourceType === "recipe" ? "primary" : "default"}
          size="sm"
          variant="flat"
        >
          {snapshot.sourceType === "recipe" ? "Receta" : "Alimento"}
        </Chip>
      </div>
      {showMacros ? (
        <p className="mt-2 text-xs text-default-500">{macroLine(option)}</p>
      ) : null}
    </div>
  );
}

function SlotBlock({
  label,
  options,
  showMacros,
}: {
  label: string;
  options: MealSlotOptionRow[];
  showMacros: boolean;
}) {
  return (
    <Card>
      <CardBody className="gap-3">
        <p className="text-sm font-semibold text-foreground">
          {label.trim().length > 0 ? label : "Comida"}
        </p>
        {options.length === 0 ? (
          <p className="text-xs text-default-400">Sin opciones aún.</p>
        ) : (
          options.map((option, index) => (
            <OptionCard
              key={option.id}
              index={index}
              option={option}
              showMacros={showMacros}
            />
          ))
        )}
      </CardBody>
    </Card>
  );
}

function DaySelector({
  days,
  todayIndex,
  selectedIndex,
  onSelect,
}: {
  days: CycleDay[];
  todayIndex: number;
  selectedIndex: number;
  onSelect: (dayIndex: number) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {days.map((day) => {
        const isToday = day.dayIndex === todayIndex;
        const isSelected = day.dayIndex === selectedIndex;

        return (
          <button
            key={day.dayIndex}
            className={`flex shrink-0 flex-col items-center rounded-xl border px-4 py-2 text-sm transition-colors ${
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-default-200 bg-content1 text-default-600"
            }`}
            type="button"
            onClick={() => onSelect(day.dayIndex)}
          >
            <span className="font-semibold">Día {day.dayIndex + 1}</span>
            {isToday ? (
              <span
                className={`text-[10px] font-medium uppercase ${
                  isSelected ? "text-primary-foreground/80" : "text-primary"
                }`}
              >
                Hoy
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Client "today" view for the assigned meal cycle (nutrition-v2, P4-T2).
 *
 * Lands on the current cycle-day (highlighted "Hoy"), with the day's meals in
 * order and each meal's options rendered from the frozen snapshot — name +
 * macros, no recipe-library join. Macro numbers are gated by
 * {@link shouldShowMacrosToClient}. Vertical-video / photo detail is the next
 * slice; this one shows the day's meals and options only.
 */
export function MealCycleContent() {
  const { data, isPending, isError } = useClientMealCycle();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Default the selected day to today once the cycle resolves. Re-syncs if the
  // cycle (and thus today's index) changes underneath us.
  const todayIndex =
    data?.position?.started === true ? data.position.dayIndex : null;

  useEffect(() => {
    if (todayIndex !== null && todayIndex !== undefined) {
      setSelectedDay(todayIndex);
    }
  }, [todayIndex]);

  if (isPending) {
    return (
      <MealCycleShell>
        <div className="flex justify-center p-12">
          <Spinner color="primary" />
        </div>
      </MealCycleShell>
    );
  }

  if (isError) {
    return (
      <MealCycleShell>
        <CenteredState
          icon="solar:danger-triangle-linear"
          subtitle="Vuelve a intentarlo en un momento."
          title="No pudimos cargar tu plan"
        />
      </MealCycleShell>
    );
  }

  // `null` = no active cycle or the feature is off (404). Both render empty.
  const state =
    data === undefined || data === null
      ? ({ kind: "empty" } as const)
      : resolveMealCycleViewState(data);

  if (data === undefined || data === null || state.kind === "empty") {
    return (
      <MealCycleShell>
        <CenteredState
          icon="solar:plate-linear"
          subtitle="Tu entrenador aún no te ha asignado un plan de comidas."
          title="Sin plan activo"
        />
      </MealCycleShell>
    );
  }

  if (state.kind === "not-started") {
    return (
      <MealCycleShell>
        <CenteredState
          icon="solar:calendar-linear"
          subtitle={`Tu plan "${data.cycle?.name ?? ""}" comienza el ${data.cycle?.startDate ?? ""}.`}
          title="Tu plan aún no empieza"
        />
      </MealCycleShell>
    );
  }

  const showMacros = shouldShowMacrosToClient();
  const activeIndex = selectedDay ?? state.activeDayIndex;
  const visibleDay = data.days[activeIndex] ?? null;

  return (
    <MealCycleShell>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {data.cycle?.name}
          </h1>
          <p className="text-sm text-default-500">
            Día {state.activeDayIndex + 1} de {data.cycle?.durationDays} · hoy
          </p>
        </div>

        <DaySelector
          days={data.days}
          selectedIndex={activeIndex}
          todayIndex={state.activeDayIndex}
          onSelect={setSelectedDay}
        />

        <Divider />

        {visibleDay === null || visibleDay.slots.length === 0 ? (
          <CenteredState
            icon="solar:plate-linear"
            title="No hay comidas para este día"
          />
        ) : (
          <div className="flex flex-col gap-3">
            {visibleDay.slots.map((slot) => (
              <SlotBlock
                key={slot.id}
                label={slot.label}
                options={slot.options}
                showMacros={showMacros}
              />
            ))}
          </div>
        )}
      </div>
    </MealCycleShell>
  );
}

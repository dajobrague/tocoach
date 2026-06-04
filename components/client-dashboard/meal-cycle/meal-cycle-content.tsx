"use client";

import type {
  ClientDayNote,
  ClientMealLog,
  CycleDay,
} from "@/lib/nutrition/cycles/cycle-day";
import type { MealSlotOptionRow } from "@/lib/nutrition/cycles/meal-slot-option-service";

import { Card, CardBody, Chip, Divider, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState, type ReactNode } from "react";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import { MealLogControl } from "@/components/client-dashboard/meal-cycle/meal-log-control";
import { resolveMealCycleViewState } from "@/components/client-dashboard/meal-cycle/meal-cycle-view-state";
import { normalizeOptionSnapshot } from "@/components/client-dashboard/meal-cycle/normalize-snapshot";
import { RecipeOptionDetail } from "@/components/client-dashboard/meal-cycle/recipe-option-detail";
import { ShoppingListSection } from "@/components/client-dashboard/shopping-list/shopping-list-section";
import {
  useClientMealCycle,
  useSetMealCycleSelection,
} from "@/lib/hooks/use-client-queries";
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
  const t = normalizeOptionSnapshot(option.item_snapshot).totals;

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
  selectable,
  isSelected,
  onOpen,
  onSelect,
}: {
  option: MealSlotOptionRow;
  index: number;
  showMacros: boolean;
  /** True when the slot has >1 option, so the client chooses one. */
  selectable: boolean;
  isSelected: boolean;
  onOpen: (option: MealSlotOptionRow) => void;
  onSelect: (option: MealSlotOptionRow) => void;
}) {
  const snapshot = normalizeOptionSnapshot(option.item_snapshot);

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border bg-content1 p-3 transition-colors ${
        isSelected ? "border-primary ring-1 ring-primary" : "border-default-200"
      }`}
      data-selected={isSelected}
      data-testid="option-card"
    >
      {selectable ? (
        <button
          aria-label="Elegir esta opción"
          aria-pressed={isSelected}
          className="shrink-0"
          data-testid="option-select"
          type="button"
          onClick={() => onSelect(option)}
        >
          <Icon
            className={isSelected ? "text-primary" : "text-default-300"}
            icon={
              isSelected
                ? "solar:check-circle-bold"
                : "solar:record-circle-linear"
            }
            width={24}
          />
        </button>
      ) : null}
      <button
        className="min-w-0 flex-1 text-left"
        data-testid="option-open"
        type="button"
        onClick={() => onOpen(option)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-default-400">
              Opción {index + 1}
            </p>
            <p className="truncate text-sm font-semibold text-foreground">
              {snapshot.name}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Chip
              color={snapshot.sourceType === "recipe" ? "primary" : "default"}
              size="sm"
              variant="flat"
            >
              {snapshot.sourceType === "recipe" ? "Receta" : "Alimento"}
            </Chip>
            <Icon
              className="text-default-300"
              icon="solar:alt-arrow-right-linear"
              width={18}
            />
          </div>
        </div>
        {showMacros ? (
          <p className="mt-2 text-xs text-default-500">{macroLine(option)}</p>
        ) : null}
      </button>
    </div>
  );
}

function SlotBlock({
  slotId,
  label,
  options,
  showMacros,
  selectedOptionId,
  isToday,
  logDate,
  log,
  onOpenOption,
  onSelectOption,
}: {
  slotId: string;
  label: string;
  options: MealSlotOptionRow[];
  showMacros: boolean;
  selectedOptionId: string | null;
  /** Only today's meals get a log control. */
  isToday: boolean;
  logDate: string;
  log: ClientMealLog | undefined;
  onOpenOption: (option: MealSlotOptionRow) => void;
  onSelectOption: (option: MealSlotOptionRow) => void;
}) {
  const selectable = options.length > 1;
  // Attach the chosen option for eaten_planned: the selection, or the only one.
  const logOptionId =
    selectedOptionId ??
    (options.length === 1 ? (options[0]?.id ?? null) : null);

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
              isSelected={selectable && selectedOptionId === option.id}
              option={option}
              selectable={selectable}
              showMacros={showMacros}
              onOpen={onOpenOption}
              onSelect={onSelectOption}
            />
          ))
        )}
        {isToday ? (
          <MealLogControl
            log={log}
            logDate={logDate}
            optionId={logOptionId}
            slotId={slotId}
          />
        ) : null}
      </CardBody>
    </Card>
  );
}

/** Trainer notes for today — a clearly highlighted banner above the meals. */
function DayNotesBanner({ notes }: { notes: ClientDayNote[] }) {
  if (notes.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-xl border border-warning-200 bg-warning-50 p-3"
      data-testid="day-notes"
    >
      <div className="flex items-center gap-2">
        <Icon
          className="text-warning-600"
          icon="solar:notebook-bold"
          width={18}
        />
        <p className="text-sm font-semibold text-warning-700">
          Notas de tu entrenador
        </p>
      </div>
      <ul className="mt-1 flex flex-col gap-1 pl-1 text-sm text-foreground">
        {notes.map((note) => (
          <li key={note.id}>{note.text}</li>
        ))}
      </ul>
    </div>
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
            aria-current={isSelected}
            className={`flex shrink-0 flex-col items-center rounded-xl border px-4 py-2 text-sm transition-colors ${
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-default-200 bg-content1 text-default-600"
            }`}
            data-testid="cycle-day"
            data-today={isToday}
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
 * {@link shouldShowMacrosToClient}. Tapping an option opens the full recipe
 * detail (photos, vertical video, ingredients, steps) — see RecipeOptionDetail.
 */
export function MealCycleContent() {
  const { data, isPending, isError } = useClientMealCycle();
  const selectMutation = useSetMealCycleSelection();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [detailOption, setDetailOption] = useState<MealSlotOptionRow | null>(
    null
  );

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

        {activeIndex === state.activeDayIndex ? (
          <DayNotesBanner notes={data.notes} />
        ) : null}

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
                isToday={activeIndex === state.activeDayIndex}
                label={slot.label}
                log={data.logs[slot.id]}
                logDate={data.today}
                options={slot.options}
                selectedOptionId={data.selections[slot.id] ?? null}
                showMacros={showMacros}
                slotId={slot.id}
                onOpenOption={setDetailOption}
                onSelectOption={(option) =>
                  selectMutation.mutate({
                    slotId: slot.id,
                    optionId: option.id,
                  })
                }
              />
            ))}
          </div>
        )}

        {/* Merged shopping list for the active cycle — same nav spot the legacy
            "Lista de Compras Semanal" section holds in the old nutrition view. */}
        <ShoppingListSection />
      </div>

      <RecipeOptionDetail
        option={detailOption}
        onClose={() => setDetailOption(null)}
      />
    </MealCycleShell>
  );
}

"use client";

import type {
  ClientDayNote,
  ClientMealLog,
} from "@/lib/nutrition/cycles/cycle-day";
import type { ClientWeekDay } from "@/lib/nutrition/cycles/client-week";
import type { MealSlotOptionRow } from "@/lib/nutrition/cycles/meal-slot-option-service";

import { Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";

import { MealLogControl } from "@/components/client-dashboard/meal-cycle/meal-log-control";
import { normalizeOptionSnapshot } from "@/components/client-dashboard/meal-cycle/normalize-snapshot";

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
  canLog,
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
  /** Whether this date can be logged (today/past within 30d) — server-gated. */
  canLog: boolean;
  logDate: string;
  log: ClientMealLog | undefined;
  onOpenOption: (option: MealSlotOptionRow) => void;
  onSelectOption: (option: MealSlotOptionRow) => void;
}) {
  const selectable = options.length > 1;
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
        {canLog ? (
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

/** Trainer notes for the selected day — a clearly highlighted banner. */
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

/**
 * The selected day's resolved plan: notes banner, then each meal slot (options
 * from the frozen snapshot, swaps already applied). The log control only
 * renders when `day.canLog` is true — future days are view-only, matching the
 * server-side log-window lock.
 */
export function MealCycleDayPanel({
  day,
  selections,
  showMacros,
  onOpenOption,
  onSelectOption,
}: {
  day: ClientWeekDay;
  selections: Record<string, string>;
  showMacros: boolean;
  onOpenOption: (option: MealSlotOptionRow) => void;
  onSelectOption: (option: MealSlotOptionRow) => void;
}) {
  if (day.started === false) {
    return (
      <Card>
        <CardBody className="px-6 py-10 text-center text-sm text-default-500">
          Este día es anterior al inicio de tu plan.
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="day-panel">
      <DayNotesBanner notes={day.notes} />

      {day.slots.length === 0 ? (
        <Card>
          <CardBody className="px-6 py-10 text-center text-sm text-default-500">
            No hay comidas para este día.
          </CardBody>
        </Card>
      ) : (
        day.slots.map((slot) => (
          <SlotBlock
            key={slot.id}
            canLog={day.canLog}
            label={slot.label}
            log={day.logs[slot.id]}
            logDate={day.date}
            options={slot.options}
            selectedOptionId={selections[slot.id] ?? null}
            showMacros={showMacros}
            slotId={slot.id}
            onOpenOption={onOpenOption}
            onSelectOption={onSelectOption}
          />
        ))
      )}
    </div>
  );
}

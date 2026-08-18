"use client";

import type { ClientDayNote } from "@/lib/nutrition/cycles/cycle-day";
import type { ClientWeekDay } from "@/lib/nutrition/cycles/client-week";
import type { MealSlotOptionRow } from "@/lib/nutrition/cycles/meal-slot-option-service";

import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

import { MacroDotsLine } from "@/components/client-dashboard/meal-cycle/macro-ui";
import { normalizeOptionSnapshot } from "@/components/client-dashboard/meal-cycle/normalize-snapshot";
import {
  chosenOption,
  slotComponents,
  slotPlannedTotals,
} from "@/components/client-dashboard/meal-cycle/slot-grouping";
import { mealVisual } from "@/features/trainer/cycles/cycle-format";

/** Photo thumbnail from the frozen snapshot, with a source-icon fallback. */
function OptionThumb({ option }: { option: MealSlotOptionRow }) {
  const snapshot = normalizeOptionSnapshot(option.item_snapshot);
  const image = snapshot.images[0]?.url;

  if (image === undefined) {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-default-200 bg-content2">
        <Icon
          className="text-default-300"
          icon={
            snapshot.sourceType === "recipe"
              ? "solar:chef-hat-linear"
              : "solar:cup-hot-linear"
          }
          width={20}
        />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className="h-12 w-12 shrink-0 rounded-xl border border-default-200 object-cover"
      decoding="async"
      loading="lazy"
      src={image}
    />
  );
}

function OptionCard({
  option,
  showMacros,
  selectable,
  isSelected,
  onOpen,
  onSelect,
}: {
  option: MealSlotOptionRow;
  showMacros: boolean;
  selectable: boolean;
  isSelected: boolean;
  onOpen: (option: MealSlotOptionRow) => void;
  onSelect: (option: MealSlotOptionRow) => void;
}) {
  const snapshot = normalizeOptionSnapshot(option.item_snapshot);

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border bg-content1 p-2.5 transition-colors ${
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
            width={22}
          />
        </button>
      ) : null}

      <button
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        data-testid="option-open"
        type="button"
        onClick={() => onOpen(option)}
      >
        <OptionThumb option={option} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {snapshot.name}
            {snapshot.brand !== null && (
              <span className="font-normal text-default-400">
                {" · "}
                {snapshot.brand}
              </span>
            )}
          </p>
          {showMacros ? (
            <MacroDotsLine
              carbs_g={snapshot.totals.carbs_g}
              className="mt-1 text-xs"
              fat_g={snapshot.totals.fat_g}
              protein_g={snapshot.totals.protein_g}
            />
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {showMacros ? (
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {Math.round(snapshot.totals.kcal)}{" "}
              <span className="text-xs font-normal text-default-400">kcal</span>
            </span>
          ) : null}
          <Icon
            className="text-default-300"
            icon="solar:alt-arrow-right-linear"
            width={16}
          />
        </div>
      </button>
    </div>
  );
}

/**
 * One alternative inside the swipe carousel: photo on top (tap = choose),
 * name/macros row below (tap = open the recipe detail). Same testids as the
 * stacked card so the e2e selection flow keeps working.
 */
function CarouselOptionCard({
  option,
  showMacros,
  isSelected,
  onOpen,
  onSelect,
}: {
  option: MealSlotOptionRow;
  showMacros: boolean;
  isSelected: boolean;
  onOpen: (option: MealSlotOptionRow) => void;
  onSelect: (option: MealSlotOptionRow) => void;
}) {
  const snapshot = normalizeOptionSnapshot(option.item_snapshot);
  const image = snapshot.images[0]?.url;

  return (
    <div
      className={`w-[72%] max-w-[240px] shrink-0 snap-start overflow-hidden rounded-xl border bg-content1 transition-colors ${
        isSelected ? "border-primary ring-1 ring-primary" : "border-default-200"
      }`}
      data-selected={isSelected}
      data-testid="option-card"
    >
      <button
        aria-label="Elegir esta opción"
        aria-pressed={isSelected}
        className="relative block w-full"
        data-testid="option-select"
        type="button"
        onClick={() => onSelect(option)}
      >
        {image !== undefined ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="h-24 w-full object-cover"
            decoding="async"
            loading="lazy"
            src={image}
          />
        ) : (
          <span className="flex h-24 w-full items-center justify-center bg-content2">
            <Icon
              className="text-default-300"
              icon={
                snapshot.sourceType === "recipe"
                  ? "solar:chef-hat-linear"
                  : "solar:cup-hot-linear"
              }
              width={28}
            />
          </span>
        )}
        <span
          className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full ${
            isSelected
              ? "bg-primary text-primary-foreground"
              : "bg-background/80 text-default-400"
          }`}
        >
          <Icon
            icon={
              isSelected
                ? "solar:check-circle-bold"
                : "solar:record-circle-linear"
            }
            width={18}
          />
        </span>
      </button>

      <button
        className="flex w-full items-center gap-2 p-2.5 text-left"
        data-testid="option-open"
        type="button"
        onClick={() => onOpen(option)}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {snapshot.name}
            {snapshot.brand !== null && (
              <span className="font-normal text-default-400">
                {" · "}
                {snapshot.brand}
              </span>
            )}
          </p>
          {showMacros ? (
            <p className="text-xs text-default-500 tabular-nums">
              {Math.round(snapshot.totals.kcal)} kcal
            </p>
          ) : null}
        </div>
        <Icon
          className="shrink-0 text-default-300"
          icon="solar:alt-arrow-right-linear"
          width={16}
        />
      </button>
    </div>
  );
}

/**
 * One component of a meal (a `group_index` group). Multiple options within a
 * component are alternatives — a horizontal swipe carousel where the client
 * picks one (Traineeks-style "¡Tú eliges!"); the chosen (or default first)
 * option counts toward the meal. A single option renders as a plain row.
 */
function ComponentSection({
  options,
  showMacros,
  selectedOptionId,
  onOpenOption,
  onSelectOption,
}: {
  options: MealSlotOptionRow[];
  showMacros: boolean;
  selectedOptionId: string | null;
  onOpenOption: (option: MealSlotOptionRow) => void;
  onSelectOption: (option: MealSlotOptionRow) => void;
}) {
  const selectable = options.length > 1;

  if (selectable === false) {
    return (
      <div className="flex flex-col gap-1.5">
        {options.map((option) => (
          <OptionCard
            key={option.id}
            isSelected={false}
            option={option}
            selectable={false}
            showMacros={showMacros}
            onOpen={onOpenOption}
            onSelect={onSelectOption}
          />
        ))}
      </div>
    );
  }

  const chosenId =
    chosenOption({ groupIndex: 0, options }, selectedOptionId)?.id ?? null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1 self-start rounded-full border border-primary/50 px-2 py-0.5 text-[11px] font-semibold text-primary">
        <Icon icon="solar:transfer-horizontal-linear" width={13} />
        ¡Tú eliges!
      </span>
      <div
        className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1"
        data-testid="option-carousel"
      >
        {options.map((option) => (
          <CarouselOptionCard
            key={option.id}
            isSelected={chosenId === option.id}
            option={option}
            showMacros={showMacros}
            onOpen={onOpenOption}
            onSelect={onSelectOption}
          />
        ))}
      </div>
    </div>
  );
}

function SlotBlock({
  label,
  options,
  showMacros,
  selectedOptionId,
  onOpenOption,
  onSelectOption,
}: {
  label: string;
  options: MealSlotOptionRow[];
  showMacros: boolean;
  selectedOptionId: string | null;
  onOpenOption: (option: MealSlotOptionRow) => void;
  onSelectOption: (option: MealSlotOptionRow) => void;
}) {
  const cleanLabel = label.trim().length > 0 ? label : "Comida";
  const visual = mealVisual(cleanLabel);
  const components = slotComponents(options);
  const mealKcal = slotPlannedTotals(options, selectedOptionId).kcal;

  return (
    <Card>
      <CardBody className="gap-3 p-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${visual.bg} ${visual.fg}`}
          >
            <Icon icon={visual.icon} width={18} />
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {cleanLabel}
          </p>
          {showMacros && components.length > 0 ? (
            <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
              {Math.round(mealKcal)} kcal
            </span>
          ) : null}
        </div>

        {components.length === 0 ? (
          <p className="text-xs text-default-400">Sin opciones aún.</p>
        ) : (
          components.map((component, index) => (
            <div key={component.groupIndex} className="flex flex-col gap-1.5">
              {index > 0 ? (
                <div className="flex items-center gap-2 py-0.5">
                  <span className="h-px flex-1 bg-default-100" />
                  <Icon
                    className="text-default-300"
                    icon="solar:add-circle-linear"
                    width={14}
                  />
                  <span className="h-px flex-1 bg-default-100" />
                </div>
              ) : null}
              <ComponentSection
                options={component.options}
                selectedOptionId={selectedOptionId}
                showMacros={showMacros}
                onOpenOption={onOpenOption}
                onSelectOption={onSelectOption}
              />
            </div>
          ))
        )}
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
 * The selected day's resolved plan: notes banner, then each meal slot. A slot
 * renders its components (group_index groups that sum toward the meal), each
 * with photo thumbnails from the frozen snapshot and choose-one alternatives.
 * The log control only renders when `day.canLog` is true — future days are
 * view-only, matching the server-side log-window lock.
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
            label={slot.label}
            options={slot.options}
            selectedOptionId={selections[slot.id] ?? null}
            showMacros={showMacros}
            onOpenOption={onOpenOption}
            onSelectOption={onSelectOption}
          />
        ))
      )}
    </div>
  );
}

"use client";

import type { ClientDayNote } from "@/lib/nutrition/cycles/cycle-day";
import type { ClientWeekDay } from "@/lib/nutrition/cycles/client-week";
import type { MealSlotOptionRow } from "@/lib/nutrition/cycles/meal-slot-option-service";
import type { NormalizedSnapshot } from "@/components/client-dashboard/meal-cycle/normalize-snapshot";

import { Icon } from "@iconify/react";

import { SectionHeader } from "@/components/client-dashboard/client-page";
import {
  MacroDotsLine,
  NutritionState,
  SoftChip,
} from "@/components/client-dashboard/meal-cycle/macro-ui";
import { normalizeOptionSnapshot } from "@/components/client-dashboard/meal-cycle/normalize-snapshot";
import {
  chosenOption,
  slotComponents,
  slotPlannedTotals,
} from "@/components/client-dashboard/meal-cycle/slot-grouping";
import { IconTile } from "@/components/shared/icon-tile";
import { mealVisual } from "@/features/trainer/cycles/cycle-format";

/** Source-type pictogram for options frozen without a photo. */
function fallbackIcon(snapshot: NormalizedSnapshot): string {
  return snapshot.sourceType === "recipe"
    ? "solar:chef-hat-linear"
    : "solar:cup-hot-linear";
}

/** 48px photo from the frozen snapshot, with a source-icon fallback. */
function OptionThumb({ snapshot }: { snapshot: NormalizedSnapshot }) {
  const image = snapshot.images[0]?.url;

  if (image === undefined) {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-default-100">
        <Icon
          className="text-default-400"
          icon={fallbackIcon(snapshot)}
          width={22}
        />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className="h-12 w-12 shrink-0 rounded-xl object-cover"
      decoding="async"
      loading="lazy"
      src={image}
    />
  );
}

/** "Pollo con arroz · Marca" — the option name with its brand muted. */
function OptionName({ snapshot }: { snapshot: NormalizedSnapshot }) {
  return (
    <>
      {snapshot.name}
      {snapshot.brand !== null && (
        <span className="font-medium text-default-500">
          {" · "}
          {snapshot.brand}
        </span>
      )}
    </>
  );
}

/** A component with a single option: one tappable row → detail. */
function OptionRow({
  option,
  showMacros,
  onOpen,
}: {
  option: MealSlotOptionRow;
  showMacros: boolean;
  onOpen: (option: MealSlotOptionRow) => void;
}) {
  const snapshot = normalizeOptionSnapshot(option.item_snapshot);

  return (
    <div data-selected={false} data-testid="option-card">
      <button
        className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-transform active:scale-[0.98] motion-reduce:transition-none [@media(hover:hover)]:hover:bg-default-100"
        data-testid="option-open"
        type="button"
        onClick={() => onOpen(option)}
      >
        <OptionThumb snapshot={snapshot} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug text-foreground">
            <OptionName snapshot={snapshot} />
          </span>
          <IngredientQuantities ingredients={snapshot.ingredients} />
          {showMacros ? (
            <MacroDotsLine
              carbs_g={snapshot.totals.carbs_g}
              className="mt-1"
              fat_g={snapshot.totals.fat_g}
              protein_g={snapshot.totals.protein_g}
            />
          ) : null}
        </span>
        {showMacros ? (
          <span className="shrink-0 text-right">
            <span className="block text-[15px] font-semibold text-foreground tabular-nums">
              {Math.round(snapshot.totals.kcal).toLocaleString("es")}
            </span>
            <span className="block text-xs text-default-500">kcal</span>
          </span>
        ) : null}
        <Icon
          className="-ml-1 shrink-0 text-default-400"
          icon="solar:alt-arrow-right-linear"
          width={16}
        />
      </button>
    </div>
  );
}

/**
 * One alternative inside the swipe carousel: photo on top (tap = choose),
 * name/portion/kcal below (tap = open the recipe detail). Testids shared
 * with the single-option row so the e2e selection flow keeps working.
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
      className={`flex w-[72%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl transition-[box-shadow,background-color] duration-200 motion-reduce:transition-none ${
        isSelected ? "bg-content1 ring-2 ring-primary" : "bg-default-100"
      }`}
      data-selected={isSelected}
      data-testid="option-card"
    >
      <button
        aria-checked={isSelected}
        aria-label={`Elegir ${snapshot.name}`}
        className="relative block w-full active:opacity-80"
        data-testid="option-select"
        role="radio"
        type="button"
        onClick={() => onSelect(option)}
      >
        {image !== undefined ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="aspect-video w-full object-cover"
            decoding="async"
            loading="lazy"
            src={image}
          />
        ) : (
          <span className="flex aspect-video w-full items-center justify-center bg-default-200/60">
            <Icon
              className="text-default-400"
              icon={fallbackIcon(snapshot)}
              width={34}
            />
          </span>
        )}
        <span
          className={`absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full transition-[transform,background-color] duration-200 motion-reduce:transition-none ${
            isSelected
              ? "scale-105 bg-primary text-primary-foreground ring-2 ring-content1"
              : "bg-black/40 text-transparent ring-2 ring-inset ring-white"
          }`}
        >
          <Icon icon="solar:unread-linear" width={16} />
        </span>
      </button>

      <button
        className="group flex flex-1 flex-col items-start gap-0.5 px-3 pb-3 pt-2.5 text-left"
        data-testid="option-open"
        type="button"
        onClick={() => onOpen(option)}
      >
        <b className="text-[15px] font-semibold leading-snug text-foreground underline-offset-[3px] [@media(hover:hover)]:group-hover:underline">
          <OptionName snapshot={snapshot} />
        </b>
        <IngredientQuantities ingredients={snapshot.ingredients} />
        <span className="mt-auto flex w-full items-center justify-between pt-2 text-[13px] text-default-500">
          {showMacros ? (
            <span>
              <span className="text-[15px] font-semibold text-foreground tabular-nums">
                {Math.round(snapshot.totals.kcal).toLocaleString("es")}
              </span>{" "}
              kcal
            </span>
          ) : (
            <span />
          )}
          <span className="inline-flex items-center font-semibold text-primary">
            {snapshot.sourceType === "recipe" ? "Ver receta" : "Ver alimento"}
            <Icon icon="solar:alt-arrow-right-linear" width={14} />
          </span>
        </span>
      </button>
    </div>
  );
}

const EMPTY_IDS: readonly string[] = [];

/**
 * "Arroz 80 g · Pollo 150 g" — the option's ingredient quantities, so the
 * client sees how much of each food without opening the detail.
 */
function IngredientQuantities({
  ingredients,
}: {
  ingredients: NormalizedSnapshot["ingredients"];
}) {
  if (ingredients.length === 0) return null;

  return (
    <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-default-500 tabular-nums">
      {ingredients
        .map((ing) => `${ing.name} ${ing.quantity} ${ing.unit}`)
        .join(" · ")}
    </span>
  );
}

/**
 * One component of a meal (a `group_index` group). Multiple options within a
 * component are alternatives — a horizontal swipe carousel where the client
 * picks one (Traineeks-style "¡Tú eliges!"); the chosen (or default first)
 * option counts toward the meal. A single option renders as a plain row.
 */
function ComponentSection({
  label,
  options,
  showMacros,
  selectedOptionIds,
  onOpenOption,
  onSelectOption,
}: {
  label: string;
  options: MealSlotOptionRow[];
  showMacros: boolean;
  selectedOptionIds: readonly string[];
  onOpenOption: (option: MealSlotOptionRow) => void;
  onSelectOption: (option: MealSlotOptionRow) => void;
}) {
  if (options.length <= 1) {
    return (
      <>
        {options.map((option) => (
          <OptionRow
            key={option.id}
            option={option}
            showMacros={showMacros}
            onOpen={onOpenOption}
          />
        ))}
      </>
    );
  }

  const chosenId =
    chosenOption({ groupIndex: 0, options }, selectedOptionIds)?.id ?? null;

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <SoftChip brand>¡Tú eliges!</SoftChip>
        <span className="text-xs text-default-500">
          {options.length} opciones · toca la foto para elegir
        </span>
      </div>
      <div
        aria-label={`Opciones de ${label.toLowerCase()}`}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto overscroll-x-contain px-4 pb-1.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-testid="option-carousel"
        role="radiogroup"
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

/** "+" between components that add up within the same meal. */
function PlusDivider() {
  return (
    <div aria-hidden className="relative grid h-7 place-items-center">
      <span className="absolute inset-x-0 top-1/2 h-px bg-default-200" />
      <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-content1 text-default-400 ring-1 ring-inset ring-default-200">
        <Icon icon="solar:add-linear" width={14} />
      </span>
    </div>
  );
}

function SlotBlock({
  label,
  options,
  showMacros,
  selectedOptionIds,
  onOpenOption,
  onSelectOption,
}: {
  label: string;
  options: MealSlotOptionRow[];
  showMacros: boolean;
  selectedOptionIds: readonly string[];
  onOpenOption: (option: MealSlotOptionRow) => void;
  onSelectOption: (option: MealSlotOptionRow) => void;
}) {
  const cleanLabel = label.trim().length > 0 ? label : "Comida";
  const visual = mealVisual(cleanLabel);
  const components = slotComponents(options);
  const mealKcal = slotPlannedTotals(options, selectedOptionIds).kcal;

  return (
    <article className="rounded-large bg-content1 px-4 pb-4 pt-3.5 shadow-small">
      <header className="mb-3 flex items-center gap-2.5">
        <IconTile icon={visual.icon} size="sm" />
        <h3 className="min-w-0 flex-1 truncate font-heading text-[17px] leading-tight tracking-[-0.01em] text-foreground">
          {cleanLabel}
        </h3>
        {showMacros && components.length > 0 ? (
          <span className="shrink-0 text-sm font-semibold text-default-500 tabular-nums">
            {Math.round(mealKcal).toLocaleString("es")} kcal
          </span>
        ) : null}
      </header>

      {components.length === 0 ? (
        <p className="rounded-[14px] bg-default-100 p-3.5 text-center text-sm text-default-500">
          Sin opciones aún.
        </p>
      ) : (
        components.map((component, index) => (
          <div key={component.groupIndex}>
            {index > 0 ? <PlusDivider /> : null}
            <ComponentSection
              label={cleanLabel}
              options={component.options}
              selectedOptionIds={selectedOptionIds}
              showMacros={showMacros}
              onOpenOption={onOpenOption}
              onSelectOption={onSelectOption}
            />
          </div>
        ))
      )}
    </article>
  );
}

/** Trainer notes for the selected day — a neutral card with a small tile. */
function DayNotesBanner({ notes }: { notes: ClientDayNote[] }) {
  if (notes.length === 0) {
    return null;
  }

  return (
    <aside
      className="rounded-large bg-content1 px-4 py-3.5 shadow-small"
      data-testid="day-notes"
    >
      <div className="flex items-center gap-2.5">
        <IconTile icon="solar:notebook-linear" size="sm" />
        <p className="text-[15px] font-semibold text-foreground">
          Notas de tu entrenador
        </p>
      </div>
      <ul className="mt-2.5 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-snug text-foreground marker:text-default-400">
        {notes.map((note) => (
          <li key={note.id}>{note.text}</li>
        ))}
      </ul>
    </aside>
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
  selections: Record<string, string[]>;
  showMacros: boolean;
  onOpenOption: (option: MealSlotOptionRow) => void;
  onSelectOption: (option: MealSlotOptionRow) => void;
}) {
  if (day.started === false) {
    return (
      <NutritionState
        icon="solar:calendar-linear"
        title="Este día es anterior al inicio de tu plan."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5" data-testid="day-panel">
      <DayNotesBanner notes={day.notes} />

      {day.slots.length === 0 ? (
        <NutritionState
          icon="solar:plate-linear"
          title="No hay comidas para este día."
        />
      ) : (
        <section>
          <SectionHeader title="Comidas del día" />
          <div className="flex flex-col gap-3">
            {day.slots.map((slot) => (
              <SlotBlock
                key={slot.id}
                label={slot.label}
                options={slot.options}
                selectedOptionIds={selections[slot.id] ?? EMPTY_IDS}
                showMacros={showMacros}
                onOpenOption={onOpenOption}
                onSelectOption={onSelectOption}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

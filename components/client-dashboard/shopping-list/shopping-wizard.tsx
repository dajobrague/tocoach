"use client";

import type { ClientWeekDay } from "@/lib/nutrition/cycles/client-week";
import type { MealSlotWithOptions } from "@/lib/nutrition/cycles/meal-cycle-service";
import type { MealSlotOptionRow } from "@/lib/nutrition/cycles/meal-slot-option-service";
import type { ShoppingListItem } from "@/lib/nutrition/shopping/shopping-list";

import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { normalizeOptionSnapshot } from "@/components/client-dashboard/meal-cycle/normalize-snapshot";
import { ShoppingResultList } from "@/components/client-dashboard/shopping-list/shopping-result-list";
import {
  aggregatePickedMeals,
  defaultOptionId,
  mealKey,
  picksFromMap,
  picksStorageKey,
  wizardCheckedKey,
} from "@/components/client-dashboard/shopping-list/shopping-wizard-helpers";

type PicksMap = Record<string, string>;

function loadPicks(weekStart: string): PicksMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(picksStorageKey(weekStart));
    const parsed: unknown = raw === null ? {} : JSON.parse(raw);

    return parsed !== null && typeof parsed === "object"
      ? (parsed as PicksMap)
      : {};
  } catch {
    return {};
  }
}

function savePicks(weekStart: string, picks: PicksMap): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      picksStorageKey(weekStart),
      JSON.stringify(picks)
    );
  } catch {
    // Private mode / quota — picks are a convenience, ignore.
  }
}

function dayLabel(ymd: string): string {
  try {
    const [y, m, d] = ymd.split("-").map(Number);
    const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
    const label = new Intl.DateTimeFormat("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(date);

    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return ymd;
  }
}

function optionName(option: MealSlotOptionRow): string {
  return normalizeOptionSnapshot(option.item_snapshot).name;
}

function MealRow({
  date,
  slot,
  pickedOptionId,
  onToggle,
  onChooseOption,
}: {
  date: string;
  slot: MealSlotWithOptions;
  /** The chosen option id, or `undefined` when the meal is not picked. */
  pickedOptionId: string | undefined;
  onToggle: () => void;
  onChooseOption: (optionId: string) => void;
}) {
  const isPicked = pickedOptionId !== undefined;
  const multi = slot.options.length > 1;

  return (
    <div className="flex flex-col gap-1.5" data-testid="wizard-meal">
      <button
        aria-pressed={isPicked}
        className="flex items-center gap-2 rounded-lg bg-default-50 px-3 py-2 text-left"
        data-picked={isPicked}
        data-testid="wizard-meal-toggle"
        type="button"
        onClick={onToggle}
      >
        <Icon
          className={isPicked ? "text-primary" : "text-default-300"}
          icon={isPicked ? "solar:check-square-bold" : "solar:stop-linear"}
          width={22}
        />
        <span className="flex-1 text-sm font-medium text-foreground">
          {slot.label.trim().length > 0 ? slot.label : "Comida"}
        </span>
        {isPicked === false && slot.options[0] !== undefined ? (
          <span className="truncate text-xs text-default-400">
            {optionName(slot.options[0])}
          </span>
        ) : null}
      </button>

      {isPicked && multi ? (
        <div className="flex flex-wrap gap-1.5 pl-9">
          {slot.options.map((option) => (
            <button
              key={option.id}
              aria-pressed={option.id === pickedOptionId}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                option.id === pickedOptionId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-default-200 bg-content1 text-default-600"
              }`}
              data-testid="wizard-option"
              type="button"
              onClick={() => onChooseOption(option.id)}
            >
              {optionName(option)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The week shopping wizard (P-wizard). Scoped to the visible week's resolved
 * days (all 7, including future — that's the point of planning ahead). The
 * client toggles which meals they'll make and, for multi-option meals, which
 * option (default = their standing selection). "Generar lista" aggregates
 * ingredients ONLY from the picked meals (swaps included, since the days are
 * already resolved) and shows the consolidated, check-off list. Picks persist
 * per `weekStart` in localStorage.
 */
export function ShoppingWizard({
  isOpen,
  onClose,
  weekStart,
  days,
  selections,
}: {
  isOpen: boolean;
  onClose: () => void;
  weekStart: string;
  days: ClientWeekDay[];
  selections: Record<string, string>;
}) {
  const [picks, setPicks] = useState<PicksMap>(() => loadPicks(weekStart));
  // null = still picking; an array = the generated list step.
  const [generated, setGenerated] = useState<ShoppingListItem[] | null>(null);

  // Reload picks (and reset to the pick step) when the visible week changes.
  useEffect(() => {
    setPicks(loadPicks(weekStart));
    setGenerated(null);
  }, [weekStart]);

  function commit(next: PicksMap) {
    setPicks(next);
    savePicks(weekStart, next);
  }

  function toggleMeal(date: string, slot: MealSlotWithOptions) {
    const key = mealKey(date, slot.id);
    const next = { ...picks };

    if (key in next) {
      delete next[key];
    } else {
      const fallback = defaultOptionId(slot, selections);

      if (fallback !== null) {
        next[key] = fallback;
      }
    }
    commit(next);
  }

  function chooseOption(date: string, slotId: string, optionId: string) {
    commit({ ...picks, [mealKey(date, slotId)]: optionId });
  }

  function generate() {
    setGenerated(aggregatePickedMeals(days, picksFromMap(picks)));
  }

  const plannableDays = days.filter(
    (day) => day.started && day.slots.length > 0
  );
  const pickedCount = Object.keys(picks).length;

  return (
    <Drawer isOpen={isOpen} placement="right" size="md" onClose={onClose}>
      <DrawerContent>
        <DrawerHeader>Lista de compras</DrawerHeader>
        <DrawerBody className="pb-6">
          {generated === null ? (
            <div className="flex flex-col gap-4" data-testid="wizard-picker">
              <p className="text-sm text-default-500">
                Elige las comidas que vas a preparar esta semana.
              </p>

              {plannableDays.length === 0 ? (
                <p className="text-sm text-default-400">
                  No hay comidas en esta semana.
                </p>
              ) : (
                plannableDays.map((day) => (
                  <section key={day.date} className="flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-default-400">
                      {dayLabel(day.date)}
                    </p>
                    {day.slots.map((slot) => (
                      <MealRow
                        key={slot.id}
                        date={day.date}
                        pickedOptionId={picks[mealKey(day.date, slot.id)]}
                        slot={slot}
                        onChooseOption={(optionId) =>
                          chooseOption(day.date, slot.id, optionId)
                        }
                        onToggle={() => toggleMeal(day.date, slot)}
                      />
                    ))}
                  </section>
                ))
              )}

              <Button
                color="primary"
                data-testid="wizard-generate"
                isDisabled={pickedCount === 0}
                startContent={
                  <Icon icon="solar:cart-large-2-bold" width={18} />
                }
                onPress={generate}
              >
                Generar lista ({pickedCount})
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3" data-testid="wizard-result">
              <Button
                className="self-start"
                data-testid="wizard-back"
                size="sm"
                startContent={
                  <Icon icon="solar:alt-arrow-left-linear" width={16} />
                }
                variant="light"
                onPress={() => setGenerated(null)}
              >
                Editar selección
              </Button>
              <ShoppingResultList
                items={generated}
                storageKey={wizardCheckedKey(weekStart)}
              />
            </div>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

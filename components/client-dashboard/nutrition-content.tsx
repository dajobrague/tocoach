"use client";

import type {
  NutritionDayWithMeals,
  NutritionMealWithIngredients,
  NutritionPlanWithDays,
} from "@/types/nutrition";

import { Card, CardBody, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import { useNutritionPlan } from "@/lib/hooks/use-client-queries";

// ─── Weekday helpers ───────────────────────────────────────────────────────
// Matches JavaScript Date.getDay(): 0 = Sunday, 1 = Monday, …, 6 = Saturday

const WEEKDAY_NAMES: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

/** Monday-first ordering for sorting: Mon=0 … Sun=6 */
function mondayFirstIndex(weekdayNum: number): number {
  // Convert JS getDay (0=Sun) to Monday-first (0=Mon)
  return weekdayNum === 0 ? 6 : weekdayNum - 1;
}

/** Returns today's weekday number (JS convention: 0=Sun). */
function getTodayWeekdayNum(): number {
  const now = new Date();
  const chicagoTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Chicago" })
  );

  return chicagoTime.getDay();
}

// ─── Weekday entry: one row per weekday a nutrition day applies to ─────────

interface WeekdayEntry {
  /** Unique key for React (dayId + weekdayNum) */
  key: string;
  /** The JS weekday number (0-6) this entry represents */
  weekdayNum: number;
  /** Display title, e.g. "Lunes - Día 1" */
  title: string;
  /** Whether this weekday is today */
  isToday: boolean;
  /** The underlying nutrition day data (meals, macros, etc.) */
  day: NutritionDayWithMeals;
}

/**
 * Expand nutrition days so each weekday in a day's `weekdays` array
 * gets its own entry. E.g. Día 1 with weekdays [1, 3] becomes two
 * entries: "Lunes - Día 1" and "Miércoles - Día 1".
 *
 * Days without weekdays assigned get a single entry using day_order.
 * Result is sorted: today first, then Mon → Sun.
 */
function buildWeekdayEntries(days: NutritionDayWithMeals[]): WeekdayEntry[] {
  const todayNum = getTodayWeekdayNum();
  const entries: WeekdayEntry[] = [];

  for (const day of days) {
    if (day.weekdays && day.weekdays.length > 0) {
      for (const wdNum of day.weekdays) {
        const weekdayName = WEEKDAY_NAMES[wdNum] || "";

        entries.push({
          key: `${day.id}-${wdNum}`,
          weekdayNum: wdNum,
          title: weekdayName
            ? `${weekdayName} - ${day.day_label}`
            : day.day_label,
          isToday: wdNum === todayNum,
          day,
        });
      }
    } else {
      // No weekdays assigned — single entry using day_order
      entries.push({
        key: day.id,
        weekdayNum: -1,
        title: day.day_label,
        isToday: false,
        day,
      });
    }
  }

  // Sort: today first, then Monday → Sunday
  entries.sort((a, b) => {
    if (a.isToday && !b.isToday) return -1;
    if (!a.isToday && b.isToday) return 1;

    // Both non-today: sort Mon → Sun
    const aIdx =
      a.weekdayNum >= 0 ? mondayFirstIndex(a.weekdayNum) : a.day.day_order;
    const bIdx =
      b.weekdayNum >= 0 ? mondayFirstIndex(b.weekdayNum) : b.day.day_order;

    return aIdx - bIdx;
  });

  return entries;
}

// ─── Shopping list helpers ─────────────────────────────────────────────────

interface AggregatedIngredient {
  name: string;
  entries: { quantity: string; unit: string }[];
}

function aggregateIngredients(
  days: NutritionDayWithMeals[]
): AggregatedIngredient[] {
  const map = new Map<string, Map<string, number>>();
  const rawMap = new Map<string, { quantity: string; unit: string }[]>();

  for (const day of days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        const key = ing.name.trim().toLowerCase();
        const numericQty = parseFloat(ing.quantity);

        if (!isNaN(numericQty) && numericQty > 0) {
          if (!map.has(key)) map.set(key, new Map());
          const unitMap = map.get(key)!;
          const unitKey = (ing.unit || "").trim().toLowerCase();

          unitMap.set(unitKey, (unitMap.get(unitKey) || 0) + numericQty);
        } else {
          if (!rawMap.has(key)) rawMap.set(key, []);
          rawMap.get(key)!.push({ quantity: ing.quantity, unit: ing.unit });
        }
      }
    }
  }

  const result: AggregatedIngredient[] = [];

  for (const [key, unitMap] of map.entries()) {
    const entries: { quantity: string; unit: string }[] = [];

    for (const [unit, total] of unitMap.entries()) {
      const pretty = total % 1 === 0 ? total.toString() : total.toFixed(1);

      entries.push({ quantity: pretty, unit });
    }

    if (rawMap.has(key)) {
      entries.push(...rawMap.get(key)!);
      rawMap.delete(key);
    }

    const displayName = key.charAt(0).toUpperCase() + key.slice(1);

    result.push({ name: displayName, entries });
  }

  for (const [key, entries] of rawMap.entries()) {
    const displayName = key.charAt(0).toUpperCase() + key.slice(1);

    result.push({ name: displayName, entries });
  }

  result.sort((a, b) => a.name.localeCompare(b.name));

  return result;
}

// ─── Macro summary (reusable) ─────────────────────────────────────────────

function MacroRow({
  calories,
  protein,
  carbs,
  fats,
}: {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      <Chip className="bg-default-100" size="sm" variant="flat">
        <span className="text-xs text-foreground/70 font-body">
          <Icon
            className="text-danger inline-block mr-0.5"
            icon="solar:fire-bold"
            width={10}
          />
          {Math.round(calories)} kcal
        </span>
      </Chip>
      <Chip className="bg-default-100" size="sm" variant="flat">
        <span className="text-xs text-foreground/70 font-body">
          <Icon
            className="text-primary inline-block mr-0.5"
            icon="fluent:food-chicken-leg-16-filled"
            width={10}
          />
          {Math.round(protein)}g
        </span>
      </Chip>
      <Chip className="bg-default-100" size="sm" variant="flat">
        <span className="text-xs text-foreground/70 font-body">
          <Icon
            className="text-warning inline-block mr-0.5"
            icon="fluent:food-toast-24-filled"
            width={10}
          />
          {Math.round(carbs)}g
        </span>
      </Chip>
      <Chip className="bg-default-100" size="sm" variant="flat">
        <span className="text-xs text-foreground/70 font-body">
          <Icon
            className="text-secondary inline-block mr-0.5"
            icon="fluent:drop-12-filled"
            width={10}
          />
          {Math.round(fats)}g
        </span>
      </Chip>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function NutritionContent() {
  const {
    clientId,
    firstName,
    logoUrl,
    trainerName,
    clientProfilePicture,
    tenantSlug,
  } = useClientData();

  const { data: nutritionPlans, isLoading } = useNutritionPlan();

  const nutritionPlan = useMemo<NutritionPlanWithDays | null>(() => {
    if (!nutritionPlans || nutritionPlans.length === 0) return null;

    return (
      nutritionPlans.find(
        (p: NutritionPlanWithDays) => p.status === "active"
      ) || nutritionPlans[0]
    );
  }, [nutritionPlans]);

  // Expand days into one entry per weekday, sorted: today first, Mon → Sun
  const weekdayEntries = useMemo(() => {
    if (!nutritionPlan?.days) return [];

    return buildWeekdayEntries(nutritionPlan.days);
  }, [nutritionPlan]);

  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());
  const [shoppingListOpen, setShoppingListOpen] = useState(false);

  // Days are collapsed by default — only today's entry starts expanded.
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => {
    return new Set<string>();
  });

  // Once entries are built, auto-expand today (runs once when data loads)
  useEffect(() => {
    const todayEntry = weekdayEntries.find((e) => e.isToday);

    if (todayEntry) {
      setExpandedDays(new Set([todayEntry.key]));
    }
  }, [weekdayEntries]);

  const toggleMeal = (mealId: string) => {
    setExpandedMeals((prev) => {
      const s = new Set(prev);

      s.has(mealId) ? s.delete(mealId) : s.add(mealId);

      return s;
    });
  };

  const toggleDay = (dayKey: string) => {
    setExpandedDays((prev) => {
      const s = new Set(prev);

      s.has(dayKey) ? s.delete(dayKey) : s.add(dayKey);

      return s;
    });
  };

  // Shopping list uses the expanded weekday entries so that a day
  // repeating on multiple weekdays counts its ingredients each time.
  const shoppingList = useMemo(() => {
    const allDays = weekdayEntries.map((e) => e.day);

    return aggregateIngredients(allDays);
  }, [weekdayEntries]);

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <>
        <div className="min-h-screen bg-background pb-20">
          <div className="max-w-lg mx-auto">
            <ClientHeader
              clientId={clientId}
              clientProfilePicture={clientProfilePicture}
              firstName={firstName}
              logoUrl={logoUrl}
              tagline="¡A alimentarte bien!"
              tenantSlug={tenantSlug}
              trainerName={trainerName}
            />
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          </div>
        </div>
        <ClientBottomNav />
      </>
    );
  }

  // ─── Empty state ─────────────────────────────────────────────────────────

  if (!nutritionPlan || weekdayEntries.length === 0) {
    return (
      <>
        <div className="min-h-screen bg-background pb-20">
          <div className="max-w-lg mx-auto">
            <ClientHeader
              clientId={clientId}
              clientProfilePicture={clientProfilePicture}
              firstName={firstName}
              logoUrl={logoUrl}
              tagline="¡A alimentarte bien!"
              tenantSlug={tenantSlug}
              trainerName={trainerName}
            />
            <div className="px-4 py-20 text-center">
              <Icon
                className="text-6xl text-default-300 mx-auto mb-4"
                icon="solar:document-text-linear"
              />
              <h3 className="text-xl font-bold text-foreground mb-2 font-heading">
                No hay plan nutricional
              </h3>
              <p className="text-sm text-foreground/60 font-body">
                Tu entrenador aún no ha creado un plan nutricional para ti.
              </p>
            </div>
          </div>
        </div>
        <ClientBottomNav />
      </>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-lg mx-auto">
          <ClientHeader
            clientId={clientId}
            clientProfilePicture={clientProfilePicture}
            firstName={firstName}
            logoUrl={logoUrl}
            tagline="¡A alimentarte bien!"
            tenantSlug={tenantSlug}
            trainerName={trainerName}
          />

          <div className="px-4 space-y-5">
            {/* ── Day sections (one per weekday) ────────────────────── */}
            {weekdayEntries.map((entry) => {
              const { day } = entry;
              const isDayExpanded = expandedDays.has(entry.key);

              // Day-level totals
              const dayTotals = day.meals.reduce(
                (t, m) => ({
                  calories: t.calories + (m.calories || 0),
                  protein: t.protein + (m.protein || 0),
                  carbs: t.carbs + (m.carbs || 0),
                  fats: t.fats + (m.fats || 0),
                }),
                { calories: 0, protein: 0, carbs: 0, fats: 0 }
              );

              return (
                <section key={entry.key}>
                  {/* Day Header */}
                  <div
                    className={`flex items-center justify-between mb-3 cursor-pointer group rounded-xl px-3 py-2 -mx-3 transition-colors ${
                      entry.isToday
                        ? "bg-primary shadow-md"
                        : "hover:bg-default-100"
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleDay(entry.key)}
                    onKeyDown={(e) => e.key === "Enter" && toggleDay(entry.key)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {entry.isToday ? (
                        <span className="bg-white/20 text-white text-xs font-black px-2.5 py-1 rounded-full font-body uppercase flex-shrink-0 tracking-widest">
                          Hoy
                        </span>
                      ) : (
                        <Icon
                          className="text-primary text-lg flex-shrink-0"
                          icon="solar:calendar-bold"
                        />
                      )}
                      <h2
                        className={`text-base font-bold font-heading truncate ${entry.isToday ? "text-white" : "text-foreground"}`}
                      >
                        {entry.title}
                      </h2>
                      <span
                        className={`text-xs font-body flex-shrink-0 ${entry.isToday ? "text-white/70" : "text-foreground/50"}`}
                      >
                        · {day.meals.length} comida
                        {day.meals.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <Icon
                      className={`text-lg transition-transform flex-shrink-0 ${entry.isToday ? "text-white/70" : "text-foreground/40 group-hover:text-foreground/60"}`}
                      icon={
                        isDayExpanded
                          ? "solar:alt-arrow-up-linear"
                          : "solar:alt-arrow-down-linear"
                      }
                    />
                  </div>

                  {isDayExpanded && (
                    <div className="space-y-3">
                      {/* Day macro summary */}
                      <Card className="border border-default-200 shadow-sm">
                        <CardBody className="p-3">
                          <div className="grid grid-cols-4 gap-2">
                            <div className="bg-default-50 rounded-xl p-2.5 text-center">
                              <Icon
                                className="text-danger text-base mx-auto mb-0.5"
                                icon="solar:fire-bold"
                              />
                              <p className="text-base font-bold text-foreground font-heading">
                                {Math.round(dayTotals.calories)}
                              </p>
                              <p className="text-[10px] text-foreground/50 font-body">
                                kcal
                              </p>
                            </div>
                            <div className="bg-default-50 rounded-xl p-2.5 text-center">
                              <Icon
                                className="text-primary text-base mx-auto mb-0.5"
                                icon="fluent:food-chicken-leg-16-filled"
                              />
                              <p className="text-base font-bold text-foreground font-heading">
                                {Math.round(dayTotals.protein)}
                              </p>
                              <p className="text-[10px] text-foreground/50 font-body">
                                proteína
                              </p>
                            </div>
                            <div className="bg-default-50 rounded-xl p-2.5 text-center">
                              <Icon
                                className="text-warning text-base mx-auto mb-0.5"
                                icon="fluent:food-toast-24-filled"
                              />
                              <p className="text-base font-bold text-foreground font-heading">
                                {Math.round(dayTotals.carbs)}
                              </p>
                              <p className="text-[10px] text-foreground/50 font-body">
                                carbos
                              </p>
                            </div>
                            <div className="bg-default-50 rounded-xl p-2.5 text-center">
                              <Icon
                                className="text-secondary text-base mx-auto mb-0.5"
                                icon="fluent:drop-12-filled"
                              />
                              <p className="text-base font-bold text-foreground font-heading">
                                {Math.round(dayTotals.fats)}
                              </p>
                              <p className="text-[10px] text-foreground/50 font-body">
                                grasas
                              </p>
                            </div>
                          </div>
                        </CardBody>
                      </Card>

                      {/* Meals */}
                      {day.meals.map((meal) => (
                        <MealCard
                          key={`${entry.key}-${meal.id}`}
                          expandedMeals={expandedMeals}
                          meal={meal}
                          onToggle={toggleMeal}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}

            {/* ── Weekly Shopping List ────────────────────────────────── */}
            {shoppingList.length > 0 && (
              <section>
                <div
                  className="flex items-center justify-between mb-3 cursor-pointer group"
                  role="button"
                  tabIndex={0}
                  onClick={() => setShoppingListOpen((o) => !o)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && setShoppingListOpen((o) => !o)
                  }
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className="text-primary text-lg"
                      icon="solar:cart-large-2-bold"
                    />
                    <h2 className="text-base font-bold font-heading text-foreground">
                      Lista de Compras Semanal
                    </h2>
                    <span className="text-xs text-foreground/50 font-body">
                      · {shoppingList.length} producto
                      {shoppingList.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <Icon
                    className="text-foreground/40 text-lg transition-transform group-hover:text-foreground/60"
                    icon={
                      shoppingListOpen
                        ? "solar:alt-arrow-up-linear"
                        : "solar:alt-arrow-down-linear"
                    }
                  />
                </div>

                {shoppingListOpen && (
                  <Card className="border border-default-200 shadow-sm">
                    <CardBody className="p-3">
                      <div className="space-y-1">
                        {shoppingList.map((item) => (
                          <div
                            key={item.name}
                            className="flex items-center justify-between bg-default-50 rounded-lg px-3 py-2.5"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Icon
                                className="text-primary flex-shrink-0"
                                icon="solar:check-circle-bold"
                                width={16}
                              />
                              <p className="text-sm font-medium text-foreground font-body truncate">
                                {item.name}
                              </p>
                            </div>
                            <p className="text-xs text-foreground/60 font-body flex-shrink-0 ml-3">
                              {item.entries
                                .map(
                                  (e) =>
                                    `${e.quantity}${e.unit ? ` ${e.unit}` : ""}`
                                )
                                .join(" + ")}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
      <ClientBottomNav />
    </>
  );
}

// ─── Meal card sub-component ───────────────────────────────────────────────

function MealCard({
  meal,
  expandedMeals,
  onToggle,
}: {
  meal: NutritionMealWithIngredients;
  expandedMeals: Set<string>;
  onToggle: (id: string) => void;
}) {
  const isExpanded = expandedMeals.has(meal.id);

  return (
    <Card className="border border-default-200 shadow-sm">
      <CardBody className="p-4">
        <div
          aria-expanded={isExpanded}
          className="cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => onToggle(meal.id)}
          onKeyDown={(e) => e.key === "Enter" && onToggle(meal.id)}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3 flex-1">
              <div className="bg-primary/10 p-2.5 rounded-xl flex-shrink-0">
                <Icon className="text-primary text-lg" icon="solar:dish-bold" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground font-heading">
                  {meal.label}
                </h3>
                <p className="text-xs text-foreground/50 font-body">
                  {meal.ingredients.length} ingrediente
                  {meal.ingredients.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Icon
              className="text-foreground/40 text-lg flex-shrink-0 mt-1"
              icon={
                isExpanded
                  ? "solar:alt-arrow-up-linear"
                  : "solar:alt-arrow-down-linear"
              }
            />
          </div>

          {meal.notes && (
            <p className="text-xs text-foreground/60 mb-2 font-body">
              {meal.notes}
            </p>
          )}

          <MacroRow
            calories={meal.calories || 0}
            carbs={meal.carbs || 0}
            fats={meal.fats || 0}
            protein={meal.protein || 0}
          />
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-default-200">
            <h4 className="text-xs font-semibold text-foreground/70 mb-2 flex items-center gap-1.5 font-heading">
              <Icon
                className="text-primary"
                icon="solar:list-check-bold"
                width={14}
              />
              Ingredientes
            </h4>
            <div className="space-y-1.5">
              {meal.ingredients && meal.ingredients.length > 0 ? (
                meal.ingredients.map((ingredient) => (
                  <div
                    key={ingredient.id}
                    className="flex items-center justify-between bg-default-50 rounded-lg px-3 py-2"
                  >
                    <p className="text-sm font-medium text-foreground font-body">
                      {ingredient.name}
                    </p>
                    <p className="text-xs text-foreground/50 font-body flex-shrink-0 ml-2">
                      {ingredient.quantity} {ingredient.unit}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-foreground/50 text-center py-2 font-body">
                  No hay ingredientes especificados
                </p>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

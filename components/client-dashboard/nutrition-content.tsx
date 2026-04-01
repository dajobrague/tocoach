"use client";

import type {
  NutritionDayWithMeals,
  NutritionMealOptionWithIngredients,
  NutritionMealWithIngredients,
  NutritionPlanMode,
  NutritionPlanWithDays,
} from "@/types/nutrition";

import {
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  ScrollShadow,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

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

/** Chicago calendar date (YYYY-MM-DD) for this weekday row; used for option selections. */
function getSelectedDateForWeekdayEntry(entry: WeekdayEntry): string {
  if (entry.weekdayNum < 0) {
    return new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Chicago",
    });
  }

  const now = new Date();
  const chicago = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Chicago" })
  );
  const currentDow = chicago.getDay();

  chicago.setDate(chicago.getDate() + (entry.weekdayNum - currentDow));
  const y = chicago.getFullYear();
  const m = String(chicago.getMonth() + 1).padStart(2, "0");
  const d = String(chicago.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
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

function formatMacroPair([a, b]: [number, number]): string {
  const ra = Math.round(a);
  const rb = Math.round(b);

  return ra === rb ? `${ra}` : `${ra}–${rb}`;
}

/** Min–max across options using stored option-level macro columns (multi-alternative meals). */
function MacroRangeRow({
  calories,
  protein,
  carbs,
  fats,
}: {
  calories: [number, number];
  protein: [number, number];
  carbs: [number, number];
  fats: [number, number];
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
          {formatMacroPair(calories)} kcal
        </span>
      </Chip>
      <Chip className="bg-default-100" size="sm" variant="flat">
        <span className="text-xs text-foreground/70 font-body">
          <Icon
            className="text-primary inline-block mr-0.5"
            icon="fluent:food-chicken-leg-16-filled"
            width={10}
          />
          {formatMacroPair(protein)}g
        </span>
      </Chip>
      <Chip className="bg-default-100" size="sm" variant="flat">
        <span className="text-xs text-foreground/70 font-body">
          <Icon
            className="text-warning inline-block mr-0.5"
            icon="fluent:food-toast-24-filled"
            width={10}
          />
          {formatMacroPair(carbs)}g
        </span>
      </Chip>
      <Chip className="bg-default-100" size="sm" variant="flat">
        <span className="text-xs text-foreground/70 font-body">
          <Icon
            className="text-secondary inline-block mr-0.5"
            icon="fluent:drop-12-filled"
            width={10}
          />
          {formatMacroPair(fats)}g
        </span>
      </Chip>
    </div>
  );
}

function storedOptionMacroRanges(meal: NutritionMealWithIngredients): {
  calories: [number, number];
  protein: [number, number];
  carbs: [number, number];
  fats: [number, number];
} | null {
  const opts = meal.options;

  if (!opts || opts.length < 2) return null;

  const col = (key: "protein" | "carbs" | "fats" | "calories") =>
    opts.map((o) => Number(o[key]) || 0);
  const mm = (vals: number[]): [number, number] => [
    Math.min(...vals),
    Math.max(...vals),
  ];

  return {
    protein: mm(col("protein")),
    carbs: mm(col("carbs")),
    fats: mm(col("fats")),
    calories: mm(col("calories")),
  };
}

function headerMacrosFromPrimaryOption(meal: NutritionMealWithIngredients): {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
} {
  const o = meal.options?.[0];

  if (!o) {
    return {
      calories: meal.calories || 0,
      protein: meal.protein || 0,
      carbs: meal.carbs || 0,
      fats: meal.fats || 0,
    };
  }

  return {
    calories: Number(o.calories) || meal.calories || 0,
    protein: Number(o.protein) || meal.protein || 0,
    carbs: Number(o.carbs) || meal.carbs || 0,
    fats: Number(o.fats) || meal.fats || 0,
  };
}

/** Client PDF block: desktop iframe + download; mobile download-only; pending if no URL. */
function NutritionPdfClientSection({ plan }: { plan: NutritionPlanWithDays }) {
  const pdfUrl = plan.pdf_url;
  const pdfName = plan.pdf_name?.trim() || "plan-nutricional.pdf";
  const title = plan.name;
  const description = plan.notes?.trim();

  if (!pdfUrl) {
    return (
      <Card className="border border-default-200 shadow-sm">
        <CardBody className="p-5 flex flex-col items-center text-center gap-3">
          <Icon
            className="text-default-300"
            icon="solar:documents-bold"
            width={56}
          />
          <h3 className="text-lg font-bold font-heading text-foreground">
            {title}
          </h3>
          <p className="text-sm text-foreground/60 font-body max-w-sm">
            Tu entrenador aún no ha subido el plan nutricional
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="border border-default-200 shadow-sm overflow-hidden">
      <CardBody className="p-4 md:p-5 gap-4">
        <div>
          <h3 className="text-lg font-bold font-heading text-foreground">
            {title}
          </h3>
          {description ? (
            <p className="text-sm text-foreground/70 font-body mt-2 whitespace-pre-wrap">
              {description}
            </p>
          ) : null}
        </div>

        <div className="hidden md:block space-y-3">
          <div className="w-full rounded-lg border border-default-200 overflow-hidden bg-default-100">
            <iframe
              className="w-full h-[500px] border-0"
              src={`${pdfUrl}#toolbar=1`}
              title={pdfName}
            />
          </div>
          <Button
            as="a"
            className="w-full font-semibold"
            color="primary"
            href={pdfUrl}
            rel="noopener noreferrer"
            startContent={<Icon icon="solar:download-bold" width={20} />}
            target="_blank"
            variant="flat"
          >
            Descargar PDF
          </Button>
        </div>

        <div className="md:hidden flex flex-col items-center text-center gap-4 py-2">
          <Icon
            className="text-red-600"
            icon="solar:document-text-bold"
            width={72}
          />
          <div>
            <p className="text-sm font-semibold text-foreground font-heading">
              {pdfName}
            </p>
            <p className="text-xs text-foreground/50 font-body mt-1">
              Abre el PDF en el navegador para verlo con comodidad.
            </p>
          </div>
          <Button
            as="a"
            className="w-full max-w-xs font-semibold"
            color="primary"
            href={pdfUrl}
            rel="noopener noreferrer"
            startContent={<Icon icon="solar:eye-bold" width={20} />}
            target="_blank"
            variant="solid"
          >
            Ver plan nutricional
          </Button>
        </div>
      </CardBody>
    </Card>
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

  /** `selected_date` -> `meal_id` -> `option_id` */
  const [selectionsByDate, setSelectionsByDate] = useState<
    Record<string, Record<string, string>>
  >({});

  const mergeSelectionsForDate = useCallback(
    (date: string, rows: { meal_id: string; option_id: string }[]) => {
      const map: Record<string, string> = {};

      for (const r of rows) {
        map[r.meal_id] = r.option_id;
      }

      setSelectionsByDate((prev) => ({ ...prev, [date]: map }));
    },
    []
  );

  useEffect(() => {
    const ac = new AbortController();

    for (const key of expandedDays) {
      const entry = weekdayEntries.find((e) => e.key === key);

      if (!entry) continue;

      const date = getSelectedDateForWeekdayEntry(entry);

      void (async () => {
        try {
          const res = await fetch(
            `/api/client/nutrition/select-option?date=${encodeURIComponent(date)}`,
            { signal: ac.signal }
          );
          const json = (await res.json()) as {
            success?: boolean;
            data?: { meal_id: string; option_id: string }[];
          };

          if (json.success && Array.isArray(json.data)) {
            mergeSelectionsForDate(date, json.data);
          }
        } catch {
          /* aborted or network */
        }
      })();
    }

    return () => ac.abort();
  }, [expandedDays, weekdayEntries, mergeSelectionsForDate]);

  const handleSelectOption = useCallback(
    async (mealId: string, optionId: string, date: string) => {
      let previousOptionId: string | undefined;

      setSelectionsByDate((prev) => {
        const dateMap = prev[date] ?? {};

        previousOptionId = dateMap[mealId];

        return {
          ...prev,
          [date]: { ...dateMap, [mealId]: optionId },
        };
      });

      try {
        const res = await fetch("/api/client/nutrition/select-option", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mealId, optionId, date }),
        });
        const json = (await res.json()) as { success?: boolean };

        if (!json.success) {
          setSelectionsByDate((prev) => {
            if (prev[date]?.[mealId] !== optionId) return prev;

            const dateMap = { ...(prev[date] ?? {}) };

            if (previousOptionId !== undefined) {
              dateMap[mealId] = previousOptionId;
            } else {
              delete dateMap[mealId];
            }

            return { ...prev, [date]: dateMap };
          });
        }
      } catch {
        setSelectionsByDate((prev) => {
          if (prev[date]?.[mealId] !== optionId) return prev;

          const dateMap = { ...(prev[date] ?? {}) };

          if (previousOptionId !== undefined) {
            dateMap[mealId] = previousOptionId;
          } else {
            delete dateMap[mealId];
          }

          return { ...prev, [date]: dateMap };
        });
      }
    },
    []
  );

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

  // ─── Empty state (solo modo estructurado sin días) ─────────────────────────

  if (!nutritionPlan) {
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

  const effectivePlanMode: NutritionPlanMode =
    nutritionPlan.plan_mode ?? "structured";

  if (effectivePlanMode === "structured" && weekdayEntries.length === 0) {
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
            {(effectivePlanMode === "pdf" ||
              effectivePlanMode === "hybrid") && (
              <NutritionPdfClientSection plan={nutritionPlan} />
            )}

            {effectivePlanMode === "hybrid" && (
              <Divider className="my-2 bg-default-200" />
            )}

            {(effectivePlanMode === "structured" ||
              effectivePlanMode === "hybrid") && (
              <>
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
                        onKeyDown={(e) =>
                          e.key === "Enter" && toggleDay(entry.key)
                        }
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
                          {day.meals.map((meal) => {
                            const selectedDate =
                              getSelectedDateForWeekdayEntry(entry);

                            return (
                              <MealCard
                                key={`${entry.key}-${meal.id}`}
                                expandedMeals={expandedMeals}
                                meal={meal}
                                selectedDate={selectedDate}
                                selectedOptionId={
                                  selectionsByDate[selectedDate]?.[meal.id] ??
                                  null
                                }
                                showMealImages={
                                  nutritionPlan.show_meal_images === true
                                }
                                onSelectOption={handleSelectOption}
                                onToggle={toggleMeal}
                              />
                            );
                          })}
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
              </>
            )}
          </div>
        </div>
      </div>
      <ClientBottomNav />
    </>
  );
}

// ─── Meal photo (expanded): skeleton, lazy image, full-screen lightbox ─────

function MealPhotoAboveIngredients({
  imageUrl,
  mealLabel,
}: {
  imageUrl: string;
  mealLabel: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [imageUrl]);

  useEffect(() => {
    if (!lightboxOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [lightboxOpen]);

  return (
    <>
      <div className="relative w-full mb-3 rounded-lg overflow-hidden bg-default-200">
        {!loaded && (
          <div
            aria-hidden
            className="absolute inset-0 z-[1] rounded-lg bg-gradient-to-r from-default-200 via-default-300 to-default-200 animate-pulse"
          />
        )}
        <button
          className="relative z-[2] block w-full text-left touch-manipulation outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
          type="button"
          onClick={() => setLightboxOpen(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={mealLabel ? `Foto: ${mealLabel}` : "Foto del plato"}
            className={`w-full max-h-[200px] object-cover rounded-lg transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
            decoding="async"
            loading="lazy"
            src={imageUrl}
            onLoad={() => setLoaded(true)}
          />
        </button>
      </div>

      {lightboxOpen ? (
        <button
          aria-label="Cerrar imagen"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-3 sm:p-6 border-0 cursor-zoom-out"
          type="button"
          onClick={() => setLightboxOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className="max-h-[100dvh] max-w-full w-auto object-contain pointer-events-none"
            decoding="async"
            src={imageUrl}
          />
        </button>
      ) : null}
    </>
  );
}

// ─── Multi-option meal: horizontal picker + single detail panel ─────────────

function MealMultiOptionClientSection({
  mealId,
  mealLabel,
  options,
  selectedOptionId,
  selectedDate,
  showMealImages,
  onSelectOption,
}: {
  mealId: string;
  mealLabel: string;
  options: NutritionMealOptionWithIngredients[];
  selectedOptionId: string | null;
  selectedDate: string;
  showMealImages: boolean;
  onSelectOption?: (mealId: string, optionId: string, date: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  const resolvedOptionId = useMemo(() => {
    if (selectedOptionId && options.some((o) => o.id === selectedOptionId)) {
      return selectedOptionId;
    }

    return options[0]?.id ?? "";
  }, [selectedOptionId, options]);

  const activeOption =
    options.find((o) => o.id === resolvedOptionId) ?? options[0];

  const selectionUnset =
    !selectedOptionId || !options.some((o) => o.id === selectedOptionId);

  const focusOptionAt = (idx: number) => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-option-idx="${idx}"]`
    );

    el?.focus();
  };

  const handleRadioKeyDown = (e: ReactKeyboardEvent, idx: number) => {
    if (!onSelectOption || options.length === 0) return;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = (idx + 1) % options.length;
      const opt = options[next];

      if (!opt) return;
      onSelectOption(mealId, opt.id, selectedDate);
      requestAnimationFrame(() => focusOptionAt(next));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (idx - 1 + options.length) % options.length;
      const opt = options[prev];

      if (!opt) return;
      onSelectOption(mealId, opt.id, selectedDate);
      requestAnimationFrame(() => focusOptionAt(prev));
    }
  };

  if (!activeOption) return null;

  const optImg =
    activeOption.image_url && String(activeOption.image_url).trim().length > 0
      ? String(activeOption.image_url).trim()
      : null;

  return (
    <div className="space-y-3">
      {selectionUnset ? (
        <p className="text-xs text-foreground/55 font-body">
          Elige una variante para ver ingredientes y macros.
        </p>
      ) : null}

      <ScrollShadow
        className="w-full max-w-full"
        hideScrollBar={false}
        orientation="horizontal"
      >
        <div
          ref={listRef}
          aria-label={`Variantes de ${mealLabel}`}
          className="flex w-max min-w-full flex-nowrap gap-2 pb-0.5"
          role="radiogroup"
        >
          {options.map((opt, idx) => {
            const selected = opt.id === resolvedOptionId;
            const thumb =
              showMealImages &&
              opt.image_url &&
              String(opt.image_url).trim().length > 0
                ? String(opt.image_url).trim()
                : null;

            return (
              <button
                key={opt.id}
                aria-checked={selected}
                className={`flex max-w-[200px] min-h-11 shrink-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  selected
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-default-200 bg-default-50 hover:bg-default-100"
                }`}
                data-option-idx={idx}
                role="radio"
                tabIndex={selected ? 0 : -1}
                type="button"
                onClick={() => onSelectOption?.(mealId, opt.id, selectedDate)}
                onKeyDown={(e) => handleRadioKeyDown(e, idx)}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-lg object-cover"
                    decoding="async"
                    loading="lazy"
                    src={thumb}
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-default-200 text-[11px] font-bold text-foreground"
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                )}
                <span className="min-w-0 truncate text-sm font-semibold text-foreground font-heading">
                  {opt.name}
                </span>
              </button>
            );
          })}
        </div>
      </ScrollShadow>

      <div className="rounded-xl border border-default-200 bg-default-50/50 p-3">
        <MacroRow
          calories={Number(activeOption.calories) || 0}
          carbs={Number(activeOption.carbs) || 0}
          fats={Number(activeOption.fats) || 0}
          protein={Number(activeOption.protein) || 0}
        />
        {showMealImages && optImg ? (
          <div className="mt-3">
            <MealPhotoAboveIngredients
              imageUrl={optImg}
              mealLabel={`${mealLabel} · ${activeOption.name}`}
            />
          </div>
        ) : null}
        <h4 className="mb-2 mt-3 flex items-center gap-1.5 text-xs font-semibold text-foreground/70 font-heading">
          <Icon
            className="text-primary"
            icon="solar:list-check-bold"
            width={14}
          />
          Ingredientes
        </h4>
        <div className="space-y-1.5">
          {activeOption.ingredients && activeOption.ingredients.length > 0 ? (
            activeOption.ingredients.map((ingredient) => (
              <div
                key={ingredient.id}
                className="flex items-center justify-between rounded-lg bg-default-50 px-3 py-2"
              >
                <p className="text-sm font-medium text-foreground font-body">
                  {ingredient.name}
                </p>
                <p className="ml-2 flex-shrink-0 text-xs text-foreground/50 font-body">
                  {ingredient.quantity} {ingredient.unit}
                </p>
              </div>
            ))
          ) : (
            <p className="py-2 text-center text-xs text-foreground/50 font-body">
              No hay ingredientes especificados
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Meal card sub-component ───────────────────────────────────────────────

function MealCard({
  meal,
  expandedMeals,
  onToggle,
  showMealImages = true,
  selectedDate,
  selectedOptionId = null,
  onSelectOption,
}: {
  meal: NutritionMealWithIngredients;
  expandedMeals: Set<string>;
  onToggle: (id: string) => void;
  showMealImages?: boolean;
  selectedDate: string;
  selectedOptionId?: string | null;
  onSelectOption?: (mealId: string, optionId: string, date: string) => void;
}) {
  const isExpanded = expandedMeals.has(meal.id);
  const options = meal.options && meal.options.length > 0 ? meal.options : [];
  const multi = options.length > 1;

  const primaryOpt = options[0];
  const singleImageCandidate =
    primaryOpt?.image_url && String(primaryOpt.image_url).trim().length > 0
      ? String(primaryOpt.image_url).trim()
      : meal.image_url && String(meal.image_url).trim().length > 0
        ? String(meal.image_url).trim()
        : null;
  const showExpandedMealPhoto =
    !multi && showMealImages === true && singleImageCandidate !== null;

  const rangeMacros = multi ? storedOptionMacroRanges(meal) : null;
  const selectedOpt =
    multi && selectedOptionId
      ? options.find((o) => o.id === selectedOptionId)
      : undefined;

  const ingCount =
    meal.ingredients?.length ??
    options.reduce((n, o) => n + (o.ingredients?.length ?? 0), 0);

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
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex-shrink-0 rounded-xl bg-primary/10 p-2.5">
                <Icon className="text-primary text-lg" icon="solar:dish-bold" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-foreground font-heading">
                  {meal.label}
                </h3>
                <p className="text-xs text-foreground/50 font-body">
                  {multi
                    ? `${options.length} alternativas`
                    : `${ingCount} ingrediente${ingCount !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
            <Icon
              className="mt-1 flex-shrink-0 text-lg text-foreground/40"
              icon={
                isExpanded
                  ? "solar:alt-arrow-up-linear"
                  : "solar:alt-arrow-down-linear"
              }
            />
          </div>

          {meal.notes && (
            <p className="mb-2 text-xs text-foreground/60 font-body">
              {meal.notes}
            </p>
          )}

          {multi && selectedOpt ? (
            <MacroRow
              calories={Number(selectedOpt.calories) || 0}
              carbs={Number(selectedOpt.carbs) || 0}
              fats={Number(selectedOpt.fats) || 0}
              protein={Number(selectedOpt.protein) || 0}
            />
          ) : multi && rangeMacros ? (
            <MacroRangeRow
              calories={rangeMacros.calories}
              carbs={rangeMacros.carbs}
              fats={rangeMacros.fats}
              protein={rangeMacros.protein}
            />
          ) : (
            <MacroRow {...headerMacrosFromPrimaryOption(meal)} />
          )}
        </div>

        {isExpanded && (
          <div className="mt-3 border-t border-default-200 pt-3">
            {multi ? (
              <MealMultiOptionClientSection
                mealId={meal.id}
                mealLabel={meal.label}
                options={options}
                selectedDate={selectedDate}
                selectedOptionId={selectedOptionId ?? null}
                showMealImages={showMealImages === true}
                {...(onSelectOption ? { onSelectOption } : {})}
              />
            ) : (
              <>
                {showExpandedMealPhoto ? (
                  <MealPhotoAboveIngredients
                    imageUrl={singleImageCandidate!}
                    mealLabel={meal.label}
                  />
                ) : null}
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground/70 font-heading">
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
                        className="flex items-center justify-between rounded-lg bg-default-50 px-3 py-2"
                      >
                        <p className="text-sm font-medium text-foreground font-body">
                          {ingredient.name}
                        </p>
                        <p className="ml-2 flex-shrink-0 text-xs text-foreground/50 font-body">
                          {ingredient.quantity} {ingredient.unit}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="py-2 text-center text-xs text-foreground/50 font-body">
                      No hay ingredientes especificados
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

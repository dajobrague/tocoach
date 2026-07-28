import type {
  ClientCycleView,
  ClientDayNote,
  ClientMealLog,
} from "./cycle-day";
import type { MealCycleTree, MealSlotWithOptions } from "./meal-cycle-service";
import type { ClientSelection } from "./option-selection";
import type { OverrideRow } from "./override-types";
import type { NutritionGoals } from "@/lib/nutrition/goals/client-goals-service";
import type { NutritionSection } from "@/lib/nutrition/delivery-visibility";
import type { MealLogRow } from "@/lib/nutrition/logs/meal-log-service";

import { buildClientCycleView } from "./cycle-day";
import { normalizeDayTargets } from "./day-targets";
import { snapshotBrand } from "./option-snapshot";
import { applyOverridesToClientView } from "./override-client-view";

import { isWithinLogWindow } from "@/lib/nutrition/logs/log-window";

const MS_PER_DAY = 86_400_000;
const DAYS_IN_WEEK = 7;

/** One resolved day of the client's week. */
export interface ClientWeekDay {
  /** "YYYY-MM-DD". */
  date: string;
  /** False before the cycle starts (a clean not-started shape). */
  started: boolean;
  /**
   * EFFECTIVE menu for this date — the client's choice when they made one,
   * otherwise the rotation's recommended day. `null` before the cycle starts.
   */
  dayIndex: number | null;
  /** The rotation's recommendation for this date (start_date math). */
  recommendedDayIndex?: number | null;
  /** True when the client saved a menu choice for this date (even if it
   *  matches the recommendation — an explicit confirmation counts). */
  hasMenuChoice?: boolean;
  /** True when `dayIndex` comes from a client choice ≠ the recommendation. */
  isMenuChoice?: boolean;
  /** Display name of the effective menu, when the trainer named it. */
  dayName?: string | null;
  /** The day's slots with swaps applied (frozen snapshot as the option). */
  slots: MealSlotWithOptions[];
  /** Trainer notes that apply to this date. */
  notes: ClientDayNote[];
  /** This date's logs (slotId → log). */
  logs: Record<string, ClientMealLog>;
  /** Whether the client may log on this date (started, today-or-past, ≤30d). */
  canLog: boolean;
  /**
   * Effective daily goals for this date: the day's assigned objective when
   * one exists, otherwise the client's default goals (null when neither is
   * set). Attached by {@link attachDayGoals} in the week route.
   */
  targets?: NutritionGoals | null;
  /** Name of the assigned objective ("Día de entrenamiento"), when one applies. */
  targetName?: string | null;
}

/** One meal of a menu, summarized for the client's menu chooser preview. */
export interface ClientWeekMenuMeal {
  label: string;
  /** Name of the primary option, or null when the meal is still empty. */
  primaryName: string | null;
  /** Total options across the meal (alternatives included). */
  optionCount: number;
}

/** One photo of the menu's image slide (tap reveals the dish name). */
export interface ClientWeekMenuImage {
  url: string;
  name: string;
}

/** One selectable menu of the plan (for the client's menu chooser). */
export interface ClientWeekMenu {
  dayIndex: number;
  /** Trainer-given name, or null → render as "Día N". */
  name: string | null;
  /** Planned kcal (each meal's primary options summed). */
  kcal: number;
  /** What the menu includes, meal by meal. */
  meals: ClientWeekMenuMeal[];
  /** Distinct option photos across the menu (for the image slide), max 8. */
  images: ClientWeekMenuImage[];
}

/** A named daily objective, as exposed to the client (goals-only view). */
export interface ClientDietPreset extends NutritionGoals {
  id: string;
  name: string;
}

/**
 * What the client's Nutrición page falls back to when there is NO active meal
 * plan: a PDF diet, or the goals-only view fed by `presets` + the week's
 * `goals`. Attached by the week route only when `cycle` is null, so plan
 * responses carry no extra weight.
 */
export interface ClientDietFallback {
  pdf: { url: string; name: string } | null;
  presets: ClientDietPreset[];
}

/** A week of the client's plan, resolved per date. */
export interface ClientWeek {
  weekStart: string;
  cycle: ClientCycleView["cycle"];
  /** Every menu of the plan, in rotation order (empty without a cycle). */
  menus: ClientWeekMenu[];
  days: ClientWeekDay[];
  /** The client's standing per-slot choice (slotId → optionId), week-global. */
  selections: Record<string, string>;
  /**
   * The daily targets the trainer saved for this client, or null when unset.
   * Attached by the week route (not by {@link buildClientWeek}, which stays
   * pure over the cycle tree); drives the client's "Nutrición del día" card.
   */
  goals?: NutritionGoals | null;
  /** No-plan delivery fallback (PDF / goals-only). Route-attached, and only
   *  when `cycle` is null. */
  fallback?: ClientDietFallback;
  /** The sections this client's page shows (trainer-chosen, or the automatic
   *  ladder's pick), in display order. Route-attached; absent on responses
   *  from servers predating the visibility feature. */
  sections?: NutritionSection[];
}

/**
 * Build the 7-day client week from `weekStart` (Monday), resolving each date
 * independently: rotation day → overrides applied (swaps replace options from
 * the frozen snapshot, notes attach) → that date's logs → `canLog`. Reuses the
 * single-date {@link buildClientCycleView} + {@link applyOverridesToClientView}
 * fold per date, so the week and the today view never disagree. Pure: no DB.
 */
export function buildClientWeek(
  tree: MealCycleTree | null,
  overrides: OverrideRow[],
  logs: MealLogRow[],
  weekStart: string,
  todayYmd: string,
  timeZone = "UTC",
  selections: ClientSelection[] = [],
  menuChoices: Record<string, number> = {}
): ClientWeek {
  const header = buildClientCycleView(tree, weekStart, timeZone, selections);
  const dayNames = normalizeDayTargets(tree?.day_names);
  const days: ClientWeekDay[] = [];

  for (let offset = 0; offset < DAYS_IN_WEEK; offset++) {
    const date = addDays(weekStart, offset);
    const dayLogs = logs.filter((log) => log.log_date === date);
    const choice = menuChoices[date];
    // Swaps/notes resolve against the menu the client actually follows.
    const view = applyOverridesToClientView(
      buildClientCycleView(tree, date, timeZone, selections, dayLogs),
      tree,
      overrides,
      date,
      timeZone,
      choice
    );

    days.push(resolveDay(view, date, todayYmd, choice, dayNames));
  }

  const menus: ClientWeekMenu[] =
    tree === null ? [] : buildMenus(tree, dayNames);

  return {
    weekStart,
    cycle: header.cycle,
    menus,
    days,
    selections: header.selections,
  };
}

/**
 * Project a single-date resolved view into a week day. The client's menu
 * choice (when valid for the plan) beats the rotation's recommendation; the
 * recommendation is always kept so the UI can show "hoy tocaba Día N".
 */
function resolveDay(
  view: ClientCycleView,
  date: string,
  todayYmd: string,
  choice: number | undefined,
  dayNames: Record<string, string>
): ClientWeekDay {
  const started =
    view.position?.started === true && view.position.dayIndex !== null;

  if (started === false || view.position === null) {
    return {
      date,
      started: false,
      dayIndex: null,
      recommendedDayIndex: null,
      isMenuChoice: false,
      dayName: null,
      slots: [],
      notes: [],
      logs: {},
      canLog: false,
    };
  }

  const recommended = view.position.dayIndex!;
  const choiceValid =
    choice !== undefined &&
    Number.isInteger(choice) &&
    choice >= 0 &&
    choice < view.days.length;
  const dayIndex = choiceValid ? choice : recommended;

  return {
    date,
    started: true,
    dayIndex,
    recommendedDayIndex: recommended,
    hasMenuChoice: choiceValid,
    isMenuChoice: choiceValid && choice !== recommended,
    dayName: dayNames[String(dayIndex)] ?? null,
    slots: view.days[dayIndex]?.slots ?? [],
    notes: view.notes,
    logs: view.logs,
    canLog: isWithinLogWindow(date, todayYmd),
  };
}

/**
 * Summarize each rotation day as a selectable menu for the chooser: name,
 * planned kcal (each meal's primary option per component summed — the same
 * "primary counts" rule as the trainer's day totals), and a meal-by-meal
 * preview (label, primary option name, option count).
 */
function buildMenus(
  tree: MealCycleTree,
  dayNames: Record<string, string>
): ClientWeekMenu[] {
  const slotsByDay = new Map<number, MealSlotWithOptions[]>();

  for (const slot of tree.slots) {
    const list = slotsByDay.get(slot.day_index) ?? [];

    list.push(slot);
    slotsByDay.set(slot.day_index, list);
  }

  return Array.from({ length: tree.duration_days }, (_, dayIndex) => {
    const slots = (slotsByDay.get(dayIndex) ?? []).sort(
      (a, b) => a.position - b.position
    );

    let kcal = 0;
    const images: ClientWeekMenuImage[] = [];
    const meals: ClientWeekMenuMeal[] = slots.map((slot) => {
      // Primary option per component (group_index): alternatives are
      // choose-one, separate groups sum toward the meal.
      const primaryByGroup = new Map<number, (typeof slot.options)[number]>();

      for (const option of slot.options) {
        const group = option.group_index ?? 0;

        if (primaryByGroup.has(group) === false) {
          primaryByGroup.set(group, option);
        }
      }

      for (const option of primaryByGroup.values()) {
        kcal += Number(option.item_snapshot?.totals?.kcal) || 0;
      }

      // Collect every option's photo for the slide (dedup, capped below) —
      // seeing the alternatives is the point of the preview.
      for (const option of slot.options) {
        const url = optionImage(option);

        if (url !== null && images.some((img) => img.url === url) === false) {
          images.push({ url, name: optionDisplayName(option.item_snapshot) });
        }
      }

      const firstName =
        slot.options[0] === undefined
          ? ""
          : optionDisplayName(slot.options[0].item_snapshot);

      return {
        label: slot.label.trim().length > 0 ? slot.label : "Comida",
        primaryName: firstName === "" ? null : firstName,
        optionCount: slot.options.length,
      };
    });

    return {
      dayIndex,
      name: dayNames[String(dayIndex)] ?? null,
      kcal: Math.round(kcal),
      meals,
      images: images.slice(0, 8),
    };
  });
}

/** First photo URL of an option's frozen snapshot, defensively read. */
function optionImage(option: {
  item_snapshot?: { images?: { url?: unknown }[] } | null;
}): string | null {
  const url = option.item_snapshot?.images?.[0]?.url;

  return typeof url === "string" && url.length > 0 ? url : null;
}

/** Display name of a frozen option — foods carry their brand ("X (Hacendado)")
 *  so the client sees which supermarket product the menu refers to. */
function optionDisplayName(
  snapshot:
    | {
        name?: unknown;
        sourceType?: string;
        ingredients?: Array<{ brand?: string | null }>;
      }
    | null
    | undefined
): string {
  const name = typeof snapshot?.name === "string" ? snapshot.name : "";
  const brand = snapshotBrand(snapshot);

  return brand === null || name === "" ? name : `${name} (${brand})`;
}

/**
 * Resolve each day's effective goals from the plan's `day_targets` map: the
 * assigned preset when it still exists, else `fallback` (the client's default
 * goals). Pure; the week route supplies the preset lookup.
 */
export function attachDayGoals(
  week: ClientWeek,
  dayTargetsRaw: unknown,
  presetsById: Map<string, { name: string } & NutritionGoals>,
  fallback: NutritionGoals | null
): ClientWeek {
  const dayTargets = normalizeDayTargets(dayTargetsRaw);

  return {
    ...week,
    days: week.days.map((day) => {
      const presetId =
        day.dayIndex !== null
          ? (dayTargets[String(day.dayIndex)] ?? null)
          : null;
      const preset = presetId !== null ? presetsById.get(presetId) : undefined;

      if (preset === undefined) {
        return { ...day, targets: fallback, targetName: null };
      }

      return {
        ...day,
        targets: {
          kcal: preset.kcal,
          protein_g: preset.protein_g,
          carbs_g: preset.carbs_g,
          fat_g: preset.fat_g,
        },
        targetName: preset.name,
      };
    }),
  };
}

function addDays(ymd: string, days: number): string {
  return new Date(ymdToMs(ymd) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

function ymdToMs(ymd: string): number {
  const [year, month, day] = ymd.split("-");

  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

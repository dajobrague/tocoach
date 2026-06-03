import type {
  ClientCycleView,
  CycleDay,
} from "@/lib/nutrition/cycles/cycle-day";

/**
 * Which top-level state the client's meal-cycle ("today") view should render,
 * derived purely from the API payload. Kept pure so the empty / not-started /
 * active branches and the "which day is today" pick are unit-tested without
 * rendering the view.
 */
export type MealCycleViewState =
  | { kind: "empty" }
  | { kind: "not-started" }
  | { kind: "active"; activeDayIndex: number; activeDay: CycleDay | null };

export function resolveMealCycleViewState(
  view: ClientCycleView
): MealCycleViewState {
  if (view.cycle === null || view.position === null) {
    return { kind: "empty" };
  }

  if (view.position.started === false || view.position.dayIndex === null) {
    return { kind: "not-started" };
  }

  const activeDayIndex = view.position.dayIndex;

  return {
    kind: "active",
    activeDayIndex,
    activeDay: view.days[activeDayIndex] ?? null,
  };
}

import type { MealLogStatus } from "@/lib/nutrition/logs/meal-log-service";

/** A loggable meal status, with its label + icon + HeroUI color for the UI. */
export interface MealLogChoice {
  status: MealLogStatus;
  label: string;
  icon: string;
  color: "success" | "warning" | "danger";
}

/**
 * The three log choices the client picks from, in plan → other → skipped order.
 * Pure so the labels/order are unit-tested without rendering the control.
 */
export const MEAL_LOG_CHOICES: readonly MealLogChoice[] = [
  {
    status: "eaten_planned",
    label: "Comí el plan",
    icon: "solar:check-circle-bold",
    color: "success",
  },
  {
    status: "eaten_other",
    label: "Comí otra cosa",
    icon: "solar:fork-knife-bold",
    color: "warning",
  },
  {
    status: "skipped",
    label: "Me la salté",
    icon: "solar:close-circle-bold",
    color: "danger",
  },
];

/** The human label for a logged status (empty string for an unknown status). */
export function mealLogChoiceLabel(status: MealLogStatus): string {
  return (
    MEAL_LOG_CHOICES.find((choice) => choice.status === status)?.label ?? ""
  );
}

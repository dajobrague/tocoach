// Client-side form helpers for status checking and timezone handling

import { FormResponse, FormType } from "./types";

/**
 * Get the start of the current week (Monday) in client timezone
 */
export function getWeekStartDate(date: Date = new Date()): Date {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(date.setDate(diff));

  monday.setHours(0, 0, 0, 0);

  return monday;
}

/**
 * Get the end of the current week (Sunday 23:59:59)
 */
export function getWeekEndDate(date: Date = new Date()): Date {
  const monday = getWeekStartDate(date);
  const sunday = new Date(monday);

  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return sunday;
}

/**
 * Check if weekly check-in was submitted this week
 */
export function isWeeklyCheckInDue(responses: FormResponse[]): boolean {
  const now = new Date();
  const weekStart = getWeekStartDate(now);

  // Check if there's a response from this week (Monday onwards)
  const thisWeekResponse = responses.find((r) => {
    const responseDate = new Date(r.response_date);

    return responseDate >= weekStart;
  });

  // Return true if not submitted yet (show entire week until submitted)
  return !thisWeekResponse;
}

/**
 * Check if daily habits was submitted today
 */
export function isDailyHabitsSubmittedToday(
  responses: FormResponse[]
): boolean {
  const today = new Date().toISOString().split("T")[0];

  return responses.some((r) => r.response_date === today);
}

/**
 * Check if form is expired (with grace period)
 */
export function isFormExpired(
  formType: FormType,
  submissionDate?: string
): boolean {
  const now = new Date();

  if (formType === "checkins") {
    // Weekly check-in expires Tuesday 00:00 (24h grace period after Sunday)
    const weekStart = getWeekStartDate(now);
    const gracePeriodEnd = new Date(weekStart);

    gracePeriodEnd.setDate(weekStart.getDate() + 8); // Monday of next week
    gracePeriodEnd.setHours(0, 0, 0, 0);

    return now >= gracePeriodEnd;
  } else {
    // Daily habits expires at end of day (no grace period for simplicity)
    const todayEnd = new Date(now);

    todayEnd.setHours(23, 59, 59, 999);

    return now > todayEnd;
  }
}

/**
 * Check if it's Monday (for weekly check-in display)
 */
export function isMonday(date: Date = new Date()): boolean {
  return date.getDay() === 1;
}

/**
 * Check if weekly form should be displayed
 * Shows ONLY on Monday or Tuesday (grace period), and only if not submitted
 */
export function shouldShowWeeklyCheckIn(responses: FormResponse[]): boolean {
  // Simply check if it's due (which now includes Monday/Tuesday check)
  return isWeeklyCheckInDue(responses);
}

/**
 * Calculate deadline for a form in client timezone
 */
export function getDeadlineForForm(
  formType: FormType,
  clientTimezone: string = "America/Chicago"
): Date {
  const now = new Date();

  if (formType === "checkins") {
    // Weekly: Sunday 23:59 of current week
    return getWeekEndDate(now);
  } else {
    // Daily: Today 23:59
    const todayEnd = new Date(now);

    todayEnd.setHours(23, 59, 59, 999);

    return todayEnd;
  }
}

/**
 * Format deadline in a human-readable way
 */
export function formatDeadline(formType: FormType): string {
  const deadline = getDeadlineForForm(formType);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 24) {
    return `Expira en ${diffHours} horas`;
  } else {
    const diffDays = Math.floor(diffHours / 24);

    return `Expira en ${diffDays} días`;
  }
}

/**
 * Get form status for display
 */
export function getFormStatus(
  formType: FormType,
  responses: FormResponse[]
): "pending" | "completed" | "expired" | "not_due" {
  if (formType === "checkins") {
    const isDue = isWeeklyCheckInDue(responses);
    const isExpired = isFormExpired("checkins");

    if (!isDue) return "completed";
    if (isExpired) return "expired";

    return "pending";
  } else {
    const isSubmittedToday = isDailyHabitsSubmittedToday(responses);

    if (isSubmittedToday) return "completed";

    return "pending";
  }
}

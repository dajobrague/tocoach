import type { CheckInScheduleInput } from "./schedule";
import type { FormConfigData, FormPage } from "./types";

import { getCheckInPeriodStart, getScheduleOrDefault } from "./schedule";

const MS_PER_WEEK = 7 * 86_400_000;

/**
 * Whether `page` is part of the check-in whose period covers `now`.
 *
 * A page with `every_n` = N appears on one period out of every N. Periods
 * are numbered by their start instant in units of the schedule's interval
 * (`interval_weeks`), counted from the Unix epoch.
 * ponytail: epoch-aligned, not aligned to the client's first check-in — a
 * "cada 4" page lands on the same calendar weeks for every client; anchor it
 * to `client_form_configs.created_at` if trainers want per-client phase.
 */
export function isPageDue(
  page: Pick<FormPage, "every_n">,
  schedule: CheckInScheduleInput,
  now: Date = new Date()
): boolean {
  const everyN = page.every_n ?? 1;

  if (!Number.isInteger(everyN) || everyN <= 1) {
    return true;
  }

  const resolved = getScheduleOrDefault(schedule);
  const periodMs = Math.max(1, resolved.interval_weeks) * MS_PER_WEEK;
  const periodIndex = Math.floor(
    getCheckInPeriodStart(resolved, now).getTime() / periodMs
  );

  return periodIndex % everyN === 0;
}

/**
 * The config with the pages that are NOT due now removed, together with
 * their questions — so the client never sees them and the server never
 * requires them. Both sides call this with the same schedule, which keeps
 * required-field validation in parity. Legacy single-page configs are
 * unchanged.
 */
export function dropPagesNotDue(
  config: FormConfigData,
  schedule: CheckInScheduleInput,
  now: Date = new Date()
): FormConfigData {
  const firstPageId = config.pages[0]?.id;
  const due = config.pages.filter((page) => isPageDue(page, schedule, now));

  if (due.length === config.pages.length) {
    return config;
  }

  const dueIds = new Set(due.map((page) => page.id));

  return {
    pages: due,
    questions: config.questions.filter((question) =>
      dueIds.has(question.pageId ?? firstPageId ?? "")
    ),
  };
}

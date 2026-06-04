"use client";

import type { ClientCycleView } from "@/lib/nutrition/cycles/cycle-day";
import type { ClientWeek } from "@/lib/nutrition/cycles/client-week";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { clientFetch } from "@/lib/auth/client-token-storage";
import {
  MEAL_CYCLE_KEY,
  MEAL_CYCLE_WEEK_KEY,
} from "@/lib/hooks/use-client-queries";

export interface LogMealInput {
  slotId: string;
  logDate: string;
  status: "eaten_planned" | "eaten_other" | "skipped";
  optionId?: string;
  comment?: string;
  photoUrl?: string;
}

/**
 * Upload a meal-log photo and return its public URL. Multipart upload via
 * clientFetch (the browser sets the multipart boundary; we don't force a
 * content-type). The server stores it under the authed client's own path.
 */
export async function uploadMealLogPhoto(file: File): Promise<string> {
  const form = new FormData();

  form.append("file", file);
  const response = await clientFetch("/api/client/meal-logs/photo", {
    method: "POST",
    body: form,
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success) {
    throw new Error(data?.error ?? `upload_failed (${response.status})`);
  }

  return data.data.url as string;
}

async function postMealLog(input: LogMealInput): Promise<void> {
  const response = await clientFetch("/api/client/meal-logs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      slot_id: input.slotId,
      log_date: input.logDate,
      status: input.status,
      option_id: input.optionId,
      comment: input.comment,
      photo_url: input.photoUrl,
    }),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success) {
    throw new Error(data?.error ?? `request_failed (${response.status})`);
  }
}

/**
 * Log (or re-log) a meal, optimistically reflecting the new status/photo/comment
 * in the cached today view so the meal shows its logged state instantly. Rolls
 * back on error and re-syncs on settle. Upserts server-side on
 * (client_id, slot_id, log_date).
 */
export function useLogMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postMealLog,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: MEAL_CYCLE_KEY });
      await queryClient.cancelQueries({ queryKey: MEAL_CYCLE_WEEK_KEY });

      const log = {
        status: input.status,
        optionId: input.optionId ?? null,
        comment: input.comment ?? null,
        photoUrl: input.photoUrl ?? null,
      };

      const previous = queryClient.getQueryData<ClientCycleView | null>(
        MEAL_CYCLE_KEY
      );

      if (previous) {
        queryClient.setQueryData<ClientCycleView | null>(MEAL_CYCLE_KEY, {
          ...previous,
          logs: { ...previous.logs, [input.slotId]: log },
        });
      }

      // Mirror into the cached week(s): set the log on the matching date's day
      // so the week view's log control reflects the new status instantly.
      const previousWeeks = queryClient.getQueriesData<ClientWeek | null>({
        queryKey: MEAL_CYCLE_WEEK_KEY,
      });

      for (const [key, week] of previousWeeks) {
        if (week) {
          queryClient.setQueryData<ClientWeek | null>(key, {
            ...week,
            days: week.days.map((day) =>
              day.date === input.logDate
                ? { ...day, logs: { ...day.logs, [input.slotId]: log } }
                : day
            ),
          });
        }
      }

      return { previous, previousWeeks };
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(MEAL_CYCLE_KEY, context.previous);
      }
      for (const [key, week] of context?.previousWeeks ?? []) {
        queryClient.setQueryData(key, week);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: MEAL_CYCLE_KEY });
      void queryClient.invalidateQueries({ queryKey: MEAL_CYCLE_WEEK_KEY });
    },
  });
}

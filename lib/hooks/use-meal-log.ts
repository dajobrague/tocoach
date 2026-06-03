"use client";

import type { ClientCycleView } from "@/lib/nutrition/cycles/cycle-day";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { clientFetch } from "@/lib/auth/client-token-storage";
import { MEAL_CYCLE_KEY } from "@/lib/hooks/use-client-queries";

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

      const previous = queryClient.getQueryData<ClientCycleView | null>(
        MEAL_CYCLE_KEY
      );

      if (previous) {
        queryClient.setQueryData<ClientCycleView | null>(MEAL_CYCLE_KEY, {
          ...previous,
          logs: {
            ...previous.logs,
            [input.slotId]: {
              status: input.status,
              optionId: input.optionId ?? null,
              comment: input.comment ?? null,
              photoUrl: input.photoUrl ?? null,
            },
          },
        });
      }

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(MEAL_CYCLE_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: MEAL_CYCLE_KEY });
    },
  });
}

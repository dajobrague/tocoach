"use client";

// Cola transversal "Videos por revisar" (página de métricas). Query propia —
// no comparte cache con el feed por cliente, pero al revisar invalida ambos
// para que el tab Videos del cliente afectado amanezca al día.

import type { VideoFeedItem } from "./videos-format";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { putVideoReview, VideosApiError } from "./videos-api";
import { videoFeedKey } from "./use-videos";

export interface PendingVideoReview extends VideoFeedItem {
  clientId: number;
  clientName: string;
  clientAvatar: string | null;
}

interface PendingResponse {
  success: boolean;
  pending: PendingVideoReview[];
  totalPending: number;
  error?: string;
}

export const pendingReviewsKey = ["pending-video-reviews"] as const;

export function usePendingVideoReviews() {
  const query = useQuery<{
    pending: PendingVideoReview[];
    totalPending: number;
  }>({
    queryKey: pendingReviewsKey,
    queryFn: async () => {
      const res = await fetch("/api/trainer/pending-video-reviews", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = (await res
        .json()
        .catch(() => null)) as PendingResponse | null;

      if (!res.ok || body?.success !== true) {
        throw new VideosApiError(
          body?.error ?? "No se pudieron cargar los videos",
          res.status
        );
      }

      return { pending: body.pending, totalPending: body.totalPending };
    },
    staleTime: 60_000,
  });

  return {
    pending: query.data?.pending ?? [],
    totalPending: query.data?.totalPending ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
}

/** Revisa desde la cola: quita el item optimistamente e invalida ambos caches. */
export function usePendingReviewMutation() {
  const qc = useQueryClient();

  return useMutation<
    unknown,
    Error,
    { item: PendingVideoReview; comment: string | null },
    { previous: unknown }
  >({
    mutationFn: ({ item, comment }) =>
      putVideoReview(String(item.clientId), {
        videoUrl: item.videoUrl,
        reviewed: true,
        comment,
        exerciseLogId: item.exerciseLogId,
        context: {
          exerciseName: item.exerciseName,
          setLabel: item.setLabel,
          scheduledDate: item.scheduledDate,
        },
      }),
    onMutate: async ({ item }) => {
      await qc.cancelQueries({ queryKey: pendingReviewsKey });

      const previous = qc.getQueryData(pendingReviewsKey);

      qc.setQueryData<{
        pending: PendingVideoReview[];
        totalPending: number;
      }>(pendingReviewsKey, (old) =>
        old === undefined
          ? old
          : {
              pending: old.pending.filter((p) => p.videoUrl !== item.videoUrl),
              totalPending: Math.max(0, old.totalPending - 1),
            }
      );

      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(pendingReviewsKey, context.previous);
      }
    },
    onSettled: (_data, _error, { item }) => {
      void qc.invalidateQueries({ queryKey: pendingReviewsKey });
      void qc.invalidateQueries({
        queryKey: videoFeedKey(String(item.clientId)),
      });
    },
  });
}

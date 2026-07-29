"use client";

// Hooks react-query de la rebanada "Videos". Un solo cache por cliente que
// comparten el badge de la pill del shell y la sección; la mutación de revisión
// parchea ese cache optimistamente (mismo patrón onMutate/rollback de
// use-training) para que el toggle no espere al round-trip. Sin toasts: los
// errores suben como VideosApiError y los pinta la UI.

import type { VideoFeed, VideoReviewInput, VideoReviewMap } from "./videos-api";
import type { VideoFeedItem } from "./videos-format";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { fetchVideoFeed, putVideoReview } from "./videos-api";
import { applyReviewToFeed, buildVideoFeed, isReviewed } from "./videos-format";

const EMPTY_REVIEWS: VideoReviewMap = {};

export const videoFeedKey = (clientId: string) =>
  ["video-feed", clientId] as const;

export interface UseVideoFeed {
  items: VideoFeedItem[];
  reviews: VideoReviewMap;
  /** Videos sin entrada en el mapa de revisiones. */
  pendingCount: number;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

/** Feed de videos del cliente (último año) + mapa de revisiones. */
export function useVideoFeed(clientId: string): UseVideoFeed {
  const query = useQuery<VideoFeed>({
    queryKey: videoFeedKey(clientId),
    queryFn: () => fetchVideoFeed(clientId),
    staleTime: 30_000,
  });

  const logs = query.data?.logs;
  const reviews = query.data?.videoReviews ?? EMPTY_REVIEWS;
  const items = useMemo(() => buildVideoFeed(logs ?? []), [logs]);
  const pendingCount = useMemo(
    () => items.filter((item) => !isReviewed(reviews, item.videoUrl)).length,
    [items, reviews]
  );

  return {
    items,
    reviews,
    pendingCount,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
}

/** Marca/desmarca revisado con parche optimista del mapa y rollback en error. */
export function useVideoReviewMutation(clientId: string) {
  const qc = useQueryClient();
  const key = videoFeedKey(clientId);

  return useMutation<
    unknown,
    Error,
    VideoReviewInput,
    { previous: VideoFeed | undefined }
  >({
    mutationFn: (input) => putVideoReview(clientId, input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });

      const previous = qc.getQueryData<VideoFeed>(key);

      if (previous !== undefined) {
        qc.setQueryData<VideoFeed>(key, applyReviewToFeed(previous, input));
      }

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(key, context.previous);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
    },
  });
}

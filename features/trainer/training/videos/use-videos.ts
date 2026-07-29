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

export interface LoggedExercise {
  id: string;
  name: string;
  category: string | null;
  /** Nº de logs del ejercicio en la ventana; ordena la lista. */
  logCount: number;
}

export interface UseLoggedExercises {
  exercises: LoggedExercise[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * Ejercicios de FUERZA con registros del último año, derivados del mismo cache
 * que el feed de videos (la ruta de logs del trainer devuelve todos los logs,
 * no solo los que tienen video). Los alimenta el selector de Progreso: sin
 * fetch extra y sin ejercicios vacíos en el desplegable.
 *
 * Cardio queda fuera: un 1RM estimado de una carrera no significa nada.
 */
export function useLoggedExercises(clientId: string): UseLoggedExercises {
  const query = useQuery<VideoFeed>({
    queryKey: videoFeedKey(clientId),
    queryFn: () => fetchVideoFeed(clientId),
    staleTime: 30_000,
  });

  const logs = query.data?.logs;

  const exercises = useMemo(() => {
    const byId = new Map<string, LoggedExercise>();

    for (const log of logs ?? []) {
      const exercise = log.exercises;

      if (exercise == null) continue;
      if (exercise.category === "cardio") continue;

      const existing = byId.get(exercise.id);

      if (existing === undefined) {
        byId.set(exercise.id, {
          id: exercise.id,
          name: exercise.name,
          category: exercise.category ?? null,
          logCount: 1,
        });
      } else {
        existing.logCount += 1;
      }
    }

    return [...byId.values()].sort((a, b) =>
      b.logCount !== a.logCount
        ? b.logCount - a.logCount
        : a.name.localeCompare(b.name, "es")
    );
  }, [logs]);

  return {
    exercises,
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

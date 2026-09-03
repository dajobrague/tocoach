"use client";

import { useQuery } from "@tanstack/react-query";

/** Invalidate after creating/editing an exercise so pickers see new tags. */
export const EXERCISE_TAGS_KEY = ["exercise-tags"];

export async function fetchExerciseTags(): Promise<string[]> {
  const response = await fetch("/api/exercises/tags", {
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);

  if (response.ok === false || data?.success !== true) {
    throw new Error(data?.error ?? "No se pudieron cargar las etiquetas");
  }

  return (data.tags ?? []) as string[];
}

/** Distinct exercise tags for suggestions and filters; [] while loading or
 *  when the endpoint fails (tags are a convenience, never a blocker). */
export function useExerciseTags(): string[] {
  const query = useQuery<string[]>({
    queryKey: EXERCISE_TAGS_KEY,
    queryFn: fetchExerciseTags,
    staleTime: 60_000,
  });

  return query.data ?? [];
}

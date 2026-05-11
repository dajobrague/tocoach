"use client";

import type { WorkoutProgram } from "@/types/training";

import { useCallback, useEffect, useState } from "react";

/**
 * Tracks which exercise cards are expanded inside the Entrenamientos / Cardio
 * tabs. Seeds defaults exactly once after programs first load: the first
 * exercise of every session in every active program starts expanded; the rest
 * collapse. After seeding, user toggles are preserved across refetches so a
 * background reload doesn't re-expand a card the user just closed.
 */
export function useExerciseExpandedState(programs: WorkoutProgram[]) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (seeded || programs.length === 0) return;

    const seed = new Set<string>();

    for (const program of programs) {
      for (const session of program.sessions) {
        const first = session.exercises[0];

        if (first?.id) seed.add(first.id);
      }
    }
    setExpanded(seed);
    setSeeded(true);
  }, [programs, seeded]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }, []);

  const isExpanded = useCallback((id: string) => expanded.has(id), [expanded]);

  return { isExpanded, toggle };
}

"use client";

import { useCallback, useState } from "react";

/**
 * Tracks which exercise cards are expanded inside the Entrenamientos / Cardio
 * tabs. All exercises start collapsed; the trainer expands what they want to
 * inspect. State persists across log refetches.
 */
export function useExerciseExpandedState() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

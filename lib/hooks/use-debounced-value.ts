"use client";

import { useEffect, useState } from "react";

/**
 * Returns `value` after it has been stable for `delayMs`. Used to keep
 * per-keystroke inputs (search boxes) from firing a network request per key —
 * Open Food Facts in particular rate-limits search to ~10 req/min.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);

    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

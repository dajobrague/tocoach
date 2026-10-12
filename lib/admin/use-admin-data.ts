"use client";

import React from "react";

// Tiny stale-while-revalidate cache for the admin JSON endpoints: revisiting a
// page renders the last response instantly and refreshes behind it, identical
// in-flight requests are shared, and rows can prefetch on hover.
// ponytail: module-level Map, cleared on reload; reach for SWR/React Query if
// the admin grows mutations that need optimistic updates or cache tags.

const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Map<string, Set<() => void>>();

function notify(url: string) {
  listeners.get(url)?.forEach((fn) => fn());
}

function load(url: string): Promise<unknown> {
  const pending = inflight.get(url);

  if (pending) return pending;

  const p = fetch(url, { credentials: "include" })
    .then(async (res) => {
      const body = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
      cache.set(url, body);
      notify(url);

      return body;
    })
    .finally(() => inflight.delete(url));

  inflight.set(url, p);

  return p;
}

/** Warm the cache (e.g. on row hover) so the next page opens with data. */
export function prefetchAdmin(url: string) {
  if (!cache.has(url)) load(url).catch(() => undefined);
}

export function useAdminData<T>(url: string) {
  const [, rerender] = React.useReducer((n: number) => n + 1, 0);
  const [error, setError] = React.useState<string | null>(null);
  const data = cache.get(url) as T | undefined;

  React.useEffect(() => {
    let set = listeners.get(url);

    if (!set) {
      set = new Set();
      listeners.set(url, set);
    }
    set.add(rerender);
    load(url)
      .then(() => setError(null))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Error al cargar")
      );

    return () => {
      set.delete(rerender);
    };
  }, [url]);

  const refresh = React.useCallback(async () => {
    try {
      await load(url);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    }
  }, [url]);

  return { data, error, isLoading: data === undefined && !error, refresh };
}

/**
 * Pure helpers for reading/writing the trainer client-profile URL query
 * string. No React, no `next/navigation` — fully unit-testable.
 */

export type ParamPatch = Record<string, string | null>;

/**
 * For each "owner" param, the child params it clears when it changes. Keeps
 * the parent→child ownership in one place so a tab switch never leaves stale
 * descendant state in the URL. Extend this map as deeper params are added in
 * the follow-up per-tab plan.
 */
export const CHILD_PARAMS: Record<string, string[]> = {
  tab: ["sub", "m", "nd", "ndv", "ft", "fv", "ex", "hd", "modal", "modalId"],
  sub: ["m", "ex", "hd", "modal", "modalId"],
};

/**
 * Apply a patch to a query snapshot, returning the new search string (without
 * a leading "?"). A null or empty-string value removes the key. Output is
 * sorted for deterministic, stable URLs.
 */
export function applyParams(
  current: URLSearchParams,
  patch: ParamPatch
): string {
  const next = new URLSearchParams(current.toString());

  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  next.sort();

  return next.toString();
}

/**
 * Build a patch that sets `key`=`value` and clears every child param that
 * `key` owns (see CHILD_PARAMS).
 */
export function patchWithChildrenCleared(
  key: string,
  value: string | null
): ParamPatch {
  const patch: ParamPatch = { [key]: value };

  for (const child of CHILD_PARAMS[key] ?? []) {
    patch[child] = null;
  }

  return patch;
}

/**
 * Read an enum param. Returns the value only if it is present in `allowed`,
 * otherwise `fallback`. Guards against stale/hand-edited URLs.
 */
export function readEnumParam<T extends string>(
  current: URLSearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  const raw = current.get(key);

  return raw !== null && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback;
}

/**
 * Read a free-form string param. Returns the raw value, or `fallback`
 * (default null) when missing or empty.
 */
export function readStringParam(
  current: URLSearchParams,
  key: string,
  fallback: string | null = null
): string | null {
  const raw = current.get(key);

  return raw !== null && raw !== "" ? raw : fallback;
}

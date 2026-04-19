/**
 * Lightweight performance logger for API routes.
 *
 * Emits structured single-line JSON logs (prefixed with [PERF]) so they can be
 * grep'd from Vercel/Supabase logs later without any heavy dependencies.
 *
 * Usage:
 *   const timer = startPerfTimer("GET /api/client/nutrition");
 *   // ... work ...
 *   timer.end({ client_id, plans: plans.length });
 *
 * The `end()` call is best-effort — if logging fails for any reason we swallow
 * the error because we never want instrumentation to break production.
 */

export type PerfMeta = Record<
  string,
  string | number | boolean | null | undefined
>;

export interface PerfTimer {
  /** Finish the timer and emit a [PERF] log line. Safe to call only once. */
  end(meta?: PerfMeta): number;
}

export function startPerfTimer(endpoint: string): PerfTimer {
  const startedAt = performance.now();
  let ended = false;

  return {
    end(meta?: PerfMeta) {
      if (ended) return 0;
      ended = true;

      const durationMs = Math.round(performance.now() - startedAt);

      try {
        // Keep on one line so log ingesters can parse it easily.
        // eslint-disable-next-line no-console
        console.log(
          `[PERF] ${JSON.stringify({
            endpoint,
            duration_ms: durationMs,
            ts: new Date().toISOString(),
            ...(meta || {}),
          })}`
        );
      } catch {
        // Intentionally ignored — instrumentation must never break requests.
      }

      return durationMs;
    },
  };
}

/**
 * Report a partial-load warning in the client nutrition endpoint (or other
 * endpoints with nested fetches). These indicate data the user is seeing is
 * incomplete — historically these were swallowed silently, which is how the
 * "fotos/calorías desaparecen" bug hid itself.
 *
 * We keep emitting the regular console.error that existed before so any tools
 * that already watch for those keep working, AND we emit a structured line so
 * new monitoring can pick it up.
 */
export function logPartialLoad(
  endpoint: string,
  level: "days" | "meals" | "options" | "ingredients",
  context: PerfMeta,
  error: unknown
) {
  try {
    // eslint-disable-next-line no-console
    console.log(
      `[PERF_PARTIAL_LOAD] ${JSON.stringify({
        endpoint,
        level,
        ts: new Date().toISOString(),
        ...context,
        error_message:
          error instanceof Error
            ? error.message
            : typeof error === "object" && error !== null && "message" in error
              ? String((error as { message: unknown }).message)
              : String(error),
      })}`
    );
  } catch {
    // Intentionally ignored.
  }
}

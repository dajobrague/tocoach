/**
 * Adapter runtime contract.
 *
 * The metadata interface (`ChartDataSource` in lib/charts/types.ts) is what
 * the data-source picker consumes. The runtime interface here is what the
 * snapshot endpoint and the client-side `useChartSurfaceData` hook call to
 * actually produce buckets.
 *
 * Adapters are SYNC against pre-fetched batches. The AdapterContext holds
 * everything an adapter could need — a chart that uses form_responses and
 * a chart that uses exercise_logs both run against the same context, and
 * each adapter only reads the fields it needs. This is what gives us the
 * "dashboard hits N tables, not N charts" perf characteristic from the spec.
 */

import type { CheckInSchedule, FormResponse } from "@/lib/forms/types";
import type {
  Aggregation,
  BucketedPoint,
  ChartDataSource,
  DateRange,
} from "../types";

/**
 * Loose ExerciseLog shape — matches what the existing
 * useExerciseLogs() hook returns. We don't pin a strict interface because
 * the upstream type is fluid; the only fields we need are scheduled_date
 * and the optional exercises.category.
 */
export interface ExerciseLogLike {
  scheduled_date?: string | null;
  exercises?: { category?: string | null } | null;
}

/**
 * Everything a synchronous adapter could need to produce buckets.
 */
export interface AdapterContext {
  /** The trainer's check-in schedule (timezone, period, anchor day). */
  schedule: CheckInSchedule;
  /** The dashboard's selected range. */
  range: DateRange;
  /** Pre-fetched form responses keyed by form type. */
  formResponses: {
    checkins: FormResponse[];
    habits: FormResponse[];
  };
  /** Pre-fetched exercise logs (training data). */
  exerciseLogs: ExerciseLogLike[];
  /**
   * Huso horario del CLIENTE que está mirando los charts (browser tz
   * via Intl.DateTimeFormat). Usado por la agregación `daily` para
   * que los buckets se alineen con el calendario que el cliente vive
   * y, sobre todo, con el `response_date` que se guarda en huso
   * browser cuando submitea formularios.
   *
   * Si está omitido, los helpers de bucketing caen al
   * `schedule.timezone` (compat retro). Para charts en el dashboard
   * del cliente este campo SIEMPRE viene presente; solo queda
   * undefined si un caller interno no lo pasa.
   */
  clientTz?: string;
}

/**
 * Runtime adapter — produces BucketedPoint[] for a given context and
 * requested aggregation. Implementations live in catalog.ts and
 * form-question.ts.
 *
 * `metadata` is the static descriptor that the picker uses; the function
 * `materialize` is the runtime reducer.
 */
export interface DataAdapter {
  metadata: ChartDataSource;
  materialize(ctx: AdapterContext, aggregation: Aggregation): BucketedPoint[];
}

/**
 * Convenience: an adapter that has been resolved (metadata + runtime fn)
 * paired with the ChartConfig that referenced it. The renderer / surface
 * hook use this paired form.
 */
export interface ResolvedChartAdapter {
  adapter: DataAdapter;
}

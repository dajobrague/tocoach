/**
 * GET /api/charts/clients/[clientId]/snapshot?range=7d|30d|90d
 *
 * Returns the effective chart config plus all bucketed data needed to
 * render every chart in a single round-trip. The client app uses this
 * on the dashboard so the iframe-embedded view doesn't fan out to N
 * separate fetches.
 *
 * Auth: trainer (must own client) OR client (must be self).
 *
 * Server-side bucketing applies the 60-bucket cap; aggregations that
 * would produce more buckets are auto-fallbacked to weekly. Each fallback
 * is reported per-chart so the surface can render the "Mostrando agregación
 * semanal por rango amplio" sub-label.
 */

import type {
  Aggregation,
  BucketedPoint,
  ChartConfig,
} from "@/lib/charts/types";
import type {
  AdapterContext,
  ExerciseLogLike,
} from "@/lib/charts/adapters/types";

import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { authorizeClientAccess } from "@/lib/charts/server/auth";
import { loadEffectiveClientCharts } from "@/lib/charts/server/template-loader";
import { resolveAdapter } from "@/lib/charts/registry";
import {
  DEFAULT_CHECKIN_SCHEDULE,
  type CheckInSchedule,
  type FormResponse,
} from "@/lib/forms/types";
import { getScheduleOrDefault } from "@/lib/forms/schedule";

// Accepts the legacy 5-key client period selector (7d / 30d / 3m / 6m / 12m)
// plus the trainer-side 90d shortcut. Anything unknown defaults to 30d.
const RANGE_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "3m": 90,
  "6m": 180,
  "12m": 365,
};
const MAX_BUCKETS = 60;

function parseRange(rangeParam: string | null): { from: Date; to: Date } {
  const days = RANGE_DAYS[rangeParam ?? "30d"] ?? 30;
  const to = new Date();
  const from = new Date();

  from.setDate(from.getDate() - days + 1);
  from.setHours(0, 0, 0, 0);

  return { from, to };
}

async function loadCheckinSchedule(
  supabase: ReturnType<typeof createSupabaseClient>,
  args: { tenantHost: string; clientIdBigint: number }
): Promise<CheckInSchedule> {
  // 1) Per-client override.
  const perClient = await supabase
    .from("client_form_configs")
    .select("schedule")
    .eq("tenant_host", args.tenantHost)
    .eq("client_id", args.clientIdBigint)
    .eq("form_type", "checkins")
    .maybeSingle();

  if (perClient.data?.schedule) {
    return getScheduleOrDefault(perClient.data.schedule as CheckInSchedule);
  }
  // 2) Trainer template default.
  const tplDefault = await supabase
    .from("form_templates")
    .select("default_schedule")
    .eq("tenant_host", args.tenantHost)
    .eq("form_type", "checkins")
    .maybeSingle();

  if (tplDefault.data?.default_schedule) {
    return getScheduleOrDefault(
      tplDefault.data.default_schedule as CheckInSchedule
    );
  }

  return { ...DEFAULT_CHECKIN_SCHEDULE };
}

async function loadFormResponses(
  supabase: ReturnType<typeof createSupabaseClient>,
  args: {
    tenantHost: string;
    clientIdBigint: number;
    fromYmd: string;
    toYmd: string;
  }
): Promise<{ checkins: FormResponse[]; habits: FormResponse[] }> {
  const both = await supabase
    .from("form_responses")
    .select("*")
    .eq("tenant_host", args.tenantHost)
    .eq("client_id", args.clientIdBigint)
    .gte("response_date", args.fromYmd)
    .lte("response_date", args.toYmd);
  const rows = (both.data ?? []) as FormResponse[];

  return {
    checkins: rows.filter((r) => r.form_type === "checkins"),
    habits: rows.filter((r) => r.form_type === "habits"),
  };
}

async function loadExerciseLogs(
  supabase: ReturnType<typeof createSupabaseClient>,
  args: { clientIdBigint: number; fromYmd: string; toYmd: string }
): Promise<ExerciseLogLike[]> {
  const { data } = await supabase
    .from("exercise_logs")
    .select("scheduled_date, exercises(category)")
    .eq("client_id", args.clientIdBigint)
    .gte("scheduled_date", args.fromYmd)
    .lte("scheduled_date", args.toYmd);

  return (data ?? []) as ExerciseLogLike[];
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

/**
 * Materialize one chart, with auto-fallback from too-fine an aggregation
 * to weekly when the bucket count would exceed the cap.
 */
function materializeWithCap(
  chart: ChartConfig,
  ctx: AdapterContext
): { buckets: BucketedPoint[]; aggregationFallback: boolean } {
  const adapter = resolveAdapter(chart.source);

  if (!adapter) {
    // Orphan source — return empty buckets; the surface will render the
    // orphan empty-state.
    return { buckets: [], aggregationFallback: false };
  }
  let buckets = adapter.materialize(ctx, chart.aggregation);
  let fallback = false;

  if (buckets.length > MAX_BUCKETS && chart.aggregation === "daily") {
    buckets = adapter.materialize(ctx, "weekly" as Aggregation);
    fallback = true;
  }
  // If still too many buckets, just truncate from the head — keeps the
  // most recent N visible. This is rare in practice (weekly cap covers
  // ~14mo).
  if (buckets.length > MAX_BUCKETS) {
    buckets = buckets.slice(buckets.length - MAX_BUCKETS);
  }

  return { buckets, aggregationFallback: fallback };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
): Promise<NextResponse> {
  const supabase = createSupabaseClient();
  const { clientId } = await params;
  const auth = await authorizeClientAccess(supabase, clientId);

  if (!auth.ok) return auth.response;

  const trainerId = await (async () => {
    const { data } = await supabase
      .from("clients")
      .select("tenant")
      .eq("id", auth.clientIdBigint)
      .single();

    return (data?.tenant as string | undefined) ?? null;
  })();

  if (!trainerId) {
    return NextResponse.json(
      { success: false, error: "Trainer no encontrado para el cliente" },
      { status: 404 }
    );
  }

  const url = new URL(request.url);
  const range = parseRange(url.searchParams.get("range"));

  try {
    const [effective, schedule, formResponses, exerciseLogs] =
      await Promise.all([
        loadEffectiveClientCharts(supabase, {
          tenantHost: auth.tenantHost,
          clientIdBigint: auth.clientIdBigint,
          clientTrainerId: trainerId,
        }),
        loadCheckinSchedule(supabase, {
          tenantHost: auth.tenantHost,
          clientIdBigint: auth.clientIdBigint,
        }),
        loadFormResponses(supabase, {
          tenantHost: auth.tenantHost,
          clientIdBigint: auth.clientIdBigint,
          fromYmd: ymd(range.from),
          toYmd: ymd(range.to),
        }),
        loadExerciseLogs(supabase, {
          clientIdBigint: auth.clientIdBigint,
          fromYmd: ymd(range.from),
          toYmd: ymd(range.to),
        }),
      ]);

    const ctx: AdapterContext = {
      schedule,
      range,
      formResponses,
      exerciseLogs,
    };

    const buckets: Record<
      string,
      { buckets: BucketedPoint[]; aggregationFallback: boolean }
    > = {};

    for (const chart of effective.charts.charts) {
      buckets[chart.id] = materializeWithCap(chart, ctx);
    }

    return NextResponse.json({
      success: true,
      data: {
        source: effective.source,
        effective_charts: effective.charts,
        schedule,
        range: { from: range.from.toISOString(), to: range.to.toISOString() },
        buckets,
      },
    });
  } catch (err) {
    console.error("[charts/snapshot]", err);

    return NextResponse.json(
      { success: false, error: "No se pudo cargar el snapshot" },
      { status: 500 }
    );
  }
}

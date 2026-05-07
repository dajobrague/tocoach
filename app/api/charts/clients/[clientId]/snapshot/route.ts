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

/**
 * Formato YYYY-MM-DD del Date `d` en el huso horario `tz`. Si `tz` no
 * es una zona IANA válida, cae a YMD del clock del servidor (UTC en
 * Vercel/Railway).
 */
function ymdInTz(d: Date, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const m: Record<string, string> = {};

    for (const p of parts) if (p.type !== "literal") m[p.type] = p.value;

    return `${m.year}-${m.month}-${m.day}`;
  } catch {
    return ymd(d);
  }
}

/**
 * Calcula el rango del snapshot en huso horario del cliente.
 *
 * Antes este parser hacía `new Date()` + `getDate() - days` usando el
 * clock del servidor (UTC en producción). Para un cliente en huso
 * UTC-3 que registraba cerca de medianoche local, su `response_date`
 * local podía quedar FUERA del rango "últimos 7 días" calculado por
 * el server, y el snapshot no incluía la respuesta hasta el día
 * siguiente. Síntoma cliente: "envío y nada se actualiza en charts".
 *
 * Ahora el frontend pasa `tz` en la URL (browser tz vía
 * Intl.DateTimeFormat). El server computa "hoy" en esa tz y
 * decrementa días desde ahí, así fromYmd/toYmd matchean la percepción
 * de día del cliente.
 *
 * Devuelve fromYmd/toYmd para el filtro SQL, y from/to como Date
 * (referencias absolutas) para los adapters que usan ms timestamps
 * (ring/macros).
 */
function parseRange(
  rangeParam: string | null,
  tz: string
): { from: Date; to: Date; fromYmd: string; toYmd: string } {
  const days = RANGE_DAYS[rangeParam ?? "30d"] ?? 30;

  const todayYmd = ymdInTz(new Date(), tz);
  const todayUtcMs = Date.parse(`${todayYmd}T00:00:00Z`);
  const fromMs = todayUtcMs - (days - 1) * 86400000;
  const fromYmd = new Date(fromMs).toISOString().split("T")[0] ?? todayYmd;

  return {
    from: new Date(fromMs),
    to: new Date(todayUtcMs + 86400000),
    fromYmd,
    toYmd: todayYmd,
  };
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
 * Decide la `aggregation` efectiva del chart según el rango que el
 * cliente seleccionó en el dashboard. La `chart.aggregation` que el
 * trainer guarda funciona como FALLBACK — solo se usa cuando el rango
 * no impone un override.
 *
 * Por qué existe este override:
 *   El trainer típicamente configura cada chart con un `aggregation`
 *   pensado para un rango "típico" (e.g. weekly check-in periods). El
 *   cliente puede mirar 7d / 30d / 3m / 6m / 12m. Si forzamos siempre
 *   la aggregation del trainer, el 7d puede mostrar 1 solo bucket
 *   (poco informativo) y el 12m puede explotar a 365 puntos (ilegible).
 *
 *   Para cada rango elegimos la granularidad que maximiza información
 *   sin saturar la pantalla. Empezamos con 7d → daily; los demás
 *   rangos los iremos afinando uno por uno.
 *
 * NOTA: este es el primero de una serie iterativa. Hoy solo está
 * cableado 7d. 30d / 3m / 6m / 12m caen al fallback del trainer hasta
 * que se decida por separado el comportamiento exacto de cada uno.
 */
function getEffectiveAggregation(
  rangeKey: string,
  fallback: Aggregation
): Aggregation {
  // 7 Días → siempre daily (7 buckets, uno por día). El cliente espera
  // ver el día a día de la última semana sin importar qué eligió el
  // trainer. Sin esto, un chart con `checkin_period` mostraba un solo
  // bucket "Lun-Dom" o ninguno si la semana actual aún no terminó.
  if (rangeKey === "7d") return "daily";

  // 30 Días → también daily (30 buckets, uno por día). Mismo patrón
  // que 7d para mantener consistencia mental: cada bar = un día. Las
  // bars en mobile quedan ~7px de ancho con 30 puntos en ~310px de
  // canvas — finas pero legibles, especialmente para line/area que
  // son la mayoría de los charts. Si en algún tenant los charts `bar`
  // se sienten apretados, el ajuste fino se hace en el renderer
  // (barSize) sin tocar la aggregation. La estructura del bucket
  // (tz-aware del cliente, sin doble conteo) ya quedó resuelta para
  // daily en commits anteriores, así que 30d hereda automáticamente
  // ese fix.
  if (rangeKey === "30d") return "daily";

  return fallback;
}

/**
 * Materialize one chart, with auto-fallback from too-fine an aggregation
 * to weekly when the bucket count would exceed the cap.
 *
 * `rangeKey` se usa para decidir la aggregation efectiva (ver
 * `getEffectiveAggregation`). La `chart.aggregation` queda como
 * fallback para rangos sin override explícito.
 */
function materializeWithCap(
  chart: ChartConfig,
  ctx: AdapterContext,
  rangeKey: string
): { buckets: BucketedPoint[]; aggregationFallback: boolean } {
  const adapter = resolveAdapter(chart.source);

  if (!adapter) {
    // Orphan source — return empty buckets; the surface will render the
    // orphan empty-state.
    return { buckets: [], aggregationFallback: false };
  }
  const effectiveAgg = getEffectiveAggregation(rangeKey, chart.aggregation);

  let buckets = adapter.materialize(ctx, effectiveAgg);
  let fallback = false;

  if (buckets.length > MAX_BUCKETS && effectiveAgg === "daily") {
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
  // tz del cliente viene del browser. Default UTC si el caller no lo
  // pasa (compat retro / scripts internos).
  const tzParam = url.searchParams.get("tz") || "UTC";
  // `rangeKey` (string crudo "7d"/"30d"/...) se pasa a
  // `materializeWithCap` para que decida la aggregation efectiva.
  const rangeKey = url.searchParams.get("range") ?? "30d";
  const range = parseRange(rangeKey, tzParam);

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
          fromYmd: range.fromYmd,
          toYmd: range.toYmd,
        }),
        loadExerciseLogs(supabase, {
          clientIdBigint: auth.clientIdBigint,
          fromYmd: range.fromYmd,
          toYmd: range.toYmd,
        }),
      ]);

    const ctx: AdapterContext = {
      schedule,
      range,
      formResponses,
      exerciseLogs,
      // tz del browser que está mirando el chart. Los adapters lo
      // propagan a generateBuckets/averageInWindow para que la
      // agregación daily se alinee con el calendario del cliente
      // (mismo huso del Registro Diario y del response_date que se
      // guarda en submit). Para weekly/checkin_period los helpers
      // siguen usando schedule.timezone.
      clientTz: tzParam,
    };

    const buckets: Record<
      string,
      { buckets: BucketedPoint[]; aggregationFallback: boolean }
    > = {};

    for (const chart of effective.charts.charts) {
      buckets[chart.id] = materializeWithCap(chart, ctx, rangeKey);
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

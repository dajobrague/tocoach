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
  PhotoPoint,
} from "@/lib/charts/types";
import type {
  AdapterContext,
  ExerciseLogLike,
} from "@/lib/charts/adapters/types";

import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { authorizeClientAccess } from "@/lib/charts/server/auth";
import { loadEffectiveClientCharts } from "@/lib/charts/server/template-loader";
import {
  filterUnusableCharts,
  loadTenantQuestions,
} from "@/lib/charts/server/resolvability";
import { filterChartsForAudience } from "@/lib/charts/server/visibility";
import { getEffectiveAggregation } from "@/lib/charts/aggregation";
import { resolveAdapter } from "@/lib/charts/registry";
import { buildFormQuestionAdapter } from "@/lib/charts/adapters/form-question";
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
function isValidRangeParam(value: string | null): boolean {
  if (value === null) return true;

  return Object.prototype.hasOwnProperty.call(RANGE_DAYS, value);
}

function parseRange(
  rangeParam: string | null,
  tz: string
): { from: Date; to: Date; fromYmd: string; toYmd: string } {
  // Caller debe haber validado rangeParam con isValidRangeParam antes.
  // Para rangeParam=null usamos 30d. Cualquier string desconocido también
  // cae a 30d pero la ruta GET lo rechaza con 400 antes de llegar acá,
  // así que en práctica solo "30d" pasa por el fallback.
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

  if (both.error) {
    // Antes el error se silenciaba con `data ?? []` y los charts de
    // check-in/hábitos aparecían vacíos sin warning. Logueamos para
    // que un fallo de PostgREST sea visible en logs de ops.
    console.warn(
      `[charts/snapshot] loadFormResponses error client=${args.clientIdBigint}: ${both.error.message}`
    );
  }
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
  // exercise_logs no tiene columna `scheduled_date`. La fecha del
  // entrenamiento viene de scheduled_sessions.scheduled_date (link via
  // scheduled_session_id). Para logs huérfanos (free-tracking sin
  // scheduled_session_id) caemos a completed_at::date.
  //
  // Dos queries paralelas:
  //   1. Linked: logs ligados a un scheduled_session cuyo scheduled_date
  //      cae en el rango. Esto cubre el caso "cliente loguea con delay"
  //      (completed_at puede ser muy posterior al scheduled_date pero el
  //      log sigue perteneciendo a la fecha programada).
  //   2. Orphan: logs sin scheduled_session_id cuyo completed_at cae en
  //      el rango. Para free-tracking. Buffer ±1d para cubrir TZ skew
  //      (cliente UTC-3 loguea 23:00 local → completed_at en día UTC+1).
  const bufferMs = 24 * 60 * 60 * 1000;
  const orphanFromTs =
    new Date(`${args.fromYmd}T00:00:00Z`).getTime() - bufferMs;
  const orphanToTs =
    new Date(`${args.toYmd}T00:00:00Z`).getTime() + 86400000 + bufferMs;
  const orphanFromIso = new Date(orphanFromTs).toISOString();
  const orphanToIso = new Date(orphanToTs).toISOString();

  const [linkedRes, orphanRes] = await Promise.all([
    supabase
      .from("exercise_logs")
      .select(
        "completed_at, scheduled_session:scheduled_sessions!inner(scheduled_date), exercises(category)"
      )
      .eq("client_id", args.clientIdBigint)
      .gte("scheduled_session.scheduled_date", args.fromYmd)
      .lte("scheduled_session.scheduled_date", args.toYmd),
    supabase
      .from("exercise_logs")
      .select("completed_at, exercises(category)")
      .eq("client_id", args.clientIdBigint)
      .is("scheduled_session_id", null)
      .gte("completed_at", orphanFromIso)
      .lte("completed_at", orphanToIso),
  ]);

  if (linkedRes.error) {
    console.warn(
      `[charts/snapshot] loadExerciseLogs.linked error client=${args.clientIdBigint}: ${linkedRes.error.message}`
    );
  }
  if (orphanRes.error) {
    console.warn(
      `[charts/snapshot] loadExerciseLogs.orphan error client=${args.clientIdBigint}: ${orphanRes.error.message}`
    );
  }

  const linked = (linkedRes.data ?? []).flatMap((row): ExerciseLogLike[] => {
    const scheduled = (
      row as {
        scheduled_session?: { scheduled_date?: string | null } | null;
      }
    ).scheduled_session?.scheduled_date;

    if (!scheduled) return [];

    return [
      {
        scheduled_date: scheduled,
        exercises:
          (row as { exercises?: { category?: string | null } | null })
            .exercises ?? null,
      },
    ];
  });

  const orphans = (orphanRes.data ?? []).flatMap((row): ExerciseLogLike[] => {
    const completedAt = (row as { completed_at?: string | null }).completed_at;
    const fallback = completedAt ? completedAt.slice(0, 10) : null;

    if (!fallback) return [];
    if (fallback < args.fromYmd || fallback > args.toYmd) return [];

    return [
      {
        scheduled_date: fallback,
        exercises:
          (row as { exercises?: { category?: string | null } | null })
            .exercises ?? null,
      },
    ];
  });

  return [...linked, ...orphans];
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
  const effectiveAgg = getEffectiveAggregation(
    rangeKey,
    chart.aggregation,
    chart.chart_type
  );

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
  const rawRange = url.searchParams.get("range");

  if (!isValidRangeParam(rawRange)) {
    return NextResponse.json(
      {
        success: false,
        error: `range param inválido. Valores permitidos: ${Object.keys(RANGE_DAYS).join(", ")}`,
      },
      { status: 400 }
    );
  }
  // `rangeKey` (string crudo "7d"/"30d"/...) se pasa a
  // `materializeWithCap` para que decida la aggregation efectiva.
  const rangeKey = rawRange ?? "30d";
  const range = parseRange(rangeKey, tzParam);

  try {
    const [effective, schedule, formResponses, exerciseLogs, tenantQuestions] =
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
        loadTenantQuestions(supabase, auth.tenantHost),
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

    // Drop charts inutilizables ANTES del filtro de audiencia y del
    // materialize. Cubre tres modos de fallo:
    //   - catalog id retirado del registro
    //   - form_question apuntando a pregunta borrada/disabled
    //   - catalog sin data feed compatible en el template del tenant
    //     (e.g. tenant sin pregunta de calorías → chart `calories`
    //     siempre vacío → lo escondemos)
    // Ni trainer ni cliente deberían ver el orphan card.
    const resolvableCharts = filterUnusableCharts(
      effective.charts,
      tenantQuestions,
      { logContext: `client=${auth.clientIdBigint} snapshot` }
    );

    // Drop trainer-only charts when serving a client session. We filter
    // BEFORE computing buckets so no bucket payload leaks for a chart the
    // client can't see.
    const visibleCharts = filterChartsForAudience(
      resolvableCharts,
      auth.actor.kind
    );

    const buckets: Record<
      string,
      { buckets: BucketedPoint[]; aggregationFallback: boolean }
    > = {};
    const photoBuckets: Record<string, { photos: PhotoPoint[] }> = {};

    for (const chart of visibleCharts.charts) {
      // Photo timeline charts use a different output shape (PhotoPoint[]
      // instead of BucketedPoint[]). Resolve a photo adapter directly here
      // — the catalog-vs-form_question generic resolveAdapter doesn't know
      // a question is of type photo (it'd return a numeric adapter), so
      // we build the photo adapter inline from the ref.
      if (
        chart.chart_type === "photo_timeline" &&
        chart.source.kind === "form_question"
      ) {
        const photoAdapter = buildFormQuestionAdapter({
          formType: chart.source.form_type,
          questionId: chart.source.question_id,
          label: chart.label,
          kind: "photo",
        });
        const photos = photoAdapter.photoTimeline?.(ctx) ?? [];

        photoBuckets[chart.id] = { photos };
        continue;
      }
      buckets[chart.id] = materializeWithCap(chart, ctx, rangeKey);
    }

    return NextResponse.json({
      success: true,
      data: {
        source: effective.source,
        effective_charts: visibleCharts,
        schedule,
        range: { from: range.from.toISOString(), to: range.to.toISOString() },
        buckets,
        photoBuckets,
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

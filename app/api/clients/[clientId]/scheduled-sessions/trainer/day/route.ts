// PUT /api/clients/[clientId]/scheduled-sessions/trainer/day
// DELETE /api/clients/[clientId]/scheduled-sessions/trainer/day?date=YYYY-MM-DD
//
// Save / reset a per-date prescription override. Trainer-scoped: validates
// client.tenant === session.trainer_id. Edit lock: past dates with logs
// return 409 (the day is immutable history at that point).

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

const LOG_PREFIX = "[Trainer Day Override API]";

// ── Validation ─────────────────────────────────────────────────────
// Caps protect against DoS via huge payloads and surface obvious junk
// (negatives, NaN, unbounded strings) before they hit the DB.
const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuidSchema = z.string().uuid();

const setDetailSchema = z.object({
  setNumber: z.number().int().min(1).max(100),
  reps: z.string().max(64).nullable(),
  weightKg: z.number().finite().min(0).max(9999).nullable(),
});

const exerciseSchema = z.object({
  exerciseId: uuidSchema,
  exerciseOrder: z.number().int().min(0).max(1000),
  sets: z.number().int().min(0).max(100).nullable(),
  reps: z.string().max(64).nullable(),
  weightKg: z.number().finite().min(0).max(9999).nullable(),
  durationSeconds: z.number().int().min(0).max(86400).nullable().optional(),
  distanceMeters: z.number().int().min(0).max(1_000_000).nullable().optional(),
  restSeconds: z.number().int().min(0).max(3600).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  setsDetail: z
    .array(setDetailSchema)
    .max(20)
    .refine((arr) => new Set(arr.map((s) => s.setNumber)).size === arr.length, {
      message: "setNumber duplicado dentro del ejercicio",
    })
    .nullable()
    .optional(),
});

const putBodySchema = z
  .object({
    scheduledDate: ymdSchema,
    sessionId: uuidSchema.nullable(),
    exercises: z.array(exerciseSchema).max(50),
  })
  .refine(
    (b) => {
      const orders = b.exercises.map((e) => e.exerciseOrder);

      return new Set(orders).size === orders.length;
    },
    { message: "exerciseOrder duplicado" }
  );

type PutBody = z.infer<typeof putBodySchema>;

function todayYmd(): string {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function nextYmd(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);

  d.setUTCDate(d.getUTCDate() + 1);

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

/**
 * Cuenta logs del cliente en una fecha dada, cubriendo BOTH:
 *   - logs ligados a un scheduled_session (vía scheduled_session_id)
 *   - logs huérfanos (free-tracking sin scheduled_session_id) cuyo
 *     completed_at cae el mismo día UTC
 *
 * Antes el lock check usaba solo el inner-join, así que el trainer podía
 * sobreescribir un día pasado con logs huérfanos del cliente sin warning.
 *
 * Devuelve el conteo total. Una falla en cualquiera de los dos counts se
 * trata como "hay logs" (fail-safe lockear) para evitar pisar history.
 */
async function countDayLogs(
  supabase: ReturnType<typeof createSupabaseClient>,
  clientId: string,
  date: string
): Promise<number> {
  // Ventana ±24h alrededor del día UTC. Sin buffer: cliente en UTC-3
  // loguea 22:00 local en día X → completed_at en día X+1 UTC → la
  // query "completed_at en UTC día X" lo dropea y el trainer puede
  // pisar el día X aunque haya trabajo del cliente. Con buffer, la
  // ventana incluye logs cercanos a medianoche en cualquier tz —
  // aceptamos falsos positivos (lockear cuando el log es del día
  // vecino) para evitar el silent overwrite. F4.4 (TZ tenant) lo
  // resolvería de forma precisa.
  const bufferMs = 24 * 60 * 60 * 1000;
  const dayStartMs = new Date(`${date}T00:00:00.000Z`).getTime();
  const dayEndMs = new Date(`${nextYmd(date)}T00:00:00.000Z`).getTime();
  const start = new Date(dayStartMs - bufferMs).toISOString();
  const end = new Date(dayEndMs + bufferMs).toISOString();

  const [linkedRes, orphanRes] = await Promise.all([
    supabase
      .from("exercise_logs")
      .select("scheduled_sessions!inner(id, scheduled_date, client_id)", {
        count: "exact",
        head: true,
      })
      .eq("scheduled_sessions.client_id", clientId)
      .eq("scheduled_sessions.scheduled_date", date),
    supabase
      .from("exercise_logs")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .is("scheduled_session_id", null)
      .gte("completed_at", start)
      .lt("completed_at", end),
  ]);

  const linked = linkedRes.error
    ? Number.MAX_SAFE_INTEGER
    : (linkedRes.count ?? 0);
  const orphan = orphanRes.error
    ? Number.MAX_SAFE_INTEGER
    : (orphanRes.count ?? 0);

  return linked + orphan;
}

/**
 * Run the same reset/cleanup the DELETE handler does. Used when PUT arrives
 * with no exercises and no session — those payloads previously created an
 * empty `scheduled_sessions` row that the client read pipeline treated as
 * "override empty" instead of falling back to the microcycle template.
 */
async function resetDay(
  supabase: ReturnType<typeof createSupabaseClient>,
  clientId: string,
  date: string,
  correlationId: string
): Promise<NextResponse> {
  if (date < todayYmd()) {
    const count = await countDayLogs(supabase, clientId, date);

    if (count > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Día con registros — no se puede resetear",
          code: "DAY_LOCKED",
        },
        { status: 409 }
      );
    }
  }

  const { data: ss } = await supabase
    .from("scheduled_sessions")
    .select("id")
    .eq("client_id", clientId)
    .eq("scheduled_date", date)
    .maybeSingle();

  if (!ss) {
    return NextResponse.json({ success: true });
  }

  const { count: logsCount } = await supabase
    .from("exercise_logs")
    .select("id", { count: "exact", head: true })
    .eq("scheduled_session_id", ss.id);

  if ((logsCount ?? 0) > 0) {
    const { error: delExError } = await supabase
      .from("scheduled_session_exercises")
      .delete()
      .eq("scheduled_session_id", ss.id);

    if (delExError) {
      console.error(`${LOG_PREFIX} delete overrides only:`, {
        correlationId,
        error: delExError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error reseteando override" },
        { status: 500 }
      );
    }

    // CRÍTICO: limpia session_id stale. Antes el reset borraba solo los
    // overrides pero dejaba scheduled_sessions.session_id apuntando a la
    // última sesión que el trainer había elegido. La próxima lectura
    // entraba por la rama "session" con esa sesión vieja en vez de caer
    // al template del microciclo — "Restaurar al template" mentía.
    const { error: clearSessionError } = await supabase
      .from("scheduled_sessions")
      .update({ session_id: null, status: "scheduled" })
      .eq("id", ss.id);

    if (clearSessionError) {
      console.error(`${LOG_PREFIX} clear session_id on reset:`, {
        correlationId,
        error: clearSessionError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error reseteando sesión asignada" },
        { status: 500 }
      );
    }
  } else {
    const { error: delSsError } = await supabase
      .from("scheduled_sessions")
      .delete()
      .eq("id", ss.id);

    if (delSsError) {
      console.error(`${LOG_PREFIX} delete scheduled_session:`, {
        correlationId,
        error: delSsError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error eliminando sesión programada" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { clientId } = await params;
    let body: PutBody;

    try {
      body = putBodySchema.parse(await request.json());
    } catch (err) {
      const issue =
        err instanceof z.ZodError ? err.issues[0]?.message : "body inválido";

      return NextResponse.json(
        { success: false, error: issue ?? "body inválido" },
        { status: 400 }
      );
    }

    // ── Tenant + client ownership ──────────────────────────────────
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !client || client.tenant !== session.trainer_id) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    // ── Empty override + no session → reroute to DELETE semantics ──
    // Saving with no exercises and no session_id used to leave an empty
    // scheduled_sessions row that the client read pipeline treated as
    // "override empty" instead of falling back to the microcycle template.
    if (body.sessionId === null && body.exercises.length === 0) {
      return resetDay(supabase, clientId, body.scheduledDate, correlationId);
    }

    // Resolve the trainer's actual tenant_host from the DB (the JWT's value
    // can be stale or not registered as a tenants.host primary key).
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", session.trainer_id)
      .maybeSingle();

    if (tenantError || !tenant) {
      console.error(`${LOG_PREFIX} resolve tenant.host:`, {
        correlationId,
        error: tenantError?.message,
      });

      return NextResponse.json(
        { success: false, error: "Tenant no resuelto" },
        { status: 500 }
      );
    }

    const tenantHost = tenant.host;

    // ── Lock check: past + has logs ────────────────────────────────
    if (body.scheduledDate < todayYmd()) {
      const count = await countDayLogs(supabase, clientId, body.scheduledDate);

      if (count > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Día con registros — no se puede editar",
            code: "DAY_LOCKED",
          },
          { status: 409 }
        );
      }
    }

    // ── Validate referenced sessionId belongs to trainer ───────────
    if (body.sessionId) {
      const { data: sess, error: sessError } = await supabase
        .from("sessions")
        .select("id, trainer_id")
        .eq("id", body.sessionId)
        .single();

      if (sessError || !sess || sess.trainer_id !== session.trainer_id) {
        return NextResponse.json(
          { success: false, error: "sessionId inválido" },
          { status: 400 }
        );
      }
    }

    // ── Validate referenced exercise_ids belong to trainer ─────────
    if (body.exercises.length > 0) {
      const exerciseIds = body.exercises.map((e) => e.exerciseId);
      const { data: foundEx, error: exError } = await supabase
        .from("exercises")
        .select("id, trainer_id")
        .in("id", exerciseIds);

      if (exError || !foundEx) {
        return NextResponse.json(
          { success: false, error: "Error validando ejercicios" },
          { status: 500 }
        );
      }

      const validIds = new Set(
        foundEx
          .filter((e) => e.trainer_id === session.trainer_id)
          .map((e) => e.id)
      );

      for (const id of exerciseIds) {
        if (!validIds.has(id)) {
          return NextResponse.json(
            { success: false, error: `exerciseId inválido: ${id}` },
            { status: 400 }
          );
        }
      }
    }

    // ── Transactional replace via RPC ──────────────────────────────
    // Migration 095. The RPC takes an advisory lock keyed by
    // (client_id, scheduled_date) so concurrent PUTs for the same day
    // serialize, then upserts the parent row, deletes the children
    // (cascading per-set rows), and inserts the new shape atomically.
    const rpcExercises = body.exercises.map((e) => {
      const computedSets =
        e.setsDetail && e.setsDetail.length > 0 ? e.setsDetail.length : e.sets;

      return {
        exerciseId: e.exerciseId,
        exerciseOrder: e.exerciseOrder,
        sets: computedSets,
        reps: e.reps,
        weightKg: e.weightKg,
        durationSeconds: e.durationSeconds ?? null,
        distanceMeters: e.distanceMeters ?? null,
        restSeconds: e.restSeconds ?? null,
        notes: e.notes ?? null,
      };
    });

    const rpcSets: Array<{
      exerciseOrder: number;
      setNumber: number;
      reps: string | null;
      weightKg: number | null;
    }> = [];

    for (const e of body.exercises) {
      if (!e.setsDetail || e.setsDetail.length === 0) continue;
      for (const s of e.setsDetail) {
        rpcSets.push({
          exerciseOrder: e.exerciseOrder,
          setNumber: s.setNumber,
          reps: s.reps,
          weightKg: s.weightKg,
        });
      }
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "replace_scheduled_session_overrides",
      {
        p_tenant_host: tenantHost,
        p_client_id: Number(clientId),
        p_trainer_id: session.trainer_id,
        p_scheduled_date: body.scheduledDate,
        p_session_id: body.sessionId,
        p_exercises: rpcExercises,
        p_sets: rpcSets,
      }
    );

    if (rpcError || !rpcResult) {
      console.error(`${LOG_PREFIX} RPC replace_scheduled_session_overrides:`, {
        correlationId,
        error: rpcError?.message,
      });

      return NextResponse.json(
        { success: false, error: "Error guardando override" },
        { status: 500 }
      );
    }

    // Migration 098 returns the UUID as a scalar (RETURNS UUID, not
    // RETURNS TABLE) — the supabase-js client surfaces it directly as
    // a string, not wrapped in a row object.
    const scheduledSessionId =
      typeof rpcResult === "string" ? rpcResult : String(rpcResult);

    return NextResponse.json({ success: true, scheduledSessionId });
  } catch (error) {
    console.error(`${LOG_PREFIX} PUT unexpected:`, error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { clientId } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!isYmd(date)) {
      return NextResponse.json(
        { success: false, error: "date inválido" },
        { status: 400 }
      );
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !client || client.tenant !== session.trainer_id) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    return resetDay(supabase, clientId, date, correlationId);
  } catch (error) {
    console.error(`${LOG_PREFIX} DELETE unexpected:`, error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

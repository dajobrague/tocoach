// PUT /api/clients/[clientId]/scheduled-sessions/trainer/day
// DELETE /api/clients/[clientId]/scheduled-sessions/trainer/day?date=YYYY-MM-DD
//
// Save / reset a per-date prescription override. Trainer-scoped: validates
// client.tenant === session.trainer_id. Edit lock: past dates with logs
// return 409 (the day is immutable history at that point).

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

const LOG_PREFIX = "[Trainer Day Override API]";

interface PutBody {
  scheduledDate: string;
  sessionId: string | null;
  exercises: Array<{
    exerciseId: string;
    exerciseOrder: number;
    sets: number | null;
    reps: string | null;
    weightKg: number | null;
    durationSeconds?: number | null;
    distanceMeters?: number | null;
    restSeconds?: number | null;
    notes?: string | null;
  }>;
}

function todayYmd(): string {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
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
    const body = (await request.json()) as PutBody;

    // ── Body validation ─────────────────────────────────────────────
    if (!isYmd(body.scheduledDate)) {
      return NextResponse.json(
        { success: false, error: "scheduledDate inválido" },
        { status: 400 }
      );
    }
    if (!Array.isArray(body.exercises)) {
      return NextResponse.json(
        { success: false, error: "exercises debe ser un array" },
        { status: 400 }
      );
    }

    const orders = body.exercises.map((e) => e.exerciseOrder);
    const orderSet = new Set(orders);

    if (orderSet.size !== orders.length) {
      return NextResponse.json(
        { success: false, error: "exerciseOrder duplicado" },
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

    // ── Lock check: past + has logs ────────────────────────────────
    if (body.scheduledDate < todayYmd()) {
      const { count } = await supabase
        .from("exercise_logs")
        .select("scheduled_sessions!inner(id, scheduled_date, client_id)", {
          count: "exact",
          head: true,
        })
        .eq("scheduled_sessions.client_id", clientId)
        .eq("scheduled_sessions.scheduled_date", body.scheduledDate);

      if ((count ?? 0) > 0) {
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

    // ── Validate referenced sessionId belongs to tenant ────────────
    if (body.sessionId) {
      const { data: sess, error: sessError } = await supabase
        .from("sessions")
        .select("id, tenant_host")
        .eq("id", body.sessionId)
        .single();

      if (sessError || !sess || sess.tenant_host !== session.trainer_id) {
        return NextResponse.json(
          { success: false, error: "sessionId inválido" },
          { status: 400 }
        );
      }
    }

    // ── Validate referenced exercise_ids belong to tenant ──────────
    if (body.exercises.length > 0) {
      const exerciseIds = body.exercises.map((e) => e.exerciseId);
      const { data: foundEx, error: exError } = await supabase
        .from("exercises")
        .select("id, tenant_host")
        .in("id", exerciseIds);

      if (exError || !foundEx) {
        return NextResponse.json(
          { success: false, error: "Error validando ejercicios" },
          { status: 500 }
        );
      }

      const validIds = new Set(
        foundEx
          .filter((e) => e.tenant_host === session.trainer_id)
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

    // ── Upsert scheduled_sessions row ──────────────────────────────
    let scheduledSessionId: string;

    const { data: existing } = await supabase
      .from("scheduled_sessions")
      .select("id")
      .eq("client_id", clientId)
      .eq("scheduled_date", body.scheduledDate)
      .maybeSingle();

    if (existing) {
      scheduledSessionId = existing.id;
      await supabase
        .from("scheduled_sessions")
        .update({
          session_id: body.sessionId,
          status: "scheduled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", scheduledSessionId);
    } else {
      const { data: created, error: createError } = await supabase
        .from("scheduled_sessions")
        .insert({
          tenant_host: session.trainer_id,
          client_id: clientId,
          trainer_id: session.trainer_id,
          session_id: body.sessionId,
          scheduled_date: body.scheduledDate,
          status: "scheduled",
        })
        .select("id")
        .single();

      if (createError || !created) {
        console.error(`${LOG_PREFIX} create scheduled_sessions:`, {
          correlationId,
          error: createError?.message,
        });

        return NextResponse.json(
          { success: false, error: "Error creando sesión programada" },
          { status: 500 }
        );
      }
      scheduledSessionId = created.id;
    }

    // ── Replace scheduled_session_exercises (delete + insert) ─────
    const { error: delError } = await supabase
      .from("scheduled_session_exercises")
      .delete()
      .eq("scheduled_session_id", scheduledSessionId);

    if (delError) {
      console.error(`${LOG_PREFIX} delete overrides:`, {
        correlationId,
        error: delError.message,
      });

      return NextResponse.json(
        { success: false, error: "Error reemplazando override" },
        { status: 500 }
      );
    }

    if (body.exercises.length > 0) {
      const rows = body.exercises.map((e) => ({
        tenant_host: session.trainer_id,
        scheduled_session_id: scheduledSessionId,
        exercise_id: e.exerciseId,
        exercise_order: e.exerciseOrder,
        sets: e.sets ?? null,
        reps: e.reps ?? null,
        weight_kg: e.weightKg ?? null,
        duration_seconds: e.durationSeconds ?? null,
        distance_meters: e.distanceMeters ?? null,
        rest_seconds: e.restSeconds ?? null,
        notes: e.notes ?? null,
      }));

      const { error: insError } = await supabase
        .from("scheduled_session_exercises")
        .insert(rows);

      if (insError) {
        console.error(`${LOG_PREFIX} insert overrides:`, {
          correlationId,
          error: insError.message,
        });

        return NextResponse.json(
          { success: false, error: "Error guardando override" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, scheduledSessionId });
  } catch (error) {
    console.error(`${LOG_PREFIX} PUT unexpected:`, error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

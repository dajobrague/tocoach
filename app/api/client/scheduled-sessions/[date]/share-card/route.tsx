// GET /api/client/scheduled-sessions/[date]/share-card?sessionId=…
// PNG con la marca del entrenador y los highlights de la sesión, para que el
// cliente la comparta (llamada JC, 15 sep). La genera el servidor con
// next/og: misma imagen en cualquier móvil y lista ANTES del tap de
// "Compartir" (navigator.share exige gesto de usuario). Estilo y datos
// visibles los elige el entrenador (tenants.features.share_card, Fase 2).
//
// Scoping: la fila se busca por client_id de la sesión del cliente; nunca se
// lee nada de otro cliente.

/* eslint-disable no-console */
import type { SessionSets, SetInput } from "@/lib/training/e1rm";

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { loadShareCardBranding } from "@/lib/share-card/branding";
import { renderShareCard } from "@/lib/share-card/render";
import { shareCardSettingsFromFeatures } from "@/lib/share-card/settings";
import {
  type ShareCardLog,
  computeShareCardStats,
} from "@/lib/training/share-card-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOG_PREFIX = "[Share Card API]";
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function legacySets(log: {
  sets_completed: number | null;
  reps_completed: string | null;
  weight_kg: number | null;
}): SetInput[] {
  const reps = /\d+/.exec(log.reps_completed ?? "")?.[0];

  return Array.from({ length: log.sets_completed ?? 0 }, () => ({
    reps: reps !== undefined ? parseInt(reps, 10) : null,
    weight_kg: log.weight_kg,
  }));
}

function toNumber(value: unknown): number | null {
  const n = typeof value === "string" ? parseFloat(value) : value;

  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { date } = await params;
    const sessionId = request.nextUrl.searchParams.get("sessionId");

    if (!YMD_RE.test(date) || !sessionId) {
      return NextResponse.json(
        { success: false, error: "Fecha o sesión inválida" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    const clientId = parseInt(String(session.client_id), 10);

    const { data: tenant } = await supabase
      .from("tenants")
      .select("logo_url, theme_json, features")
      .eq("slug", session.tenant_slug)
      .maybeSingle();
    const settings = shareCardSettingsFromFeatures(tenant?.features);

    if (!settings.enabled) {
      return NextResponse.json(
        { success: false, error: "Tu entrenador ha desactivado esta opción" },
        { status: 404 }
      );
    }

    const { data: row, error: rowError } = await supabase
      .from("scheduled_sessions")
      .select("id, session:sessions(name, program:programs(name))")
      .eq("client_id", clientId)
      .eq("scheduled_date", date)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (rowError || !row) {
      if (rowError) {
        console.error(`${LOG_PREFIX} row fetch error:`, {
          correlationId,
          error: rowError.message,
        });
      }

      return NextResponse.json(
        { success: false, error: "Sesión no encontrada" },
        { status: 404 }
      );
    }

    const [logsResult, countResult, branding] = await Promise.all([
      supabase
        .from("exercise_logs")
        .select(
          "exercise_id, sets_completed, reps_completed, weight_kg, duration_seconds, distance_meters, exercise:exercises(name), exercise_log_sets(reps, weight_kg)"
        )
        .eq("client_id", clientId)
        .eq("scheduled_session_id", row.id)
        .not("finalized_at", "is", null),
      supabase
        .from("scheduled_sessions")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("status", "completed")
        .lte("scheduled_date", date),
      loadShareCardBranding(tenant, correlationId),
    ]);

    if (logsResult.error) {
      console.error(`${LOG_PREFIX} logs fetch error:`, {
        correlationId,
        error: logsResult.error.message,
      });

      return NextResponse.json(
        { success: false, error: "Error al leer la sesión" },
        { status: 500 }
      );
    }

    const logs: ShareCardLog[] = (logsResult.data ?? []).map((log: any) => {
      const rows = (log.exercise_log_sets ?? []) as any[];

      return {
        exerciseId: log.exercise_id,
        exerciseName:
          pickOne<{ name?: string }>(log.exercise)?.name ?? "Ejercicio",
        sets:
          rows.length > 0
            ? rows.map((set) => ({
                reps: toNumber(set.reps),
                weight_kg: toNumber(set.weight_kg),
              }))
            : legacySets({
                sets_completed: log.sets_completed,
                reps_completed: log.reps_completed,
                weight_kg: toNumber(log.weight_kg),
              }),
        durationSeconds: toNumber(log.duration_seconds),
        distanceMeters: toNumber(log.distance_meters),
      };
    });

    // Historial de los mismos ejercicios en días ANTERIORES (récords).
    // Best-effort: si falla, la tarjeta sale sin récords.
    const priorByExercise = new Map<string, SessionSets[]>();
    const exerciseIds = [...new Set(logs.map((log) => log.exerciseId))];

    if (exerciseIds.length > 0 && settings.stats.includes("records")) {
      const { data: prior, error: priorError } = await supabase
        .from("exercise_logs")
        .select(
          "exercise_id, scheduled_sessions!inner(scheduled_date), exercise_log_sets(reps, weight_kg)"
        )
        .eq("client_id", clientId)
        .in("exercise_id", exerciseIds)
        .not("finalized_at", "is", null)
        .lt("scheduled_sessions.scheduled_date", date)
        .limit(5000);

      if (priorError) {
        console.warn(`${LOG_PREFIX} prior logs failed:`, {
          correlationId,
          error: priorError.message,
        });
      }

      for (const log of (prior ?? []) as any[]) {
        const day = pickOne<{ scheduled_date?: string }>(
          log.scheduled_sessions
        )?.scheduled_date;

        if (!day) continue;
        const list = priorByExercise.get(log.exercise_id) ?? [];

        list.push({
          date: day,
          sets: ((log.exercise_log_sets ?? []) as any[]).map((set) => ({
            reps: toNumber(set.reps),
            weight_kg: toNumber(set.weight_kg),
          })),
        });
        priorByExercise.set(log.exercise_id, list);
      }
    }

    const sessionRow = pickOne<{ name?: string; program?: unknown }>(
      row.session as any
    );

    return await renderShareCard(
      {
        branding,
        programName:
          pickOne<{ name?: string }>(sessionRow?.program as any)?.name ?? null,
        sessionName: sessionRow?.name ?? "Entrenamiento",
        date,
        stats: computeShareCardStats(logs, priorByExercise),
        sessionNumber: countResult.count ?? null,
      },
      settings,
      { "Cache-Control": "private, no-store" }
    );
  } catch (error) {
    console.error(`${LOG_PREFIX} unexpected error:`, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

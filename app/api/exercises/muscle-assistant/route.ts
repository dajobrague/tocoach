// POST /api/exercises/muscle-assistant — sugerencias de músculos con Claude.
//   { exerciseIds: string[] }  ejercicios de la biblioteca del entrenador
//                              (hasta ASSISTANT_BATCH); la sugerencia se
//                              guarda en metadata.muscle_suggestion para no
//                              pagarla dos veces si cierra la revisión.
//   { draft: {...} }           ejercicio que aún se está creando.
// Nada se aplica: el entrenador acepta o corrige después.

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  ASSISTANT_BATCH,
  type AssistantExercise,
  AssistantUnavailableError,
  suggestMuscles,
} from "@/lib/training/muscle-assistant";

const LOG_PREFIX = "[Muscle Assistant API]";
// ponytail: contador en memoria por instancia; se reinicia en cada deploy.
// Pasar a una tabla si hace falta un tope exacto entre réplicas.
const DAILY_LIMIT = 500;
const usage = new Map<string, { day: string; count: number }>();

function takeQuota(trainerId: string, n: number): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const entry = usage.get(trainerId);
  const count = entry?.day === day ? entry.count : 0;

  if (count + n > DAILY_LIMIT) return false;
  usage.set(trainerId, { day, count: count + n });

  return true;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string").slice(0, 20)
    : [];

const text = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.trim() ? value.slice(0, max) : null;

export async function POST(request: NextRequest) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const session = await getTrainerSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const supabase = createSupabaseClient();
  let items: AssistantExercise[] = [];
  let rows: { id: string; metadata: unknown }[] = [];

  if (Array.isArray(body?.exerciseIds)) {
    const exerciseIds = strings(body.exerciseIds).slice(0, ASSISTANT_BATCH);
    const { data: tenant } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", session.trainer_id)
      .single();

    if (!tenant || exerciseIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Ejercicios no válidos" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("exercises")
      .select(
        "id, name, category, description, instructions, equipment, movement_pattern, muscle_groups, metadata"
      )
      .eq("tenant_host", tenant.host)
      .eq("trainer_id", session.trainer_id)
      .in("id", exerciseIds);

    if (error) {
      console.error(`${LOG_PREFIX} load failed:`, {
        correlationId,
        error: error.message,
      });

      return NextResponse.json(
        { success: false, error: "No se pudieron leer los ejercicios" },
        { status: 500 }
      );
    }
    rows = data ?? [];
    items = rows.map((row: any) => ({
      key: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      instructions: row.instructions,
      equipment: row.equipment,
      movementPattern: row.movement_pattern,
      legacyMuscles: row.muscle_groups,
    }));
  } else if (body?.draft && typeof body.draft === "object") {
    const name = text(body.draft.name, 200);

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Escribe primero el nombre del ejercicio" },
        { status: 400 }
      );
    }
    items = [
      {
        key: "draft",
        name,
        category: text(body.draft.category, 40),
        description: text(body.draft.description, 2000),
        instructions: strings(body.draft.instructions),
        equipment: strings(body.draft.equipment),
        movementPattern: text(body.draft.movement_pattern, 120),
      },
    ];
  } else {
    return NextResponse.json(
      { success: false, error: "Petición no válida" },
      { status: 400 }
    );
  }

  if (items.length === 0) {
    return NextResponse.json({ success: true, data: {} });
  }

  if (!takeQuota(String(session.trainer_id), items.length)) {
    return NextResponse.json(
      {
        success: false,
        error: "Has llegado al límite diario del asistente. Inténtalo mañana.",
      },
      { status: 429 }
    );
  }

  try {
    const suggestions = await suggestMuscles(items);
    const at = new Date().toISOString();

    // Guarda la sugerencia en cada ejercicio (solo las que hay).
    await Promise.all(
      rows.map((row) => {
        const suggestion = suggestions.get(row.id);

        if (!suggestion) return null;
        const metadata =
          row.metadata && typeof row.metadata === "object"
            ? (row.metadata as Record<string, unknown>)
            : {};

        return supabase
          .from("exercises")
          .update({
            metadata: { ...metadata, muscle_suggestion: { ...suggestion, at } },
          })
          .eq("id", row.id);
      })
    );

    return NextResponse.json({
      success: true,
      data: Object.fromEntries(suggestions),
    });
  } catch (error) {
    if (error instanceof AssistantUnavailableError) {
      return NextResponse.json(
        { success: false, error: "El asistente no está configurado todavía" },
        { status: 503 }
      );
    }
    console.error(`${LOG_PREFIX} suggestion failed:`, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        error: "El asistente no pudo responder. Inténtalo de nuevo.",
      },
      { status: 502 }
    );
  }
}

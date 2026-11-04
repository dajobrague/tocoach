// POST /api/exercises/muscle-assistant/apply — guarda los músculos que el
// entrenador aceptó en la revisión del asistente: { items: [{ id, primary,
// secondary }] }. Misma regla que el editor: principal obligatorio salvo
// cardio. Limpia la sugerencia guardada de cada ejercicio.

/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { parseMuscles, primaryMuscleRequired } from "@/lib/training/muscles";

const MAX_ITEMS = 200;

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
  const raw: unknown[] = Array.isArray(body?.items)
    ? body.items.slice(0, MAX_ITEMS)
    : [];
  const supabase = createSupabaseClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("host")
    .eq("trainer_id", session.trainer_id)
    .single();

  if (!tenant || raw.length === 0) {
    return NextResponse.json(
      { success: false, error: "Nada que guardar" },
      { status: 400 }
    );
  }

  const ids = raw
    .map((item) => (item as { id?: unknown })?.id)
    .filter((id): id is string => typeof id === "string");
  const { data: owned, error } = await supabase
    .from("exercises")
    .select("id, category, metadata")
    .eq("tenant_host", tenant.host)
    .eq("trainer_id", session.trainer_id)
    .in("id", ids);

  if (error) {
    console.error("[Muscle Assistant Apply] load failed:", {
      correlationId,
      error: error.message,
    });

    return NextResponse.json(
      { success: false, error: "No se pudieron leer los ejercicios" },
      { status: 500 }
    );
  }

  const byId = new Map((owned ?? []).map((row: any) => [row.id, row]));
  let updated = 0;

  for (const item of raw as {
    id?: string;
    primary?: unknown;
    secondary?: unknown;
  }[]) {
    const row: any = item.id ? byId.get(item.id) : undefined;
    const parsed = parseMuscles(item.primary, item.secondary);

    if (!row || parsed?.ok !== true) continue;
    if (
      primaryMuscleRequired(row.category) &&
      parsed.muscles.primary.length === 0
    ) {
      continue;
    }
    const { muscle_suggestion: _done, ...metadata } =
      row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const { error: updateError } = await supabase
      .from("exercises")
      .update({
        primary_muscles: parsed.muscles.primary,
        secondary_muscles: parsed.muscles.secondary,
        metadata,
      })
      .eq("id", row.id);

    if (updateError) {
      console.error("[Muscle Assistant Apply] update failed:", {
        correlationId,
        id: row.id,
        error: updateError.message,
      });
      continue;
    }
    updated++;
  }

  return NextResponse.json({ success: true, data: { updated } });
}

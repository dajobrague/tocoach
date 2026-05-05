// GET /api/client/microcycle
// Devuelve el microciclo del programa activo del cliente con los slots
// expandidos a TODOS los días (1..duration_days). Los días que el
// entrenador no haya configurado vienen como type: 'rest' (descanso
// implícito). Esto evita lógica de "días faltantes" en el cliente.
// Sin programa activo o sin microciclo configurado → { microcycle: null }
// y la UI muestra empty state.

/* eslint-disable no-console */
import type { MicrocycleSlotView, SessionType } from "@/types/training";

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  loadActiveOwnedProgram,
  loadMicrocycleWithSlots,
} from "@/lib/microcycles/db";

const LOG_PREFIX = "[Client Microcycle API]";

export async function GET(_request: NextRequest) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const supabase = createSupabaseClient();

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const ownedProgram = await loadActiveOwnedProgram(
      supabase,
      session.client_id,
      null,
      correlationId
    );

    if (!ownedProgram) {
      return NextResponse.json({ success: true, microcycle: null });
    }

    const microcycle = await loadMicrocycleWithSlots(
      supabase,
      ownedProgram.id,
      correlationId
    );

    if (!microcycle) {
      return NextResponse.json({ success: true, microcycle: null });
    }

    const sessionIds = microcycle.slots
      .map((s) => s.session_id)
      .filter((id): id is string => id !== null);

    const sessionMap = await loadSessionDetails(
      supabase,
      sessionIds,
      correlationId
    );

    const expanded = expandSlots(
      microcycle.duration_days,
      microcycle.slots,
      sessionMap
    );

    return NextResponse.json({
      success: true,
      microcycle: {
        duration_days: microcycle.duration_days,
        slots: expanded,
      },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Unexpected error:`, {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

interface SessionDetail {
  id: string;
  name: string;
  session_type: SessionType | null;
  duration_minutes: number | null;
}

async function loadSessionDetails(
  supabase: ReturnType<typeof createSupabaseClient>,
  sessionIds: string[],
  correlationId: string
): Promise<Map<string, SessionDetail>> {
  if (sessionIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("sessions")
    .select("id, name, session_type, duration_minutes")
    .in("id", sessionIds);

  if (error) {
    console.warn(
      `${LOG_PREFIX} Failed to load session details, slots without metadata:`,
      { correlationId, error: error.message }
    );

    return new Map();
  }

  const map = new Map<string, SessionDetail>();

  for (const row of data ?? []) {
    map.set(row.id, {
      id: row.id,
      name: row.name,
      session_type: (row.session_type ?? null) as SessionType | null,
      duration_minutes: row.duration_minutes ?? null,
    });
  }

  return map;
}

// Construye la lista 1..duration_days. Los days_index con session_id no
// nulo y session encontrada → type 'session'. Resto → type 'rest'
// (incluye descansos explícitos session_id NULL y descansos implícitos
// días sin slot, decisión c en §1 de bloque-1-spec.md).

function expandSlots(
  durationDays: number,
  rawSlots: Array<{ day_index: number; session_id: string | null }>,
  sessionMap: Map<string, SessionDetail>
): MicrocycleSlotView[] {
  const slotByDay = new Map<
    number,
    { day_index: number; session_id: string | null }
  >();

  for (const slot of rawSlots) {
    slotByDay.set(slot.day_index, slot);
  }

  const result: MicrocycleSlotView[] = [];

  for (let day = 1; day <= durationDays; day++) {
    const slot = slotByDay.get(day);

    if (!slot || slot.session_id === null) {
      result.push({ day_index: day, type: "rest" });
      continue;
    }

    const detail = sessionMap.get(slot.session_id);

    if (!detail) {
      // session referenciada no encontrada (por ejemplo, fue borrada y el
      // slot quedó huérfano hasta que el FK ON DELETE SET NULL se aplique).
      // Defensivo: marcar como rest para que la UI no se rompa.
      result.push({ day_index: day, type: "rest" });
      continue;
    }

    result.push({
      day_index: day,
      type: "session",
      session: {
        id: detail.id,
        name: detail.name,
        session_type: detail.session_type ?? "other",
        duration_minutes: detail.duration_minutes,
      },
    });
  }

  return result;
}

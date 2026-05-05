// Helpers de base de datos para microciclos. Vive aparte del route handler
// para mantenerlo enfocado en orquestación HTTP. Reutilizable también
// por el endpoint cliente (GET /api/client/microcycle) cuando llegue.

/* eslint-disable no-console */
import type {
  Microcycle,
  MicrocycleSlot,
  MicrocycleWithSlots,
} from "@/types/training";

import { createSupabaseClient } from "@/lib/clients/supabase-api";

export type Supabase = ReturnType<typeof createSupabaseClient>;

export interface OwnedProgram {
  id: string;
  program_id: string;
  tenant_host: string;
  start_date: string;
}

const LOG_PREFIX = "[Microcycle DB]";

// Resuelve el client_program activo de un cliente. Si se pasa trainerId,
// además exige que ese trainer sea dueño (filtro doble client_id +
// trainer_id, patrón implícito de ownership usado en el resto de los
// endpoints trainer-side del repo).

export async function loadActiveOwnedProgram(
  supabase: Supabase,
  clientId: string,
  trainerIdOrNull: string | null,
  correlationId: string
): Promise<OwnedProgram | null> {
  let query = supabase
    .from("client_programs")
    .select("id, program_id, tenant_host, start_date")
    .eq("client_id", clientId)
    .eq("status", "active")
    .order("start_date", { ascending: false })
    .limit(1);

  if (trainerIdOrNull) {
    query = query.eq("trainer_id", trainerIdOrNull);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error(`${LOG_PREFIX} Error resolving active program:`, {
      correlationId,
      clientId,
      trainerId: trainerIdOrNull,
      error: error.message,
    });

    return null;
  }

  return data ?? null;
}

export async function loadMicrocycleWithSlots(
  supabase: Supabase,
  clientProgramId: string,
  correlationId: string
): Promise<MicrocycleWithSlots | null> {
  const { data: microcycle, error: microcycleError } = await supabase
    .from("microcycles")
    .select("*")
    .eq("client_program_id", clientProgramId)
    .maybeSingle();

  if (microcycleError) {
    console.error(`${LOG_PREFIX} Error fetching microcycle:`, {
      correlationId,
      clientProgramId,
      error: microcycleError.message,
    });

    return null;
  }

  if (!microcycle) return null;

  const { data: slots, error: slotsError } = await supabase
    .from("microcycle_slots")
    .select("*")
    .eq("microcycle_id", microcycle.id)
    .order("day_index", { ascending: true });

  if (slotsError) {
    console.error(`${LOG_PREFIX} Error fetching microcycle_slots:`, {
      correlationId,
      microcycleId: microcycle.id,
      error: slotsError.message,
    });

    return null;
  }

  return {
    ...(microcycle as Microcycle),
    slots: (slots ?? []) as MicrocycleSlot[],
  };
}

export async function upsertMicrocycle(
  supabase: Supabase,
  ownedProgram: OwnedProgram,
  durationDays: number,
  correlationId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("microcycles")
    .upsert(
      {
        tenant_host: ownedProgram.tenant_host,
        client_program_id: ownedProgram.id,
        duration_days: durationDays,
      },
      { onConflict: "client_program_id" }
    )
    .select("id")
    .single();

  if (error || !data) {
    console.error(`${LOG_PREFIX} Error upserting microcycle:`, {
      correlationId,
      clientProgramId: ownedProgram.id,
      error: error?.message,
    });

    return null;
  }

  return data.id;
}

// Reemplaza los slots del microciclo (DELETE + INSERT). Estrategia simple
// suficiente para la frecuencia esperada de cambios. Si el INSERT falla
// después del DELETE, el microciclo queda sin slots — recuperable con un
// re-save desde la UI.

export async function replaceSlots(
  supabase: Supabase,
  microcycleId: string,
  slots: Array<{ day_index: number; session_id: string | null }>,
  correlationId: string
): Promise<string | null> {
  const { error: deleteError } = await supabase
    .from("microcycle_slots")
    .delete()
    .eq("microcycle_id", microcycleId);

  if (deleteError) {
    console.error(`${LOG_PREFIX} Error deleting old slots:`, {
      correlationId,
      microcycleId,
      error: deleteError.message,
    });

    return "Error al limpiar los slots existentes";
  }

  if (slots.length === 0) return null;

  const rows = slots.map((s) => ({
    microcycle_id: microcycleId,
    day_index: s.day_index,
    session_id: s.session_id,
  }));

  const { error: insertError } = await supabase
    .from("microcycle_slots")
    .insert(rows);

  if (insertError) {
    console.error(`${LOG_PREFIX} Error inserting new slots:`, {
      correlationId,
      microcycleId,
      slotsCount: slots.length,
      error: insertError.message,
    });

    return "Error al guardar los slots del microciclo";
  }

  return null;
}

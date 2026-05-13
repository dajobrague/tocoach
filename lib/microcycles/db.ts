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
  const all = await loadAllActiveOwnedPrograms(
    supabase,
    clientId,
    trainerIdOrNull,
    correlationId
  );

  return all[0] ?? null;
}

// Devuelve TODOS los client_programs activos del cliente (un cliente
// puede tener fuerza + cardio activos a la vez). Ordenados por
// start_date desc — el primero es el "primario" para el microciclo.
// Filtra por status === 'active' en JS (insensible a mayúsculas/
// espacios) replicando el patrón de /api/client/programs.
export async function loadAllActiveOwnedPrograms(
  supabase: Supabase,
  clientId: string,
  trainerIdOrNull: string | null,
  correlationId: string
): Promise<OwnedProgram[]> {
  let query = supabase
    .from("client_programs")
    .select("id, program_id, tenant_host, start_date, status");

  query = query.eq("client_id", clientId);

  if (trainerIdOrNull) {
    query = query.eq("trainer_id", trainerIdOrNull);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`${LOG_PREFIX} Error resolving active programs:`, {
      correlationId,
      clientId,
      trainerId: trainerIdOrNull,
      error: error.message,
    });

    return [];
  }

  return (data ?? [])
    .filter(
      (cp) =>
        typeof cp.status === "string" &&
        cp.status.trim().toLowerCase() === "active"
    )
    .sort((a, b) => {
      const aDate = a.start_date ?? "";
      const bDate = b.start_date ?? "";

      return aDate < bDate ? 1 : aDate > bDate ? -1 : 0;
    })
    .map((cp) => ({
      id: cp.id,
      program_id: cp.program_id,
      tenant_host: cp.tenant_host,
      start_date: cp.start_date,
    }));
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
  startDate: string,
  correlationId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("microcycles")
    .upsert(
      {
        tenant_host: ownedProgram.tenant_host,
        client_program_id: ownedProgram.id,
        duration_days: durationDays,
        start_date: startDate,
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

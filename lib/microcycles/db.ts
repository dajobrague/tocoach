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
  /** Status normalizado (trim + lowercase) del client_program. */
  status: string;
  /** Ancla explícita del microciclo: a lo sumo un activo por cliente. */
  is_primary: boolean;
}

const LOG_PREFIX = "[Microcycle DB]";

// Orden canónico de los picks de programa en TODO el repo: el primario
// explícito (is_primary) primero y, como fallback determinista si no hay
// ninguno marcado (fila recién borrada, data anterior a la migración
// 20260817120000), el desempate start_date desc, created_at desc, id desc.
export interface ProgramOrderFields {
  id: string;
  start_date?: string | null;
  created_at?: string | null;
  is_primary?: boolean | null;
}

export function compareProgramPriority(
  a: ProgramOrderFields,
  b: ProgramOrderFields
): number {
  const aPrimary = a.is_primary === true;
  const bPrimary = b.is_primary === true;

  if (aPrimary !== bPrimary) return aPrimary ? -1 : 1;

  const aDate = a.start_date ?? "";
  const bDate = b.start_date ?? "";

  if (aDate !== bDate) return aDate < bDate ? 1 : -1;

  const aCreated = a.created_at ?? "";
  const bCreated = b.created_at ?? "";

  if (aCreated !== bCreated) return aCreated < bCreated ? 1 : -1;

  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

// Resuelve el client_program PRIMARIO activo de un cliente (ancla del
// microciclo). Si se pasa trainerId, además exige que ese trainer sea
// dueño (filtro doble client_id + trainer_id, patrón implícito de
// ownership usado en el resto de los endpoints trainer-side del repo).

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

// Devuelve los client_programs activos del cliente en orden canónico
// (compareProgramPriority): el primario explícito primero. Multi-activo
// es estado válido y deliberado (fuerza + cardio): puede haber N
// elementos.
export async function loadAllActiveOwnedPrograms(
  supabase: Supabase,
  clientId: string,
  trainerIdOrNull: string | null,
  correlationId: string
): Promise<OwnedProgram[]> {
  return loadOwnedProgramsByStatus(
    supabase,
    clientId,
    trainerIdOrNull,
    ["active"],
    correlationId
  );
}

// Variante general: filtra por una lista de status (en JS, insensible a
// mayúsculas/espacios, replicando el patrón de /api/client/programs).
// La usa el seguimiento del trainer para proyectar el track PASADO también
// desde programas pausados — la historia planificada no debe desaparecer
// al cambiar de programa activo.
export async function loadOwnedProgramsByStatus(
  supabase: Supabase,
  clientId: string,
  trainerIdOrNull: string | null,
  statuses: string[],
  correlationId: string
): Promise<OwnedProgram[]> {
  let query = supabase
    .from("client_programs")
    .select(
      "id, program_id, tenant_host, start_date, status, created_at, is_primary"
    );

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

  const wanted = new Set(statuses.map((s) => s.trim().toLowerCase()));

  return (data ?? [])
    .filter(
      (cp) =>
        typeof cp.status === "string" &&
        wanted.has(cp.status.trim().toLowerCase())
    )
    .sort(compareProgramPriority)
    .map((cp) => ({
      id: cp.id,
      program_id: cp.program_id,
      tenant_host: cp.tenant_host,
      start_date: cp.start_date,
      status: (cp.status as string).trim().toLowerCase(),
      is_primary: cp.is_primary === true,
    }));
}

// Garantiza que haya un primario entre los programas ACTIVOS del cliente.
// Se llama tras cualquier cambio de estado/asignación/borrado: si ninguno
// está marcado (primer programa del cliente, primario recién pausado o
// eliminado), promueve el primero del orden determinista. Best-effort —
// si falla, los lectores igual caen al desempate de compareProgramPriority.
export async function ensurePrimaryProgram(
  supabase: Supabase,
  clientId: string | number,
  correlationId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("client_programs")
    .select("id, status, start_date, created_at, is_primary")
    .eq("client_id", clientId);

  if (error) {
    console.error(`${LOG_PREFIX} ensurePrimary: error loading programs:`, {
      correlationId,
      clientId,
      error: error.message,
    });

    return;
  }

  const actives = (data ?? []).filter(
    (cp) =>
      typeof cp.status === "string" &&
      cp.status.trim().toLowerCase() === "active"
  );

  if (actives.length === 0 || actives.some((cp) => cp.is_primary === true)) {
    return;
  }

  const next = [...actives].sort(compareProgramPriority)[0];

  if (next === undefined) return;

  // Guard .eq(is_primary, false): si otra request promovió en paralelo,
  // este update no pisa nada y el índice parcial único hace de cinturón.
  const { error: promoteError } = await supabase
    .from("client_programs")
    .update({ is_primary: true, updated_at: new Date().toISOString() })
    .eq("id", next.id)
    .eq("is_primary", false);

  if (promoteError) {
    console.error(`${LOG_PREFIX} ensurePrimary: error promoting:`, {
      correlationId,
      clientId,
      clientProgramId: next.id,
      error: promoteError.message,
    });

    return;
  }

  console.log(`${LOG_PREFIX} ensurePrimary: promoted`, {
    correlationId,
    clientId,
    clientProgramId: next.id,
  });
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

/**
 * Borra las filas scheduled_sessions del cliente desde `fromDate`
 * inclusive que cumplan TODAS:
 *   - prescribed_by='trainer' (no tocamos actividad del cliente).
 *   - No tienen exercise_logs ligados (preservamos historia entrenada).
 *   - session_id está en `scopedSessionIds` (las sesiones del microciclo
 *     que cambió — unión de slots pre-save y post-save para limpiar
 *     tanto pins de la alineación vieja como de la nueva).
 *
 * Use case: trainer cambia microcycle.start_date y quiere que las
 * prescripciones futuras pre-cargadas se re-deriven con la nueva
 * alineación, sin colateral en otros microciclos activos del cliente.
 */
export async function cleanFuturePrescribedRowsForReset(
  supabase: Supabase,
  clientId: string,
  fromDate: string,
  scopedSessionIds: string[],
  correlationId: string
): Promise<{ deletedCount: number; error: string | null }> {
  if (scopedSessionIds.length === 0) {
    // El microciclo cambiado no referencia sesiones (todo descanso) ni
    // tenía sesiones antes. Nada que limpiar.
    return { deletedCount: 0, error: null };
  }

  // 1. Buscar candidatos: trainer-pinned rows del cliente desde fromDate
  //    cuyo session_id pertenezca al scope.
  const { data: candidates, error: selectError } = await supabase
    .from("scheduled_sessions")
    .select("id")
    .eq("client_id", clientId)
    .eq("prescribed_by", "trainer")
    .gte("scheduled_date", fromDate)
    .in("session_id", scopedSessionIds);

  if (selectError) {
    console.error(`${LOG_PREFIX} clean reset select failed:`, {
      correlationId,
      clientId,
      fromDate,
      error: selectError.message,
    });

    return { deletedCount: 0, error: selectError.message };
  }

  const candidateIds = (candidates ?? []).map((r) => r.id);

  if (candidateIds.length === 0) return { deletedCount: 0, error: null };

  // 2. Filtrar a las que NO tengan exercise_logs ligados. Si tiene
  //    logs, no la tocamos (preservar actividad del cliente).
  const { data: withLogs, error: logsError } = await supabase
    .from("exercise_logs")
    .select("scheduled_session_id")
    .in("scheduled_session_id", candidateIds);

  if (logsError) {
    console.error(`${LOG_PREFIX} clean reset logs probe failed:`, {
      correlationId,
      clientId,
      error: logsError.message,
    });

    return { deletedCount: 0, error: logsError.message };
  }

  const withLogsSet = new Set(
    (withLogs ?? []).map((l) => l.scheduled_session_id)
  );
  const toDelete = candidateIds.filter((id) => !withLogsSet.has(id));

  if (toDelete.length === 0) return { deletedCount: 0, error: null };

  const { error: deleteError } = await supabase
    .from("scheduled_sessions")
    .delete()
    .in("id", toDelete);

  if (deleteError) {
    console.error(`${LOG_PREFIX} clean reset delete failed:`, {
      correlationId,
      clientId,
      deletedCount: toDelete.length,
      error: deleteError.message,
    });

    return { deletedCount: 0, error: deleteError.message };
  }

  console.log(`${LOG_PREFIX} clean reset deleted future trainer pins:`, {
    correlationId,
    clientId,
    fromDate,
    deletedCount: toDelete.length,
  });

  return { deletedCount: toDelete.length, error: null };
}

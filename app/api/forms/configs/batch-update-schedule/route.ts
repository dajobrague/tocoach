import type { CheckInSchedule } from "@/lib/forms/types";

import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { validateCheckInScheduleInput } from "@/lib/forms";

const ACTIVE_STATUSES = ["Activo", "Onboarding Completado"] as const;

/**
 * PUT /api/forms/configs/batch-update-schedule
 * Body: { schedule: CheckInSchedule }
 *
 * **Update-only:** runs `.update()` on existing `client_form_configs` rows. Does **not**
 * insert new rows — active clients without a check-ins config are unchanged and counted in
 * `skipped_no_config` when the pre-update count query succeeds.
 */
export async function PUT(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as { schedule?: unknown };

    if (body.schedule === undefined || body.schedule === null) {
      return NextResponse.json(
        { success: false, error: "Falta el objeto schedule en el cuerpo." },
        { status: 400 }
      );
    }

    const validation = validateCheckInScheduleInput(body.schedule);

    if (!validation.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Horario inválido",
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    const tenantHost = session.tenant_host;

    const { data: activeClients, error: clientsError } = await supabase
      .from("clients")
      .select("id")
      .eq("tenant", session.trainer_id)
      .in("status", [...ACTIVE_STATUSES]);

    if (clientsError) {
      console.error(
        "[Forms Batch Schedule] Error listing active clients:",
        clientsError
      );

      return NextResponse.json(
        { success: false, error: "Error al listar clientes activos" },
        { status: 500 }
      );
    }

    const clientIds = (activeClients ?? []).map((c) => c.id as number);

    if (clientIds.length === 0) {
      console.log(
        "[Forms Batch Schedule] No active clients for trainer",
        session.trainer_id
      );

      return NextResponse.json({
        success: true,
        updated: 0,
        active_clients: 0,
        skipped_no_config: 0,
      });
    }

    const { count: existingCheckinConfigCount, error: countError } =
      await supabase
        .from("client_form_configs")
        .select("id", { count: "exact", head: true })
        .eq("tenant_host", tenantHost)
        .eq("form_type", "checkins")
        .in("client_id", clientIds);

    if (countError) {
      console.warn(
        "[Forms Batch Schedule] Could not count existing configs:",
        countError.message
      );
    }

    // Lo propio de cada cliente (primer check-in y check-ins movidos o
    // quitados) no es parte del horario por defecto: se conserva. Esas filas
    // se actualizan una a una; el resto, en bloque como siempre.
    const { data: ownRows } = await supabase
      .from("client_form_configs")
      .select("id, schedule")
      .eq("tenant_host", tenantHost)
      .eq("form_type", "checkins")
      .in("client_id", clientIds);
    const kept = (ownRows ?? []).flatMap((row) => {
      const prev = (row.schedule ?? {}) as Partial<CheckInSchedule>;

      if (!prev.first_close_date && !prev.exceptions) return [];

      return {
        id: row.id as string,
        schedule: {
          ...validation.value,
          ...(prev.first_close_date
            ? { first_close_date: prev.first_close_date }
            : {}),
          ...(prev.exceptions ? { exceptions: prev.exceptions } : {}),
        },
      };
    });
    const keptIds = kept.map((k) => k.id);

    let bulk = supabase
      .from("client_form_configs")
      .update({ schedule: validation.value })
      .eq("tenant_host", tenantHost)
      .eq("form_type", "checkins")
      .in("client_id", clientIds);

    if (keptIds.length > 0) {
      bulk = bulk.not("id", "in", `(${keptIds.join(",")})`);
    }

    const [bulkResult, ...keptResults] = await Promise.all([
      bulk.select("id"),
      ...kept.map((k) =>
        supabase
          .from("client_form_configs")
          .update({ schedule: k.schedule })
          .eq("id", k.id)
          .eq("tenant_host", tenantHost)
          .select("id")
      ),
    ]);
    const updateError =
      bulkResult.error ?? keptResults.find((r) => r.error)?.error ?? null;
    const updatedRows = [
      ...(bulkResult.data ?? []),
      ...keptResults.flatMap((r) => r.data ?? []),
    ];

    if (updateError) {
      console.error("[Forms Batch Schedule] Update error:", updateError);

      return NextResponse.json(
        { success: false, error: "Error al actualizar horarios" },
        { status: 500 }
      );
    }

    const updated = updatedRows?.length ?? 0;
    const skippedNoConfig =
      countError || existingCheckinConfigCount == null
        ? null
        : Math.max(0, clientIds.length - existingCheckinConfigCount);

    console.log(
      `[Forms Batch Schedule] Trainer ${session.trainer_id} updated check-in schedule for ${updated} client config row(s) (${clientIds.length} active clients` +
        (skippedNoConfig != null
          ? `, skipped_no_config: ${skippedNoConfig}`
          : "") +
        ")"
    );

    return NextResponse.json({
      success: true,
      updated,
      active_clients: clientIds.length,
      skipped_no_config: skippedNoConfig,
    });
  } catch (error) {
    console.error("[Forms Batch Schedule] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

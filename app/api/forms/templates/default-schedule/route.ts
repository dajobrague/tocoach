import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  resolveCheckInScheduleForApi,
  validateCheckInScheduleInput,
} from "@/lib/forms";

/**
 * GET /api/forms/templates/default-schedule
 * Effective default check-in schedule for new clients (from template row or system default).
 */
export async function GET(_request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", session.trainer_id)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const { data: template, error: templateError } = await supabase
      .from("form_templates")
      .select("id, default_schedule")
      .eq("tenant_host", tenant.host)
      .eq("form_type", "checkins")
      .eq("is_active", true)
      .maybeSingle();

    if (templateError) {
      console.error(
        "[Forms Template Default Schedule GET] Error:",
        templateError
      );

      return NextResponse.json(
        { success: false, error: "Error al obtener la plantilla" },
        { status: 500 }
      );
    }

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: "No se encontró plantilla activa de check-ins.",
        },
        { status: 404 }
      );
    }

    const { schedule, schedule_source } = resolveCheckInScheduleForApi(
      null,
      template.default_schedule
    );

    return NextResponse.json({
      success: true,
      default_schedule: schedule,
      schedule_source,
      template_id: template.id,
    });
  } catch (error) {
    console.error(
      "[Forms Template Default Schedule GET] Unexpected error:",
      error
    );

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/forms/templates/default-schedule
 * Body: check-in schedule object for the tenant's active check-ins template.
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

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", session.trainer_id)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const body = (await request.json()) as unknown;
    // The trainer template page wraps the schedule as `{ schedule: ... }` to
    // mirror the per-client config endpoint shape; unwrap before validating.
    const scheduleInput =
      body && typeof body === "object" && "schedule" in body
        ? (body as { schedule: unknown }).schedule
        : body;
    const scheduleValidation = validateCheckInScheduleInput(scheduleInput);

    if (!scheduleValidation.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Horario inválido",
          errors: scheduleValidation.errors,
        },
        { status: 400 }
      );
    }

    const { data: template, error: fetchError } = await supabase
      .from("form_templates")
      .select("id")
      .eq("tenant_host", tenant.host)
      .eq("form_type", "checkins")
      .eq("is_active", true)
      .maybeSingle();

    if (fetchError) {
      console.error(
        "[Forms Template Default Schedule PUT] Fetch error:",
        fetchError
      );

      return NextResponse.json(
        { success: false, error: "Error al obtener la plantilla" },
        { status: 500 }
      );
    }

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: "No se encontró plantilla activa de check-ins.",
        },
        { status: 404 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("form_templates")
      .update({ default_schedule: scheduleValidation.value })
      .eq("id", template.id)
      .select("id, default_schedule")
      .single();

    if (updateError) {
      console.error(
        "[Forms Template Default Schedule PUT] Update error:",
        updateError
      );

      return NextResponse.json(
        { success: false, error: "Error al guardar el horario por defecto" },
        { status: 500 }
      );
    }

    const { schedule, schedule_source } = resolveCheckInScheduleForApi(
      null,
      updated.default_schedule
    );

    return NextResponse.json({
      success: true,
      default_schedule: schedule,
      schedule_source,
      template_id: updated.id,
    });
  } catch (error) {
    console.error(
      "[Forms Template Default Schedule PUT] Unexpected error:",
      error
    );

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

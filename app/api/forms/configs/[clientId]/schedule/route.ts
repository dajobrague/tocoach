import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  fetchCheckinsTemplateDefaultSchedule,
  resolveCheckInScheduleForApi,
  validateCheckInScheduleInput,
} from "@/lib/forms";
/**
 * GET /api/forms/configs/[clientId]/schedule?form_type=checkins
 * Lightweight schedule for the client (check-ins only).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    const trainerSession = await getTrainerSession();
    const clientSession = await getClientSession();

    if (!trainerSession && !clientSession) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { clientId: clientIdStr } = await params;
    const clientId = parseInt(clientIdStr);

    if (isNaN(clientId)) {
      return NextResponse.json(
        { success: false, error: "ID de cliente inválido" },
        { status: 400 }
      );
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", client.tenant)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const tenantHost = tenant.host;

    if (trainerSession) {
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("host, trainer_id")
        .eq("host", tenantHost)
        .single();

      if (!tenantData || tenantData.trainer_id !== trainerSession.trainer_id) {
        return NextResponse.json(
          { success: false, error: "No autorizado para este cliente" },
          { status: 403 }
        );
      }
    } else if (clientSession) {
      if (String(clientSession.client_id) !== String(clientId)) {
        return NextResponse.json(
          { success: false, error: "No autorizado" },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const formType = searchParams.get("form_type") ?? "checkins";

    if (formType !== "checkins") {
      return NextResponse.json(
        {
          success: false,
          error: "El horario solo está disponible para checkins.",
        },
        { status: 400 }
      );
    }

    const { data: row, error: fetchError } = await supabase
      .from("client_form_configs")
      .select("schedule, template_id")
      .eq("client_id", clientId)
      .eq("form_type", "checkins")
      .eq("tenant_host", tenantHost)
      .maybeSingle();

    if (fetchError) {
      console.error("[Forms Config Schedule GET] Fetch error:", fetchError);

      return NextResponse.json(
        { success: false, error: "Error al obtener el horario" },
        { status: 500 }
      );
    }

    if (!row) {
      return NextResponse.json(
        {
          success: false,
          error: "No se encontró configuración de check-ins para este cliente.",
        },
        { status: 404 }
      );
    }

    const templateDefault = await fetchCheckinsTemplateDefaultSchedule(
      supabase,
      tenantHost,
      row.template_id
    );

    const { schedule, schedule_source } = resolveCheckInScheduleForApi(
      row.schedule,
      templateDefault
    );

    return NextResponse.json({
      success: true,
      schedule,
      schedule_source,
    });
  } catch (error) {
    console.error("[Forms Config Schedule GET] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/forms/configs/[clientId]/schedule
 * Body: check-in schedule object (same validation as PUT /configs/[clientId]).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { clientId: clientIdStr } = await params;
    const clientId = parseInt(clientIdStr);

    if (isNaN(clientId)) {
      return NextResponse.json(
        { success: false, error: "ID de cliente inválido" },
        { status: 400 }
      );
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", client.tenant)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const tenantHost = tenant.host;

    const { data: tenantData } = await supabase
      .from("tenants")
      .select("host, trainer_id")
      .eq("host", tenantHost)
      .single();

    if (!tenantData || tenantData.trainer_id !== session.trainer_id) {
      return NextResponse.json(
        { success: false, error: "No autorizado para este cliente" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as unknown;
    const scheduleValidation = validateCheckInScheduleInput(body);

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

    const { data: updated, error: updateError } = await supabase
      .from("client_form_configs")
      .update({ schedule: scheduleValidation.value })
      .eq("client_id", clientId)
      .eq("form_type", "checkins")
      .eq("tenant_host", tenantHost)
      .select("schedule, template_id")
      .maybeSingle();

    if (updateError) {
      console.error("[Forms Config Schedule PUT] Update error:", updateError);

      return NextResponse.json(
        { success: false, error: "Error al guardar el horario" },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          error: "No se encontró configuración de check-ins para este cliente.",
        },
        { status: 404 }
      );
    }

    const templateDefault = await fetchCheckinsTemplateDefaultSchedule(
      supabase,
      tenantHost,
      updated.template_id
    );

    const resolved = resolveCheckInScheduleForApi(
      updated.schedule,
      templateDefault
    );

    return NextResponse.json({
      success: true,
      schedule: resolved.schedule,
      schedule_source: resolved.schedule_source,
    });
  } catch (error) {
    console.error("[Forms Config Schedule PUT] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

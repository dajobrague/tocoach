import type { CheckInSchedule } from "@/lib/forms/types";

import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { getScheduleOrDefault } from "@/lib/forms/schedule";

/**
 * POST /api/forms/configs/[clientId]/apply-template
 *
 * Explicitly applies the tenant's active template (for the given form_type) to
 * a single existing client. **Overwrites** the client's current questions
 * config and, for checkins, the client's schedule with the template's
 * `default_schedule` (if present).
 *
 * Intended to be called only from an explicit trainer action with
 * double-confirmation UI. Not reachable by client sessions.
 *
 * Body: `{ form_type: "checkins" | "habits" }`
 */
export async function POST(
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
    const clientId = parseInt(clientIdStr, 10);

    if (!Number.isFinite(clientId)) {
      return NextResponse.json(
        { success: false, error: "ID de cliente inválido" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const formType = body?.form_type;

    if (formType !== "checkins" && formType !== "habits") {
      return NextResponse.json(
        { success: false, error: "Tipo de formulario inválido" },
        { status: 400 }
      );
    }

    // Locate client → tenant (mirrors GET/PUT patterns above).
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
      .select("host, trainer_id")
      .eq("trainer_id", client.tenant)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    if (tenant.trainer_id !== session.trainer_id) {
      return NextResponse.json(
        { success: false, error: "No autorizado para este cliente" },
        { status: 403 }
      );
    }

    const tenantHost = tenant.host;

    // Fetch the active template for this tenant + form_type.
    const { data: template, error: templateError } = await supabase
      .from("form_templates")
      .select("id, questions_config, default_schedule")
      .eq("tenant_host", tenantHost)
      .eq("form_type", formType)
      .eq("is_active", true)
      .maybeSingle();

    if (templateError) {
      console.error("[apply-template] Error fetching template:", templateError);

      return NextResponse.json(
        { success: false, error: "Error al obtener plantilla" },
        { status: 500 }
      );
    }

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: "No hay plantilla activa para este formulario",
        },
        { status: 404 }
      );
    }

    // Resolve the schedule we'll write. For checkins, prefer the template's
    // default_schedule; if missing, fall back to system default (so the client
    // isn't left with a stale custom schedule).
    let scheduleToWrite: CheckInSchedule | null = null;

    if (formType === "checkins") {
      scheduleToWrite = getScheduleOrDefault(
        template.default_schedule as CheckInSchedule | null | undefined
      );
    }

    const upsertPayload: Record<string, unknown> = {
      tenant_host: tenantHost,
      client_id: clientId,
      form_type: formType,
      questions_config: template.questions_config,
      uses_template: true,
      template_id: template.id,
    };

    if (formType === "checkins") {
      upsertPayload.schedule = scheduleToWrite;
    }

    const { data: config, error: upsertError } = await supabase
      .from("client_form_configs")
      .upsert(upsertPayload, { onConflict: "client_id,form_type" })
      .select()
      .single();

    if (upsertError) {
      console.error("[apply-template] Upsert error:", upsertError);

      return NextResponse.json(
        { success: false, error: "Error al aplicar plantilla" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      config,
      schedule: scheduleToWrite,
      schedule_source: formType === "checkins" ? "template" : null,
    });
  } catch (error) {
    console.error("[apply-template] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

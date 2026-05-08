import type { CheckInSchedule } from "@/lib/forms/types";

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import {
  validateQuestionsConfig,
  fetchCheckinsTemplateDefaultSchedule,
  validateCheckInScheduleInput,
} from "@/lib/forms";
import {
  DEFAULT_CHECKIN_CONFIG,
  DEFAULT_HABIT_CONFIG,
} from "@/lib/forms/defaults";
import {
  DEFAULT_CHECKIN_SCHEDULE,
  getScheduleOrDefault,
} from "@/lib/forms/schedule";

function resolveCheckinScheduleForConfigResponse(
  clientSchedule: unknown | null | undefined,
  templateDefaultSchedule: unknown | null | undefined
): {
  schedule: CheckInSchedule;
  schedule_source: "client" | "template" | "default";
} {
  if (clientSchedule != null) {
    return {
      schedule: getScheduleOrDefault(clientSchedule as CheckInSchedule),
      schedule_source: "client",
    };
  }

  if (templateDefaultSchedule != null) {
    return {
      schedule: getScheduleOrDefault(
        templateDefaultSchedule as CheckInSchedule
      ),
      schedule_source: "template",
    };
  }

  return {
    schedule: getScheduleOrDefault(DEFAULT_CHECKIN_SCHEDULE),
    schedule_source: "default",
  };
}

/**
 * GET /api/forms/configs/[clientId]?form_type=checkins|habits
 * Get form configuration for a specific client
 * Auto-creates from template if doesn't exist (lazy initialization)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    // Support both trainer and client sessions
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

    // Get client to find their tenant (trainer UUID)
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      console.error(
        "[Forms Configs GET] Client not found:",
        clientId,
        clientError
      );

      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    // Get tenant_host using the trainer_id from client.tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", client.tenant)
      .single();

    if (tenantError || !tenant) {
      console.error(
        "[Forms Configs GET] Tenant not found for trainer:",
        client.tenant,
        tenantError
      );

      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const tenantHost = tenant.host;

    // Authorization check
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
      // Clients can read their own configs
      if (String(clientSession.client_id) !== String(clientId)) {
        return NextResponse.json(
          { success: false, error: "No autorizado" },
          { status: 403 }
        );
      }
    }

    // Get form type from query params
    const { searchParams } = new URL(request.url);
    const formType = searchParams.get("form_type");

    if (!formType || (formType !== "checkins" && formType !== "habits")) {
      return NextResponse.json(
        { success: false, error: "Tipo de formulario inválido" },
        { status: 400 }
      );
    }

    // Try to get existing config
    const { data: existingConfig, error: fetchError } = await supabase
      .from("client_form_configs")
      .select("*")
      .eq("client_id", clientId)
      .eq("form_type", formType)
      .eq("tenant_host", tenantHost)
      .maybeSingle();

    if (fetchError) {
      console.error("[Forms Configs] Error fetching config:", fetchError);

      return NextResponse.json(
        { success: false, error: "Error al obtener configuración" },
        { status: 500 }
      );
    }

    let config = existingConfig;

    // If config doesn't exist, auto-create from the tenant's template
    if (!config) {
      console.log(
        "[Forms Configs] No config found for client:",
        clientId,
        formType,
        "auto-creating from template"
      );

      // Look for the tenant's active template for this form type
      const { data: template, error: templateError } = await supabase
        .from("form_templates")
        .select("id, questions_config, default_schedule")
        .eq("tenant_host", tenantHost)
        .eq("form_type", formType)
        .eq("is_active", true)
        .maybeSingle();

      if (templateError) {
        console.error(
          "[Forms Configs] Error fetching template:",
          templateError
        );

        return NextResponse.json(
          { success: false, error: "Error al obtener plantilla" },
          { status: 500 }
        );
      }

      // No template exists for this tenant: lazily auto-create one from the
      // in-code defaults so every client renders a populated form even if the
      // trainer never opened the template editor. Subsequent trainer edits
      // overwrite this row through the normal /api/forms/templates flow.
      let resolvedTemplate = template;

      if (!resolvedTemplate) {
        console.log(
          "[Forms Configs] No template found for tenant — creating from defaults:",
          tenantHost,
          formType
        );

        const fallbackConfig =
          formType === "checkins"
            ? DEFAULT_CHECKIN_CONFIG
            : DEFAULT_HABIT_CONFIG;
        const fallbackName =
          formType === "checkins"
            ? "Plantilla de Check-in"
            : "Plantilla de Hábitos";

        const { data: createdTemplate, error: createTemplateError } =
          await supabase
            .from("form_templates")
            .insert({
              tenant_host: tenantHost,
              form_type: formType,
              name: fallbackName,
              questions_config: fallbackConfig,
              is_active: true,
              auto_apply_to_new_clients: true,
            })
            .select("id, questions_config, default_schedule")
            .single();

        if (createTemplateError || !createdTemplate) {
          console.error(
            "[Forms Configs] Error auto-creating template from defaults:",
            createTemplateError
          );

          return NextResponse.json(
            { success: false, error: "Error al crear plantilla por defecto" },
            { status: 500 }
          );
        }

        resolvedTemplate = createdTemplate;
      }

      // Create the client config from the (existing or freshly-seeded) template
      const { data: newConfig, error: insertError } = await supabase
        .from("client_form_configs")
        .insert({
          tenant_host: tenantHost,
          client_id: clientId,
          form_type: formType,
          questions_config: resolvedTemplate.questions_config,
          uses_template: true,
          template_id: resolvedTemplate.id,
        })
        .select()
        .single();

      if (insertError) {
        console.error(
          "[Forms Configs] Error creating config from template:",
          insertError
        );

        return NextResponse.json(
          {
            success: false,
            error: "Error al crear configuración del formulario",
          },
          { status: 500 }
        );
      }

      console.log(
        "[Forms Configs] Auto-created config for client:",
        clientId,
        formType
      );
      config = newConfig;
    }

    let schedulePayload: {
      schedule: CheckInSchedule | null;
      schedule_source: "client" | "template" | "default" | null;
    };

    if (formType === "checkins") {
      const templateDefault = await fetchCheckinsTemplateDefaultSchedule(
        supabase,
        tenantHost,
        config.template_id
      );
      const resolved = resolveCheckinScheduleForConfigResponse(
        config.schedule,
        templateDefault
      );

      schedulePayload = {
        schedule: resolved.schedule,
        schedule_source: resolved.schedule_source,
      };
    } else {
      schedulePayload = { schedule: null, schedule_source: null };
    }

    return NextResponse.json({
      success: true,
      config,
      schedule: schedulePayload.schedule,
      schedule_source: schedulePayload.schedule_source,
    });
  } catch (error) {
    console.error("[Forms Configs] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/forms/configs/[clientId]
 * Update a client's form configuration
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

    // Get client to find their tenant (trainer UUID)
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      console.error(
        "[Forms Configs PUT] Client not found:",
        clientId,
        clientError
      );

      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    // Get tenant_host using the trainer_id from client.tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", client.tenant)
      .single();

    if (tenantError || !tenant) {
      console.error(
        "[Forms Configs PUT] Tenant not found for trainer:",
        client.tenant,
        tenantError
      );

      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const tenantHost = tenant.host;

    // Verify this tenant belongs to the logged-in trainer
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

    const body = await request.json();
    const {
      form_type,
      questions_config,
      uses_template,
      schedule: bodySchedule,
    } = body;

    // Validate required fields
    if (!form_type || (form_type !== "checkins" && form_type !== "habits")) {
      return NextResponse.json(
        { success: false, error: "Tipo de formulario inválido" },
        { status: 400 }
      );
    }

    if (!questions_config) {
      return NextResponse.json(
        { success: false, error: "Configuración de preguntas requerida" },
        { status: 400 }
      );
    }

    // Validate questions config
    const validation = validateQuestionsConfig(questions_config);

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Configuración de preguntas inválida",
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    let validatedScheduleBody: CheckInSchedule | undefined;

    if (bodySchedule !== undefined) {
      if (form_type !== "checkins") {
        return NextResponse.json(
          {
            success: false,
            error:
              "El horario solo puede actualizarse para formularios de tipo checkins.",
          },
          { status: 400 }
        );
      }

      const scheduleValidation = validateCheckInScheduleInput(bodySchedule);

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

      validatedScheduleBody = scheduleValidation.value;
    }

    const { data: existingRow } = await supabase
      .from("client_form_configs")
      .select("schedule")
      .eq("client_id", clientId)
      .eq("form_type", form_type)
      .eq("tenant_host", tenantHost)
      .maybeSingle();

    const nextSchedule: unknown =
      validatedScheduleBody !== undefined
        ? validatedScheduleBody
        : (existingRow?.schedule ?? null);

    const { data: config, error } = await supabase
      .from("client_form_configs")
      .upsert(
        {
          tenant_host: tenantHost,
          client_id: clientId,
          form_type,
          questions_config,
          uses_template: uses_template !== undefined ? uses_template : false,
          schedule: nextSchedule,
        },
        { onConflict: "client_id,form_type" }
      )
      .select()
      .single();

    if (error) {
      console.error("[Forms Configs] Error saving config:", error);

      return NextResponse.json(
        { success: false, error: "Error al guardar configuración" },
        { status: 500 }
      );
    }

    let schedule: CheckInSchedule | null = null;
    let schedule_source: "client" | "template" | "default" | null = null;

    if (form_type === "checkins") {
      const templateDefault = await fetchCheckinsTemplateDefaultSchedule(
        supabase,
        tenantHost,
        config.template_id
      );
      const resolved = resolveCheckinScheduleForConfigResponse(
        config.schedule,
        templateDefault
      );

      schedule = resolved.schedule;
      schedule_source = resolved.schedule_source;
    }

    return NextResponse.json({
      success: true,
      config,
      schedule,
      schedule_source,
    });
  } catch (error) {
    console.error("[Forms Configs] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { validateQuestionsConfig } from "@/lib/forms";

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
      if (clientSession.client_id !== clientId.toString()) {
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

    // If config doesn't exist, return success with no config (frontend will handle this gracefully)
    if (!config) {
      console.log(
        "[Forms Configs] No config found for client:",
        clientId,
        formType
      );

      return NextResponse.json(
        {
          success: false,
          error: "No config found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      config,
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
    const { form_type, questions_config, uses_template } = body;

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

    // Check if config exists
    const { data: existingConfig } = await supabase
      .from("client_form_configs")
      .select("id")
      .eq("client_id", clientId)
      .eq("form_type", form_type)
      .single();

    let config;
    let error;

    if (existingConfig) {
      // Update existing config
      const result = await supabase
        .from("client_form_configs")
        .update({
          questions_config,
          uses_template: uses_template !== undefined ? uses_template : true,
        })
        .eq("client_id", clientId)
        .eq("form_type", form_type)
        .eq("tenant_host", tenantHost)
        .select()
        .single();

      config = result.data;
      error = result.error;
    } else {
      // Create new config
      const result = await supabase
        .from("client_form_configs")
        .insert({
          tenant_host: tenantHost,
          client_id: clientId,
          form_type,
          questions_config,
          uses_template: uses_template !== undefined ? uses_template : false,
        })
        .select()
        .single();

      config = result.data;
      error = result.error;
    }

    if (error) {
      console.error("[Forms Configs] Error saving config:", error);

      return NextResponse.json(
        { success: false, error: "Error al guardar configuración" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error("[Forms Configs] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

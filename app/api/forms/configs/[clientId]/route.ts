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

    // Get tenant_host for this client using helper function
    const { data: tenantHost, error: tenantError } = await supabase
      .rpc("get_tenant_host_for_client", { p_client_id: clientId })
      .single();

    if (tenantError || !tenantHost) {
      console.error(
        "[Forms Configs GET] Client/tenant not found:",
        clientId,
        tenantError
      );

      return NextResponse.json(
        { success: false, error: "Cliente o tenant no encontrado" },
        { status: 404 }
      );
    }

    // Authorization check
    if (trainerSession) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("host, trainer_id")
        .eq("host", tenantHost)
        .single();

      if (!tenant || tenant.trainer_id !== trainerSession.trainer_id) {
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

    // Use the database function to get or create config
    const { data: config, error } = await supabase
      .rpc("get_or_create_client_form_config", {
        p_client_id: clientId,
        p_form_type: formType,
        p_tenant_host: tenantHost,
      })
      .single();

    if (error) {
      console.error("[Forms Configs] Error getting/creating config:", error);

      return NextResponse.json(
        { success: false, error: "Error al obtener configuración" },
        { status: 500 }
      );
    }

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: "No se pudo crear configuración (template no encontrada)",
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

    // Get tenant_host for this client
    const { data: tenantHost, error: tenantError } = await supabase
      .rpc("get_tenant_host_for_client", { p_client_id: clientId })
      .single();

    if (tenantError || !tenantHost) {
      console.error(
        "[Forms Configs PUT] Client/tenant not found:",
        clientId,
        tenantError
      );

      return NextResponse.json(
        { success: false, error: "Cliente o tenant no encontrado" },
        { status: 404 }
      );
    }

    // Verify this tenant belongs to the logged-in trainer
    const { data: tenant } = await supabase
      .from("tenants")
      .select("host, trainer_id")
      .eq("host", tenantHost)
      .single();

    if (!tenant || tenant.trainer_id !== session.trainer_id) {
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

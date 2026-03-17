import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { FormResponseSubmission, validateFormResponse } from "@/lib/forms";

/**
 * GET /api/forms/responses/[clientId]?form_type=checkins|habits&start_date=&end_date=
 * Get form responses for a specific client
 * Supports both trainer and client sessions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    // Check for either trainer or client session
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

    // Get tenant_host for this client
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !clientData) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    const { data: tenantData, error: tenantError } = await supabase
      .from("tenants")
      .select("host, trainer_id")
      .eq("trainer_id", clientData.tenant)
      .single();

    if (tenantError || !tenantData) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const tenantHost = tenantData.host;

    // Authorization check
    if (trainerSession) {
      if (tenantData.trainer_id !== trainerSession.trainer_id) {
        return NextResponse.json(
          { success: false, error: "No autorizado para este cliente" },
          { status: 403 }
        );
      }
    } else if (clientSession) {
      // Clients can only access their own data
      if (String(clientSession.client_id) !== String(clientId)) {
        return NextResponse.json(
          { success: false, error: "No autorizado" },
          { status: 403 }
        );
      }
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const formType = searchParams.get("form_type");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    if (!formType || (formType !== "checkins" && formType !== "habits")) {
      return NextResponse.json(
        { success: false, error: "Tipo de formulario inválido" },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from("form_responses")
      .select("*")
      .eq("client_id", clientId)
      .eq("form_type", formType)
      .eq("tenant_host", tenantHost);

    // Apply date filters
    if (startDate) {
      query = query.gte("response_date", startDate);
    }
    if (endDate) {
      query = query.lte("response_date", endDate);
    }

    const { data: responses, error } = await query.order("response_date", {
      ascending: false,
    });

    if (error) {
      console.error("[Forms Responses] Error fetching responses:", error);

      return NextResponse.json(
        { success: false, error: "Error al obtener respuestas" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      responses: responses || [],
    });
  } catch (error) {
    console.error("[Forms Responses] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/forms/responses/[clientId]
 * Submit a new form response
 * Supports both trainer and client sessions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    // Check for either trainer or client session
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

    // Get tenant_host for this client
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !clientData) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    const { data: tenantData, error: tenantError } = await supabase
      .from("tenants")
      .select("host, trainer_id")
      .eq("trainer_id", clientData.tenant)
      .single();

    if (tenantError || !tenantData) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const tenantHost = tenantData.host;

    // Authorization check
    if (trainerSession) {
      if (tenantData.trainer_id !== trainerSession.trainer_id) {
        return NextResponse.json(
          { success: false, error: "No autorizado para este cliente" },
          { status: 403 }
        );
      }
    } else if (clientSession) {
      // Clients can only submit their own responses
      if (String(clientSession.client_id) !== String(clientId)) {
        return NextResponse.json(
          { success: false, error: "No autorizado" },
          { status: 403 }
        );
      }
    }

    const body: FormResponseSubmission = await request.json();
    const { form_type, response_date, answers, metadata } = body;

    // Validate required fields
    if (!form_type || (form_type !== "checkins" && form_type !== "habits")) {
      return NextResponse.json(
        { success: false, error: "Tipo de formulario inválido" },
        { status: 400 }
      );
    }

    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { success: false, error: "Respuestas requeridas" },
        { status: 400 }
      );
    }

    // Get the form config for validation
    const { data: config } = await supabase
      .from("client_form_configs")
      .select("questions_config")
      .eq("client_id", clientId)
      .eq("form_type", form_type)
      .single();

    if (config) {
      // Validate responses against config
      const validation = validateFormResponse(body, config.questions_config);

      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: "Respuestas inválidas",
            errors: validation.errors,
          },
          { status: 400 }
        );
      }
    }

    // Create response
    const { data: response, error } = await supabase
      .from("form_responses")
      .insert({
        tenant_host: tenantHost,
        client_id: clientId,
        form_type,
        response_date: response_date || new Date().toISOString().split("T")[0],
        answers,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error("[Forms Responses] Error creating response:", error);

      return NextResponse.json(
        { success: false, error: "Error al crear respuesta" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      response,
    });
  } catch (error) {
    console.error("[Forms Responses] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { validateQuestionsConfig } from "@/lib/forms";

/**
 * GET /api/forms/templates
 * Get all form templates for the trainer's tenant
 */
export async function GET(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    // Get tenant host
    const { data: tenant } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", session.trainer_id)
      .single();

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    // Get form type from query params (optional)
    const { searchParams } = new URL(request.url);
    const formType = searchParams.get("form_type");

    let query = supabase
      .from("form_templates")
      .select("*")
      .eq("tenant_host", tenant.host)
      .eq("is_active", true);

    if (formType && (formType === "checkins" || formType === "habits")) {
      query = query.eq("form_type", formType);
    }

    const { data: templates, error } = await query.order("form_type");

    if (error) {
      console.error("[Forms Templates] Error fetching templates:", error);

      return NextResponse.json(
        { success: false, error: "Error al obtener plantillas" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      templates: templates || [],
    });
  } catch (error) {
    console.error("[Forms Templates] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/forms/templates
 * Create a new form template
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    // Get tenant host
    const { data: tenant } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", session.trainer_id)
      .single();

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      form_type,
      name,
      description,
      questions_config,
      auto_apply_to_new_clients,
    } = body;

    // Validate required fields
    if (!form_type || (form_type !== "checkins" && form_type !== "habits")) {
      return NextResponse.json(
        { success: false, error: "Tipo de formulario inválido" },
        { status: 400 }
      );
    }

    if (!name || !questions_config) {
      return NextResponse.json(
        {
          success: false,
          error: "Nombre y configuración de preguntas son requeridos",
        },
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

    if (
      auto_apply_to_new_clients !== undefined &&
      typeof auto_apply_to_new_clients !== "boolean"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "auto_apply_to_new_clients debe ser true o false",
        },
        { status: 400 }
      );
    }

    // Create template
    const insertPayload: Record<string, unknown> = {
      tenant_host: tenant.host,
      form_type,
      name,
      description,
      questions_config,
      is_active: true,
    };

    if (auto_apply_to_new_clients !== undefined) {
      insertPayload.auto_apply_to_new_clients = auto_apply_to_new_clients;
    }

    const { data: template, error } = await supabase
      .from("form_templates")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error("[Forms Templates] Error creating template:", error);

      return NextResponse.json(
        { success: false, error: "Error al crear plantilla" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error("[Forms Templates] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/forms/templates
 * Update an existing form template
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

    // Get tenant host
    const { data: tenant } = await supabase
      .from("tenants")
      .select("host")
      .eq("trainer_id", session.trainer_id)
      .single();

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      template_id,
      name,
      description,
      questions_config,
      is_active,
      auto_apply_to_new_clients,
    } = body;

    if (!template_id) {
      return NextResponse.json(
        { success: false, error: "ID de plantilla requerido" },
        { status: 400 }
      );
    }

    // Validate questions config if provided
    if (questions_config) {
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
    }

    if (
      auto_apply_to_new_clients !== undefined &&
      typeof auto_apply_to_new_clients !== "boolean"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "auto_apply_to_new_clients debe ser true o false",
        },
        { status: 400 }
      );
    }

    // Build update object
    const updates: any = {};

    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (questions_config) updates.questions_config = questions_config;
    if (is_active !== undefined) updates.is_active = is_active;
    if (auto_apply_to_new_clients !== undefined) {
      updates.auto_apply_to_new_clients = auto_apply_to_new_clients;
    }

    // Update template
    const { data: template, error } = await supabase
      .from("form_templates")
      .update(updates)
      .eq("id", template_id)
      .eq("tenant_host", tenant.host)
      .select()
      .single();

    if (error) {
      console.error("[Forms Templates] Error updating template:", error);

      return NextResponse.json(
        { success: false, error: "Error al actualizar plantilla" },
        { status: 500 }
      );
    }

    if (!template) {
      return NextResponse.json(
        { success: false, error: "Plantilla no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error("[Forms Templates] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

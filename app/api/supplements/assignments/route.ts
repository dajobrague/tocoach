import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET - Fetch supplement assignments for a client
export async function GET(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    // Authenticate trainer
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "client_id es requerido" },
        { status: 400 }
      );
    }

    console.log(
      "[Supplement Assignments API] Fetching assignments for client:",
      clientId
    );

    // Get tenant_host for the trainer
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

    // Fetch assignments with supplement inventory data (left join)
    const { data: assignments, error: assignmentsError } = await supabase
      .from("client_supplement_assignments")
      .select(
        `
                *,
                supplement:supplement_inventory(*)
            `
      )
      .eq("tenant_host", tenant.host)
      .eq("client_id", clientId)
      .eq("trainer_id", session.trainer_id)
      .order("created_at", { ascending: false });

    if (assignmentsError) {
      console.error(
        "[Supplement Assignments API] Error fetching assignments:",
        assignmentsError
      );

      return NextResponse.json(
        { success: false, error: "Error al obtener asignaciones" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: assignments || [],
    });
  } catch (error) {
    console.error("[Supplement Assignments API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

// POST - Create a new supplement assignment
export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    // Authenticate trainer
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      client_id,
      supplement_id,
      dosage,
      frequency,
      timing,
      notes,
      status,
    } = body;

    console.log("[Supplement Assignments API] Creating assignment:", body);

    // Validate required fields
    if (!client_id || !supplement_id || !dosage || !frequency || !timing) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Campos requeridos: client_id, supplement_id, dosage, frequency, timing",
        },
        { status: 400 }
      );
    }

    // Get tenant_host for the trainer
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

    // Fetch the supplement from inventory to get name and description
    const { data: supplement, error: supplementError } = await supabase
      .from("supplement_inventory")
      .select("name, description")
      .eq("id", supplement_id)
      .eq("tenant_host", tenant.host)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (supplementError || !supplement) {
      console.error(
        "[Supplement Assignments API] Supplement not found:",
        supplementError
      );

      return NextResponse.json(
        { success: false, error: "Suplemento no encontrado en inventario" },
        { status: 404 }
      );
    }

    // Create the assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from("client_supplement_assignments")
      .insert({
        tenant_host: tenant.host,
        client_id: parseInt(client_id),
        trainer_id: session.trainer_id,
        supplement_id,
        supplement_name: supplement.name,
        supplement_description: supplement.description,
        dosage,
        frequency,
        timing,
        notes: notes || null,
        status: status || "active",
      })
      .select(
        `
                *,
                supplement:supplement_inventory(*)
            `
      )
      .single();

    if (assignmentError) {
      console.error(
        "[Supplement Assignments API] Error creating assignment:",
        assignmentError
      );

      return NextResponse.json(
        { success: false, error: "Error al crear asignación" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    console.error("[Supplement Assignments API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

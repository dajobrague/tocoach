import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// GET - Fetch a specific supplement assignment
export async function GET(
  request: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
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

    const { assignmentId } = params;

    console.log(
      "[Supplement Assignments API] Fetching assignment:",
      assignmentId
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

    // Fetch the assignment with supplement data
    const { data: assignment, error: assignmentError } = await supabase
      .from("client_supplement_assignments")
      .select(
        `
                *,
                supplement:supplement_inventory(*)
            `
      )
      .eq("id", assignmentId)
      .eq("tenant_host", tenant.host)
      .eq("trainer_id", session.trainer_id)
      .single();

    if (assignmentError || !assignment) {
      console.error(
        "[Supplement Assignments API] Error fetching assignment:",
        assignmentError
      );

      return NextResponse.json(
        { success: false, error: "Asignación no encontrada" },
        { status: 404 }
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

// PATCH - Update a supplement assignment
export async function PATCH(
  request: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
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

    const { assignmentId } = params;
    const body = await request.json();
    const { dosage, frequency, timing, notes, status } = body;

    console.log(
      "[Supplement Assignments API] Updating assignment:",
      assignmentId,
      body
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

    // Build update object
    const updateData: any = {};

    if (dosage !== undefined) updateData.dosage = dosage;
    if (frequency !== undefined) updateData.frequency = frequency;
    if (timing !== undefined) updateData.timing = timing;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

    // Update the assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from("client_supplement_assignments")
      .update(updateData)
      .eq("id", assignmentId)
      .eq("tenant_host", tenant.host)
      .eq("trainer_id", session.trainer_id)
      .select(
        `
                *,
                supplement:supplement_inventory(*)
            `
      )
      .single();

    if (assignmentError || !assignment) {
      console.error(
        "[Supplement Assignments API] Error updating assignment:",
        assignmentError
      );

      return NextResponse.json(
        { success: false, error: "Error al actualizar asignación" },
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

// DELETE - Delete a supplement assignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
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

    const { assignmentId } = params;

    console.log(
      "[Supplement Assignments API] Deleting assignment:",
      assignmentId
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

    // Delete the assignment
    const { error: deleteError } = await supabase
      .from("client_supplement_assignments")
      .delete()
      .eq("id", assignmentId)
      .eq("tenant_host", tenant.host)
      .eq("trainer_id", session.trainer_id);

    if (deleteError) {
      console.error(
        "[Supplement Assignments API] Error deleting assignment:",
        deleteError
      );

      return NextResponse.json(
        { success: false, error: "Error al eliminar asignación" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Asignación eliminada correctamente",
    });
  } catch (error) {
    console.error("[Supplement Assignments API] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error inesperado" },
      { status: 500 }
    );
  }
}

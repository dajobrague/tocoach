// Admin trainer detail API
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";

// Helper to verify admin authentication
async function verifyAdminAuth(request: NextRequest) {
  const supabase = createSupabaseClient();
  const sessionCookie = request.cookies.get("admin-session")?.value;

  if (!sessionCookie) {
    return { isAdmin: false, adminId: null };
  }

  try {
    // Verify JWT token
    const { jwtVerify } = await import("jose");
    const JWT_SECRET = new TextEncoder().encode(
      process.env.JWT_SECRET || "fallback-secret-change-in-production"
    );

    const { payload } = await jwtVerify(sessionCookie, JWT_SECRET);
    const userId = (payload as any).trainer_id;

    if (!userId) {
      return { isAdmin: false, adminId: null };
    }

    const { data: adminData, error } = await supabase
      .from("admin_users")
      .select("id, status")
      .eq("id", userId)
      .eq("status", "active")
      .single();

    if (error || !adminData) {
      return { isAdmin: false, adminId: null };
    }

    return { isAdmin: true, adminId: adminData.id };
  } catch (err) {
    return { isAdmin: false, adminId: null };
  }
}

// GET: Get trainer details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trainerId: string }> }
) {
  const { isAdmin } = await verifyAdminAuth(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseClient();
  const { trainerId } = await params;

  try {
    // Get trainer data
    const { data: trainer, error } = await supabase
      .from("trainers")
      .select("*")
      .eq("id", trainerId)
      .single();

    if (error || !trainer) {
      return NextResponse.json(
        { error: "Entrenador no encontrado" },
        { status: 404 }
      );
    }

    // Get client count
    const { count: clientCount } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", trainerId);

    return NextResponse.json(
      {
        trainer: {
          ...trainer,
          clientCount: clientCount || 0,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[AdminTrainerDetail] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PATCH: Update trainer
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ trainerId: string }> }
) {
  const { isAdmin } = await verifyAdminAuth(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseClient();
  const { trainerId } = await params;

  try {
    const body = await request.json();
    const { subscriptionStatus, status, tenantHost } = body;

    const updates: Record<string, unknown> = {};

    if (subscriptionStatus) {
      if (!["active", "paused", "cancelled"].includes(subscriptionStatus)) {
        return NextResponse.json(
          { error: "Estado de suscripción inválido" },
          { status: 400 }
        );
      }
      updates.subscription_status = subscriptionStatus;
    }

    if (status) {
      if (!["active", "inactive"].includes(status)) {
        return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
      }
      updates.status = status;
    }

    if (tenantHost) {
      // Check if new tenant_host is available
      const { data: existingTenant } = await supabase
        .from("trainers")
        .select("id")
        .eq("tenant_host", tenantHost.toLowerCase().trim())
        .neq("id", trainerId)
        .single();

      if (existingTenant) {
        return NextResponse.json(
          { error: "Este subdominio ya está en uso" },
          { status: 400 }
        );
      }

      updates.tenant_host = tenantHost.toLowerCase().trim();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No hay campos para actualizar" },
        { status: 400 }
      );
    }

    // Update trainer
    const { data, error } = await supabase
      .from("trainers")
      .update(updates)
      .eq("id", trainerId)
      .select()
      .single();

    if (error) {
      console.error("[AdminUpdateTrainer] Error:", error);

      return NextResponse.json(
        { error: "Error al actualizar entrenador" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        trainer: data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[AdminUpdateTrainer] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE: Soft delete trainer (set subscription to cancelled)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ trainerId: string }> }
) {
  const { isAdmin } = await verifyAdminAuth(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseClient();
  const { trainerId } = await params;

  try {
    // PERMANENT DELETE - This will cascade delete all related data
    // Migration 048 ensures all child records are CASCADE deleted
    // Migration 053 removes the auth deletion trigger to avoid conflicts
    // Note: auth.users record will remain but trainer and all data will be deleted

    console.log(`[TrainerDelete] Starting deletion of trainer: ${trainerId}`);

    const { error } = await supabase
      .from("trainers")
      .delete()
      .eq("id", trainerId);

    if (error) {
      console.error("[TrainerDelete] Error:", error);

      return NextResponse.json(
        { error: "Error al eliminar entrenador: " + error.message },
        { status: 500 }
      );
    }

    console.log(
      `[TrainerDelete] Successfully deleted trainer and all related data: ${trainerId}`
    );

    return NextResponse.json(
      {
        success: true,
        message:
          "Entrenador y todos sus datos han sido eliminados permanentemente",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[TrainerDelete] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

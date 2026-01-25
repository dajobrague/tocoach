// Admin user detail API
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";

// Helper to verify admin authentication
async function verifyAdminAuth(request: NextRequest) {
  const supabase = createSupabaseClient();
  const sessionCookie = request.cookies.get("admin-session")?.value;

  if (!sessionCookie) {
    return { isAdmin: false, adminId: null, role: null };
  }

  try {
    const { jwtVerify } = await import("jose");
    const JWT_SECRET = new TextEncoder().encode(
      process.env.JWT_SECRET || "fallback-secret-change-in-production"
    );

    const { payload } = await jwtVerify(sessionCookie, JWT_SECRET);
    const userId = (payload as any).trainer_id;

    if (!userId) {
      return { isAdmin: false, adminId: null, role: null };
    }

    const { data: adminData, error } = await supabase
      .from("admin_users")
      .select("id, status, role")
      .eq("id", userId)
      .eq("status", "active")
      .single();

    if (error || !adminData) {
      return { isAdmin: false, adminId: null, role: null };
    }

    return { isAdmin: true, adminId: adminData.id, role: adminData.role };
  } catch (err) {
    return { isAdmin: false, adminId: null, role: null };
  }
}

// PATCH: Update admin user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { isAdmin, role, adminId } = await verifyAdminAuth(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Only super_admin can update admin users
  if (role !== "super_admin") {
    return NextResponse.json(
      {
        error:
          "Solo los super administradores pueden actualizar usuarios admin",
      },
      { status: 403 }
    );
  }

  const supabase = createSupabaseClient();
  const { userId } = await params;

  try {
    const body = await request.json();
    const { status: newStatus, role: newRole } = body;

    const updates: Record<string, unknown> = {};

    if (newStatus) {
      if (!["active", "inactive"].includes(newStatus)) {
        return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
      }
      updates.status = newStatus;
    }

    if (newRole) {
      if (!["super_admin", "admin"].includes(newRole)) {
        return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
      }
      updates.role = newRole;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No hay campos para actualizar" },
        { status: 400 }
      );
    }

    // Prevent admin from deactivating themselves
    if (userId === adminId && newStatus === "inactive") {
      return NextResponse.json(
        { error: "No puedes desactivar tu propia cuenta" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("admin_users")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      console.error("[AdminUserUpdate] Error:", error);

      return NextResponse.json(
        { error: "Error al actualizar usuario admin" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, admin: data }, { status: 200 });
  } catch (error) {
    console.error("[AdminUserUpdate] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE: Permanently delete admin user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { isAdmin, role, adminId } = await verifyAdminAuth(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Only super_admin can delete admin users
  if (role !== "super_admin") {
    return NextResponse.json(
      {
        error: "Solo los super administradores pueden eliminar usuarios admin",
      },
      { status: 403 }
    );
  }

  const supabase = createSupabaseClient();
  const { userId } = await params;

  // Prevent admin from deleting themselves
  if (userId === adminId) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta" },
      { status: 400 }
    );
  }

  try {
    // Delete from admin_users table
    // The database trigger will automatically delete the auth.users record
    const { error: deleteError } = await supabase
      .from("admin_users")
      .delete()
      .eq("id", userId);

    if (deleteError) {
      console.error(
        "[AdminUserDelete] Error deleting admin_users:",
        deleteError
      );

      return NextResponse.json(
        { error: "Error al eliminar usuario admin" },
        { status: 500 }
      );
    }

    console.log(
      `[AdminUserDelete] Successfully deleted admin user and auth record: ${userId}`
    );

    return NextResponse.json(
      { success: true, message: "Usuario admin eliminado permanentemente" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[AdminUserDelete] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

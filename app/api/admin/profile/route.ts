// Admin profile update API
import { NextRequest, NextResponse } from "next/server";

import { JWT_SECRET_BYTES } from "@/lib/auth/jwt-secret";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// Helper to verify admin authentication
async function verifyAdminAuth(request: NextRequest) {
  const supabase = createSupabaseClient();
  const sessionCookie = request.cookies.get("admin-session")?.value;

  if (!sessionCookie) {
    return { isAdmin: false, adminId: null };
  }

  try {
    const { jwtVerify } = await import("jose");

    const { payload } = await jwtVerify(sessionCookie, JWT_SECRET_BYTES);
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

// PATCH: Update own profile
export async function PATCH(request: NextRequest) {
  const { isAdmin, adminId } = await verifyAdminAuth(request);

  if (!isAdmin || !adminId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseClient();

  try {
    const body = await request.json();
    const { fullName, email } = body;

    // Validate required fields
    if (!fullName || !email) {
      return NextResponse.json(
        { error: "Nombre y email son obligatorios" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Formato de correo electrónico no válido" },
        { status: 400 }
      );
    }

    // Check if email is already used by another admin
    const { data: existingAdmin } = await supabase
      .from("admin_users")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .neq("id", adminId)
      .single();

    if (existingAdmin) {
      return NextResponse.json(
        { error: "Este correo electrónico ya está en uso por otro admin" },
        { status: 400 }
      );
    }

    // Update admin_users table
    const { error: updateError } = await supabase
      .from("admin_users")
      .update({
        full_name: fullName.trim(),
        email: email.toLowerCase().trim(),
      })
      .eq("id", adminId);

    if (updateError) {
      console.error("[ProfileUpdate] Error updating admin_users:", updateError);

      return NextResponse.json(
        { error: "Error al actualizar perfil" },
        { status: 500 }
      );
    }

    console.log(`[ProfileUpdate] Profile updated for admin: ${adminId}`);

    return NextResponse.json(
      {
        success: true,
        message: "Perfil actualizado exitosamente",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[ProfileUpdate] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

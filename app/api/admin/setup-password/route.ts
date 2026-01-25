// Admin password setup API - marks password as changed after first login
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email es obligatorio" },
        { status: 400 }
      );
    }

    // Get admin user by email
    const { data: adminUser, error: fetchError } = await supabase
      .from("admin_users")
      .select("id, status")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (fetchError || !adminUser) {
      console.error("[AdminSetupPassword] Admin not found:", fetchError);

      return NextResponse.json(
        { error: "Usuario admin no encontrado" },
        { status: 404 }
      );
    }

    // Check if admin is active
    if (adminUser.status !== "active") {
      return NextResponse.json(
        { error: "Usuario admin no activo" },
        { status: 403 }
      );
    }

    // Mark password as changed
    const { error: updateError } = await supabase
      .from("admin_users")
      .update({
        password_changed_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      })
      .eq("id", adminUser.id);

    if (updateError) {
      console.error("[AdminSetupPassword] Update error:", updateError);

      return NextResponse.json(
        { error: "Error al actualizar estado de contraseña" },
        { status: 500 }
      );
    }

    console.log(
      `[AdminSetupPassword] Password marked as changed for: ${email}`
    );

    return NextResponse.json(
      { success: true, message: "Contraseña configurada exitosamente" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[AdminSetupPassword] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

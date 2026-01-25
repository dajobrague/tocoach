// Admin login API
import { NextRequest, NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: "El correo electrónico y la contraseña son obligatorios" },
        { status: 400 }
      );
    }

    // Authenticate with Supabase
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

    if (authError || !authData.user) {
      console.warn("[AdminLogin] Authentication failed:", authError?.message);

      return NextResponse.json(
        { error: "Correo electrónico o contraseña incorrectos" },
        { status: 401 }
      );
    }

    // Get admin data
    const { data: adminData, error: adminError } = await supabase
      .from("admin_users")
      .select("id, email, full_name, role, status, password_changed_at")
      .eq("id", authData.user.id)
      .single();

    if (adminError || !adminData) {
      console.error("[AdminLogin] Admin not found:", adminError);

      return NextResponse.json(
        { error: "Cuenta de administrador no encontrada" },
        { status: 404 }
      );
    }

    // Check if admin account is active
    if (adminData.status !== "active") {
      return NextResponse.json(
        {
          error: "La cuenta está inactiva. Por favor, contacta con soporte.",
        },
        { status: 403 }
      );
    }

    // Check if password needs to be changed (first login)
    if (!adminData.password_changed_at) {
      console.log(
        "[AdminLogin] First-time login detected for:",
        adminData.email
      );

      return NextResponse.json(
        {
          needsPasswordSetup: true,
          email: adminData.email,
          userId: adminData.id,
        },
        { status: 200 }
      );
    }

    // Update last login timestamp (non-blocking, fire and forget)
    void supabase
      .from("admin_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", authData.user.id);

    // Create session and set cookie
    const response = NextResponse.json(
      {
        success: true,
        admin: {
          id: adminData.id,
          email: adminData.email,
          fullName: adminData.full_name,
          role: adminData.role,
        },
      },
      { status: 200 }
    );

    // Set session cookie for admin (no tenant_host for admins)
    await setSessionCookie(
      response,
      adminData.id,
      "", // Empty for admin - they're not on a tenant subdomain
      adminData.email,
      adminData.full_name || undefined
    );

    console.log(
      `[AdminLogin] Successfully authenticated admin: ${adminData.email}`
    );

    return response;
  } catch (error) {
    console.error("[AdminLogin] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

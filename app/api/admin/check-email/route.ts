// Admin email check API - checks if admin exists and if it's first login
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

    // Check if admin exists
    const { data: adminData, error: adminError } = await supabase
      .from("admin_users")
      .select("id, email, status, password_changed_at")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (adminError || !adminData) {
      return NextResponse.json(
        { error: "No se encontró una cuenta de administrador con este email" },
        { status: 404 }
      );
    }

    // Check if admin is active
    if (adminData.status !== "active") {
      return NextResponse.json(
        { error: "La cuenta está inactiva. Por favor, contacta con soporte." },
        { status: 403 }
      );
    }

    // Check if it's first login
    const isFirstLogin = !adminData.password_changed_at;

    return NextResponse.json(
      {
        exists: true,
        isFirstLogin,
        email: adminData.email,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[AdminCheckEmail] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

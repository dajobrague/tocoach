import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email es requerido" },
        { status: 400 }
      );
    }

    // Check if trainer exists
    const { data: trainer, error } = await supabase
      .from("trainers")
      .select("id, email, full_name, password_set_at, status")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (error || !trainer) {
      return NextResponse.json(
        { error: "Correo electrónico no encontrado" },
        { status: 404 }
      );
    }

    // Check if trainer is active
    if (trainer.status !== "active") {
      return NextResponse.json(
        { error: "Cuenta inactiva. Contacta con soporte." },
        { status: 403 }
      );
    }

    // Check if this is first login (password_set_at is null)
    const isFirstLogin = !trainer.password_set_at;

    return NextResponse.json(
      {
        exists: true,
        isFirstLogin,
        fullName: trainer.full_name,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[TrainerCheckEmail] Error:", error);

    return NextResponse.json(
      { error: "Error al verificar email" },
      { status: 500 }
    );
  }
}

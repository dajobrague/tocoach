import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const { email, newPassword } = await request.json();

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: "Email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    // Get trainer
    const { data: trainer, error: trainerError } = await supabase
      .from("trainers")
      .select("id, email")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (trainerError || !trainer) {
      return NextResponse.json(
        { error: "Entrenador no encontrado" },
        { status: 404 }
      );
    }

    // Update password_set_at and last_login_at
    const { error: updateError } = await supabase
      .from("trainers")
      .update({
        password_set_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      })
      .eq("id", trainer.id);

    if (updateError) {
      console.error("[TrainerSetupPassword] Update error:", updateError);

      return NextResponse.json(
        { error: "Error al actualizar entrenador" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Contraseña configurada exitosamente",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[TrainerSetupPassword] Error:", error);

    return NextResponse.json(
      { error: "Error al configurar contraseña" },
      { status: 500 }
    );
  }
}

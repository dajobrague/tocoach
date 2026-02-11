// Trainer change password API
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "La contraseña actual y la nueva son obligatorias" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "La nueva contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: session.email,
      password: currentPassword,
    });

    if (signInError) {
      console.warn(
        "[Change Password] Current password verification failed:",
        signInError.message
      );

      return NextResponse.json(
        { error: "La contraseña actual es incorrecta" },
        { status: 400 }
      );
    }

    // Update password via Supabase Auth
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error("[Change Password] Update error:", updateError);

      return NextResponse.json(
        { error: "Error al cambiar la contraseña" },
        { status: 500 }
      );
    }

    console.log(
      `[Change Password] Password updated for trainer ${session.trainer_id}`
    );

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada correctamente",
    });
  } catch (error) {
    console.error("[Change Password] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

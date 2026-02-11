import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

// Password validation
function validatePassword(password: string): {
  valid: boolean;
  error?: string;
} {
  if (password.length < 8) {
    return {
      valid: false,
      error: "La contraseña debe tener al menos 8 caracteres",
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: "La contraseña debe contener al menos una letra mayúscula",
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      error: "La contraseña debe contener al menos un número",
    };
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const session = await getClientSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { currentPassword, newPassword, confirmNewPassword } =
      await request.json();

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return NextResponse.json(
        { success: false, error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    if (newPassword !== confirmNewPassword) {
      return NextResponse.json(
        { success: false, error: "Las contraseñas nuevas no coinciden" },
        { status: 400 }
      );
    }

    // Validate new password requirements
    const validation = validatePassword(newPassword);

    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Get current client password from DB
    const { data: client, error: fetchError } = await supabase
      .from("clients")
      .select("id, password")
      .eq("id", session.client_id)
      .single();

    if (fetchError || !client) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    // Verify current password
    if (client.password !== currentPassword) {
      return NextResponse.json(
        { success: false, error: "La contraseña actual es incorrecta" },
        { status: 401 }
      );
    }

    // Prevent setting the same password
    if (currentPassword === newPassword) {
      return NextResponse.json(
        {
          success: false,
          error: "La nueva contraseña debe ser diferente a la actual",
        },
        { status: 400 }
      );
    }

    // Update password in database
    const { error: updateError } = await supabase
      .from("clients")
      .update({ password: newPassword })
      .eq("id", session.client_id);

    if (updateError) {
      console.error("[Change Password] Update error:", updateError);

      return NextResponse.json(
        { success: false, error: "Error al actualizar la contraseña" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada correctamente",
    });
  } catch (error) {
    console.error("[Change Password] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

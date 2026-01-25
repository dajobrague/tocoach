// Trainer password setup API (first-time login)
// This endpoint marks the password as set after the frontend updates it via Supabase
import { NextRequest, NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const body = await request.json();
    const { email } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { error: "El correo electrónico es obligatorio" },
        { status: 400 }
      );
    }

    // Find trainer by email
    const { data: trainerData, error: trainerError } = await supabase
      .from("trainers")
      .select(
        "id, email, full_name, password_set_at, subscription_status, status"
      )
      .eq("email", email.toLowerCase().trim())
      .single();

    if (trainerError || !trainerData) {
      console.error("[SetupPassword] Trainer not found:", trainerError);

      return NextResponse.json(
        { error: "Cuenta de entrenador no encontrada" },
        { status: 404 }
      );
    }

    // Get tenant info for this trainer
    const { data: tenant } = await supabase
      .from("tenants")
      .select("host, slug")
      .eq("trainer_id", trainerData.id)
      .single();

    const tenantHost = tenant?.host || "";

    // Check if password was already set
    if (trainerData.password_set_at) {
      return NextResponse.json(
        {
          error:
            "La contraseña ya fue configurada. Usa el inicio de sesión normal.",
        },
        { status: 400 }
      );
    }

    // Check subscription status
    if (trainerData.subscription_status === "cancelled") {
      return NextResponse.json(
        { error: "Tu suscripción ha sido cancelada. Contacta con soporte." },
        { status: 403 }
      );
    }

    if (trainerData.subscription_status === "paused") {
      return NextResponse.json(
        { error: "Tu suscripción está pausada. Contacta con soporte." },
        { status: 403 }
      );
    }

    // Mark password as set in trainers table
    const { error: updateError } = await supabase
      .from("trainers")
      .update({
        password_set_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      })
      .eq("id", trainerData.id);

    if (updateError) {
      console.error("[SetupPassword] Trainer update error:", updateError);

      return NextResponse.json(
        { error: "Error al marcar la contraseña como configurada" },
        { status: 500 }
      );
    }

    // Create session and set cookie
    const response = NextResponse.json(
      {
        success: true,
        trainer: {
          id: trainerData.id,
          email: trainerData.email,
          fullName: trainerData.full_name,
          tenantHost: tenantHost,
        },
        message: "Contraseña configurada exitosamente",
      },
      { status: 200 }
    );

    await setSessionCookie(
      response,
      trainerData.id,
      tenantHost,
      trainerData.email,
      trainerData.full_name || undefined
    );

    console.log(
      `[SetupPassword] Successfully marked password as set for trainer: ${trainerData.email}`
    );

    return response;
  } catch (error) {
    console.error("[SetupPassword] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

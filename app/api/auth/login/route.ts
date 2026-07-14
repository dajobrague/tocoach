// Trainer login API
import { NextRequest, NextResponse } from "next/server";

import { setSessionCookie, updateTrainerLastLogin } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/clients/supabase-admin";
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
      console.warn("[Login] Authentication failed:", authError?.message);

      return NextResponse.json(
        { error: "Correo electrónico o contraseña incorrectos" },
        { status: 401 }
      );
    }

    // Get trainer data
    const { data: trainerData, error: trainerError } = await supabase
      .from("trainers")
      .select(
        "id, email, full_name, status, subscription_status, password_set_at"
      )
      .eq("id", authData.user.id)
      .single();

    if (trainerError || !trainerData) {
      console.error("[Login] Trainer not found:", trainerError);

      return NextResponse.json(
        { error: "Cuenta de entrenador no encontrada" },
        { status: 404 }
      );
    }

    // Get tenant info for this trainer. Use the service-role client: the
    // post-sign-in anon client can return empty here under local RLS, which
    // would leave tenant_host = "".
    const { data: tenant } = await createSupabaseAdminClient()
      .from("tenants")
      .select("host, slug")
      .eq("trainer_id", authData.user.id)
      .single();

    const tenantHost = tenant?.host || "";

    // Check if password needs to be set up (first-time login)
    if (!trainerData.password_set_at) {
      console.log(
        "[Login] Trainer needs to setup password:",
        trainerData.email
      );

      return NextResponse.json(
        {
          needsPasswordSetup: true,
          email: trainerData.email,
          message: "Debes configurar tu contraseña antes de continuar",
        },
        { status: 200 }
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

    // Check if trainer account is active
    if (trainerData.status !== "active") {
      return NextResponse.json(
        { error: "La cuenta está inactiva. Por favor, contacta con soporte." },
        { status: 403 }
      );
    }

    // Update last login timestamp (non-blocking)
    updateTrainerLastLogin(authData.user.id).catch(console.warn);

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
      },
      { status: 200 }
    );

    // Trainers log in on main domain (localhost/topcoach.app), not their client subdomain
    // Pass tenantHost so it's stored in the session
    await setSessionCookie(
      response,
      trainerData.id,
      tenantHost, // Store tenant host in session
      trainerData.email,
      trainerData.full_name || undefined
    );

    console.log(
      `[Login] Successfully authenticated trainer: ${trainerData.email}`
    );

    return response;
  } catch (error) {
    console.error("[Login] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// Trainer registration API
// NOTE: Public registration is currently disabled. Trainers are created by admin only.
// This endpoint is kept for potential future use or migration purposes.
// To enable public registration, remove the feature flag check below.

import { NextRequest, NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";
import { healThemeJson } from "@/lib/theme/heal";

export async function POST(request: NextRequest) {
  // Feature flag: disable public registration
  const ENABLE_PUBLIC_REGISTRATION = false;

  if (!ENABLE_PUBLIC_REGISTRATION) {
    return NextResponse.json(
      {
        error:
          "El registro público está deshabilitado. Contacta con el administrador para obtener una cuenta.",
      },
      { status: 403 }
    );
  }
  const supabase = createSupabaseClient();

  try {
    const body = await request.json();
    const { email, password, fullName } = body;

    // Validate required fields
    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: "Todos los campos son obligatorios" },
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

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    // Generate a temporary tenant slug based on email
    // This will be updated later during the setup process
    const emailPrefix = email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const timestamp = Date.now().toString().slice(-4);
    const tempTenantSlug = `${emailPrefix}${timestamp}`;

    // Create Supabase user using signUp
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (authError || !authUser.user) {
      console.error("[Registration] Auth error:", authError);

      // Provide more specific error messages
      let errorMessage = "Error al crear la cuenta.";

      if (authError?.message?.includes("already registered")) {
        errorMessage = "Este correo electrónico ya está registrado.";
      } else if (authError?.message?.includes("invalid")) {
        errorMessage =
          "Dirección de correo electrónico no válida. Por favor, usa un correo real.";
      } else if (authError?.message?.includes("password")) {
        errorMessage = "La contraseña no cumple con los requisitos mínimos.";
      }

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Create trainer record with temporary tenant host
    const { error: trainerError } = await supabase.from("trainers").insert({
      id: authUser.user.id,
      tenant_host: tempTenantSlug,
      email: email.toLowerCase().trim(),
      full_name: fullName.trim(),
    });

    if (trainerError) {
      console.error("[Registration] Trainer creation error:", trainerError);

      // Note: Cannot delete user with anon key, but trainer creation failed
      console.error(
        "[Registration] Trainer creation failed, user may exist without trainer record"
      );

      return NextResponse.json(
        { error: "Error al crear el perfil de entrenador" },
        { status: 500 }
      );
    }

    // Create temporary tenant record (will be updated during setup)
    const { error: tenantError } = await supabase.from("tenants").upsert(
      {
        slug: tempTenantSlug,
        host: tempTenantSlug, // Keep host in sync with slug for now
        theme_slug: "default", // Default theme, can be customized later
        status: "inactive", // Inactive until setup is completed
        trainer_id: authUser.user.id,
        // healThemeJson garantiza una forma que pasa validateTheme. La
        // semilla anterior (fonts como strings, shadow {sm,md}, sin
        // accent/text/border/fill) era inválida: el generador de CSS la
        // descartaba y servía el tema default para siempre, incluso
        // después de que el trainer guardara sus colores.
        theme_json: healThemeJson({
          meta: {
            name: fullName.trim(),
            description: `${fullName.trim()}'s Coaching Platform`,
          },
          colors: {
            brand: "#0070f3",
            surface: {
              "1": "#ffffff",
              "2": "#f8fafc",
            },
          },
          fonts: {
            heading: "Poppins",
            body: "Poppins",
          },
          shadow: {
            sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
            md: "0 2px 4px -1px rgb(0 0 0 / 0.1)",
          },
        }),
      },
      {
        onConflict: "host",
      }
    );

    if (tenantError) {
      console.error("[Registration] Tenant creation error:", tenantError);
      // Don't fail registration if tenant creation fails - can be fixed later
    }

    // Create session and set cookie
    const response = NextResponse.json(
      {
        success: true,
        trainer: {
          id: authUser.user.id,
          email: email.toLowerCase().trim(),
          fullName: fullName.trim(),
          tenantHost: tempTenantSlug,
        },
      },
      { status: 201 }
    );

    await setSessionCookie(
      response,
      authUser.user.id,
      tempTenantSlug,
      email.toLowerCase().trim(),
      fullName.trim()
    );

    console.log(
      `[Registration] Successfully created trainer: ${email} with temporary tenant slug: ${tempTenantSlug}`
    );

    return response;
  } catch (error) {
    console.error("[Registration] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

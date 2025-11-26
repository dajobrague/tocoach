// Trainer registration API
import { NextRequest, NextResponse } from "next/server";

import {
  markInvitationCodeUsed,
  validateInvitationCode,
} from "@/lib/auth/invitation";
import { setSessionCookie } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const body = await request.json();
    const { invitationCode, email, password, fullName } = body;

    // Validate required fields
    if (!invitationCode || !email || !password || !fullName) {
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

    // Generate a temporary tenant host based on email
    // This will be updated later during the setup process
    const emailPrefix = email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const timestamp = Date.now().toString().slice(-4);
    const tempTenantHost = `${emailPrefix}${timestamp}.localhost`;

    // Validate invitation code
    let invitation;

    try {
      invitation = await validateInvitationCode(invitationCode);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Invalid invitation code",
        },
        { status: 400 }
      );
    }

    // Create Supabase user using signUp
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      // Skip email verification for MVP
    });

    if (authError || !authUser.user) {
      console.error("[Registration] Auth error:", authError);

      return NextResponse.json(
        {
          error:
            "Error al crear la cuenta. Es posible que el correo electrónico ya esté en uso.",
        },
        { status: 400 }
      );
    }

    // Create trainer record with temporary tenant host
    const { error: trainerError } = await supabase.from("trainers").insert({
      id: authUser.user.id,
      tenant_host: tempTenantHost,
      email: email.toLowerCase().trim(),
      full_name: fullName.trim(),
      invitation_code_used: invitationCode.toUpperCase().trim(),
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
        host: tempTenantHost,
        slug: tempTenantHost.split(".")[0], // Extract subdomain part
        theme_slug: "default", // Default theme, can be customized later
        status: "inactive", // Inactive until setup is completed
        trainer_id: authUser.user.id,
        theme_json: {
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
        },
      },
      {
        onConflict: "host",
      }
    );

    if (tenantError) {
      console.error("[Registration] Tenant creation error:", tenantError);
      // Don't fail registration if tenant creation fails - can be fixed later
    }

    // Mark invitation code as used
    try {
      await markInvitationCodeUsed(invitationCode, authUser.user.id);
    } catch (error) {
      console.warn("[Registration] Failed to mark invitation as used:", error);
      // Don't fail registration for this
    }

    // Create session and set cookie
    const response = NextResponse.json(
      {
        success: true,
        trainer: {
          id: authUser.user.id,
          email: email.toLowerCase().trim(),
          fullName: fullName.trim(),
          tenantHost: tempTenantHost,
        },
      },
      { status: 201 }
    );

    await setSessionCookie(
      response,
      authUser.user.id,
      tempTenantHost,
      email.toLowerCase().trim(),
      fullName.trim()
    );

    console.log(
      `[Registration] Successfully created trainer: ${email} with temporary tenant: ${tempTenantHost}`
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

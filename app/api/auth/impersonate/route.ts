import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SignJWT } from "jose";

import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "Token no proporcionado" },
        { status: 400 }
      );
    }

    // Verify impersonation token
    const { jwtVerify } = await import("jose");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

    let payload;

    try {
      const result = await jwtVerify(token, secret);

      payload = result.payload;
    } catch (error) {
      console.error("[Impersonate] Invalid or expired token:", error);

      return NextResponse.json(
        { error: "Token inválido o expirado (5 min máx)" },
        { status: 401 }
      );
    }

    // Verify it's an impersonation token
    if (payload.type !== "impersonation") {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const trainerId = payload.trainerId as string;
    const tenantHost = payload.tenantHost as string;
    const tenantSlug = payload.tenantSlug as string;
    const adminId = payload.adminId as string;
    const adminEmail = payload.adminEmail as string;

    const supabase = createSupabaseClient();

    // Verify trainer still exists and is active
    const { data: trainer, error: trainerError } = await supabase
      .from("trainers")
      .select("id, email, full_name, status")
      .eq("id", trainerId)
      .single();

    if (trainerError || !trainer) {
      return NextResponse.json(
        { error: "Entrenador no encontrado" },
        { status: 404 }
      );
    }

    // Generate trainer session token (using same structure as regular sessions)
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 8 * 60 * 60; // 8 hours

    const sessionToken = await new SignJWT({
      trainer_id: trainer.id, // Must match TrainerSession interface
      tenant_host: tenantHost, // Use tenant from token
      email: trainer.email,
      full_name: trainer.full_name || "",
      impersonatedBy: adminId, // Flag that this is an impersonation session
      iat: now,
      exp: exp,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(secret);

    // Set session cookie for trainer (using trainer-session cookie name)
    const cookieStore = await cookies();

    cookieStore.set("trainer-session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
      path: "/", // Root path so it works for trainer portal
    });

    // Log successful impersonation
    console.log(
      `[Impersonate] Admin ${adminEmail} (${adminId}) successfully logged in as trainer ${trainer.email} (${trainer.id})`
    );

    // Update last_login_at for audit trail
    await supabase
      .from("trainers")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", trainerId);

    return NextResponse.json(
      {
        success: true,
        trainer: {
          name: trainer.full_name,
          email: trainer.email,
          subdomain: tenantHost,
          slug: tenantSlug,
        },
        impersonationNote:
          "Esta es una sesión de soporte. Cualquier acción será registrada.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Impersonate] Error:", error);

    return NextResponse.json(
      { error: "Error al acceder a la cuenta" },
      { status: 500 }
    );
  }
}

// Check if client email exists and whether password is set
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const { email, tenantHost } = await request.json();

    if (!email || !tenantHost) {
      return NextResponse.json(
        { error: "El correo y el identificador del entrenador son requeridos" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Resolve tenant slug → trainer_id so we can scope the client lookup
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("trainer_id")
      .eq("slug", tenantHost)
      .eq("status", "active")
      .single();

    if (tenantError || !tenant?.trainer_id) {
      console.warn("[Check Client Email] Tenant not found or inactive:", {
        slug: tenantHost,
        error: tenantError?.message,
      });

      return NextResponse.json(
        {
          exists: false,
          message:
            "No se encontró el sitio del entrenador. Verifica el enlace e intenta de nuevo.",
        },
        { status: 404 }
      );
    }

    // Look up client scoped to this tenant (trainer)
    const { data: clients, error } = await supabase
      .from("clients")
      .select("id, email, name, last_name, password, status, tenant")
      .eq("email", normalizedEmail)
      .eq("tenant", tenant.trainer_id);

    if (error) {
      console.error("[Check Client Email] DB query error:", {
        email: normalizedEmail,
        tenantSlug: tenantHost,
        trainerId: tenant.trainer_id,
        error: error.message,
      });

      return NextResponse.json(
        {
          exists: false,
          message: "Error al verificar el correo. Intenta de nuevo.",
        },
        { status: 500 }
      );
    }

    if (!clients || clients.length === 0) {
      console.warn("[Check Client Email] No client found:", {
        email: normalizedEmail,
        tenantSlug: tenantHost,
        trainerId: tenant.trainer_id,
      });

      return NextResponse.json(
        {
          exists: false,
          message:
            "No se encontró una cuenta con ese correo. Contacta a tu entrenador.",
        },
        { status: 404 }
      );
    }

    if (clients.length > 1) {
      console.warn("[Check Client Email] Multiple clients with same email:", {
        email: normalizedEmail,
        tenantSlug: tenantHost,
        count: clients.length,
      });
    }

    const client = clients[0]!;

    // Check if client is active
    if (
      client.status !== "Activo" &&
      client.status !== "Onboarding Completado"
    ) {
      console.warn("[Check Client Email] Inactive client attempted login:", {
        email: normalizedEmail,
        status: client.status,
        tenantSlug: tenantHost,
      });

      return NextResponse.json(
        {
          exists: false,
          message:
            "Tu cuenta está inactiva. Contacta a tu entrenador para más información.",
        },
        { status: 403 }
      );
    }

    const hasPassword = !!client.password && client.password.trim() !== "";

    return NextResponse.json({
      exists: true,
      hasPassword: hasPassword,
      clientId: client.id,
      fullName: `${client.name} ${client.last_name || ""}`.trim(),
    });
  } catch (error) {
    console.error("[Check Client Email] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor. Intenta de nuevo." },
      { status: 500 }
    );
  }
}

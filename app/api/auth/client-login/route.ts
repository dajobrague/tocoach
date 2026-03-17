// Client login API (plain text password authentication)
import { NextRequest, NextResponse } from "next/server";

import {
  setClientSessionCookie,
  updateClientLastLogin,
} from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient();

  try {
    const body = await request.json();
    const { clientId, password, tenantSlug } = body;

    if (!clientId || !password || !tenantSlug) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    // Resolve tenant slug → trainer_id for validation
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("trainer_id")
      .eq("slug", tenantSlug)
      .eq("status", "active")
      .single();

    if (tenantError || !tenant?.trainer_id) {
      console.warn("[Client Login] Tenant not found:", {
        slug: tenantSlug,
        error: tenantError?.message,
      });

      return NextResponse.json(
        { error: "Sitio del entrenador no encontrado." },
        { status: 404 }
      );
    }

    // Get client and verify they belong to this tenant
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, email, name, last_name, password, status, tenant")
      .eq("id", clientId)
      .eq("tenant", tenant.trainer_id)
      .single();

    if (clientError || !client) {
      console.warn("[Client Login] Client not found or wrong tenant:", {
        clientId,
        tenantSlug,
        error: clientError?.message,
      });

      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    if (!client.password || client.password.trim() === "") {
      return NextResponse.json(
        {
          error: "Contraseña no configurada. Configura tu contraseña primero.",
        },
        { status: 400 }
      );
    }

    if (client.password !== password) {
      console.warn("[Client Login] Invalid password for:", client.email);

      return NextResponse.json(
        { error: "Contraseña incorrecta" },
        { status: 401 }
      );
    }

    if (
      client.status !== "Activo" &&
      client.status !== "Onboarding Completado"
    ) {
      return NextResponse.json(
        {
          error:
            "Tu cuenta está inactiva. Contacta a tu entrenador para más información.",
        },
        { status: 403 }
      );
    }

    updateClientLastLogin(client.id).catch(console.warn);

    const fullName = `${client.name} ${client.last_name || ""}`.trim();
    const response = NextResponse.json(
      {
        success: true,
        client: {
          id: client.id,
          email: client.email,
          fullName: fullName,
          tenantSlug: tenantSlug,
        },
      },
      { status: 200 }
    );

    await setClientSessionCookie(
      response,
      String(client.id),
      tenantSlug,
      client.email,
      fullName
    );

    console.log(
      `[Client Login] Authenticated: ${client.email} for tenant: ${tenantSlug}`
    );

    return response;
  } catch (error) {
    console.error("[Client Login] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor. Intenta de nuevo." },
      { status: 500 }
    );
  }
}

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

    // NOTE: we construct the response in two passes so we can echo the
    // signed JWT back to the frontend in the JSON body. The browser will
    // persist this in localStorage and attach it as `Authorization: Bearer`
    // on write requests — a fallback transport for cases where the cookie
    // gets dropped (Safari ITP, third-party cookie restrictions, in-app
    // browsers, iframe embedding). See `lib/auth/client-token-storage.ts`
    // and `getClientSession` in `lib/auth/client-session.ts` for the full
    // rationale. Same JWT, same secret, same payload — just a second
    // delivery channel.
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

    const token = await setClientSessionCookie(
      response,
      String(client.id),
      tenantSlug,
      client.email,
      fullName
    );

    // Re-serialize with the token included. We recreate the response to
    // avoid mutating `response.json()` (not possible in Next) — the cookie
    // was attached to the headers above, so we re-apply it to the new
    // response before returning.
    const finalResponse = NextResponse.json(
      {
        success: true,
        client: {
          id: client.id,
          email: client.email,
          fullName: fullName,
          tenantSlug: tenantSlug,
        },
        token,
      },
      { status: 200 }
    );

    response.cookies.getAll().forEach((cookie) => {
      finalResponse.cookies.set(cookie);
    });

    console.log(
      `[Client Login] Authenticated: ${client.email} for tenant: ${tenantSlug}`
    );

    console.log(
      `[Client Login:LOOP] client_login_success`,
      JSON.stringify({
        event: "client_login_success",
        clientId: String(client.id),
        tenantSlug,
        timestamp: Date.now(),
      })
    );

    return finalResponse;
  } catch (error) {
    console.error("[Client Login] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor. Intenta de nuevo." },
      { status: 500 }
    );
  }
}

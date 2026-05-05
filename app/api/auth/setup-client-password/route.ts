// Set up password for client (first time)
import { NextRequest, NextResponse } from "next/server";

import {
  setClientSessionCookie,
  updateClientLastLogin,
} from "@/lib/auth/client-session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

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
    const { clientId, password, confirmPassword, tenantSlug } =
      await request.json();

    if (!clientId || !password || !confirmPassword || !tenantSlug) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Las contraseñas no coinciden" },
        { status: 400 }
      );
    }

    const validation = validatePassword(password);

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Resolve tenant slug → trainer_id for validation
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("trainer_id")
      .eq("slug", tenantSlug)
      .eq("status", "active")
      .single();

    if (tenantError || !tenant?.trainer_id) {
      console.warn("[Setup Password] Tenant not found:", {
        slug: tenantSlug,
        error: tenantError?.message,
      });

      return NextResponse.json(
        { error: "Sitio del entrenador no encontrado." },
        { status: 404 }
      );
    }

    // Get client scoped to this tenant
    const { data: client, error: fetchError } = await supabase
      .from("clients")
      .select("id, email, name, last_name, password, status, tenant")
      .eq("id", clientId)
      .eq("tenant", tenant.trainer_id)
      .single();

    if (fetchError || !client) {
      console.warn("[Setup Password] Client not found or wrong tenant:", {
        clientId,
        tenantSlug,
        error: fetchError?.message,
      });

      return NextResponse.json(
        { error: "Cliente no encontrado." },
        { status: 404 }
      );
    }

    if (client.password && client.password.trim() !== "") {
      return NextResponse.json(
        { error: "La contraseña ya fue configurada para esta cuenta." },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("clients")
      .update({ password: password })
      .eq("id", clientId)
      .eq("tenant", tenant.trainer_id);

    if (updateError) {
      console.error("[Setup Password] Database update error:", updateError);

      return NextResponse.json(
        { error: "Error al guardar la contraseña. Intenta de nuevo." },
        { status: 500 }
      );
    }

    updateClientLastLogin(clientId).catch(console.warn);

    const fullName = `${client.name} ${client.last_name || ""}`.trim();

    // See the note in `app/api/auth/client-login/route.ts` explaining why
    // we echo the JWT back in the body — this is the localStorage fallback
    // for environments where the httpOnly cookie gets blocked/dropped.
    const response = NextResponse.json(
      {
        success: true,
        message: "Contraseña configurada correctamente",
        client: {
          id: client.id,
          email: client.email,
          fullName,
          tenantSlug: tenantSlug,
        },
      },
      { status: 200 }
    );

    const token = await setClientSessionCookie(
      response,
      client.id,
      tenantSlug,
      client.email,
      fullName
    );

    const finalResponse = NextResponse.json(
      {
        success: true,
        message: "Contraseña configurada correctamente",
        client: {
          id: client.id,
          email: client.email,
          fullName,
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
      `[Setup Password] Password set for client: ${client.email} in tenant: ${tenantSlug}`
    );

    console.log(
      `[Client Login:LOOP] client_login_success`,
      JSON.stringify({
        event: "client_login_success",
        clientId: String(client.id),
        tenantSlug,
        timestamp: Date.now(),
        flow: "setup-password",
      })
    );

    return finalResponse;
  } catch (error) {
    console.error("[Setup Password] Unexpected error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor. Intenta de nuevo." },
      { status: 500 }
    );
  }
}

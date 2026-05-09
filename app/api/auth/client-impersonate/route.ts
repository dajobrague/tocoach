/* eslint-disable no-console */
import type { ClientSession } from "@/lib/auth/client-session";

import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";

import { JWT_SECRET_BYTES as JWT_SECRET } from "@/lib/auth/jwt-secret";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

const isProduction = process.env.NODE_ENV === "production";

// Same shape as `lib/auth/client-session.ts` COOKIE_OPTIONS, but with a
// shorter TTL (8h) — admin impersonation must not mint a 30-day session.
//
// SameSite MUST match the regular login cookie ("lax"). The previous
// "none" attribute caused the impersonation cookie to be attached to
// every cross-site request to app.topcoach.io for 8 hours after a
// support session, polluting other tenant URLs with the impersonated
// tenant's session. The middleware then logged a `Tenant mismatch:
// <impersonated-tenant> vs <visited-tenant>` warning on every protected
// route the admin (or anyone sharing that browser) hit afterwards.
// Impersonation flows are initiated from the admin panel on the same
// origin, so Lax is sufficient.
const IMPERSONATION_MAX_AGE = 8 * 60 * 60; // 8 hours in seconds
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: IMPERSONATION_MAX_AGE,
};

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "Token no proporcionado" },
        { status: 400 }
      );
    }

    let payload: Record<string, unknown>;

    try {
      const result = await jwtVerify(token, JWT_SECRET);

      payload = result.payload as Record<string, unknown>;
    } catch (error) {
      console.error(
        "[ClientImpersonate] Invalid or expired token:",
        error instanceof Error ? error.message : error
      );

      return NextResponse.json(
        { error: "Token inválido o expirado (5 min máx)" },
        { status: 401 }
      );
    }

    if (payload.type !== "client_impersonation") {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const clientId = payload.clientId as string;
    const tenantSlug = payload.tenantSlug as string;
    const adminId = payload.adminId as string;
    const adminEmail = payload.adminEmail as string;

    const supabase = createSupabaseClient();

    // Defense-in-depth: re-verify the client belongs to the tenant the
    // token was issued for. The admin mint endpoint
    // (/api/admin/trainers/[trainerId]/clients/[clientId]/impersonate)
    // already enforces ownership when minting the token, but enforcing
    // it again at consume time means a bug in mint, a malformed token,
    // or a future caller that signs `client_impersonation` tokens with
    // mismatched clientId / tenantSlug fields cannot promote a client
    // of trainer A into a session for trainer B.
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("trainer_id")
      .eq("slug", tenantSlug)
      .eq("status", "active")
      .single();

    if (tenantError || !tenant?.trainer_id) {
      return NextResponse.json(
        { error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    // Confirm the client exists AND belongs to this tenant. We deliberately
    // do NOT re-check status/password — impersonation must work for broken
    // accounts, which is the whole point of admin support access.
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, email, name, last_name, status")
      .eq("id", clientId)
      .eq("tenant", tenant.trainer_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    const fullName = `${client.name ?? ""} ${client.last_name ?? ""}`.trim();

    const now = Math.floor(Date.now() / 1000);
    const exp = now + IMPERSONATION_MAX_AGE;

    const sessionPayload: ClientSession = {
      client_id: String(client.id),
      tenant_slug: tenantSlug,
      email: client.email,
      full_name: fullName,
      impersonatedBy: adminId,
      iat: now,
      exp,
    };

    const sessionToken = await new SignJWT(sessionPayload as any)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(JWT_SECRET);

    // Update last_login_at for audit trail (best-effort, non-blocking).
    supabase
      .from("clients")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", client.id)
      .then(({ error }) => {
        if (error) {
          console.warn(
            "[ClientImpersonate] Failed to update last_login_at:",
            error.message
          );
        }
      });

    console.log(
      `[ClientImpersonate] Admin ${adminEmail} (${adminId}) successfully logged in as client ${client.email} (id=${client.id}) under tenant ${tenantSlug}`
    );

    // Return the JWT in the body so the SPA can persist it in localStorage
    // for the Bearer fallback transport. Without this, the session silently
    // fails in iframe / Safari ITP / in-app-browser environments. See
    // `lib/auth/client-token-storage.ts` for the rationale.
    const response = NextResponse.json(
      {
        success: true,
        client: {
          id: client.id,
          email: client.email,
          fullName,
          tenantSlug,
        },
        token: sessionToken,
        impersonationNote:
          "Esta es una sesión de soporte. Cualquier acción será registrada.",
      },
      { status: 200 }
    );

    response.cookies.set("client-session", sessionToken, COOKIE_OPTIONS);

    return response;
  } catch (error) {
    console.error("[ClientImpersonate] Error:", error);

    return NextResponse.json(
      { error: "Error al acceder a la cuenta del cliente" },
      { status: 500 }
    );
  }
}

/* eslint-disable no-console */
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/clients/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * Short-lived on purpose: realtime-js re-asks the browser for a token on every
 * heartbeat (see lib/realtime/realtime-token.ts), so renewal is automatic.
 */
const TOKEN_TTL_SECONDS = 15 * 60;

type RealtimeKind = "trainer" | "client";

interface RealtimeIdentity {
  kind: RealtimeKind;
  userId: string;
  tenantHost: string;
  tenantSlug: string;
}

/**
 * Identity for `kind` from the app session (trainer cookie, or client cookie /
 * Bearer). Each session only knows one tenant column, and the two Realtime
 * tables disagree: `messages.tenant_slug` stores the HOST while
 * `notifications.tenant_slug` stores the SLUG — so both go into the token.
 */
async function resolveIdentity(
  kind: RealtimeKind
): Promise<RealtimeIdentity | null> {
  const supabase = createSupabaseAdminClient();

  if (kind === "trainer") {
    const session = await getTrainerSession();

    if (!session) return null;

    const { data } = await supabase
      .from("tenants")
      .select("slug")
      .eq("host", session.tenant_host)
      .maybeSingle();

    if (!data?.slug) return null;

    return {
      kind,
      userId: session.trainer_id,
      tenantHost: session.tenant_host,
      tenantSlug: data.slug,
    };
  }

  const session = await getClientSession();

  if (!session) return null;

  const { data } = await supabase
    .from("tenants")
    .select("host")
    .eq("slug", session.tenant_slug)
    .maybeSingle();

  if (!data?.host) return null;

  return {
    kind,
    userId: String(session.client_id),
    tenantHost: data.host,
    tenantSlug: session.tenant_slug,
  };
}

/**
 * GET /api/realtime/token?kind=trainer|client
 *
 * Mints the JWT the browser hands to Supabase Realtime. Signed with the
 * project's JWT secret; `role: "authenticated"` is what stops PostgREST /
 * Realtime from treating it as anon. The policies in
 * supabase/migrations/20260907120000_revoke_anon_table_access.sql read the
 * remaining claims through auth.jwt().
 */
export async function GET(request: NextRequest) {
  const secret = process.env.SUPABASE_JWT_SECRET;

  if (!secret) {
    console.error(
      "[Realtime Token] SUPABASE_JWT_SECRET is not set — realtime disabled"
    );

    return NextResponse.json(
      { error: "Realtime not configured" },
      { status: 503 }
    );
  }

  const kind = request.nextUrl.searchParams.get("kind");

  if (kind !== "trainer" && kind !== "client") {
    return NextResponse.json(
      { error: "kind must be trainer or client" },
      { status: 400 }
    );
  }

  const identity = await resolveIdentity(kind);

  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + TOKEN_TTL_SECONDS;

  const token = await new SignJWT({
    role: "authenticated",
    kind: identity.kind,
    user_id: identity.userId,
    tenant_host: identity.tenantHost,
    tenant_slug: identity.tenantSlug,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(identity.userId)
    .setAudience("authenticated")
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json(
    { token, expiresAt: exp },
    { headers: { "Cache-Control": "no-store" } }
  );
}

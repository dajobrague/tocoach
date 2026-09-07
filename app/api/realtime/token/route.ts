/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { getClientSession } from "@/lib/auth/client-session";
import {
  checkRealtimeSecretOnce,
  getRealtimeSigningSecret,
  signRealtimeToken,
  type RealtimeTokenClaims,
} from "@/lib/auth/realtime-token";
import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/clients/supabase-admin";

export const dynamic = "force-dynamic";

type RealtimeKind = RealtimeTokenClaims["kind"];

/**
 * Claims for `kind` from the app session (trainer cookie, or client cookie /
 * Bearer). Each session only knows one tenant column, and the two Realtime
 * tables disagree: `messages.tenant_slug` stores the HOST while
 * `notifications.tenant_slug` stores the SLUG — so both go into the token.
 */
async function resolveClaims(
  kind: RealtimeKind
): Promise<RealtimeTokenClaims | null> {
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
      user_id: session.trainer_id,
      tenant_host: session.tenant_host,
      tenant_slug: data.slug,
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
    user_id: String(session.client_id),
    tenant_host: data.host,
    tenant_slug: session.tenant_slug,
  };
}

/**
 * GET /api/realtime/token?kind=trainer|client
 *
 * Mints the short-lived JWT the browser hands to Supabase Realtime
 * (lib/realtime/realtime-token.ts fetches and renews it). Signing details and
 * the one-time secret self-check live in lib/auth/realtime-token.ts.
 */
export async function GET(request: NextRequest) {
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let secret: string;

  try {
    secret = getRealtimeSigningSecret();
  } catch (error) {
    console.error(
      `${error instanceof Error ? error.message : String(error)} correlationId=${correlationId}`
    );

    return NextResponse.json(
      { error: "Realtime not configured: SUPABASE_JWT_SECRET is missing" },
      { status: 500 }
    );
  }

  const kind = request.nextUrl.searchParams.get("kind");

  if (kind !== "trainer" && kind !== "client") {
    return NextResponse.json(
      { error: "kind must be trainer or client" },
      { status: 400 }
    );
  }

  const claims = await resolveClaims(kind);

  if (!claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token, expiresAt } = await signRealtimeToken(claims, secret);

  // Fire-and-forget: the diagnosis goes to the server logs, the caller gets
  // its token either way (the hooks degrade if Realtime rejects it).
  void checkRealtimeSecretOnce(token, correlationId);

  return NextResponse.json(
    { token, expiresAt },
    { headers: { "Cache-Control": "no-store" } }
  );
}

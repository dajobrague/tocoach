/* eslint-disable no-console */
/**
 * Server-side signing of the Realtime token (see app/api/realtime/token).
 *
 * PostgREST and Realtime verify tokens with the Supabase PROJECT JWT secret
 * (Dashboard → Settings → API → JWT Secret). That is a different value from
 * the app's `JWT_SECRET`, so there is deliberately no fallback: signing with
 * the wrong secret would fail silently (channels open, no events ever arrive).
 */
import "server-only";

import { SignJWT } from "jose";

export const REALTIME_TOKEN_TTL_SECONDS = 15 * 60;

export const MISSING_SECRET_MESSAGE =
  "[realtime-token] Falta SUPABASE_JWT_SECRET (Supabase → Settings → API → JWT Secret). Realtime desactivado.";

export interface RealtimeTokenClaims {
  kind: "trainer" | "client";
  user_id: string;
  tenant_host: string;
  tenant_slug: string;
}

/** Throws (with the operator-facing message) when the secret is not set. */
export function getRealtimeSigningSecret(): string {
  const secret = process.env.SUPABASE_JWT_SECRET?.trim();

  if (!secret) throw new Error(MISSING_SECRET_MESSAGE);

  return secret;
}

/**
 * `role: "authenticated"` is what stops PostgREST / Realtime from treating
 * the token as anon; the policies in
 * supabase/migrations/20260907120000_revoke_anon_table_access.sql read the
 * other claims through auth.jwt().
 */
export async function signRealtimeToken(
  claims: RealtimeTokenClaims,
  secret: string,
  now: number = Math.floor(Date.now() / 1000)
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = now + REALTIME_TOKEN_TTL_SECONDS;

  const token = await new SignJWT({ role: "authenticated", ...claims })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.user_id)
    .setAudience("authenticated")
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(secret));

  return { token, expiresAt };
}

let selfCheck: Promise<boolean> | null = null;

/**
 * One-time (per process) proof that Supabase accepts what we sign: GET
 * /rest/v1/ with the anon apikey and the freshly minted token. 401 means the
 * signing secret is not the project's JWT secret — logged loudly, never
 * blocking the endpoint. A network failure is not cached so the next request
 * retries.
 */
export function checkRealtimeSecretOnce(
  token: string,
  correlationId: string
): Promise<boolean> {
  if (!selfCheck) {
    selfCheck = runSelfCheck(token, correlationId).catch((error) => {
      console.warn(
        `[realtime-token] ${correlationId} self-check could not reach Supabase:`,
        error instanceof Error ? error.message : error
      );
      selfCheck = null;

      return false;
    });
  }

  return selfCheck;
}

async function runSelfCheck(
  token: string,
  correlationId: string
): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error(
      `[realtime-token] ${correlationId} self-check skipped: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing`
    );

    return false;
  }

  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    console.error(
      `[realtime-token] ${correlationId} Supabase rechaza el token: el secreto de firma (SUPABASE_JWT_SECRET) no coincide con el JWT secret del proyecto. Realtime no funcionará.`
    );

    return false;
  }

  console.log(
    `[realtime-token] ${correlationId} self-check ok: Supabase acepta el token firmado (HTTP ${res.status})`
  );

  return true;
}

/** Test seam. */
export function resetRealtimeSelfCheckForTests(): void {
  selfCheck = null;
}

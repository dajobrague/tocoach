// Client session management (separate from trainer sessions)
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

const COOKIE_NAME = "client-session"; // Different from trainer-session
const isProduction = process.env.NODE_ENV === "production";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  // Lax: sent on top-level GET navigations from any origin, including links
  // shared via WhatsApp, email, etc. Not affected by Safari ITP or Chrome's
  // third-party cookie deprecation because Lax cookies are first-party by
  // definition. Iframe embedding of the client portal is not supported; if
  // that requirement returns, revisit (likely Partitioned/CHIPS).
  sameSite: "lax" as const,
  path: "/",
  maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
};

export interface ClientSession {
  client_id: string; // Supabase user ID
  tenant_slug: string; // The tenant slug they belong to
  email: string;
  full_name?: string;
  // Set when an admin impersonates this client. Carries the admin's id for
  // audit logging; absent on regular client logins.
  impersonatedBy?: string;
  iat: number;
  exp: number;
}

/**
 * Extract a bearer token from an `Authorization` header value.
 * Exported for reuse in request-scoped verifiers and logging/telemetry.
 */
export function extractBearerToken(
  authHeader: string | null | undefined
): string | null {
  if (!authHeader) return null;
  const trimmed = authHeader.trim();

  if (!/^Bearer\s+/i.test(trimmed)) return null;
  const token = trimmed.replace(/^Bearer\s+/i, "").trim();

  return token || null;
}

/**
 * Get the current client session.
 *
 * Tries two transports in order:
 *   1. `client-session` httpOnly cookie (preferred — set by login flow).
 *   2. `Authorization: Bearer <jwt>` header (fallback for browsers where
 *      the cookie is blocked/stripped: Safari ITP, third-party cookie
 *      restrictions, in-app browsers, iframe embedding).
 *
 * Both transports carry the SAME signed JWT (same `JWT_SECRET`, same
 * payload shape), so the security properties are identical — we're just
 * giving the browser two ways to present it. The client-side helper
 * `lib/auth/client-token-storage.ts` stores a copy of the JWT in
 * `localStorage` on login and attaches it as a bearer token on subsequent
 * requests.
 */
export async function getClientSession(): Promise<ClientSession | null> {
  // 1) Cookie transport (preferred)
  try {
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(COOKIE_NAME)?.value;

    if (cookieToken) {
      try {
        const { payload } = await jwtVerify(cookieToken, JWT_SECRET);

        return payload as unknown as ClientSession;
      } catch (error) {
        // Cookie present but invalid/expired — fall through to bearer.
        console.warn(
          "[Client Session] Cookie token invalid, trying bearer:",
          error instanceof Error ? error.message : error
        );
      }
    }
  } catch {
    // cookies() can throw if called outside a request scope — fall through.
  }

  // 2) Authorization: Bearer <jwt> fallback
  try {
    const headerList = await headers();
    const bearer = extractBearerToken(headerList.get("authorization"));

    if (!bearer) {
      return null;
    }

    const { payload } = await jwtVerify(bearer, JWT_SECRET);

    return payload as unknown as ClientSession;
  } catch (error) {
    console.warn(
      "[Client Session] Invalid or expired session:",
      error instanceof Error ? error.message : error
    );

    return null;
  }
}

/**
 * Set client session cookie in response (for API routes)
 */
export async function setClientSessionCookie(
  response: NextResponse,
  clientId: string,
  tenantSlug: string,
  email: string,
  fullName?: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 30 * 24 * 60 * 60; // 30 days

  const payload: ClientSession = {
    client_id: clientId,
    tenant_slug: tenantSlug,
    email,
    full_name: fullName || "",
    iat: now,
    exp,
  };

  const token = await new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(JWT_SECRET);

  // No domain-specific cookie logic needed with slug-based routing
  response.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS);

  return token;
}

/**
 * Clear the client session cookie
 */
export async function clearClientSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(COOKIE_NAME);
}

/**
 * Verify client session from request (for middleware)
 */
export async function verifyClientSessionFromRequest(
  request: NextRequest
): Promise<ClientSession | null> {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);

    return payload as unknown as ClientSession;
  } catch (error) {
    return null;
  }
}

/**
 * Update last login timestamp for client
 */
export async function updateClientLastLogin(clientId: string): Promise<void> {
  try {
    const { createClient } = await import("@supabase/supabase-js");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase
      .from("clients")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", clientId);

    if (error) {
      console.warn("[Client Session] Failed to update last login:", error);
    } else {
      console.log(
        "[Client Session] Updated last_login_at for client:",
        clientId
      );
    }
  } catch (error) {
    console.warn("[Client Session] Failed to update last login:", error);
  }
}

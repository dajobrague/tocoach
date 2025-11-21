// Client session management (separate from trainer sessions)
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

const COOKIE_NAME = "client-session"; // Different from trainer-session
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
};

export interface ClientSession {
  client_id: string; // Supabase user ID
  tenant_slug: string; // The tenant slug they belong to
  email: string;
  full_name?: string;
  iat: number;
  exp: number;
}

/**
 * Get the current client session from cookies
 */
export async function getClientSession(): Promise<ClientSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);

    return payload as unknown as ClientSession;
  } catch (error) {
    console.warn("[Client Session] Invalid or expired session:", error);

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

    // Note: The clients table might not have a last_login_at field
    // This is a non-critical operation, so we just log if it fails
    await supabase
      .from("clients")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", clientId);
  } catch (error) {
    console.warn("[Client Session] Failed to update last login:", error);
  }
}

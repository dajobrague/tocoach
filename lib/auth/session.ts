/* eslint-disable no-console */
// Server-only session management for trainers
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { JWT_SECRET_BYTES as JWT_SECRET } from "./jwt-secret";

const TRAINER_COOKIE_NAME = "trainer-session";
const ADMIN_COOKIE_NAME = "admin-session";
const TRAINER_DEFAULT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Build cookie options for trainer/admin session cookies.
 *
 * Single source of truth so that all writers of `trainer-session` /
 * `admin-session` (regular login, password setup, register, admin login,
 * trainer impersonation) end up with the same `secure`, `sameSite`,
 * `path`, and (most importantly) `domain` attributes. Without this the
 * impersonation route was setting a host-only cookie while regular login
 * set a `.domain.tld`-scoped cookie, leaving two cookies that browsers
 * resolve in undefined ways.
 */
export function buildTrainerCookieOptions(maxAgeSeconds: number) {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax: sent on top-level same-site navigations from any origin
    // (admin → impersonation URL is opened on the same origin).
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };

  if (
    process.env.NODE_ENV !== "production" ||
    !process.env.NEXT_PUBLIC_APP_DOMAIN
  ) {
    return base;
  }

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN;

  // Railway / Vercel / Netlify preview domains don't allow setting a
  // wildcard parent domain; the cookie must be host-scoped on those.
  const isCustomDomain =
    !appDomain.includes("railway.app") &&
    !appDomain.includes("vercel.app") &&
    !appDomain.includes("netlify.app");

  if (!isCustomDomain) {
    return base;
  }

  const parts = appDomain.split(".");

  if (parts.length < 2) {
    return base;
  }

  return {
    ...base,
    domain: `.${parts.slice(-2).join(".")}`,
  };
}

const COOKIE_OPTIONS = buildTrainerCookieOptions(
  TRAINER_DEFAULT_MAX_AGE_SECONDS
);

export interface TrainerSession {
  trainer_id: string; // Supabase user ID
  tenant_host: string; // The tenant they own
  email: string;
  full_name?: string;
  iat: number;
  exp: number;
}

/**
 * Create a new trainer session and set the cookie
 */
export async function createTrainerSession(
  trainerId: string,
  tenantHost: string,
  email: string,
  fullName?: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7 * 24 * 60 * 60; // 7 days

  const payload: TrainerSession = {
    trainer_id: trainerId,
    tenant_host: tenantHost,
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

  // Set the cookie
  const cookieStore = await cookies();

  cookieStore.set(TRAINER_COOKIE_NAME, token, COOKIE_OPTIONS);

  return token;
}

/**
 * Get the current trainer session from cookies.
 *
 * Returns `null` when the request is not authenticated as a trainer — this is
 * EXPECTED, not an error: many endpoints (e.g. `/api/forms/responses/[clientId]`)
 * call both `getTrainerSession()` and `getClientSession()` and accept either
 * one. Logging every "no cookie" call as a warn/error generated thousands of
 * false-positive entries in Railway and drowned real errors. We now log
 * exclusively when a token IS present but fails verification — that's the
 * only path that actually warrants attention (expired, tampered, or wrong
 * signing key).
 */
export async function getTrainerSession(): Promise<TrainerSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(TRAINER_COOKIE_NAME)?.value;

    if (!token) {
      // No cookie → caller is anonymous or authenticated via a different
      // session type. Silent return is the contract.
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);

    return payload as unknown as TrainerSession;
  } catch (error) {
    // Token was present but failed `jwtVerify` (expired, malformed, or
    // signed by a rotated/different key). This is the only branch worth
    // logging — keeping it at `error` so it surfaces in production.
    console.error("[Trainer Session] JWT verification failed:", {
      error: error instanceof Error ? error.message : String(error),
      errorType: error?.constructor?.name,
    });

    return null;
  }
}

/**
 * Clear the trainer session cookie
 */
export async function clearTrainerSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(TRAINER_COOKIE_NAME);
}

/**
 * Verify session from request (for middleware)
 */
export async function verifySessionFromRequest(
  request: NextRequest
): Promise<TrainerSession | null> {
  try {
    const token = request.cookies.get(TRAINER_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);

    return payload as unknown as TrainerSession;
  } catch {
    return null;
  }
}

/**
 * Set session cookie in response (for API routes)
 * Cookie is scoped to main domain (localhost in dev) to prevent conflicts with client sessions
 */
export async function setSessionCookie(
  response: NextResponse,
  trainerId: string,
  tenantHost: string,
  email: string,
  fullName?: string,
  isAdmin: boolean = false
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7 * 24 * 60 * 60; // 7 days

  const payload: TrainerSession = {
    trainer_id: trainerId,
    tenant_host: tenantHost,
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

  const cookieName = isAdmin ? ADMIN_COOKIE_NAME : TRAINER_COOKIE_NAME;

  response.cookies.set(cookieName, token, COOKIE_OPTIONS);

  return token;
}

/**
 * Update last login timestamp for trainer
 */
export async function updateTrainerLastLogin(trainerId: string): Promise<void> {
  try {
    const { createClient } = await import("@supabase/supabase-js");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    await supabase
      .from("trainers")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", trainerId);
  } catch (error) {
    console.warn("[Session] Failed to update last login:", error);
    // Don't throw - this is not critical
  }
}

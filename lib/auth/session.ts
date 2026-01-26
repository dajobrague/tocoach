// Server-only session management for trainers
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

const TRAINER_COOKIE_NAME = "trainer-session";
const ADMIN_COOKIE_NAME = "admin-session";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // Use "lax" for same-site cookies (trainer/admin on app.topcoach.io)
  // This allows cookies to be sent on normal navigation while still being secure
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

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
 * Get the current trainer session from cookies
 */
export async function getTrainerSession(): Promise<TrainerSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(TRAINER_COOKIE_NAME)?.value;

    console.log("[Trainer Session] Reading session:", {
      cookieName: TRAINER_COOKIE_NAME,
      hasToken: !!token,
      tokenLength: token?.length,
      tokenPreview: token?.substring(0, 20) + "...",
    });

    if (!token) {
      console.warn("[Trainer Session] No token found in cookies");

      return null;
    }

    console.log("[Trainer Session] Attempting JWT verification...");
    const { payload } = await jwtVerify(token, JWT_SECRET);

    console.log("[Trainer Session] Session verified successfully:", {
      trainerId: (payload as unknown as TrainerSession).trainer_id,
    });

    return payload as unknown as TrainerSession;
  } catch (error) {
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
  } catch (error) {
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

  // Use provided isAdmin flag to determine cookie name
  const cookieName = isAdmin ? ADMIN_COOKIE_NAME : TRAINER_COOKIE_NAME;

  // In production with custom domain, set domain to allow sharing across subdomains
  // For Railway/Vercel domains, DON'T set domain (cookies don't work across their infrastructure)
  let cookieOptionsWithDomain: any = COOKIE_OPTIONS;

  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_APP_DOMAIN
  ) {
    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN;

    // Only set domain for custom domains (not Railway, Vercel, etc.)
    const isCustomDomain =
      !appDomain.includes("railway.app") &&
      !appDomain.includes("vercel.app") &&
      !appDomain.includes("netlify.app");

    if (isCustomDomain) {
      const parts = appDomain.split(".");

      if (parts.length >= 2) {
        // Get last two parts (domain.tld) for custom domains
        const baseDomain = `.${parts.slice(-2).join(".")}`;

        cookieOptionsWithDomain = {
          ...cookieOptionsWithDomain,
          domain: baseDomain,
        };
      }
    }
    // For Railway/Vercel/etc, don't set domain - use default (current host only)
  }

  response.cookies.set(cookieName, token, cookieOptionsWithDomain);
  console.log("[Session] Cookie set:", {
    cookieName,
    isAdmin,
    userId: trainerId,
    tenantHost,
    options: cookieOptionsWithDomain,
  });

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

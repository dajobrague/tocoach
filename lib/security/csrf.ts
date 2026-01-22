/**
 * CSRF (Cross-Site Request Forgery) Protection Utility
 *
 * This provides an additional layer of security now that we use sameSite: "none" cookies
 * for iframe embedding support.
 *
 * Usage:
 * 1. Generate a CSRF token when creating sessions
 * 2. Include token in forms and API requests
 * 3. Validate token on state-changing operations (POST, PUT, DELETE)
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const CSRF_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Generate a CSRF token for the current session
 */
export async function generateCSRFToken(sessionId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60; // 1 hour expiry

  const token = await new SignJWT({ sessionId, type: "csrf" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(CSRF_SECRET);

  return token;
}

/**
 * Set CSRF token in a cookie
 * This should be called during login or session creation
 */
export async function setCSRFTokenCookie(sessionId: string): Promise<string> {
  const token = await generateCSRFToken(sessionId);
  const cookieStore = await cookies();

  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Allow JavaScript access so it can be included in fetch requests
    secure: process.env.NODE_ENV === "production",
    sameSite: "none" as const,
    path: "/",
    maxAge: 60 * 60, // 1 hour
  });

  return token;
}

/**
 * Get CSRF token from cookies
 */
export async function getCSRFToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(CSRF_COOKIE_NAME)?.value;

    return token || null;
  } catch (error) {
    console.error("[CSRF] Error getting token:", error);

    return null;
  }
}

/**
 * Validate CSRF token from request
 * Checks both header and cookie to ensure they match and are valid
 */
export async function validateCSRFToken(
  request: NextRequest | Request
): Promise<boolean> {
  try {
    // Get token from header (sent by client)
    const headerToken =
      request.headers.get(CSRF_HEADER_NAME) ||
      request.headers.get("X-CSRF-Token") ||
      request.headers.get("csrf-token");

    if (!headerToken) {
      console.warn("[CSRF] No token in request header");

      return false;
    }

    // Get token from cookie (set by server)
    const cookieToken =
      request instanceof NextRequest
        ? request.cookies.get(CSRF_COOKIE_NAME)?.value
        : null;

    if (!cookieToken) {
      console.warn("[CSRF] No token in cookie");

      return false;
    }

    // Tokens must match
    if (headerToken !== cookieToken) {
      console.warn("[CSRF] Token mismatch");

      return false;
    }

    // Verify token signature and expiry
    const { payload } = await jwtVerify(headerToken, CSRF_SECRET);

    if (payload.type !== "csrf") {
      console.warn("[CSRF] Invalid token type");

      return false;
    }

    return true;
  } catch (error) {
    console.error("[CSRF] Token validation failed:", error);

    return false;
  }
}

/**
 * Middleware helper to validate CSRF for state-changing operations
 * Returns true if request is safe to proceed
 */
export async function validateCSRFForMutation(
  request: NextRequest | Request
): Promise<boolean> {
  const method = request.method.toUpperCase();

  // Only validate for state-changing methods
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return true; // GET, HEAD, OPTIONS are safe
  }

  // Validate CSRF token
  return await validateCSRFToken(request);
}

/**
 * Client-side helper to get CSRF token from cookie
 * Use this in your frontend to include the token in requests
 */
export function getCSRFTokenFromCookie(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookies = document.cookie.split(";");
  const csrfCookie = cookies.find((c) =>
    c.trim().startsWith(`${CSRF_COOKIE_NAME}=`)
  );

  if (!csrfCookie) {
    return null;
  }

  return csrfCookie.split("=")[1];
}

/**
 * Client-side fetch wrapper that automatically includes CSRF token
 *
 * Usage:
 * import { fetchWithCSRF } from '@/lib/security/csrf';
 *
 * const response = await fetchWithCSRF('/api/some-endpoint', {
 *   method: 'POST',
 *   body: JSON.stringify(data)
 * });
 */
export async function fetchWithCSRF(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getCSRFTokenFromCookie();

  if (token) {
    options.headers = {
      ...options.headers,
      [CSRF_HEADER_NAME]: token,
    };
  }

  return fetch(url, options);
}

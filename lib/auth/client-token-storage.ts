"use client";

/**
 * Client-side storage + fetch helpers for the client-session JWT.
 *
 * Why this exists
 * ---------------
 * The primary transport for `client-session` is an httpOnly cookie set by
 * `/api/auth/client-login`. In production it uses `SameSite=None; Secure`
 * (needed for iframe embedding and cross-site login redirects), which makes
 * it vulnerable to being silently dropped by:
 *   - Safari ITP (intelligent tracking prevention)
 *   - Third-party cookie restrictions (Chrome, Firefox)
 *   - Third-party in-app browsers (Instagram, Facebook, TikTok webviews)
 *
 * When that happens the cookie is never sent back on subsequent requests,
 * and the client sees "No autorizado" on form submission. To cover those
 * cases we *also* store the same signed JWT in `localStorage` at login
 * time, and attach it as `Authorization: Bearer <jwt>` on writes.
 *
 * The server accepts either transport (see `getClientSession` in
 * `lib/auth/client-session.ts`) — both carry the identical signed JWT, so
 * the security properties are the same.
 *
 * This module is explicitly `"use client"` and should never be imported
 * from server components / route handlers.
 */

const TOKEN_KEY = "topcoach.client_session_token";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/**
 * Persist the JWT returned by the login / setup-password endpoints.
 * Fails silently — `localStorage` can throw in Safari private mode, and
 * a missing fallback token is not a critical error (cookie may still work).
 */
export function storeClientToken(token: string): void {
  if (!isBrowser()) return;
  if (!token) return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.warn("[Client Token] Failed to persist token:", error);
  }
}

export function getClientToken(): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Clear the locally-stored token. Call this on logout OR when the server
 * returns 401 (token expired / revoked), so we don't keep attaching a dead
 * token on future requests.
 */
export function clearClientToken(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // no-op
  }
}

/**
 * `fetch` wrapper that attaches `Authorization: Bearer <jwt>` when a token
 * is available in `localStorage`. The cookie still rides along on the
 * request (as always) — this just adds a second, independent transport
 * that survives cookie partitioning.
 *
 * Drop-in replacement for `fetch` in client-side write paths:
 *
 *   const res = await clientFetch(`/api/forms/responses/${clientId}`, {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify(payload),
 *   });
 */
export function clientFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token = getClientToken();

  if (!token) {
    return fetch(input, init);
  }

  const headers = new Headers(init.headers);

  // Respect an explicitly-set Authorization header — callers may need to
  // override (e.g. a different token for a specific request).
  if (!headers.has("Authorization") && !headers.has("authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, { ...init, headers });
}

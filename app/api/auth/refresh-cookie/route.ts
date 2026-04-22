// Refresh the `client-session` cookie from a bearer token.
//
// Why this exists
// ---------------
// `middleware.ts` protects client pages (/[slug]/dashboard, /programs, ...)
// by reading the `client-session` httpOnly cookie via
// `verifyClientSessionFromRequest`. On the edge we can't read localStorage,
// so if the cookie gets silently dropped by the browser (Safari ITP,
// third-party cookie restrictions, in-app webviews, iframe embedding) the
// user bounces to /login on every navigation even though they have a valid
// JWT in localStorage.
//
// This endpoint closes that gap: the login page detects the orphaned
// localStorage token on mount, POSTs it here as `Authorization: Bearer`,
// the server re-validates and re-issues the cookie, then the client
// navigates to the dashboard. Same signed JWT, same secret, same payload
// shape — so no new trust surface.
import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

import {
  ClientSession,
  extractBearerToken,
  setClientSessionCookie,
} from "@/lib/auth/client-session";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

export async function POST(request: NextRequest) {
  try {
    const bearer = extractBearerToken(request.headers.get("authorization"));

    if (!bearer) {
      return NextResponse.json(
        { success: false, error: "Missing bearer token" },
        { status: 401 }
      );
    }

    let payload: ClientSession;

    try {
      const result = await jwtVerify(bearer, JWT_SECRET);

      payload = result.payload as unknown as ClientSession;
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    if (!payload.client_id || !payload.tenant_slug || !payload.email) {
      return NextResponse.json(
        { success: false, error: "Malformed token payload" },
        { status: 401 }
      );
    }

    // Two-pass response construction so we can echo the re-signed JWT
    // back in the body (same rationale as /api/auth/client-login). The
    // caller refreshes its localStorage copy with the new token so both
    // transports expire in lockstep.
    const response = NextResponse.json(
      {
        success: true,
        client: {
          id: payload.client_id,
          email: payload.email,
          tenantSlug: payload.tenant_slug,
        },
      },
      { status: 200 }
    );

    const token = await setClientSessionCookie(
      response,
      payload.client_id,
      payload.tenant_slug,
      payload.email,
      payload.full_name
    );

    const finalResponse = NextResponse.json(
      {
        success: true,
        client: {
          id: payload.client_id,
          email: payload.email,
          tenantSlug: payload.tenant_slug,
        },
        token,
      },
      { status: 200 }
    );

    response.cookies.getAll().forEach((cookie) => {
      finalResponse.cookies.set(cookie);
    });

    return finalResponse;
  } catch (error) {
    console.error("[Refresh Cookie] Unexpected error:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

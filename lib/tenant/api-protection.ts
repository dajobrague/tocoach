/**
 * API route protection for tenant status and secret access
 * Ensures inactive tenants never access secrets or data
 */

import { NextRequest, NextResponse } from "next/server";

import { loadTenantContext, normalizeHost } from "@/lib/tenant/loader";

export interface ProtectedRouteContext {
  tenant: {
    host: string;
    slug: string;
    theme_slug: string;
    status: "active" | "inactive";
    features: Record<string, any>;
  };
  correlationId: string;
}

/**
 * Protect API routes that require active tenant status
 * Returns tenant context if active, or error response if inactive/unknown
 */
export async function withTenantProtection(
  request: NextRequest,
  handler: (context: ProtectedRouteContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const correlationId = `api-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    // Extract and normalize host
    const hostHeader = request.headers.get("host") || "";
    const normalizedHost = normalizeHost(hostHeader);

    console.log(
      `[API Protection] Checking tenant for host: ${normalizedHost}`,
      { correlationId }
    );

    // Load tenant context
    const tenantContext = await loadTenantContext(normalizedHost);

    if (!tenantContext) {
      console.warn(`[API Protection] Unknown host: ${normalizedHost}`, {
        correlationId,
      });

      return NextResponse.json(
        {
          error: "UNKNOWN_HOST",
          message: "This domain is not configured",
          correlationId,
        },
        {
          status: 404,
          headers: { "X-Tenant-Status": "unknown" },
        }
      );
    }

    if (tenantContext.status === "inactive") {
      console.warn(`[API Protection] Inactive tenant: ${normalizedHost}`, {
        correlationId,
        tenantSlug: tenantContext.slug,
      });

      return NextResponse.json(
        {
          error: "TENANT_INACTIVE",
          message: "This trainer's app is temporarily unavailable",
          correlationId,
        },
        {
          status: 503,
          headers: { "X-Tenant-Status": "inactive" },
        }
      );
    }

    // Create protected context
    const protectedContext: ProtectedRouteContext = {
      tenant: {
        host: tenantContext.host,
        slug: tenantContext.slug,
        theme_slug: tenantContext.theme_slug,
        status: tenantContext.status,
        features: tenantContext.features,
      },
      correlationId,
    };

    console.log(`[API Protection] Active tenant verified: ${normalizedHost}`, {
      correlationId,
      tenantSlug: tenantContext.slug,
    });

    // Call the protected handler
    return await handler(protectedContext);
  } catch (error) {
    console.error(
      `[API Protection] Protection check failed for host: ${request.headers.get("host")}`,
      {
        correlationId,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    );

    return NextResponse.json(
      {
        error: "TENANT_CHECK_FAILED",
        message: "Unable to verify tenant status",
        correlationId,
      },
      { status: 500 }
    );
  }
}

/**
 * Legacy: withSecretProtection removed
 * All data now lives in Supabase with RLS protection
 * Use withTenantProtection for API route protection
 * Use Supabase RLS policies for data-level security
 */

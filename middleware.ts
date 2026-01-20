import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { verifyClientSessionFromRequest } from "@/lib/auth/client-session";

// Lazy Supabase client initialization to avoid connection issues at module load
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[Middleware] Missing required environment variables:", {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
    });
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Cache for tenant slugs validation (60 second TTL)
const tenantCache = new Map<string, { exists: boolean; expires: number }>();
const CACHE_TTL = 60 * 1000; // 60 seconds

/**
 * Extract slug from pathname if it matches the pattern /[slug]/...
 * Returns null if no slug pattern detected
 */
function extractSlugFromPath(pathname: string): string | null {
  // Match pattern: /[slug]/something or /[slug]
  // But exclude /trainer, /api, /brands, etc.
  const match = pathname.match(/^\/([^\/]+)(?:\/|$)/);

  if (!match) {
    return null;
  }

  const firstSegment = match[1];

  if (!firstSegment) {
    return null;
  }

  // Exclude known trainer/admin routes and system files
  const excludedRoutes = [
    "trainer",
    "api",
    "_next",
    "brands",
    "about",
    "blog",
    "docs",
    "pricing",
    "icons", // Static icons directory
    "sw.js", // Service worker
    "404", // Exclude 404 page to prevent redirect loops
    "500", // Exclude error pages
    "favicon.ico",
    "manifest.json",
    "robots.txt",
    "sitemap.xml",
  ];

  if (excludedRoutes.includes(firstSegment)) {
    return null;
  }

  return firstSegment;
}

/**
 * Validate if a slug exists in the tenants table
 */
async function validateTenantSlug(slug: string): Promise<boolean> {
  const cached = tenantCache.get(slug);

  if (cached && cached.expires > Date.now()) {
    return cached.exists;
  }

  try {
    console.log(`[Middleware] Validating tenant slug: ${slug}`);

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("tenants")
      .select("slug")
      .eq("slug", slug)
      .eq("status", "active")
      .single();

    console.log(`[Middleware] Supabase query result:`, {
      slug,
      hasData: !!data,
      error: error?.message || null,
    });

    const exists = !error && !!data;

    // Cache result
    tenantCache.set(slug, {
      exists,
      expires: Date.now() + CACHE_TTL,
    });

    console.log(`[Middleware] Tenant validation result: ${exists}`);

    return exists;
  } catch (error) {
    console.error("[Middleware] Error validating tenant slug:", {
      slug,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return false;
  }
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const pathname = url.pathname;

  console.log(`[Middleware] Incoming request: ${request.method} ${pathname}`, {
    correlationId,
  });

  // Extract slug from pathname
  const slug = extractSlugFromPath(pathname);

  console.log(`[Middleware] Extracted slug: ${slug || "none"}`);

  // =============================================================================
  // CLIENT SECTION - Slug-based routes (/[slug]/...)
  // =============================================================================
  if (slug) {
    // Validate that the slug exists in the database
    let isValidTenant = false;

    try {
      isValidTenant = await validateTenantSlug(slug);
    } catch (error) {
      console.error(`[Middleware:CLIENT] Critical error validating tenant:`, {
        slug,
        error: error instanceof Error ? error.message : String(error),
      });

      // On critical error, return 503 Service Unavailable
      return new NextResponse("Service temporarily unavailable", {
        status: 503,
      });
    }

    if (!isValidTenant) {
      console.warn(`[Middleware:CLIENT] Invalid tenant slug: ${slug}`);

      return NextResponse.rewrite(new URL("/404", request.url));
    }

    // Extract the rest of the path after the slug
    const pathAfterSlug = pathname.substring(slug.length + 1) || "/";

    // Define route types
    const isPublicRoute =
      pathAfterSlug === "/login" ||
      pathAfterSlug === "/forgot-password" ||
      pathAfterSlug === "/reset-password";

    const isProtectedRoute =
      pathAfterSlug === "/" ||
      pathAfterSlug === "/dashboard" ||
      pathAfterSlug === "/programs" ||
      pathAfterSlug === "/calendar" ||
      pathAfterSlug === "/profile" ||
      pathAfterSlug === "/nutricion" ||
      pathAfterSlug === "/ejercicio" ||
      pathAfterSlug === "/mas";

    // Handle protected routes
    if (isProtectedRoute) {
      const session = await verifyClientSessionFromRequest(request);

      // Root path - redirect based on auth status
      if (pathAfterSlug === "/") {
        if (session && session.tenant_slug === slug) {
          const dashboardUrl = new URL(`/${slug}/dashboard`, request.url);
          const response = NextResponse.rewrite(dashboardUrl);

          response.headers.set("x-tenant-slug", slug);
          response.headers.set("x-correlation-id", correlationId);
          response.headers.set("x-pathname", pathname);

          console.log(
            `[Middleware:CLIENT] ${request.method} ${pathname} → /${slug}/dashboard (authenticated)`,
            {
              slug,
              correlationId,
            }
          );

          return response;
        } else {
          const loginUrl = new URL(`/${slug}/login`, request.url);
          const response = NextResponse.rewrite(loginUrl);

          response.headers.set("x-tenant-slug", slug);
          response.headers.set("x-correlation-id", correlationId);
          response.headers.set("x-pathname", pathname);

          console.log(
            `[Middleware:CLIENT] ${request.method} ${pathname} → /${slug}/login (guest)`,
            {
              slug,
              correlationId,
            }
          );

          return response;
        }
      }

      // Other protected routes - require authentication
      if (!session) {
        const loginUrl = new URL(`/${slug}/login`, request.url);

        loginUrl.searchParams.set("redirect", pathAfterSlug);

        console.log(
          `[Middleware:CLIENT] ${request.method} ${pathname} → redirect to /${slug}/login (no session)`,
          {
            slug,
            correlationId,
          }
        );

        return NextResponse.redirect(loginUrl);
      }

      // Verify tenant matches
      if (session.tenant_slug !== slug) {
        console.warn(
          `[Middleware:CLIENT] Tenant mismatch: ${session.tenant_slug} vs ${slug}`
        );
        const loginUrl = new URL(`/${slug}/login`, request.url);

        return NextResponse.redirect(loginUrl);
      }
    }

    // All client routes get tenant headers
    const response = NextResponse.next();

    response.headers.set("x-tenant-slug", slug);
    response.headers.set("x-brand-slug", "default");
    response.headers.set("x-correlation-id", correlationId);
    response.headers.set("x-pathname", pathname);

    console.log(`[Middleware:CLIENT] ${request.method} ${pathname}`, {
      slug,
      isPublic: isPublicRoute,
      isProtected: isProtectedRoute,
      correlationId,
    });

    return response;
  }

  // =============================================================================
  // TRAINER SECTION - Main Domain Routes (no slug detected)
  // =============================================================================

  // Block client-only routes on main domain without slug
  const clientOnlyRoutes = [
    "/dashboard",
    "/programs",
    "/calendar",
    "/profile",
    "/forgot-password",
    "/reset-password",
    "/login",
  ];

  if (clientOnlyRoutes.includes(pathname)) {
    console.warn(
      `[Middleware:TRAINER] Blocked client-only route without tenant slug: ${pathname}`
    );

    return NextResponse.rewrite(new URL("/404", request.url));
  }

  const response = NextResponse.next();

  response.headers.set("x-correlation-id", correlationId);
  response.headers.set("x-tenant-slug", ""); // Empty for trainer domain
  response.headers.set("x-brand-slug", "default");
  response.headers.set("x-pathname", pathname);

  console.log(`[Middleware:TRAINER] ${request.method} ${pathname}`, {
    correlationId,
  });

  // Just pass through - trainer auth is handled by components
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - brands (brand assets and CSS routes)
     * - manifest.json (PWA manifest)
     * - robots.txt, sitemap.xml (SEO files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|brands|manifest.json|robots.txt|sitemap.xml|icons|sw.js).*)",
  ],
};

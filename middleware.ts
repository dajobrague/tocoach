import { verifyClientSessionFromRequest } from "@/lib/auth/client-session";
import { NextRequest, NextResponse } from "next/server";

// Normalize host function (duplicated to avoid Edge Runtime issues)
function normalizeHost(host: string | null): string {
    const safeHost = host || "localhost";
    return safeHost!.toLowerCase().split(':')[0]!.trim();
}

// Get main domain from environment or use default
function getMainDomain(): string {
    return process.env.NEXT_PUBLIC_APP_DOMAIN || "localhost";
}

// Check if host is the main domain (no subdomain prefix)
function isMainDomainHost(normalizedHost: string): boolean {
    const mainDomain = getMainDomain();
    
    // Always allow localhost as main domain for development
    if (normalizedHost === "localhost") {
        return true;
    }
    
    // Check if it's exactly the main domain (no subdomain)
    return normalizedHost === mainDomain;
}

export async function middleware(request: NextRequest) {
    const url = request.nextUrl;
    const correlationId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Extract and normalize host
    const hostHeader = request.headers.get("host");
    const normalizedHost = normalizeHost(hostHeader);
    const pathname = url.pathname;

    // Debug: Log ALL requests including API
    if (pathname.includes('/api/auth/session')) {
        console.log('[Middleware:DEBUG] /api/auth/session request detected - THIS SHOULD NOT HAPPEN!');
    }

    // Determine if this is main domain (trainers) or subdomain (clients)
    const isMainDomain = isMainDomainHost(normalizedHost);
    const isSubdomain = !isMainDomain;

    // =============================================================================
    // TRAINER SECTION - Main Domain (localhost or Vercel-assigned domain)
    // =============================================================================
    if (isMainDomain) {
        // Block client-only routes on main domain - redirect to trainer equivalents
        if (pathname === '/login') {
            console.log(`[Middleware:TRAINER] Redirecting /login → /trainer/login`);
            return NextResponse.redirect(new URL('/trainer/login', request.url));
        }

        const clientOnlyRoutes = ['/dashboard', '/programs', '/calendar', '/profile', '/forgot-password', '/reset-password'];
        if (clientOnlyRoutes.includes(pathname)) {
            console.warn(`[Middleware:TRAINER] Blocked client-only route on main domain: ${pathname}`);
            return NextResponse.rewrite(new URL('/404', request.url));
        }

        const response = NextResponse.next();
        response.headers.set("x-correlation-id", correlationId);
        response.headers.set("x-tenant-host", ""); // Empty for trainer domain
        response.headers.set("x-brand-slug", "default");
        response.headers.set("x-pathname", pathname);

        console.log(`[Middleware:TRAINER] ${request.method} ${pathname}`, {
            host: normalizedHost,
            correlationId,
        });

        // Just pass through - trainer auth is handled by components
        return response;
    }

    // =============================================================================
    // CLIENT SECTION - Subdomains (trainer-slug.yourapp.vercel.app or trainer-slug.localhost)
    // =============================================================================
    if (isSubdomain) {
        // Define route types
        const isPublicRoute = pathname === "/login" ||
            pathname === "/forgot-password" ||
            pathname === "/reset-password";

        const isProtectedRoute = pathname === "/" ||
            pathname === "/dashboard" ||
            pathname === "/programs" ||
            pathname === "/calendar" ||
            pathname === "/profile";

        // Handle protected routes
        if (isProtectedRoute) {
            const session = await verifyClientSessionFromRequest(request);

            // Root path - redirect based on auth status
            if (pathname === "/") {
                if (session && session.tenant_host === normalizedHost) {
                    const dashboardUrl = new URL("/dashboard", request.url);
                    const response = NextResponse.rewrite(dashboardUrl);
                    response.headers.set("x-tenant-host", normalizedHost);
                    response.headers.set("x-correlation-id", correlationId);
                    response.headers.set("x-pathname", pathname);

                    console.log(`[Middleware:CLIENT] ${request.method} ${pathname} → /dashboard (authenticated)`, {
                        host: normalizedHost,
                        correlationId,
                    });

                    return response;
                } else {
                    const loginUrl = new URL("/login", request.url);
                    const response = NextResponse.rewrite(loginUrl);
                    response.headers.set("x-tenant-host", normalizedHost);
                    response.headers.set("x-correlation-id", correlationId);
                    response.headers.set("x-pathname", pathname);

                    console.log(`[Middleware:CLIENT] ${request.method} ${pathname} → /login (guest)`, {
                        host: normalizedHost,
                        correlationId,
                    });

                    return response;
                }
            }

            // Other protected routes - require authentication
            if (!session) {
                const loginUrl = new URL("/login", request.url);
                loginUrl.searchParams.set("redirect", pathname);

                console.log(`[Middleware:CLIENT] ${request.method} ${pathname} → redirect to /login (no session)`, {
                    host: normalizedHost,
                    correlationId,
                });

                return NextResponse.redirect(loginUrl);
            }

            // Verify tenant matches
            if (session.tenant_host !== normalizedHost) {
                console.warn(`[Middleware:CLIENT] Tenant mismatch: ${session.tenant_host} vs ${normalizedHost}`);
                const loginUrl = new URL("/login", request.url);
                return NextResponse.redirect(loginUrl);
            }
        }

        // All client routes get tenant headers
        const response = NextResponse.next();
        response.headers.set("x-tenant-host", normalizedHost);
        response.headers.set("x-brand-slug", "default");
        response.headers.set("x-correlation-id", correlationId);
        response.headers.set("x-pathname", pathname);

        console.log(`[Middleware:CLIENT] ${request.method} ${pathname}`, {
            host: normalizedHost,
            isPublic: isPublicRoute,
            isProtected: isProtectedRoute,
            correlationId,
        });

        return response;
    }

    // Fallback (should not reach here)
    return NextResponse.next();
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
         */
        "/((?!api|_next/static|_next/image|favicon.ico|brands).*)",
    ],
};

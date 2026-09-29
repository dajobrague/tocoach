"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo } from "react";

import { ClientPageSkeleton } from "./client-page-skeleton";

import { useClientBootstrap } from "@/lib/hooks/use-client-queries";

export interface ClientData {
  clientId: string;
  firstName: string;
  lastName: string;
  logoUrl: string;
  trainerName: string;
  clientProfilePicture: string;
  tenantSlug: string;
  communityUrl: string | null;
}

const ClientDataContext = createContext<ClientData | null>(null);

// Mirrors the public-route list in `middleware.ts`. Pages here don't
// depend on bootstrap data and render fine without context.
const PUBLIC_PATH_SUFFIXES = new Set([
  "/login",
  "/forgot-password",
  "/reset-password",
  "/auth/impersonate",
  "/auth/client-impersonate",
]);

/**
 * Self-fetching provider that loads client profile + tenant context
 * via a single /api/client/bootstrap call, cached by TanStack Query.
 *
 * - First visit: shows lightweight skeleton while the API responds.
 * - Subsequent navigations: TanStack Query serves cached data instantly.
 * - If unauthenticated (401) on a public page: renders children as-is.
 * - If unauthenticated on a protected page: redirects to login. The
 *   middleware should have caught this earlier, but if the cookie was
 *   present at middleware-time and dropped before the bootstrap call
 *   (or vice-versa) we'd otherwise crash because consumers like
 *   `DashboardContent` call `useClientData()` which throws when there
 *   is no context.
 */
export function ClientDataProvider({
  children,
  tenantSlug,
}: {
  children: React.ReactNode;
  tenantSlug: string;
}) {
  const { data, isLoading } = useClientBootstrap();
  const pathname = usePathname();
  const router = useRouter();

  const isPublicPath = useMemo(() => {
    const prefix = `/${tenantSlug}`;
    const suffix = pathname.startsWith(prefix)
      ? pathname.slice(prefix.length) || "/"
      : pathname;

    return PUBLIC_PATH_SUFFIXES.has(suffix);
  }, [pathname, tenantSlug]);

  useEffect(() => {
    if (isLoading) return;
    if (data) return;
    if (isPublicPath) return;
    router.replace(`/${tenantSlug}/login`);
  }, [isLoading, data, isPublicPath, router, tenantSlug]);

  // First-time load — show lightweight skeleton so the user sees
  // instant feedback. On cached revisits this is skipped entirely.
  if (isLoading) {
    return <BootstrapSkeleton />;
  }

  if (!data) {
    // Public pages render their children directly. Protected pages
    // see the skeleton while the redirect above is in flight — better
    // than rendering a tree that throws inside `useClientData()`.
    return isPublicPath ? <>{children}</> : <BootstrapSkeleton />;
  }

  return (
    <ClientDataContext.Provider value={data}>
      {children}
    </ClientDataContext.Provider>
  );
}

export function useClientData(): ClientData {
  const context = useContext(ClientDataContext);

  if (!context) {
    throw new Error("useClientData must be used within a ClientDataProvider");
  }

  return context;
}

// ─── Minimal skeleton shown only on the very first load ─────────────────────

function BootstrapSkeleton() {
  return <ClientPageSkeleton />;
}

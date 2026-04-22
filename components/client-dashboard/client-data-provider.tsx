"use client";

import { createContext, useContext } from "react";

import { useClientBootstrap } from "@/lib/hooks/use-client-queries";

export interface ClientData {
  clientId: string;
  firstName: string;
  logoUrl: string;
  trainerName: string;
  clientProfilePicture: string;
  tenantSlug: string;
  communityUrl: string | null;
}

const ClientDataContext = createContext<ClientData | null>(null);

/**
 * Self-fetching provider that loads client profile + tenant context
 * via a single /api/client/bootstrap call, cached by TanStack Query.
 *
 * - First visit: shows lightweight skeleton while the API responds.
 * - Subsequent navigations: TanStack Query serves cached data instantly.
 * - If unauthenticated (401): renders children as-is so public pages
 *   (login, forgot-password) work without context.
 */
export function ClientDataProvider({
  children,
  tenantSlug,
}: {
  children: React.ReactNode;
  tenantSlug: string;
}) {
  const { data, isLoading } = useClientBootstrap();

  // First-time load — show lightweight skeleton so the user sees
  // instant feedback. On cached revisits this is skipped entirely.
  if (isLoading) {
    return <BootstrapSkeleton />;
  }

  // Not authenticated (API returned 401 → data is null) or unexpected
  // error — render children without context.  Public pages (login,
  // forgot-password) don't call useClientData() so they work fine.
  if (!data) {
    return <>{children}</>;
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
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-default-200 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-24 bg-default-200 rounded animate-pulse" />
                <div className="h-3 w-16 bg-default-100 rounded animate-pulse" />
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-default-200 animate-pulse" />
          </div>
        </div>

        {/* Content cards */}
        <div className="px-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-default-100 rounded-xl p-5 animate-pulse"
            >
              <div className="h-5 w-32 bg-default-200 rounded mb-3" />
              <div className="h-4 w-full bg-default-200 rounded mb-2" />
              <div className="h-4 w-3/4 bg-default-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

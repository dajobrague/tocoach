"use client";

import { createContext, useContext } from "react";

import { type ClientTenantInfo } from "@/lib/tenant/types";

// Client-safe tenant context
const TenantContext = createContext<ClientTenantInfo | null>(null);

export interface TenantProviderProps {
  children: React.ReactNode;
  tenant: ClientTenantInfo | null;
}

export function TenantProvider({ children, tenant }: TenantProviderProps) {
  return (
    <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>
  );
}

export function useTenant(): ClientTenantInfo | null {
  return useContext(TenantContext);
}

// Utility hooks
export function useTenantSlug(): string {
  const tenant = useTenant();

  return tenant?.slug || "default";
}

export function useTenantName(): string {
  const tenant = useTenant();

  // Extract name from theme_json if available, fallback to slug
  return tenant?.slug || "TopCoach";
}

export function useIsDefaultTenant(): boolean {
  const tenant = useTenant();

  return !tenant || tenant.slug === "default";
}

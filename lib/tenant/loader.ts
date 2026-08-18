/* eslint-disable no-console */
/**
 * Server-only tenant resolution and configuration loader
 *
 * SECURITY: This module must NEVER be imported by client components
 * Use only in server components, API routes, and middleware
 */

import { createClient } from "@supabase/supabase-js";

import { logTenantContext } from "@/lib/security/encryption";
import { TenantContext, TenantMetadata } from "@/lib/tenant/types";

// Lazy Supabase client initialization to avoid connection pool issues
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // Using anon key as per project standards
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// Types imported from types.ts for consistency

// Metadata cache (60 second TTL, no secrets)
const metadataCache = new Map<
  string,
  { data: TenantMetadata; expires: number }
>();
const CACHE_TTL = 60 * 1000; // 60 seconds

/**
 * Normalize and sanitize host header
 */
export function normalizeHost(host: string): string {
  return host
    .toLowerCase()
    .split(":")[0]! // Remove port in production
    .trim();
}

/**
 * Load tenant metadata with caching (no secrets)
 * Note: The 'host' parameter actually receives slug values in the new architecture
 */
async function loadTenantMetadata(
  host: string
): Promise<TenantMetadata | null> {
  const normalizedSlug = normalizeHost(host);
  const correlationId = `tenant-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Check cache first
  const cached = metadataCache.get(normalizedSlug);

  if (cached && cached.expires > Date.now()) {
    logTenantContext(cached.data, `${correlationId}-cache-hit`);

    return cached.data;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("tenants")
      .select(
        "host, slug, theme_slug, theme_json, features, status, tables, stripe_customer_portal_conf, maintenance_reason, maintenance_until, logo_url"
      )
      .eq("slug", normalizedSlug)
      .single();

    if (error || !data) {
      console.warn(
        `[Tenant Loader] No tenant found for slug: ${normalizedSlug}`,
        { correlationId }
      );

      return null;
    }

    const metadata: TenantMetadata = {
      host: data.host,
      slug: data.slug,
      theme_slug: data.theme_slug,
      theme_json: data.theme_json || {},
      features: data.features || {},
      status: data.status,
      tables: data.tables || {},
      stripe_customer_portal_conf: data.stripe_customer_portal_conf || {},
      maintenance_reason: data.maintenance_reason,
      maintenance_until: data.maintenance_until,
      logo_url: data.logo_url,
    };

    // Cache metadata (no secrets)
    metadataCache.set(normalizedSlug, {
      data: metadata,
      expires: Date.now() + CACHE_TTL,
    });

    logTenantContext(metadata, `${correlationId}-db-load`);

    return metadata;
  } catch (error) {
    console.error(
      `[Tenant Loader] Failed to load tenant for slug: ${normalizedSlug}`,
      {
        error: error instanceof Error ? error.message : "Unknown error",
        correlationId,
      }
    );

    return null;
  }
}

/**
 * Load tenant metadata by `host` column with caching (no secrets).
 * Mirror of `loadTenantMetadata`, but keyed on the real `tenants.host` value
 * instead of `slug` — trainer routes carry no slug in the URL, only
 * `TrainerSession.tenant_host`. Cached under a `host:` prefix so it can never
 * collide with the slug-keyed cache entries above.
 */
export async function loadTenantMetadataByHost(
  host: string
): Promise<TenantMetadata | null> {
  const normalizedHost = normalizeHost(host);
  const cacheKey = `host:${normalizedHost}`;
  const correlationId = `tenant-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Check cache first
  const cached = metadataCache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    logTenantContext(cached.data, `${correlationId}-cache-hit`);

    return cached.data;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("tenants")
      .select(
        "host, slug, theme_slug, theme_json, features, status, tables, stripe_customer_portal_conf, maintenance_reason, maintenance_until, logo_url"
      )
      .eq("host", normalizedHost)
      .single();

    if (error || !data) {
      console.warn(
        `[Tenant Loader] No tenant found for host: ${normalizedHost}`,
        { correlationId }
      );

      return null;
    }

    const metadata: TenantMetadata = {
      host: data.host,
      slug: data.slug,
      theme_slug: data.theme_slug,
      theme_json: data.theme_json || {},
      features: data.features || {},
      status: data.status,
      tables: data.tables || {},
      stripe_customer_portal_conf: data.stripe_customer_portal_conf || {},
      maintenance_reason: data.maintenance_reason,
      maintenance_until: data.maintenance_until,
      logo_url: data.logo_url,
    };

    // Cache metadata (no secrets)
    metadataCache.set(cacheKey, {
      data: metadata,
      expires: Date.now() + CACHE_TTL,
    });

    logTenantContext(metadata, `${correlationId}-db-load`);

    return metadata;
  } catch (error) {
    console.error(
      `[Tenant Loader] Failed to load tenant for host: ${normalizedHost}`,
      {
        error: error instanceof Error ? error.message : "Unknown error",
        correlationId,
      }
    );

    return null;
  }
}

// Airtable secret accessor removed - now using 100% Supabase architecture
// Future: Add other secret accessors here if needed (Stripe, etc.)

/**
 * Load complete tenant context by slug
 * Note: Parameter is named 'host' for backward compatibility, but receives slug values
 * Returns null for unknown/inactive tenants
 */
export async function loadTenantContext(
  host: string
): Promise<TenantContext | null> {
  const metadata = await loadTenantMetadata(host);

  if (!metadata) {
    return null;
  }

  return {
    ...metadata,
  };
}

/**
 * Get whitelisted domains from tenants table
 * Used for host validation in middleware
 */
export async function getWhitelistedDomains(): Promise<string[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("tenants")
      .select("host")
      .eq("status", "active");

    if (error) {
      console.error("[Domain Whitelist] Failed to load domains:", error);

      return [];
    }

    return data.map((row) => row.host);
  } catch (error) {
    console.error("[Domain Whitelist] Unexpected error:", error);

    return [];
  }
}

/**
 * Clear metadata cache for a specific slug (for testing/admin).
 * Clears both the slug-keyed entry (`loadTenantMetadata`) and the
 * `host:`-prefixed entry (`loadTenantMetadataByHost`) — a stale entry left
 * behind in the other cache key has bitten this repo before.
 */
export function clearTenantCache(host?: string): void {
  if (host) {
    const normalized = normalizeHost(host);

    metadataCache.delete(normalized);
    metadataCache.delete(`host:${normalized}`);
    console.log(`[Cache] Cleared cache for slug/host: ${normalized}`);
  } else {
    metadataCache.clear();
    console.log("[Cache] Cleared all tenant metadata cache");
  }
}

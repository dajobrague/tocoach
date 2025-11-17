/**
 * Tenant system types with security boundaries
 */

// Safe tenant metadata (can be cached, no secrets)
export interface TenantMetadata {
    host: string;
    slug: string;
    theme_slug: string;
    theme_json: Record<string, any>;
    features: Record<string, any>;
    status: "active" | "inactive";
    tables: Record<string, any>;
    stripe_customer_portal_conf: Record<string, any>;
    maintenance_reason?: string;
    maintenance_until?: string;
    logo_url?: string;
}

// Full tenant context (server-only)
export interface TenantContext extends TenantMetadata {
    // Future: add other server-only accessors here if needed
}

// Client-safe tenant info (absolutely no secrets or secret accessors)
export interface ClientTenantInfo {
    slug: string;
    theme_slug: string;
    theme_json?: Record<string, any>;
    features: Record<string, any>;
    status: "active" | "inactive";
    maintenance_reason?: string;
    maintenance_until?: string;
    logo_url?: string;
}

/**
 * Convert tenant context to client-safe info
 * SECURITY: Strips all sensitive data and secret accessors
 */
export function toClientSafe(context: TenantContext): ClientTenantInfo {
    return {
        slug: context.slug,
        theme_slug: context.theme_slug,
        theme_json: context.theme_json,
        features: context.features,
        status: context.status,
        maintenance_reason: context.maintenance_reason || '',
        maintenance_until: context.maintenance_until || '',
        logo_url: context.logo_url || '',
    };
}

/**
 * Type guard to ensure we never serialize secrets
 */
export function assertNoSecrets(obj: any): void {
    if (typeof obj !== "object" || obj === null) return;

    const dangerousKeys = [
        "decrypt",
        "apiKey",
        "secret",
        "key",
        "token",
        "password"
    ];

    const foundDangerous = dangerousKeys.filter(key =>
        key in obj ||
        (typeof obj[key] === "function")
    );

    if (foundDangerous.length > 0) {
        throw new Error(`Security violation: Found dangerous keys in client data: ${foundDangerous.join(", ")}`);
    }

    // Recursively check nested objects
    Object.values(obj).forEach(value => {
        if (typeof value === "object" && value !== null) {
            assertNoSecrets(value);
        }
    });
}

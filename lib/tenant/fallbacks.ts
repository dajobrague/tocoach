/**
 * Tenant fallback policies and error handling
 */

export const FALLBACK_THEME = "default";
export const FALLBACK_TENANT_SLUG = "default";

export interface FallbackContext {
    host: string;
    reason: "unknown_host" | "inactive_tenant" | "missing_theme" | "decryption_error";
    correlationId: string;
}

/**
 * Log fallback usage for monitoring
 */
export function logFallback(context: FallbackContext): void {
    console.warn(`[Tenant Fallback] Using default theme`, {
        host: context.host,
        reason: context.reason,
        correlationId: context.correlationId,
        fallbackTheme: FALLBACK_THEME,
    });
}

/**
 * Check if a theme folder exists
 */
export async function validateThemeExists(themeSlug: string): Promise<boolean> {
    try {
        const fs = await import("fs/promises");
        const path = await import("path");

        const themePath = path.join(process.cwd(), "public", "brands", themeSlug, "theme.json");
        await fs.access(themePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get safe theme slug with fallback validation
 */
export async function getSafeThemeSlug(
    requestedTheme: string,
    context: { host: string; correlationId: string }
): Promise<string> {
    // Check if requested theme exists
    const themeExists = await validateThemeExists(requestedTheme);

    if (!themeExists) {
        logFallback({
            host: context.host,
            reason: "missing_theme",
            correlationId: context.correlationId,
        });
        return FALLBACK_THEME;
    }

    return requestedTheme;
}

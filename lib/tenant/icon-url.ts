// lib/tenant/icon-url.ts
import { createHash } from "crypto";

/**
 * The PNG sizes emitted in the per-tenant manifest icons array.
 * 180 is intentionally absent — it's iOS-only and is set via
 * <link rel="apple-touch-icon"> in app/layout.tsx, not the manifest.
 */
export const TENANT_MANIFEST_ICON_SIZES = [
  72, 96, 128, 144, 152, 192, 384, 512,
] as const;

export type TenantIconSize = (typeof TENANT_MANIFEST_ICON_SIZES)[number];

/**
 * Sizes the dynamic endpoint will serve. Includes 180 (iOS apple-touch-icon).
 * Used for path-param validation in the route handler.
 */
export const TENANT_ICON_SERVED_SIZES = [
  72, 96, 128, 144, 152, 180, 192, 384, 512,
] as const;

export type ServedIconSize = (typeof TENANT_ICON_SERVED_SIZES)[number];

/**
 * The iOS apple-touch-icon dimension. Used by app/layout.tsx for the
 * <link rel="apple-touch-icon"> tag.
 */
export const APPLE_TOUCH_ICON_SIZE = 180 as const;

/**
 * Static fallback path served as apple-touch-icon when no tenant logo
 * applies (trainer/admin/root paths, or tenant without logo_url).
 */
export const DEFAULT_APPLE_TOUCH_ICON = "/icons/icon-180x180.png";

export function isServedIconSize(n: number): n is ServedIconSize {
  return (TENANT_ICON_SERVED_SIZES as readonly number[]).includes(n);
}

/**
 * Deterministic version hash that changes when any input to icon
 * rendering changes. Embedded as ?v=... in icon URLs to drive
 * CDN cache invalidation when a trainer updates their logo or
 * surface color.
 */
export function iconVersion(
  logoUrl: string | null | undefined,
  surfaceColor: string | null | undefined
): string {
  const inputs = `${logoUrl ?? "none"}|${surfaceColor ?? "none"}`;

  return createHash("sha1").update(inputs).digest("hex").slice(0, 10);
}

export function tenantIconUrl(
  slug: string,
  size: ServedIconSize,
  version: string
): string {
  return `/api/icons/${slug}/${size}.png?v=${version}`;
}

/**
 * Extracts the canvas background color from a tenant's theme_json.
 * Falls back to white when absent or invalid.
 */
export function resolveSurfaceColor(
  themeJson: { colors?: { surface?: { 1?: string } } } | null | undefined
): string {
  const candidate = themeJson?.colors?.surface?.["1"];

  if (
    typeof candidate === "string" &&
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(candidate)
  ) {
    return candidate;
  }

  return "#ffffff";
}

// lib/tenant/icon-url.ts
import { createHash } from "crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
 * Stable version string for the static TopCoach icons under
 * /public/icons. Computed once at module load by hashing the
 * canonical 512x512 PNG.
 *
 * All 9 sizes are regenerated together by
 * scripts/generate-topcoach-icons.mjs, so a change to the source
 * mark produces new bytes for icon-512x512.png and bumps this hash —
 * which then bumps every static icon URL we emit, prompting Chrome
 * (Android/desktop WebAPK) to refresh installed app icons on its
 * next manifest re-check without requiring a reinstall.
 *
 * iOS still won't refresh apple-touch-icon after install; that's a
 * platform limitation, not something we can solve with cache busting.
 */
function computeTopcoachIconVersion(): string {
  try {
    // Read as hex string to sidestep cross-version Buffer/Uint8Array
    // typing friction with crypto.createHash().update(...).
    const data = readFileSync(
      join(process.cwd(), "public", "icons", "icon-512x512.png"),
      "hex"
    );

    return createHash("sha1").update(data, "hex").digest("hex").slice(0, 10);
  } catch {
    return "v1";
  }
}

export const TOPCOACH_ICON_VERSION = computeTopcoachIconVersion();

/**
 * URL for a static TopCoach icon, content-versioned via ?v=.
 * Used in /public/manifest.json (root), /trainer/manifest.json, and
 * as the default apple-touch-icon in app/layout.tsx.
 */
export function topcoachIconUrl(size: number): string {
  return `/icons/icon-${size}x${size}.png?v=${TOPCOACH_ICON_VERSION}`;
}

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

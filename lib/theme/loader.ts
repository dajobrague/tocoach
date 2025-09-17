// Runtime theme loading and management
"use client";

import { ThemeConfig, validateTheme, defaultTheme } from "./schema";
import {
  validateThemeContrast,
  logContrastViolations,
  generateFocusColor,
} from "./contrast";

// Theme cache to avoid repeated fetches
const themeCache = new Map<string, ThemeConfig>();

// Available brand slugs
export const AVAILABLE_BRANDS = ["default", "ironfit", "zen-coach"] as const;
export type BrandSlug = (typeof AVAILABLE_BRANDS)[number];

// Validate brand slug
export function isValidBrandSlug(slug: string): slug is BrandSlug {
  return AVAILABLE_BRANDS.includes(slug as BrandSlug);
}

// Extract brand slug from URL (supports ?brand=slug and /b/slug patterns)
export function getBrandSlugFromUrl(): BrandSlug {
  if (typeof window === "undefined") return "default";

  // Check query parameter first
  const urlParams = new URLSearchParams(window.location.search);
  const brandParam = urlParams.get("brand");

  if (brandParam && isValidBrandSlug(brandParam)) {
    return brandParam;
  }

  // Check route pattern /b/{slug}
  const pathMatch = window.location.pathname.match(/^\/b\/([^\/]+)/);

  if (pathMatch && pathMatch[1] && isValidBrandSlug(pathMatch[1])) {
    return pathMatch[1];
  }

  return "default";
}

// Load theme configuration from brand directory
export async function loadThemeConfig(
  brandSlug: BrandSlug
): Promise<ThemeConfig> {
  // Check cache first
  if (themeCache.has(brandSlug)) {
    return themeCache.get(brandSlug)!;
  }

  try {
    const response = await fetch(`/brands/${brandSlug}/theme.json`, {
      cache: "no-store", // Always fetch fresh for Phase 2
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const rawData = await response.json();
    const validation = validateTheme(rawData, brandSlug);

    if (!validation.success) {
      console.warn(
        `[Theme] Validation failed for brand "${brandSlug}":`,
        validation.errors
      );
      console.warn(`[Theme] Falling back to default theme`);

      return defaultTheme;
    }

    let theme = validation.data;

    // Validate contrast and apply corrections if needed
    const contrastResult = validateThemeContrast(theme.colors);

    if (!contrastResult.isValid) {
      logContrastViolations(brandSlug, contrastResult);

      // Apply corrections
      Object.entries(contrastResult.corrections).forEach(([key, value]) => {
        const keyPath = key.split(".");

        if (keyPath.length === 2 && keyPath[0] === "text") {
          const textKey = keyPath[1] as keyof typeof theme.colors.text;

          if (textKey in theme.colors.text) {
            (theme.colors.text as any)[textKey] = value;
          }
        }
      });
    }

    // Cache the validated and corrected theme
    themeCache.set(brandSlug, theme);

    return theme;
  } catch (error) {
    console.error(
      `[Theme] Failed to load theme for brand "${brandSlug}":`,
      error
    );
    console.warn(`[Theme] Falling back to default theme`);

    // Cache the default theme for this brand to avoid repeated failures
    themeCache.set(brandSlug, defaultTheme);

    return defaultTheme;
  }
}

// Generate CSS variables from theme configuration
export function generateCSSVariables(
  theme: ThemeConfig
): Record<string, string> {
  const variables: Record<string, string> = {};

  // Colors
  variables["--color-brand"] = theme.colors.brand;
  variables["--color-accent"] = theme.colors.accent;
  variables["--color-text-primary"] = theme.colors.text.primary;
  variables["--color-text-secondary"] = theme.colors.text.secondary;
  variables["--color-surface-1"] = theme.colors.surface["1"];
  variables["--color-surface-2"] = theme.colors.surface["2"];
  variables["--color-border"] = theme.colors.border;
  variables["--color-fill"] = theme.colors.fill;

  // Semantic colors
  if (theme.semantic) {
    variables["--color-success"] = theme.semantic.success;
    variables["--color-warning"] = theme.semantic.warning;
    variables["--color-error"] = theme.semantic.error;
  }

  // Focus color (derived from accent)
  variables["--color-focus"] = generateFocusColor(
    theme.colors.accent,
    theme.colors.surface["1"]
  );

  // Typography
  variables["--font-heading"] = theme.fonts.heading.family;
  variables["--font-body"] = theme.fonts.body.family;
  variables["--font-weight-heading"] = theme.fonts.heading.weight.toString();
  variables["--font-weight-body"] = theme.fonts.body.weight.toString();

  // Radius
  variables["--radius-sm"] = `${theme.radius.sm}px`;
  variables["--radius-md"] = `${theme.radius.md}px`;
  variables["--radius-lg"] = `${theme.radius.lg}px`;
  variables["--radius-xl"] = `${theme.radius.xl}px`;

  // Shadows
  variables["--shadow-e1"] = theme.shadow.e1;
  variables["--shadow-e2"] = theme.shadow.e2;

  return variables;
}

// Apply CSS variables to the document root
export function applyCSSVariables(variables: Record<string, string>): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  Object.entries(variables).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
}

// Main theme application function
export async function applyTheme(brandSlug: BrandSlug): Promise<ThemeConfig> {
  const startTime = performance.now();

  try {
    const theme = await loadThemeConfig(brandSlug);
    const variables = generateCSSVariables(theme);

    applyCSSVariables(variables);

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(
      `[Theme] Applied "${theme.meta.name}" theme in ${duration.toFixed(1)}ms`
    );

    // Warn if performance is slow
    if (duration > 100) {
      console.warn(
        `[Theme] Theme application took ${duration.toFixed(1)}ms (>100ms target)`
      );
    }

    return theme;
  } catch (error) {
    console.error("[Theme] Failed to apply theme:", error);
    throw error;
  }
}

// Clear theme cache (useful for development)
export function clearThemeCache(): void {
  themeCache.clear();
  console.log("[Theme] Cache cleared");
}

// Get current theme from cache
export function getCurrentTheme(brandSlug: BrandSlug): ThemeConfig | null {
  return themeCache.get(brandSlug) || null;
}

// Preload themes (useful for performance)
export async function preloadThemes(
  brandSlugs: readonly BrandSlug[] = AVAILABLE_BRANDS
): Promise<void> {
  const promises = brandSlugs.map((slug) => loadThemeConfig(slug));

  await Promise.allSettled(promises);
  console.log(`[Theme] Preloaded ${brandSlugs.length} themes`);
}

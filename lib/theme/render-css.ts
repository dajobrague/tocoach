// Generación server-side del CSS de tema para tenants con theme en DB.
//
// Código movido VERBATIM desde app/brands/db/[slug]/styles.css/route.ts para
// que el root layout pueda inyectar el MISMO CSS inline en <head> (el layout
// ya tiene el tenantContext en memoria — el request extra a /brands/db era
// una cadena render-blocking de 3 saltos con cache de 60s y sin CDN). La
// ruta sigue existiendo y sirve este mismo módulo: es la red de seguridad y
// el fallback del layout cuando la generación inline falla.

import type { TenantContext, TenantMetadata } from "@/lib/tenant/types";
import type { ThemeConfig } from "@/lib/theme/schema";

import {
  generateHeroUIColorScale,
  hexToHeroUIHSL,
  pickForegroundHSL,
} from "@/lib/theme/color-utils";
import { defaultTheme, validateTheme } from "@/lib/theme/schema";

/**
 * Valida el theme_json de un tenant ya cargado (mismas reglas y fallbacks
 * que loadThemeFromDatabase en la ruta /brands/db, pero sin re-consultar).
 */
export function resolveTenantTheme(
  tenantContext: Pick<TenantContext, "theme_json" | "theme_slug"> | null,
  host: string
): ThemeConfig {
  if (!tenantContext) return defaultTheme;

  const validation = validateTheme(
    tenantContext.theme_json,
    tenantContext.theme_slug
  );

  if (!validation.success) {
    console.warn(
      `[CSS Gen DB] Theme validation failed for ${host}:`,
      validation.errors
    );

    return defaultTheme;
  }

  return validation.data;
}

// Build a Google Fonts @import URL for the heading & body fonts
export function buildGoogleFontsImport(theme: ThemeConfig): string {
  const headingWeight = theme.fonts.heading.weight;
  const bodyWeight = theme.fonts.body.weight;

  // System fonts that don't need loading from Google
  const systemFonts = new Set([
    "system-ui",
    "sans-serif",
    "serif",
    "monospace",
    "Arial",
    "Helvetica",
    "Times New Roman",
    "Georgia",
    "Verdana",
    "Courier New",
  ]);

  // Strip CSS fallbacks like "Inter, system-ui, sans-serif" → "Inter"
  const extractPrimary = (f: string) => (f.split(",")[0] ?? f).trim();

  const hPrimary = extractPrimary(theme.fonts.heading.family);
  const bPrimary = extractPrimary(theme.fonts.body.family);

  const families: string[] = [];

  if (!systemFonts.has(hPrimary)) {
    const weights = new Set([400, 500, 600, 700, headingWeight]);
    const encoded = hPrimary.replace(/ /g, "+");

    families.push(
      `family=${encoded}:wght@${[...weights].sort((a, b) => a - b).join(";")}`
    );
  }

  if (!systemFonts.has(bPrimary) && bPrimary !== hPrimary) {
    const weights = new Set([300, 400, 500, 600, 700, bodyWeight]);
    const encoded = bPrimary.replace(/ /g, "+");

    families.push(
      `family=${encoded}:wght@${[...weights].sort((a, b) => a - b).join(";")}`
    );
  }

  if (families.length === 0) return "";

  return `@import url('https://fonts.googleapis.com/css2?${families.join("&")}&display=swap');`;
}

// Format a font-family value for CSS (add quotes and system fallback)
export function cssFontFamily(raw: string): string {
  // If it already has fallbacks like "Inter, system-ui, sans-serif", quote the primary
  const parts = raw.split(",").map((p) => p.trim());
  const primary = (parts[0] ?? raw).replace(/['"]/g, "");
  // If it has spaces, wrap in quotes
  const quoted = primary.includes(" ") ? `'${primary}'` : primary;
  // Add system fallbacks if not already present
  const hasFallback = parts.length > 1;

  return hasFallback
    ? `${quoted}, ${parts.slice(1).join(", ")}`
    : `${quoted}, system-ui, sans-serif`;
}

// Generate complete CSS for a theme (same as file-based version)
export function generateThemeCSS(
  theme: ThemeConfig,
  opts?: { scope?: string }
): string {
  const fontsImport = buildGoogleFontsImport(theme);
  const headingFontCSS = cssFontFamily(theme.fonts.heading.family);
  const bodyFontCSS = cssFontFamily(theme.fonts.body.family);
  const sel = opts?.scope ?? "html.light,\nhtml:not(.dark)";
  const prefix = opts?.scope ? `${opts.scope} ` : "html ";

  const css = `
${fontsImport}
/* Generated theme CSS for ${theme.meta.name} */
:root {
  /* Custom theme variables */
  --color-brand: ${theme.colors.brand};
  --color-accent: ${theme.colors.accent};
  --color-text-primary: ${theme.colors.text.primary};
  --color-text-secondary: ${theme.colors.text.secondary};
  --color-surface-1: ${theme.colors.surface["1"]};
  --color-surface-2: ${theme.colors.surface["2"]};
  --color-border: ${theme.colors.border};
  --color-fill: ${theme.colors.fill};
  --color-success: ${theme.semantic?.success || "#22c55e"};
  --color-warning: ${theme.semantic?.warning || "#f59e0b"};
  --color-error: ${theme.semantic?.error || "#ef4444"};

  /* Typography */
  --font-heading: ${headingFontCSS};
  --font-body: ${bodyFontCSS};
  --font-weight-heading: ${theme.fonts.heading.weight};
  --font-weight-body: ${theme.fonts.body.weight};

  /* Layout */
  --radius-sm: ${theme.radius.sm}px;
  --radius-md: ${theme.radius.md}px;
  --radius-lg: ${theme.radius.lg}px;
  --radius-xl: ${theme.radius.xl}px;
  --shadow-e1: ${theme.shadow.e1};
  --shadow-e2: ${theme.shadow.e2};
}

/* Target HeroUI's light theme class and default (no class) */
${sel} {
  /* HeroUI Primary Color Override - HSL Format */
  --heroui-primary: ${hexToHeroUIHSL(theme.colors.brand)} !important;
  --heroui-primary-50: ${generateHeroUIColorScale(theme.colors.brand)["50"]} !important;
  --heroui-primary-100: ${generateHeroUIColorScale(theme.colors.brand)["100"]} !important;
  --heroui-primary-200: ${generateHeroUIColorScale(theme.colors.brand)["200"]} !important;
  --heroui-primary-300: ${generateHeroUIColorScale(theme.colors.brand)["300"]} !important;
  --heroui-primary-400: ${generateHeroUIColorScale(theme.colors.brand)["400"]} !important;
  --heroui-primary-500: ${generateHeroUIColorScale(theme.colors.brand)["500"]} !important;
  --heroui-primary-600: ${generateHeroUIColorScale(theme.colors.brand)["600"]} !important;
  --heroui-primary-700: ${generateHeroUIColorScale(theme.colors.brand)["700"]} !important;
  --heroui-primary-800: ${generateHeroUIColorScale(theme.colors.brand)["800"]} !important;
  --heroui-primary-900: ${generateHeroUIColorScale(theme.colors.brand)["900"]} !important;
  --heroui-primary-foreground: ${pickForegroundHSL(theme.colors.brand)} !important;

  /* HeroUI Secondary Color Override - HSL Format */
  --heroui-secondary: ${hexToHeroUIHSL(theme.colors.accent)} !important;
  --heroui-secondary-50: ${generateHeroUIColorScale(theme.colors.accent)["50"]} !important;
  --heroui-secondary-100: ${generateHeroUIColorScale(theme.colors.accent)["100"]} !important;
  --heroui-secondary-200: ${generateHeroUIColorScale(theme.colors.accent)["200"]} !important;
  --heroui-secondary-300: ${generateHeroUIColorScale(theme.colors.accent)["300"]} !important;
  --heroui-secondary-400: ${generateHeroUIColorScale(theme.colors.accent)["400"]} !important;
  --heroui-secondary-500: ${generateHeroUIColorScale(theme.colors.accent)["500"]} !important;
  --heroui-secondary-600: ${generateHeroUIColorScale(theme.colors.accent)["600"]} !important;
  --heroui-secondary-700: ${generateHeroUIColorScale(theme.colors.accent)["700"]} !important;
  --heroui-secondary-800: ${generateHeroUIColorScale(theme.colors.accent)["800"]} !important;
  --heroui-secondary-900: ${generateHeroUIColorScale(theme.colors.accent)["900"]} !important;
  --heroui-secondary-foreground: ${pickForegroundHSL(theme.colors.accent)} !important;

  /* HeroUI Default/Neutral Colors - HSL Format */
  --heroui-default: ${hexToHeroUIHSL(theme.colors.surface["2"])} !important;
  --heroui-default-50: ${hexToHeroUIHSL(theme.colors.surface["2"])} !important;
  --heroui-default-100: ${hexToHeroUIHSL(theme.colors.surface["2"])} !important;
  --heroui-default-200: ${hexToHeroUIHSL(theme.colors.fill)} !important;
  --heroui-default-300: ${hexToHeroUIHSL(theme.colors.border)} !important;
  --heroui-default-400: ${hexToHeroUIHSL(theme.colors.border)} !important;
  --heroui-default-500: ${hexToHeroUIHSL(theme.colors.text.secondary)} !important;
  --heroui-default-600: ${hexToHeroUIHSL(theme.colors.text.secondary)} !important;
  --heroui-default-700: ${hexToHeroUIHSL(theme.colors.text.primary)} !important;
  --heroui-default-800: ${hexToHeroUIHSL(theme.colors.text.primary)} !important;
  --heroui-default-900: ${hexToHeroUIHSL(theme.colors.text.primary)} !important;
  --heroui-default-foreground: ${hexToHeroUIHSL(theme.colors.text.primary)} !important;

  /* HeroUI Background System - HSL Format */
  --heroui-background: ${hexToHeroUIHSL(theme.colors.surface["1"])} !important;
  --heroui-foreground: ${hexToHeroUIHSL(theme.colors.text.primary)} !important;
  --heroui-content1: ${hexToHeroUIHSL(theme.colors.surface["1"])} !important;
  --heroui-content2: ${hexToHeroUIHSL(theme.colors.surface["2"])} !important;
  --heroui-content3: ${hexToHeroUIHSL(theme.colors.fill)} !important;
  --heroui-content4: ${hexToHeroUIHSL(theme.colors.border)} !important;

  /* HeroUI Semantic Colors - HSL Format */
  --heroui-success: ${hexToHeroUIHSL(theme.semantic?.success || "#22c55e")} !important;
  --heroui-success-foreground: 0 0% 100% !important;
  --heroui-warning: ${hexToHeroUIHSL(theme.semantic?.warning || "#f59e0b")} !important;
  --heroui-warning-foreground: 0 0% 100% !important;
  --heroui-danger: ${hexToHeroUIHSL(theme.semantic?.error || "#ef4444")} !important;
  --heroui-danger-foreground: 0 0% 100% !important;

  /* HeroUI Focus */
  --heroui-focus: ${hexToHeroUIHSL(theme.colors.accent)} !important;

  /* HeroUI Layout */
  --heroui-radius-small: ${theme.radius.sm}px !important;
  --heroui-radius-medium: ${theme.radius.md}px !important;
  --heroui-radius-large: ${theme.radius.lg}px !important;
  --heroui-box-shadow-small: ${theme.shadow.e1} !important;
  --heroui-box-shadow-medium: ${theme.shadow.e2} !important;
  --heroui-box-shadow-large: ${theme.shadow.e2} !important;
}

/* Ultra high specificity HeroUI component overrides */
${prefix}body .bg-primary,
${prefix}body [data-slot="base"].bg-primary,
${prefix}body button.bg-primary,
${prefix}body [data-color="primary"],
${prefix}body .heroui-button[data-color="primary"],
${prefix}body *[class*="bg-primary"] {
  background-color: ${theme.colors.brand} !important;
}

${prefix}.text-primary-foreground,
${prefix}[data-slot="base"].text-primary-foreground,
${prefix}button.text-primary-foreground {
  color: #ffffff !important;
}

${prefix}.bg-secondary,
${prefix}[data-slot="base"].bg-secondary,
${prefix}button.bg-secondary,
${prefix}[data-color="secondary"],
${prefix}.heroui-button[data-color="secondary"],
${prefix}*[class*="bg-secondary"] {
  background-color: ${theme.colors.accent} !important;
}

${prefix}.text-secondary-foreground,
${prefix}[data-slot="base"].text-secondary-foreground,
${prefix}button.text-secondary-foreground {
  color: #ffffff !important;
}

${prefix}.bg-default,
${prefix}[data-slot="base"].bg-default,
${prefix}button.bg-default,
${prefix}[data-color="default"],
${prefix}.heroui-button[data-color="default"],
${prefix}*[class*="bg-default"] {
  background-color: ${theme.colors.surface["2"]} !important;
}

${prefix}.text-default-foreground,
${prefix}[data-slot="base"].text-default-foreground {
  color: ${theme.colors.text.primary} !important;
}

${prefix}.bg-default-100 {
  background-color: ${theme.colors.surface["2"]} !important;
}

${prefix}.bg-default-200 {
  background-color: ${theme.colors.fill} !important;
}

${prefix}.text-default-600 {
  color: ${theme.colors.text.secondary} !important;
}

${prefix}.border-default {
  border-color: ${theme.colors.border} !important;
}

${prefix}.text-foreground {
  color: ${theme.colors.text.primary} !important;
}

${prefix}.text-primary {
  color: ${theme.colors.brand} !important;
}

${prefix}.text-secondary {
  color: ${theme.colors.text.secondary} !important;
}

/* Custom utility classes */
.bg-brand { background-color: ${theme.colors.brand} !important; }
.bg-accent { background-color: ${theme.colors.accent} !important; }
.text-brand { color: ${theme.colors.brand} !important; }
.text-accent { color: ${theme.colors.accent} !important; }

/* Font family overrides */
.font-heading {
  font-family: ${headingFontCSS} !important;
  font-weight: ${theme.fonts.heading.weight} !important;
}
.font-body {
  font-family: ${bodyFontCSS} !important;
  font-weight: ${theme.fonts.body.weight} !important;
}

/* HeroUI Component Font Overrides */
${prefix}body button,
${prefix}body .heroui-button,
${prefix}body [data-slot="base"],
${prefix}body input,
${prefix}body textarea,
${prefix}body .heroui-input input,
${prefix}body .heroui-textarea textarea,
${prefix}body .heroui-chip,
${prefix}body .heroui-chip span,
${prefix}body [role="button"],
${prefix}body .heroui-navbar-item,
${prefix}body .heroui-link {
  font-family: ${bodyFontCSS} !important;
  font-weight: ${theme.fonts.body.weight} !important;
}

/* Body background uses theme surface color */
body {
  background: ${theme.colors.surface["1"]} !important;
}
`;

  return css.trim();
}

/**
 * CSS de tema listo para inyectar inline en <head>. Devuelve null cuando no
 * debe inyectarse (tema inválido cae a defaultTheme igual que la ruta, pero
 * un CSS que contenga "<" — imposible con temas legítimos — se rechaza para
 * que jamás pueda romper el contexto HTML del <style>; el caller cae al
 * <link> clásico).
 */
export function renderInlineThemeCSS(
  tenantContext: Pick<TenantContext, "theme_json" | "theme_slug"> | null,
  host: string
): string | null {
  try {
    const theme = resolveTenantTheme(tenantContext, host);
    const css = generateThemeCSS(theme);

    if (css.includes("<")) {
      console.warn(
        `[CSS Gen DB] Inline theme CSS for ${host} contained "<" — falling back to linked stylesheet`
      );

      return null;
    }

    return css;
  } catch (error) {
    console.error(
      `[CSS Gen DB] Inline theme CSS generation failed for ${host}:`,
      error
    );

    return null;
  }
}

/**
 * CSS de tema scoped a `.trainer-app`, listo para inyectar inline en <head>
 * del shell de trainer. Espejo de `renderInlineThemeCSS` (misma validación
 * y guard de "<") pero generando con `{ scope: ".trainer-app" }` para que
 * los overrides no se filtren fuera del wrapper del trainer.
 */
export function renderTrainerThemeCSS(context: TenantMetadata): string | null {
  try {
    const theme = resolveTenantTheme(context, context.host);
    const css = generateThemeCSS(theme, { scope: ".trainer-app" });

    if (css.includes("<")) {
      console.warn(
        `[CSS Gen DB] Trainer theme CSS for ${context.host} contained "<" — falling back to linked stylesheet`
      );

      return null;
    }

    return css;
  } catch (error) {
    console.error(
      `[CSS Gen DB] Trainer theme CSS generation failed for ${context.host}:`,
      error
    );

    return null;
  }
}

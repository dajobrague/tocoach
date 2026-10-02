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
import { brandInk, resolveClientSurface } from "@/lib/theme/client-surface";
import { healThemeJson } from "@/lib/theme/heal";
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

  // Sanear ANTES de validar: un theme_json legacy (forma parcial) hacía
  // fallar el schema y el tenant perdía su marca entera en silencio (caía al
  // default azul). El healer conserva todo lo válido y solo rellena huecos.
  const validation = validateTheme(
    healThemeJson(tenantContext.theme_json),
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
//
// Dos modos:
// - Sin scope (portal de clientes): variables en html/:root global. Como el
//   trainer, SIN overrides por substring (aplanaban cada tint/hover a un
//   sólido — el origen de las "pastillas menta" y los bloques de marca). La
//   escala neutra se deriva con contraste garantizado (client-surface.ts).
// - Con scope (p. ej. ".trainer-app"): SOLO variables. Los overrides de
//   clase por substring (*[class*="bg-primary"], etc.) aplanaban cada
//   tint/hover/variant a un sólido — con la hoja de marca default fuera de
//   /trainer (app/layout.tsx), las variables HeroUI bastan y los variants
//   light/flat/ghost y los alpha tints (bg-primary/20) vuelven a funcionar.
//   Los portals de HeroUI (modal/popover/dropdown montan en document.body,
//   FUERA del scope) reciben las variables vía body:has(scope), emitido como
//   bloque separado — un parser sin :has() invalida una lista con coma
//   ENTERA y perdería también el bloque base del scope.
/** Superficies neutras del shell de trainer (escala zinc de HeroUI light).
 *  El tenant aporta el ACENTO — primary, secondary, focus —, nunca el lienzo:
 *  varios temas de producción traen `surface.1` oscuro y el trainer app no
 *  está diseñado para dark, así que heredarlo lo dejaba ilegible. El portal de
 *  cliente (modo sin scope) conserva el comportamiento histórico. */
const TRAINER_SURFACES = {
  background: "#FFFFFF",
  foreground: "#11181C",
  content1: "#FFFFFF",
  content2: "#F4F4F5",
  content3: "#E4E4E7",
  content4: "#D4D4D8",
  default: "#F4F4F5",
  default50: "#FAFAFA",
  default100: "#F4F4F5",
  default200: "#E4E4E7",
  default300: "#D4D4D8",
  default400: "#A1A1AA",
  default500: "#71717A",
  default600: "#52525B",
  default700: "#3F3F46",
  default800: "#27272A",
  default900: "#18181B",
} as const;

export function generateThemeCSS(
  theme: ThemeConfig,
  opts?: { scope?: string }
): string {
  const fontsImport = buildGoogleFontsImport(theme);
  const headingFontCSS = cssFontFamily(theme.fonts.heading.family);
  const bodyFontCSS = cssFontFamily(theme.fonts.body.family);
  const scope = opts?.scope;
  // Prefijo para las utilidades custom (.bg-brand, .font-heading, …): sin
  // scope quedan globales como siempre; con scope no se filtran fuera.
  const utilPrefix = scope ? `${scope} ` : "";

  // El tenant nunca pinta el lienzo del trainer: solo el acento.
  const surface = scope
    ? {
        default: TRAINER_SURFACES.default,
        d50: TRAINER_SURFACES.default50,
        d100: TRAINER_SURFACES.default100,
        d200: TRAINER_SURFACES.default200,
        d300: TRAINER_SURFACES.default300,
        d400: TRAINER_SURFACES.default400,
        d500: TRAINER_SURFACES.default500,
        d600: TRAINER_SURFACES.default600,
        d700: TRAINER_SURFACES.default700,
        d800: TRAINER_SURFACES.default800,
        d900: TRAINER_SURFACES.default900,
        dFg: TRAINER_SURFACES.foreground,
        background: TRAINER_SURFACES.background,
        foreground: TRAINER_SURFACES.foreground,
        c1: TRAINER_SURFACES.content1,
        c2: TRAINER_SURFACES.content2,
        c3: TRAINER_SURFACES.content3,
        c4: TRAINER_SURFACES.content4,
      }
    : resolveClientSurface(theme.colors);
  const ink = scope
    ? theme.colors.brand
    : brandInk(theme.colors.brand, surface.background, surface.foreground);
  const successHex = theme.semantic?.success || "#22c55e";
  const warningHex = theme.semantic?.warning || "#f59e0b";
  const errorHex = theme.semantic?.error || "#ef4444";

  const customVars = `  /* Custom theme variables */
  --color-brand: ${theme.colors.brand};
  --color-accent: ${theme.colors.accent};
  --color-text-primary: ${surface.foreground};
  --color-text-secondary: ${surface.d500};
  --color-surface-1: ${surface.background};
  --color-surface-2: ${surface.c2};
  --color-border: ${surface.d300};
  --color-fill: ${surface.d200};
  --color-success: ${successHex};
  --color-warning: ${warningHex};
  --color-error: ${errorHex};
  /* Anillo de foco global (globals.css) con la marca del entrenador; antes
     se quedaba en el azul por defecto en todos los tenants. */
  --color-focus: hsl(${hexToHeroUIHSL(theme.colors.brand)} / 0.5);

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
  --shadow-e2: ${theme.shadow.e2};`;

  const surfaceVars = `  --heroui-default: ${hexToHeroUIHSL(surface.default)} !important;
  --heroui-default-50: ${hexToHeroUIHSL(surface.d50)} !important;
  --heroui-default-100: ${hexToHeroUIHSL(surface.d100)} !important;
  --heroui-default-200: ${hexToHeroUIHSL(surface.d200)} !important;
  --heroui-default-300: ${hexToHeroUIHSL(surface.d300)} !important;
  --heroui-default-400: ${hexToHeroUIHSL(surface.d400)} !important;
  --heroui-default-500: ${hexToHeroUIHSL(surface.d500)} !important;
  --heroui-default-600: ${hexToHeroUIHSL(surface.d600)} !important;
  --heroui-default-700: ${hexToHeroUIHSL(surface.d700)} !important;
  --heroui-default-800: ${hexToHeroUIHSL(surface.d800)} !important;
  --heroui-default-900: ${hexToHeroUIHSL(surface.d900)} !important;
  --heroui-default-foreground: ${hexToHeroUIHSL(surface.dFg)} !important;

  --heroui-background: ${hexToHeroUIHSL(surface.background)} !important;
  --heroui-foreground: ${hexToHeroUIHSL(surface.foreground)} !important;
  --heroui-content1: ${hexToHeroUIHSL(surface.c1)} !important;
  --heroui-content2: ${hexToHeroUIHSL(surface.c2)} !important;
  --heroui-content3: ${hexToHeroUIHSL(surface.c3)} !important;
  --heroui-content4: ${hexToHeroUIHSL(surface.c4)} !important;`;

  const herouiVars = `  /* HeroUI Primary Color Override - HSL Format */
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

  /* HeroUI Default/Neutral Colors + Background System - HSL Format.
     Con scope (trainer) las superficies son neutras: ver TRAINER_SURFACES. */
${surfaceVars}

  /* HeroUI Semantic Colors - HSL Format */
  --heroui-success: ${hexToHeroUIHSL(successHex)} !important;
  --heroui-success-foreground: ${pickForegroundHSL(successHex)} !important;
  --heroui-warning: ${hexToHeroUIHSL(warningHex)} !important;
  --heroui-warning-foreground: ${pickForegroundHSL(warningHex)} !important;
  --heroui-danger: ${hexToHeroUIHSL(errorHex)} !important;
  --heroui-danger-foreground: ${pickForegroundHSL(errorHex)} !important;

  /* HeroUI Focus */
  --heroui-focus: ${hexToHeroUIHSL(theme.colors.accent)} !important;

  /* HeroUI Layout */
  --heroui-radius-small: ${theme.radius.sm}px !important;
  --heroui-radius-medium: ${theme.radius.md}px !important;
  --heroui-radius-large: ${theme.radius.lg}px !important;
  --heroui-box-shadow-small: ${theme.shadow.e1} !important;
  --heroui-box-shadow-medium: ${theme.shadow.e2} !important;
  --heroui-box-shadow-large: ${theme.shadow.e2} !important;`;

  const herouiVarsBlock = scope
    ? `${scope} {
${herouiVars}
}

body:has(${scope}) {
${herouiVars}
}`
    : `html.light,
html:not(.dark) {
${herouiVars}
}`;

  // Texto de marca: solo cuando la marca cruda no llega a 4.5:1 sobre el
  // lienzo (lima/amarillo/pastel). Selector exacto, sin !important: al no
  // estar en @layer gana a la utilidad de Tailwind igualmente, y los
  // rellenos (bg-primary) siguen con la marca cruda.
  const inkRule =
    !scope && ink !== theme.colors.brand
      ? `

html .text-primary {
  color: ${ink};
}`
      : "";

  // Fuentes: una sola regla ligera en la raíz (body del portal, o el scope
  // del trainer) — el preflight de Tailwind da font-family: inherit a los
  // form controls, así que buttons e inputs la heredan sin !important y
  // font-medium/font-semibold sobreviven. El bloque histórico por control
  // forzaba el peso de cuerpo en botones/chips y obligó a ~35 estilos inline.
  const fontRules = scope
    ? `/* Fuente base del shell (los form controls heredan via preflight) */
${scope} {
  font-family: ${bodyFontCSS};
}

body:has(${scope}) {
  font-family: ${bodyFontCSS};
}`
    : `/* Fuente de cuerpo del tenant en todo el portal (antes solo llegaba a
   botones/chips; el resto del texto quedaba en la Inter de la app) */
html body {
  font-family: ${bodyFontCSS};
  font-weight: ${theme.fonts.body.weight};
}`;

  const css = `
${fontsImport}
/* Generated theme CSS for ${theme.meta.name} */
${scope ?? ":root"} {
${customVars}
}

/* Target HeroUI's light theme class and default (no class) */
${herouiVarsBlock}${inkRule}

/* Custom utility classes */
${utilPrefix}.bg-brand { background-color: ${theme.colors.brand} !important; }
${utilPrefix}.bg-accent { background-color: ${theme.colors.accent} !important; }
${utilPrefix}.text-brand { color: ${theme.colors.brand} !important; }
${utilPrefix}.text-accent { color: ${theme.colors.accent} !important; }

/* Font family overrides */
${utilPrefix}.font-heading {
  font-family: ${headingFontCSS} !important;
  font-weight: ${theme.fonts.heading.weight} !important;
}
${utilPrefix}.font-body {
  font-family: ${bodyFontCSS} !important;${
    scope ? `\n  font-weight: ${theme.fonts.body.weight} !important;` : ""
  }
}

${fontRules}

/* Fondo del body. En el portal de cliente lo pinta el tema del tenant; en el
   trainer se fuerza el lienzo neutro, porque esta regla es global y con
   !important: un surface.1 oscuro teñía la app entera. */
${
  scope
    ? `body:has(${scope}) {
  background: ${TRAINER_SURFACES.background} !important;
}`
    : `body {
  background: ${surface.background} !important;
}`
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

// Fallback monocromo del shell de trainer (login/register o sesión sin
// tenant): el bloque slate histórico, intacto. HeroUI resuelve --heroui-*
// dentro de hsl(), así que los valores DEBEN ser triples HSL (RGB aquí
// produjo marrón — no repetir).
const TRAINER_FALLBACK_VARS = `    --heroui-primary-50: 210 40% 98% !important;
    --heroui-primary-100: 210 40% 96% !important;
    --heroui-primary-200: 214 32% 91% !important;
    --heroui-primary-300: 213 27% 84% !important;
    --heroui-primary-400: 215 20% 65% !important;
    --heroui-primary-500: 215 16% 47% !important;
    --heroui-primary-600: 215 19% 35% !important;
    --heroui-primary-700: 215 25% 27% !important;
    --heroui-primary-800: 217 33% 18% !important;
    --heroui-primary-900: 222 47% 11% !important;
    --heroui-primary: 222 47% 11% !important;
    --heroui-primary-foreground: 0 0% 100% !important;`;

// Dos bloques con el mismo cuerpo (no una lista con coma): un parser sin
// :has() invalidaría la lista ENTERA y perdería también .trainer-app. El
// bloque body:has(...) alcanza los portals de HeroUI (modal/popover/
// dropdown), que montan en document.body fuera del wrapper.
export const TRAINER_FALLBACK_CSS = `
  .trainer-app {
${TRAINER_FALLBACK_VARS}
  }

  body:has(.trainer-app) {
${TRAINER_FALLBACK_VARS}
  }
`;

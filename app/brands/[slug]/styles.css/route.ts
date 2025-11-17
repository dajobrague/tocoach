// Server-side CSS generation for brand themes
import { generateHeroUIColorScale, hexToHeroUIHSL } from "@/lib/theme/color-utils";
import type { ThemeConfig } from "@/lib/theme/schema";
import { defaultTheme, validateTheme } from "@/lib/theme/schema";
import { readFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { join } from "path";

// Available brand slugs
const AVAILABLE_BRANDS = ["default", "ironfit", "zen-coach"] as const;
type BrandSlug = (typeof AVAILABLE_BRANDS)[number];

function isValidBrandSlug(slug: string): slug is BrandSlug {
  return AVAILABLE_BRANDS.includes(slug as BrandSlug);
}

// Load theme from file system
async function loadThemeFromFile(brandSlug: BrandSlug): Promise<ThemeConfig> {
  try {
    const themePath = join(process.cwd(), "public", "brands", brandSlug, "theme.json");
    const themeData = await readFile(themePath, "utf-8");
    const rawData = JSON.parse(themeData);

    const validation = validateTheme(rawData, brandSlug);
    if (!validation.success) {
      console.warn(`[CSS Gen] Theme validation failed for ${brandSlug}:`, validation.errors);
      return defaultTheme;
    }

    return validation.data;
  } catch (error) {
    console.error(`[CSS Gen] Failed to load theme ${brandSlug}:`, error);
    return defaultTheme;
  }
}

// Generate complete CSS for a theme
function generateThemeCSS(theme: ThemeConfig): string {
  const css = `
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
  --font-heading: ${theme.fonts.heading.family};
  --font-body: ${theme.fonts.body.family};
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
html.light,
html:not(.dark) {
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
  --heroui-primary-foreground: 0 0% 100% !important;

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
  --heroui-secondary-foreground: 0 0% 100% !important;

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
html body .bg-primary,
html body [data-slot="base"].bg-primary,
html body button.bg-primary,
html body [data-color="primary"],
html body .heroui-button[data-color="primary"],
html body *[class*="bg-primary"] {
  background-color: ${theme.colors.brand} !important;
}

html .text-primary-foreground,
html [data-slot="base"].text-primary-foreground,
html button.text-primary-foreground {
  color: #ffffff !important;
}

html .bg-secondary,
html [data-slot="base"].bg-secondary,
html button.bg-secondary,
html .heroui-button[data-color="secondary"] {
  background-color: ${theme.colors.accent} !important;
}

html .text-secondary-foreground,
html [data-slot="base"].text-secondary-foreground,
html button.text-secondary-foreground {
  color: #ffffff !important;
}

html .bg-default,
html [data-slot="base"].bg-default,
html button.bg-default {
  background-color: ${theme.colors.surface["2"]} !important;
}

html .text-default-foreground,
html [data-slot="base"].text-default-foreground {
  color: ${theme.colors.text.primary} !important;
}

html .bg-default-100 {
  background-color: ${theme.colors.surface["2"]} !important;
}

html .bg-default-200 {
  background-color: ${theme.colors.fill} !important;
}

html .text-default-600 {
  color: ${theme.colors.text.secondary} !important;
}

html .border-default {
  border-color: ${theme.colors.border} !important;
}

html .text-foreground {
  color: ${theme.colors.text.primary} !important;
}

html .text-primary {
  color: ${theme.colors.brand} !important;
}

html .text-secondary {
  color: ${theme.colors.text.secondary} !important;
}

/* Custom utility classes */
.bg-brand { background-color: ${theme.colors.brand} !important; }
.bg-accent { background-color: ${theme.colors.accent} !important; }
.text-brand { color: ${theme.colors.brand} !important; }
.text-accent { color: ${theme.colors.accent} !important; }

/* Font family overrides */
.font-heading {
  font-family: ${theme.fonts.heading.family} !important;
  font-weight: ${theme.fonts.heading.weight} !important;
}
.font-body {
  font-family: ${theme.fonts.body.family} !important;
  font-weight: ${theme.fonts.body.weight} !important;
}

/* HeroUI Component Font Overrides */
html body button,
html body .heroui-button,
html body [data-slot="base"],
html body input,
html body textarea,
html body .heroui-input input,
html body .heroui-textarea textarea,
html body .heroui-chip,
html body .heroui-chip span,
html body [role="button"],
html body .heroui-navbar-item,
html body .heroui-link {
  font-family: ${theme.fonts.body.family} !important;
  font-weight: ${theme.fonts.body.weight} !important;
}

/* Body background uses theme surface color */
body {
  background: ${theme.colors.surface["1"]} !important;
}
`;

  return css.trim();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const brandSlug = slug;

  // Validate brand slug
  if (!isValidBrandSlug(brandSlug)) {
    return new NextResponse("Invalid brand slug", { status: 404 });
  }

  try {
    // Load theme configuration
    const theme = await loadThemeFromFile(brandSlug);

    // Generate CSS
    const css = generateThemeCSS(theme);

    const isDev = process.env.NODE_ENV !== "production";
    return new NextResponse(css, {
      headers: {
        "Content-Type": "text/css",
        "Cache-Control": isDev
          ? "no-store"
          : "public, max-age=3600, stale-while-revalidate=86400",
        "Vary": "Accept-Encoding",
      },
    });
  } catch (error) {
    console.error(`[CSS Gen] Error generating CSS for brand ${brandSlug}:`, error);

    // Fallback to default theme CSS
    const defaultCSS = generateThemeCSS(defaultTheme);
    return new NextResponse(defaultCSS, {
      headers: {
        "Content-Type": "text/css",
        "Cache-Control": "public, max-age=300", // Shorter cache for fallback
      },
    });
  }
}

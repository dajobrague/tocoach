// Pure helpers for the setup-wizard live preview: hex→HSL conversion and the
// HeroUI CSS string generated from wizard state. No React/JSX so it stays
// unit-testable; the provider component lives in preview-theme-provider.tsx.

import type { SetupWizardState } from "@/lib/setup-wizard/context";

import { simplifyBrandColors } from "@/lib/theme/brand-colors";
import { brandInk, resolveClientSurface } from "@/lib/theme/client-surface";
import { pickForegroundHSL } from "@/lib/theme/color-utils";

// Function to convert hex to HSL (HeroUI format).
//
// Resilient to missing/invalid input. Partial or legacy themes can omit a
// color (e.g. a tenant whose colors.text only has {primary, secondary} and no
// h1/h2/body/muted). This runs inside the setup wizard's live-preview useMemo,
// so throwing here white-screens the entire onboarding page and locks the
// trainer out. Fall back to a neutral gray instead of crashing.
export function hexToHSL(hex: string | undefined | null): string {
  const cleanHex = typeof hex === "string" ? hex.trim().replace(/^#/, "") : "";

  // Only 6-digit hex is supported by the RGB parsing below; anything else
  // (undefined, "", 3-digit, rgba(), named) degrades to neutral gray.
  if (!/^[0-9a-fA-F]{6}$/.test(cleanHex)) {
    return "0 0% 50%";
  }

  // Convert to RGB
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;

    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Generate HeroUI-compatible CSS from wizard state.
//
// Mismo cálculo que el portal real: el wizard solo elige principal y
// secundario, así que las superficies, textos y el texto sobre botones se
// derivan con resolveClientSurface / brandInk / pickForegroundHSL a partir
// de los neutros que se guardarán (simplifyBrandColors). Así la vista previa
// enseña exactamente lo que verá el cliente, sin leer los text/background
// legacy del estado (que podían venir parciales y tumbar el wizard).
export function generatePreviewCSS(state: SetupWizardState): string {
  const colors = simplifyBrandColors(undefined, {
    brand: state.colors?.primary,
    accent: state.colors?.secondary,
    scheme: state.colors?.dark ? "dark" : "light",
  });
  const { brand, accent } = colors;
  const surface = resolveClientSurface(colors);
  const ink = brandInk(brand, surface.background, surface.foreground);
  const semantic = state.colors?.semantic;
  const success = semantic?.success ?? "#22c55e";
  const warning = semantic?.warning ?? "#f59e0b";
  const danger = semantic?.danger ?? "#ef4444";
  const shadows = state.colors?.shadows;

  return `
    /* HeroUI Theme Override for Preview */
    .preview-theme-wrapper {
      --heroui-primary: ${hexToHSL(brand)};
      --heroui-primary-foreground: ${pickForegroundHSL(brand)};
      --heroui-secondary: ${hexToHSL(accent)};
      --heroui-secondary-foreground: ${pickForegroundHSL(accent)};

      /* Background System (derivado) */
      --heroui-background: ${hexToHSL(surface.background)};
      --heroui-foreground: ${hexToHSL(surface.foreground)};
      --heroui-content1: ${hexToHSL(surface.c1)};
      --heroui-content2: ${hexToHSL(surface.c2)};
      --heroui-content3: ${hexToHSL(surface.c3)};
      --heroui-content4: ${hexToHSL(surface.c4)};

      /* Semantic Colors */
      --heroui-success: ${hexToHSL(success)};
      --heroui-success-foreground: ${pickForegroundHSL(success)};
      --heroui-warning: ${hexToHSL(warning)};
      --heroui-warning-foreground: ${pickForegroundHSL(warning)};
      --heroui-danger: ${hexToHSL(danger)};
      --heroui-danger-foreground: ${pickForegroundHSL(danger)};

      /* Default/Neutral Colors (derivado) */
      --heroui-default: ${hexToHSL(surface.default)};
      --heroui-default-50: ${hexToHSL(surface.d50)};
      --heroui-default-100: ${hexToHSL(surface.d100)};
      --heroui-default-200: ${hexToHSL(surface.d200)};
      --heroui-default-300: ${hexToHSL(surface.d300)};
      --heroui-default-400: ${hexToHSL(surface.d400)};
      --heroui-default-500: ${hexToHSL(surface.d500)};
      --heroui-default-600: ${hexToHSL(surface.d600)};
      --heroui-default-700: ${hexToHSL(surface.d700)};
      --heroui-default-800: ${hexToHSL(surface.d800)};
      --heroui-default-900: ${hexToHSL(surface.d900)};
      --heroui-default-foreground: ${hexToHSL(surface.dFg)};

      --heroui-focus: ${hexToHSL(accent)};

      --heroui-radius-small: 6px;
      --heroui-radius-medium: 8px;
      --heroui-radius-large: 12px;

      --heroui-box-shadow-small: 0 1px 2px ${shadows?.light ?? "rgba(0, 0, 0, 0.05)"};
      --heroui-box-shadow-medium: 0 2px 4px ${shadows?.medium ?? "rgba(0, 0, 0, 0.1)"};
      --heroui-box-shadow-large: 0 10px 25px ${shadows?.dark ?? "rgba(0, 0, 0, 0.25)"};
    }

    .preview-theme-wrapper .bg-primary {
      background-color: ${brand} !important;
    }

    .preview-theme-wrapper .bg-secondary {
      background-color: ${accent} !important;
    }

    .preview-theme-wrapper .text-primary {
      color: ${ink} !important;
    }

    .preview-theme-wrapper .bg-background {
      background-color: ${surface.background} !important;
    }

    /* Font overrides */
    .preview-theme-wrapper .font-heading {
      font-family: ${state.fonts.heading.family}, sans-serif !important;
    }
    
    .preview-theme-wrapper .font-body {
      font-family: ${state.fonts.body.family}, sans-serif !important;
    }
    
    /* Ensure all text uses body font by default */
    .preview-theme-wrapper {
      font-family: ${state.fonts.body.family}, sans-serif !important;
    }
  `;
}

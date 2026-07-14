// Pure helpers for the setup-wizard live preview: hex→HSL conversion and the
// HeroUI CSS string generated from wizard state. No React/JSX so it stays
// unit-testable; the provider component lives in preview-theme-provider.tsx.

import type { SetupWizardState } from "@/lib/setup-wizard/context";

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

// Generate HeroUI-compatible CSS from wizard state
export function generatePreviewCSS(state: SetupWizardState): string {
  const primaryHSL = hexToHSL(state.colors.primary);
  const secondaryHSL = hexToHSL(state.colors.secondary);
  const successHSL = hexToHSL(state.colors.semantic.success);
  const warningHSL = hexToHSL(state.colors.semantic.warning);
  const dangerHSL = hexToHSL(state.colors.semantic.danger);

  return `
    /* HeroUI Theme Override for Preview */
    .preview-theme-wrapper {
      /* Primary Color */
      --heroui-primary: ${primaryHSL};
      --heroui-primary-foreground: 0 0% 100%;
      
      /* Secondary Color */
      --heroui-secondary: ${secondaryHSL};
      --heroui-secondary-foreground: 0 0% 100%;
      
      /* Background System */
      --heroui-background: ${hexToHSL(state.colors.background.secondary)};
      --heroui-foreground: ${hexToHSL(state.colors.text.h1)};
      --heroui-content1: ${hexToHSL(state.colors.surface["1"])};
      --heroui-content2: ${hexToHSL(state.colors.surface["2"])};
      --heroui-content3: ${hexToHSL(state.colors.background.accent)};
      --heroui-content4: ${hexToHSL(state.colors.text.muted)};
      
      /* Semantic Colors */
      --heroui-success: ${successHSL};
      --heroui-success-foreground: 0 0% 100%;
      --heroui-warning: ${warningHSL};
      --heroui-warning-foreground: 0 0% 100%;
      --heroui-danger: ${dangerHSL};
      --heroui-danger-foreground: 0 0% 100%;
      
      /* Default/Neutral Colors */
      --heroui-default: ${hexToHSL(state.colors.surface["2"])};
      --heroui-default-50: ${hexToHSL(state.colors.surface["1"])};
      --heroui-default-100: ${hexToHSL(state.colors.surface["2"])};
      --heroui-default-200: ${hexToHSL(state.colors.background.accent)};
      --heroui-default-300: ${hexToHSL(state.colors.text.muted)};
      --heroui-default-400: ${hexToHSL(state.colors.text.muted)};
      --heroui-default-500: ${hexToHSL(state.colors.text.body)};
      --heroui-default-600: ${hexToHSL(state.colors.text.body)};
      --heroui-default-700: ${hexToHSL(state.colors.text.h2)};
      --heroui-default-800: ${hexToHSL(state.colors.text.h1)};
      --heroui-default-900: ${hexToHSL(state.colors.text.h1)};
      --heroui-default-foreground: ${hexToHSL(state.colors.text.h1)};
      
      /* Focus */
      --heroui-focus: ${secondaryHSL};
      
      /* Layout */
      --heroui-radius-small: 6px;
      --heroui-radius-medium: 8px;
      --heroui-radius-large: 12px;
      
      /* Shadows */
      --heroui-box-shadow-small: 0 1px 2px ${state.colors.shadows.light};
      --heroui-box-shadow-medium: 0 2px 4px ${state.colors.shadows.medium};
      --heroui-box-shadow-large: 0 10px 25px ${state.colors.shadows.dark};
    }
    
    /* Direct color overrides for preview */
    .preview-theme-wrapper .bg-primary {
      background-color: ${state.colors.primary} !important;
    }
    
    .preview-theme-wrapper .bg-secondary {
      background-color: ${state.colors.secondary} !important;
    }
    
    .preview-theme-wrapper .bg-warning {
      background-color: ${state.colors.semantic.warning} !important;
    }
    
    .preview-theme-wrapper .bg-danger {
      background-color: ${state.colors.semantic.danger} !important;
    }
    
    .preview-theme-wrapper .bg-success {
      background-color: ${state.colors.semantic.success} !important;
    }
    
    .preview-theme-wrapper .text-primary {
      color: ${state.colors.primary} !important;
    }
    
    .preview-theme-wrapper .text-foreground {
      color: ${state.colors.text.h1} !important;
    }
    
    .preview-theme-wrapper .text-foreground\\/60 {
      color: ${state.colors.text.body} !important;
    }
    
    .preview-theme-wrapper .text-foreground\\/70 {
      color: ${state.colors.text.h2} !important;
    }
    
    .preview-theme-wrapper .bg-background {
      background-color: ${state.colors.background.secondary} !important;
    }
    
    .preview-theme-wrapper .bg-content1 {
      background-color: ${state.colors.surface["1"]} !important;
    }
    
    .preview-theme-wrapper .bg-default-100 {
      background-color: ${state.colors.surface["2"]} !important;
    }
    
    .preview-theme-wrapper .bg-default-200 {
      background-color: ${state.colors.background.accent} !important;
    }
    
    .preview-theme-wrapper .bg-primary\\/10 {
      background-color: ${state.colors.primary}19 !important;
    }
    
    .preview-theme-wrapper .bg-warning\\/10 {
      background-color: ${state.colors.semantic.warning}19 !important;
    }
    
    .preview-theme-wrapper .bg-secondary\\/10 {
      background-color: ${state.colors.secondary}19 !important;
    }
    
    .preview-theme-wrapper .bg-danger\\/10 {
      background-color: ${state.colors.semantic.danger}19 !important;
    }
    
    .preview-theme-wrapper .bg-success\\/10 {
      background-color: ${state.colors.semantic.success}19 !important;
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

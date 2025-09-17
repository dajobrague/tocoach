// Theme management utilities
// Handles theme loading and CSS variable generation

export interface ThemeConfig {
  name: string;
  version: string;
  colors: Record<string, Record<string, string>>;
  typography: {
    fontFamily: Record<string, string[]>;
    fontSize: Record<string, string>;
    fontWeight: Record<string, string>;
    lineHeight: Record<string, string>;
  };
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  shadows: Record<string, string>;
  breakpoints: Record<string, string>;
}

/**
 * Loads theme configuration from the brands directory
 * @param brandId - The brand identifier (e.g., 'default')
 * @returns Theme configuration object
 */
export async function loadThemeConfig(
  brandId: string = "default"
): Promise<ThemeConfig> {
  try {
    // In a real implementation, this would fetch from the appropriate brand directory
    // For now, we'll return the default theme structure
    const response = await fetch(`/brands/${brandId}/theme.json`);

    if (!response.ok) {
      throw new Error(`Failed to load theme for brand: ${brandId}`);
    }

    return await response.json();
  } catch (error) {
    console.warn(
      `Failed to load theme for brand ${brandId}, falling back to default`
    );

    // Fallback to default theme
    return {
      name: "TopCoach Default Theme",
      version: "1.0.0",
      colors: {
        primary: {
          "500": "#0ea5e9",
          "600": "#0284c7",
        },
        secondary: {
          "500": "#64748b",
          "600": "#475569",
        },
      },
      typography: {
        fontFamily: {
          sans: ["Inter", "system-ui", "sans-serif"],
        },
        fontSize: {
          base: "1rem",
          lg: "1.125rem",
        },
        fontWeight: {
          normal: "400",
          bold: "700",
        },
        lineHeight: {
          normal: "1.5",
        },
      },
      spacing: {
        "4": "1rem",
        "8": "2rem",
      },
      borderRadius: {
        default: "0.25rem",
        lg: "0.5rem",
      },
      shadows: {
        default: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
      },
      breakpoints: {
        md: "768px",
        lg: "1024px",
      },
    };
  }
}

/**
 * Generates CSS custom properties from theme config
 * @param theme - Theme configuration
 * @returns CSS custom properties string
 */
export function generateCSSVariables(theme: ThemeConfig): string {
  const variables: string[] = [];

  // Colors
  Object.entries(theme.colors).forEach(([colorName, shades]) => {
    Object.entries(shades).forEach(([shade, value]) => {
      variables.push(`--color-${colorName}-${shade}: ${value};`);
    });
  });

  // Typography
  Object.entries(theme.typography.fontSize).forEach(([size, value]) => {
    variables.push(`--font-size-${size}: ${value};`);
  });

  Object.entries(theme.typography.fontWeight).forEach(([weight, value]) => {
    variables.push(`--font-weight-${weight}: ${value};`);
  });

  // Spacing
  Object.entries(theme.spacing).forEach(([size, value]) => {
    variables.push(`--spacing-${size}: ${value};`);
  });

  // Border radius
  Object.entries(theme.borderRadius).forEach(([size, value]) => {
    variables.push(`--border-radius-${size}: ${value};`);
  });

  // Shadows
  Object.entries(theme.shadows).forEach(([size, value]) => {
    variables.push(`--shadow-${size}: ${value};`);
  });

  return `:root {\n  ${variables.join("\n  ")}\n}`;
}

/**
 * Gets the current brand ID from hostname or configuration
 * This will be used for multi-tenant theming in Phase 2
 */
export function getCurrentBrandId(): string {
  // For Phase 1, always return 'default'
  // In Phase 2, this will resolve based on hostname/subdomain
  return "default";
}

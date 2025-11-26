// WCAG AA contrast validation and auto-fallback utilities

// Convert hex color to RGB values
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

  if (!result || !result[1] || !result[2] || !result[3]) {
    return null;
  }

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

// Calculate relative luminance
function getLuminance(r: number, g: number, b: number): number {
  const luminanceValues = [r, g, b].map((c) => {
    c = c / 255;

    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return (
    0.2126 * luminanceValues[0]! +
    0.7152 * luminanceValues[1]! +
    0.0722 * luminanceValues[2]!
  );
}

// Calculate contrast ratio between two colors
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) return 1; // Fallback for invalid colors

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (brightest + 0.05) / (darkest + 0.05);
}

// Check if contrast meets WCAG AA standard (4.5:1)
export function meetsWCAGAA(foreground: string, background: string): boolean {
  return getContrastRatio(foreground, background) >= 4.5;
}

// Contrast validation rules for theme colors
export interface ContrastValidationResult {
  isValid: boolean;
  violations: ContrastViolation[];
  corrections: Record<string, string>;
}

export interface ContrastViolation {
  pair: string;
  foreground: string;
  background: string;
  ratio: number;
  required: number;
}

// Validate all critical contrast pairs in a theme
export function validateThemeContrast(colors: {
  text: { primary: string; secondary: string };
  surface: { "1": string; "2": string };
  fill: string;
  brand: string;
  accent: string;
}): ContrastValidationResult {
  const violations: ContrastViolation[] = [];
  const corrections: Record<string, string> = {};

  // Critical contrast pairs to validate
  const pairs = [
    {
      name: "text.primary on surface.1",
      foreground: colors.text.primary,
      background: colors.surface["1"],
      key: "text.primary",
    },
    {
      name: "text.primary on surface.2",
      foreground: colors.text.primary,
      background: colors.surface["2"],
      key: "text.primary",
    },
    {
      name: "text.secondary on surface.1",
      foreground: colors.text.secondary,
      background: colors.surface["1"],
      key: "text.secondary",
    },
  ];

  pairs.forEach((pair) => {
    const ratio = getContrastRatio(pair.foreground, pair.background);

    if (ratio < 4.5) {
      violations.push({
        pair: pair.name,
        foreground: pair.foreground,
        background: pair.background,
        ratio,
        required: 4.5,
      });

      // Auto-correct by using a safer fallback
      if (pair.key === "text.secondary") {
        corrections[pair.key] = colors.text.primary; // Promote to primary text
      } else {
        corrections[pair.key] = "#000000"; // Fallback to black for primary text
      }
    }
  });

  return {
    isValid: violations.length === 0,
    violations,
    corrections,
  };
}

// Generate safe focus color with proper contrast
export function generateFocusColor(
  accentColor: string,
  surfaceColor: string
): string {
  const baseOpacity = 0.5;
  const rgb = hexToRgb(accentColor);

  if (!rgb) return "rgba(14, 165, 233, 0.5)"; // Fallback

  // Create semi-transparent version for focus rings
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${baseOpacity})`;
}

// Darken or lighten a color for better contrast
export function adjustColorForContrast(
  color: string,
  background: string,
  targetRatio: number = 4.5
): string {
  const rgb = hexToRgb(color);
  const bgRgb = hexToRgb(background);

  if (!rgb || !bgRgb) return color;

  // Simple approach: if background is light, darken text; if dark, lighten text
  const bgLuminance = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
  const isLightBackground = bgLuminance > 0.5;

  if (isLightBackground) {
    // Darken the color
    const factor = 0.7;
    const newR = Math.floor(rgb.r * factor);
    const newG = Math.floor(rgb.g * factor);
    const newB = Math.floor(rgb.b * factor);

    return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
  } else {
    // Lighten the color
    const factor = 0.3;
    const newR = Math.floor(rgb.r + (255 - rgb.r) * factor);
    const newG = Math.floor(rgb.g + (255 - rgb.g) * factor);
    const newB = Math.floor(rgb.b + (255 - rgb.b) * factor);

    return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
  }
}

// Log contrast violations with helpful information
export function logContrastViolations(
  brandSlug: string,
  result: ContrastValidationResult
): void {
  if (!result.isValid) {
    console.warn(
      `[Theme] Contrast violations detected for brand "${brandSlug}":`
    );
    result.violations.forEach((violation) => {
      console.warn(
        `  ${violation.pair}: ${violation.ratio.toFixed(2)}:1 (required: ${violation.required}:1)`
      );
    });

    if (Object.keys(result.corrections).length > 0) {
      console.warn("  Auto-corrections applied:", result.corrections);
    }
  }
}

// Color contrast utilities for dynamic text color selection
// Ensures WCAG AA compliance (4.5:1 contrast ratio)

import { getContrastRatio } from "@/lib/theme/contrast";

/**
 * Convert hex color to RGB values
 */
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

/**
 * Convert hex to RGBA string with alpha channel
 */
export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);

  if (!rgb) return `rgba(0, 0, 0, ${alpha})`;

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Blend two colors with alpha compositing
 * Used to calculate the actual background color when using semi-transparent overlays
 */
function blendColors(
  foregroundHex: string,
  foregroundAlpha: number,
  backgroundHex: string
): string {
  const fg = hexToRgb(foregroundHex);
  const bg = hexToRgb(backgroundHex);

  if (!fg || !bg) return backgroundHex;

  // Alpha compositing formula
  const r = Math.round(fg.r * foregroundAlpha + bg.r * (1 - foregroundAlpha));
  const g = Math.round(fg.g * foregroundAlpha + bg.g * (1 - foregroundAlpha));
  const b = Math.round(fg.b * foregroundAlpha + bg.b * (1 - foregroundAlpha));

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Calculate the actual background color after applying opacity
 * This accounts for the semi-transparent overlay on top of the surface color
 */
export function getComputedBackgroundColor(
  bgColor: string,
  bgOpacity: number,
  surfaceColor: string = "#ffffff"
): string {
  return blendColors(bgColor, bgOpacity, surfaceColor);
}

/**
 * Darken a color by a given factor (0-1)
 */
function darkenColor(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);

  if (!rgb) return hex;

  const r = Math.round(rgb.r * (1 - factor));
  const g = Math.round(rgb.g * (1 - factor));
  const b = Math.round(rgb.b * (1 - factor));

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Lighten a color by a given factor (0-1)
 */
function lightenColor(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);

  if (!rgb) return hex;

  const r = Math.round(rgb.r + (255 - rgb.r) * factor);
  const g = Math.round(rgb.g + (255 - rgb.g) * factor);
  const b = Math.round(rgb.b + (255 - rgb.b) * factor);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Get the best text color for a given background
 * Returns a color that meets WCAG AA contrast ratio (4.5:1)
 *
 * @param bgColor - The background color (hex)
 * @param bgOpacity - The opacity of the background (0-1)
 * @param surfaceColor - The underlying surface color (default: white)
 * @param themeColor - Optional theme color to try using (maintains brand consistency)
 * @returns Optimal text color as hex string
 */
export function getTextColorForBackground(
  bgColor: string,
  bgOpacity: number = 1,
  surfaceColor: string = "#ffffff",
  themeColor?: string
): string {
  // Calculate the actual background after opacity is applied
  const actualBg = getComputedBackgroundColor(bgColor, bgOpacity, surfaceColor);

  // Candidate text colors to test
  const candidates: { color: string; priority: number }[] = [
    { color: "#000000", priority: 3 }, // Black
    { color: "#ffffff", priority: 3 }, // White
  ];

  // If theme color is provided, try variations
  if (themeColor) {
    candidates.push(
      { color: themeColor, priority: 5 }, // Original theme color (highest priority)
      { color: darkenColor(themeColor, 0.3), priority: 4 }, // Darkened theme color
      { color: darkenColor(themeColor, 0.5), priority: 4 }, // More darkened
      { color: darkenColor(themeColor, 0.7), priority: 4 }, // Even more darkened
      { color: lightenColor(themeColor, 0.3), priority: 4 }, // Lightened theme color
      { color: lightenColor(themeColor, 0.5), priority: 4 } // More lightened
    );
  }

  // Find the best candidate with sufficient contrast
  let bestColor = "#000000";
  let bestRatio = 0;
  let bestPriority = 0;

  for (const candidate of candidates) {
    const ratio = getContrastRatio(candidate.color, actualBg);

    // WCAG AA requires 4.5:1 for normal text
    if (ratio >= 4.5) {
      // Prefer higher priority colors, then higher contrast ratios
      if (
        candidate.priority > bestPriority ||
        (candidate.priority === bestPriority && ratio > bestRatio)
      ) {
        bestColor = candidate.color;
        bestRatio = ratio;
        bestPriority = candidate.priority;
      }
    }
  }

  // If no candidate meets the threshold, use the one with highest contrast
  if (bestRatio < 4.5) {
    for (const candidate of candidates) {
      const ratio = getContrastRatio(candidate.color, actualBg);

      if (ratio > bestRatio) {
        bestColor = candidate.color;
        bestRatio = ratio;
      }
    }
  }

  return bestColor;
}

/**
 * Get multiple text color variants for a background
 * Useful when you need different emphasis levels (primary, secondary text)
 */
export function getTextColorVariants(
  bgColor: string,
  bgOpacity: number = 1,
  surfaceColor: string = "#ffffff",
  themeColor?: string
): {
  primary: string;
  secondary: string;
  contrast: number;
} {
  const primaryColor = getTextColorForBackground(
    bgColor,
    bgOpacity,
    surfaceColor,
    themeColor
  );

  // For secondary text, use a slightly more transparent version
  // or a gray that still meets contrast requirements
  const actualBg = getComputedBackgroundColor(bgColor, bgOpacity, surfaceColor);
  const contrastRatio = getContrastRatio(primaryColor, actualBg);

  // Secondary text should be slightly lighter/darker
  let secondaryColor = primaryColor;

  if (primaryColor === "#000000") {
    secondaryColor = "#64748b"; // Slate gray for secondary text on light backgrounds
  } else if (primaryColor === "#ffffff") {
    secondaryColor = "#cbd5e1"; // Light gray for secondary text on dark backgrounds
  }

  // Verify secondary color still has enough contrast
  const secondaryRatio = getContrastRatio(secondaryColor, actualBg);

  if (secondaryRatio < 4.5) {
    secondaryColor = primaryColor; // Fall back to primary if contrast is insufficient
  }

  return {
    primary: primaryColor,
    secondary: secondaryColor,
    contrast: contrastRatio,
  };
}

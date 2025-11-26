"use client";

import { useEffect, useState } from "react";

import {
  getTextColorForBackground,
  getTextColorVariants,
} from "./color-contrast";

/**
 * React hook to get optimal text color for a given background
 * Automatically reads theme colors from CSS variables
 *
 * @param colorVar - The CSS variable name for the background color (e.g., "primary", "danger", "warning")
 * @param opacity - The opacity of the background (0-1), default 0.1 for typical bg-{color}/10 usage
 * @param options - Optional configuration
 * @returns Object with text color and utility info
 */
export function useContrastColor(
  colorVar: "primary" | "secondary" | "danger" | "warning" | "success" | string,
  opacity: number = 0.1,
  options?: {
    useThemeColor?: boolean; // If true, tries to use a variant of the theme color instead of just black/white
    surfaceVar?: string; // CSS variable name for the surface color, default is "surface-1"
  }
) {
  const [textColor, setTextColor] = useState<string>("#000000");
  const [secondaryTextColor, setSecondaryTextColor] =
    useState<string>("#64748b");
  const [contrastRatio, setContrastRatio] = useState<number>(4.5);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Get the CSS variable values from the document
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);

    // Map common color names to HeroUI CSS variables
    const colorVarMap: Record<string, string> = {
      primary: "--heroui-primary",
      secondary: "--heroui-secondary",
      danger: "--heroui-danger",
      warning: "--heroui-warning",
      success: "--heroui-success",
    };

    const cssVarName = colorVarMap[colorVar] || `--color-${colorVar}`;
    const surfaceVarName = options?.surfaceVar
      ? `--color-${options.surfaceVar}`
      : "--heroui-background";

    // Get the color values
    let bgColor = computedStyle.getPropertyValue(cssVarName).trim();
    const surfaceColor = computedStyle.getPropertyValue(surfaceVarName).trim();

    // HeroUI uses HSL format, convert to hex if needed
    if (bgColor.includes(" ") && !bgColor.startsWith("#")) {
      // It's likely HSL format like "221 83% 53%"
      bgColor = hslToHex(bgColor);
    }

    // If still no valid color, use fallback
    if (!bgColor || bgColor === "") {
      bgColor = "#0ea5e9"; // Default blue
    }

    // Get surface color with fallback
    let finalSurfaceColor = surfaceColor;

    if (finalSurfaceColor.includes(" ") && !finalSurfaceColor.startsWith("#")) {
      finalSurfaceColor = hslToHex(finalSurfaceColor);
    }
    if (!finalSurfaceColor || finalSurfaceColor === "") {
      finalSurfaceColor = "#ffffff";
    }

    // Get optimal text colors
    const themeColorToUse = options?.useThemeColor ? bgColor : undefined;
    const colors = getTextColorVariants(
      bgColor,
      opacity,
      finalSurfaceColor,
      themeColorToUse
    );

    setTextColor(colors.primary);
    setSecondaryTextColor(colors.secondary);
    setContrastRatio(colors.contrast);
  }, [colorVar, opacity, options?.useThemeColor, options?.surfaceVar]);

  return {
    textColor,
    secondaryTextColor,
    contrastRatio,
    // Convenience properties for inline styles
    style: { color: textColor },
    secondaryStyle: { color: secondaryTextColor },
  };
}

/**
 * Simple HSL to Hex converter for HeroUI color format
 * Input: "221 83% 53%" or "221deg 83% 53%"
 * Output: "#3b82f6"
 */
function hslToHex(hsl: string): string {
  // Parse HSL string
  const parts = hsl.replace(/deg/g, "").split(/\s+/);

  if (parts.length !== 3) return "#000000";

  const h = parseFloat(parts[0] || "0") / 360;
  const s = parseFloat(parts[1] || "0") / 100;
  const l = parseFloat(parts[2] || "0") / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;

      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);

    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Hook for getting text color with a specific background color (not from CSS variables)
 * Useful when you have a dynamic color that's not in the theme
 */
export function useContrastColorForHex(
  backgroundColor: string,
  opacity: number = 1,
  surfaceColor: string = "#ffffff"
) {
  const [textColor, setTextColor] = useState<string>("#000000");

  useEffect(() => {
    const color = getTextColorForBackground(
      backgroundColor,
      opacity,
      surfaceColor
    );

    setTextColor(color);
  }, [backgroundColor, opacity, surfaceColor]);

  return {
    textColor,
    style: { color: textColor },
  };
}

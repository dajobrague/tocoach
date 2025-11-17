// Color conversion utilities for HeroUI integration

// Convert hex to RGB
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

// Convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h: number, s: number;
    const l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
            default:
                h = 0;
        }
        h /= 6;
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
    };
}

// Convert hex color to HeroUI HSL format (without hsl() wrapper)
export function hexToHeroUIHSL(hex: string): string {
    const rgb = hexToRgb(hex);
    if (!rgb) {
        return "0 0% 50%"; // Fallback gray
    }

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return `${hsl.h} ${hsl.s}% ${hsl.l}%`;
}

// Generate HeroUI color scale from a single hex color
export function generateHeroUIColorScale(baseHex: string): Record<string, string> {
    const rgb = hexToRgb(baseHex);
    if (!rgb) {
        return {
            "50": "0 0% 95%",
            "100": "0 0% 90%",
            "200": "0 0% 80%",
            "300": "0 0% 70%",
            "400": "0 0% 60%",
            "500": "0 0% 50%",
            "600": "0 0% 40%",
            "700": "0 0% 30%",
            "800": "0 0% 20%",
            "900": "0 0% 10%",
            DEFAULT: "0 0% 50%",
        };
    }

    const baseHsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    // Generate lighter and darker variants
    const scale: Record<string, string> = {};

    // Lighter variants (50-400)
    scale["50"] = `${baseHsl.h} ${Math.min(baseHsl.s, 30)}% 95%`;
    scale["100"] = `${baseHsl.h} ${Math.min(baseHsl.s, 40)}% 90%`;
    scale["200"] = `${baseHsl.h} ${Math.min(baseHsl.s, 50)}% 80%`;
    scale["300"] = `${baseHsl.h} ${Math.min(baseHsl.s, 60)}% 70%`;
    scale["400"] = `${baseHsl.h} ${Math.min(baseHsl.s, 70)}% 60%`;

    // Base color (500)
    scale["500"] = `${baseHsl.h} ${baseHsl.s}% ${baseHsl.l}%`;
    scale["DEFAULT"] = `${baseHsl.h} ${baseHsl.s}% ${baseHsl.l}%`;

    // Darker variants (600-900)
    scale["600"] = `${baseHsl.h} ${baseHsl.s}% ${Math.max(baseHsl.l - 10, 10)}%`;
    scale["700"] = `${baseHsl.h} ${baseHsl.s}% ${Math.max(baseHsl.l - 20, 8)}%`;
    scale["800"] = `${baseHsl.h} ${baseHsl.s}% ${Math.max(baseHsl.l - 30, 6)}%`;
    scale["900"] = `${baseHsl.h} ${baseHsl.s}% ${Math.max(baseHsl.l - 40, 4)}%`;

    return scale;
}

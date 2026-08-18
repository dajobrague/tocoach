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
function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
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
export function generateHeroUIColorScale(
  baseHex: string
): Record<string, string> {
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

const DARK_FOREGROUND_HEX = "#0f172a"; // slate-900, ya usado como neutro oscuro del sistema
const DARK_FOREGROUND_HSL = "222 47% 11%";
const LIGHT_FOREGROUND_HSL = "0 0% 100%";

// --- APCA-W3 (SAPC-4g) 0.0.98G-4g constants -------------------------------
// Referencia: https://git.apcacontrast.com — mismos coeficientes que usa
// la implementación canónica `apca-w3` de Myndex, verificados contra los
// valores publicados negro-sobre-blanco (Lc ≈ 106.04) y blanco-sobre-negro
// (Lc ≈ -107.88, ver test "referencia APCA").
const APCA_TRC = 2.4; // exponente de linealización sRGB
const APCA_R_COEFF = 0.2126729;
const APCA_G_COEFF = 0.7151522;
const APCA_B_COEFF = 0.072175;
const APCA_BLACK_THRESHOLD = 0.022; // piso del "soft black clamp"
const APCA_BLACK_CLAMP_EXP = 1.414;
const APCA_SCALE = 1.14;
const APCA_NORMAL_BG_EXP = 0.56; // polaridad normal: texto oscuro sobre fondo claro
const APCA_NORMAL_TXT_EXP = 0.57;
const APCA_REVERSE_BG_EXP = 0.65; // polaridad inversa: texto claro sobre fondo oscuro
const APCA_REVERSE_TXT_EXP = 0.62;
const APCA_LOW_CLIP = 0.1; // clip de bajo contraste, en unidades de Sapc (pre *100)
const APCA_LOW_CLIP_OFFSET = 0.027;

// Lc mínimo (escala APCA, texto grande/negrita — el tamaño típico de un
// label de botón) por debajo del cual blanco deja de ser una opción de
// legibilidad aceptable aunque su |Lc| sea nominalmente el mayor de los
// dos candidatos. Ver tabla "Lookup Tables" de APCA/WCAG3. Con este piso,
// blanco sigue siendo la opción convencional para botones sólidos salvo en
// primarios pastel/amarillos donde ya era ilegible (regla documentada en
// components/client-dashboard/dashboard-content.tsx:398-416).
const APCA_WHITE_READABILITY_FLOOR = 45;

function apcaScreenLuminance(hex: string): number {
  const rgb = hexToRgb(hex);

  if (!rgb) return 0;

  const r = Math.pow(rgb.r / 255, APCA_TRC);
  const g = Math.pow(rgb.g / 255, APCA_TRC);
  const b = Math.pow(rgb.b / 255, APCA_TRC);

  return APCA_R_COEFF * r + APCA_G_COEFF * g + APCA_B_COEFF * b;
}

function apcaSoftBlackClamp(y: number): number {
  return y < APCA_BLACK_THRESHOLD
    ? y + Math.pow(APCA_BLACK_THRESHOLD - y, APCA_BLACK_CLAMP_EXP)
    : y;
}

/**
 * Contraste perceptual APCA-W3 (SAPC-4g) entre `textHex` y `bgHex`. El
 * rango aproximado es -108..106; el signo codifica la polaridad (negativo
 * = texto claro sobre fondo oscuro). No lanza con hex inválido (Y = 0).
 */
function apcaLc(textHex: string, bgHex: string): number {
  const textY = apcaSoftBlackClamp(apcaScreenLuminance(textHex));
  const bgY = apcaSoftBlackClamp(apcaScreenLuminance(bgHex));

  if (bgY > textY) {
    const contrast =
      (Math.pow(bgY, APCA_NORMAL_BG_EXP) -
        Math.pow(textY, APCA_NORMAL_TXT_EXP)) *
      APCA_SCALE;

    return contrast < APCA_LOW_CLIP
      ? 0
      : (contrast - APCA_LOW_CLIP_OFFSET) * 100;
  }

  const contrast =
    (Math.pow(bgY, APCA_REVERSE_BG_EXP) -
      Math.pow(textY, APCA_REVERSE_TXT_EXP)) *
    APCA_SCALE;

  return contrast > -APCA_LOW_CLIP
    ? 0
    : (contrast + APCA_LOW_CLIP_OFFSET) * 100;
}

/** Expuesto solo para pinnear la matemática de APCA en tests unitarios. */
export function __apcaLcForTest(textHex: string, bgHex: string): number {
  return apcaLc(textHex, bgHex);
}

/**
 * Elige el foreground (HSL triple) sobre `hex` usando contraste perceptual
 * APCA en vez de la ratio WCAG 2. Blanco gana si su Lc absoluto alcanza el
 * piso de legibilidad de texto grande/negrita (APCA_WHITE_READABILITY_FLOOR)
 * — esto preserva blanco como opción convencional de botón sólido incluso
 * cuando oscuro mide un Lc apenas mayor (p.ej. teal #14b8a6: blanco ≈ -53,
 * oscuro ≈ +54 — WCAG 2 medía blanco en solo 2.49:1 y forzaba oscuro,
 * perceptualmente peor). Por debajo del piso, gana quien tenga mayor |Lc|.
 */
export function pickForegroundHSL(hex: string): string {
  if (!/^#?[a-f\d]{6}$/i.test(hex)) {
    return LIGHT_FOREGROUND_HSL;
  }

  const lcWhite = apcaLc("#ffffff", hex);

  if (Math.abs(lcWhite) >= APCA_WHITE_READABILITY_FLOOR) {
    return LIGHT_FOREGROUND_HSL;
  }

  const lcDark = apcaLc(DARK_FOREGROUND_HEX, hex);

  return Math.abs(lcDark) >= Math.abs(lcWhite)
    ? DARK_FOREGROUND_HSL
    : LIGHT_FOREGROUND_HSL;
}

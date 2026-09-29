// Escala neutra del portal de cliente, derivada del lienzo del tenant con
// contraste garantizado.
//
// Por qué existe: el portal mapeaba los hex del trainer directo a la escala
// HeroUI (fill → default-200, border → default-300/400, text.secondary →
// default-500). En prod eso daba grises que no son grises: fill #08415c
// (azul marino) o #026de2 como "neutro", borde #ffffff invisible, texto
// principal #6DAEDB sobre blanco (2.4:1), texto casi negro sobre lienzo
// oscuro. Regla: el valor del trainer GANA cuando es legible/sutil respecto
// al lienzo; si no, se deriva mezclando lienzo → texto.

import type { ThemeConfig } from "./schema";

import { getContrastRatio } from "./contrast";

const HEX = /^#[0-9a-f]{6}$/i;

const isHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v);

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);

  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mezcla lineal en sRGB: t=0 → a, t=1 → b. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = channels(a);
  const cb = channels(b);
  const out = ca.map((c, i) => Math.round(c + ((cb[i] ?? c) - c) * t));

  return `#${out.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Primer punto de la mezcla a → b (desde `from`) que alcanza `ratio` contra `bg`. */
function mixUntil(
  a: string,
  b: string,
  bg: string,
  ratio: number,
  from: number
): string {
  for (let t = from; t < 1; t += 0.02) {
    const c = mixHex(a, b, t);

    if (getContrastRatio(c, bg) >= ratio) return c;
  }

  return b;
}

const isDarkHex = (hex: string) =>
  getContrastRatio(hex, "#ffffff") > getContrastRatio(hex, "#000000");

export interface ClientSurface {
  background: string;
  foreground: string;
  c1: string;
  c2: string;
  c3: string;
  c4: string;
  default: string;
  d50: string;
  d100: string;
  d200: string;
  d300: string;
  d400: string;
  d500: string;
  d600: string;
  d700: string;
  d800: string;
  d900: string;
  dFg: string;
}

export function resolveClientSurface(
  colors: ThemeConfig["colors"]
): ClientSurface {
  const bg = isHex(colors.surface["1"]) ? colors.surface["1"] : "#ffffff";
  const darkBg = isDarkHex(bg);
  const fg =
    isHex(colors.text.primary) &&
    getContrastRatio(colors.text.primary, bg) >= 4.5
      ? colors.text.primary
      : darkBg
        ? "#FAFAFA"
        : "#11181C";

  const subtle = (hex: unknown, max: number, fallbackT: number) =>
    isHex(hex) && getContrastRatio(hex, bg) <= max
      ? hex
      : mixHex(bg, fg, fallbackT);

  const d100 = subtle(colors.surface["2"], 1.6, 0.05);
  const d200 = subtle(colors.fill, 1.6, 0.1);
  // Borde: visible pero sin competir con el texto.
  const border = colors.border;
  const d300 =
    isHex(border) &&
    getContrastRatio(border, bg) >= 1.15 &&
    getContrastRatio(border, bg) <= 3.2
      ? border
      : mixHex(bg, fg, 0.2);
  // Texto terciario / iconos (text-default-400): 3:1 mínimo.
  const d400 = mixUntil(bg, fg, bg, 3, 0.35);
  const secondary =
    isHex(colors.text.secondary) &&
    getContrastRatio(colors.text.secondary, bg) >= 4.5
      ? colors.text.secondary
      : mixUntil(bg, fg, bg, 4.5, 0.5);

  return {
    background: bg,
    foreground: fg,
    c1: bg,
    c2: d100,
    c3: d200,
    c4: d300,
    default: d100,
    d50: d100,
    d100,
    d200,
    d300,
    d400,
    d500: secondary,
    d600: secondary,
    d700: mixHex(bg, fg, 0.82),
    d800: mixHex(bg, fg, 0.9),
    d900: fg,
    dFg: fg,
  };
}

/**
 * Color de marca para TEXTO sobre el lienzo: la marca tal cual si llega a
 * 4.5:1; si no (lima, amarillo, pastel sobre blanco), se desplaza hacia el
 * texto hasta llegar. Los rellenos sólidos siguen usando la marca cruda.
 */
export function brandInk(brand: string, bg: string, fg: string): string {
  if (!isHex(brand) || getContrastRatio(brand, bg) >= 4.5) return brand;

  return mixUntil(brand, fg, bg, 4.5, 0.05);
}

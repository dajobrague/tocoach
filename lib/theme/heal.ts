// Sanea un theme_json para que SIEMPRE pase validateTheme sin perder nada
// de lo que el trainer guardó.
//
// Por qué existe: /api/auth/register sembraba theme_json con forma inválida
// (fonts como strings, shadow {sm,md} en vez de {e1,e2}, sin accent/text/
// border/fill), y los tabs de brand-settings hacen merges parciales sin
// validar. El generador de CSS (/brands/db/[slug]/styles.css) valida
// estricto y ante cualquier fallo sirve silenciosamente el tema default —
// resultado: el trainer guarda colores "exitosamente" y el app del cliente
// nunca los muestra. Este healer se aplica al guardar (PATCH brand/config)
// y al sembrar el tenant, y sirvió para backfillear los tenants rotos.
//
// Regla de oro: lo existente VÁLIDO gana; solo se rellena/corrige lo que
// falta o tiene forma legacy. Keys extra que el schema no conoce (p.ej.
// colors.surface."3", colors.buttons, text.muted) se conservan — el schema
// las ignora al validar (strip) pero otras partes de la UI las leen.

import type { ThemeConfig } from "./schema";

import { defaultTheme } from "./schema";

const HEX_RE = /^#?[0-9A-Fa-f]{6}$/;

function isRecord(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hexOr(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_RE.test(value) ? value : fallback;
}

function radiusOr(value: unknown, fallback: number): number {
  return typeof value === "number" && value >= 6 && value <= 28
    ? value
    : fallback;
}

function weightOr(value: unknown, fallback: number): number {
  return typeof value === "number" && value >= 100 && value <= 900
    ? value
    : fallback;
}

function shadowOr(value: unknown, fallback: string): string {
  const ok =
    typeof value === "string" &&
    value.includes("px") &&
    /rgba?\(|hsla?\(|#/.test(value);

  return ok ? value : fallback;
}

/**
 * Una entrada de fonts puede venir como string legacy ("Poppins") o como
 * objeto {family, weight}. Normaliza a la forma del schema conservando la
 * familia elegida.
 */
function healFont(
  raw: unknown,
  fallback: { family: string; weight: number }
): { family: string; weight: number } {
  if (typeof raw === "string" && raw.trim() !== "") {
    return {
      family: `${raw.trim()}, system-ui, sans-serif`,
      weight: fallback.weight,
    };
  }
  if (isRecord(raw)) {
    const family =
      typeof raw.family === "string" && raw.family.trim() !== ""
        ? raw.family
        : fallback.family;

    return { family, weight: weightOr(raw.weight, fallback.weight) };
  }

  return { ...fallback };
}

/**
 * Devuelve un theme_json schema-válido. Conserva todos los valores válidos
 * presentes (incluidas keys extra fuera del schema) y rellena lo faltante
 * con `defaultTheme`.
 */
export function healThemeJson(raw: unknown): Record<string, any> {
  const t = isRecord(raw) ? raw : {};
  const d: ThemeConfig = defaultTheme;

  const meta = isRecord(t.meta) ? t.meta : {};
  const fonts = isRecord(t.fonts) ? t.fonts : {};
  const colors = isRecord(t.colors) ? t.colors : {};
  const text = isRecord(colors.text) ? colors.text : {};
  const surface = isRecord(colors.surface) ? colors.surface : {};
  const radius = isRecord(t.radius) ? t.radius : {};
  const shadow = isRecord(t.shadow) ? t.shadow : {};

  return {
    ...t,
    meta: {
      ...meta,
      name:
        typeof meta.name === "string" && meta.name.trim() !== ""
          ? meta.name
          : d.meta.name,
    },
    fonts: {
      ...fonts,
      heading: healFont(fonts.heading, d.fonts.heading),
      body: healFont(fonts.body, d.fonts.body),
    },
    colors: {
      ...colors,
      brand: hexOr(colors.brand, d.colors.brand),
      accent: hexOr(colors.accent, d.colors.accent),
      text: {
        ...text,
        primary: hexOr(text.primary, d.colors.text.primary),
        secondary: hexOr(text.secondary, d.colors.text.secondary),
      },
      surface: {
        ...surface,
        "1": hexOr(surface["1"], d.colors.surface["1"]),
        "2": hexOr(surface["2"], d.colors.surface["2"]),
      },
      border: hexOr(colors.border, d.colors.border),
      fill: hexOr(colors.fill, d.colors.fill),
    },
    radius: {
      ...radius,
      sm: radiusOr(radius.sm, d.radius.sm),
      md: radiusOr(radius.md, d.radius.md),
      lg: radiusOr(radius.lg, d.radius.lg),
      xl: radiusOr(radius.xl, d.radius.xl),
    },
    shadow: {
      ...shadow,
      // Migración legacy: registration sembraba {sm, md} — mapean a e1/e2.
      e1: shadowOr(shadow.e1 ?? shadow.sm, d.shadow.e1),
      e2: shadowOr(shadow.e2 ?? shadow.md, d.shadow.e2),
    },
  };
}

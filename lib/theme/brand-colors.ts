// Editor de marca simplificado: el entrenador elige SOLO el color principal
// (colors.brand) y, opcionalmente, un secundario (colors.accent). Todo lo
// demás (texto, fondos, bordes, rellenos, texto sobre botones) lo deriva el
// pipeline con contraste garantizado:
//   - escala neutra y texto → resolveClientSurface (client-surface.ts)
//   - marca usada como texto → brandInk (client-surface.ts)
//   - texto sobre botones → pickForegroundHSL (color-utils.ts)
//
// Solo hay UN slot secundario: el pipeline no tiene un tercer color que
// pintar (accent alimenta --heroui-secondary y el anillo de foco).
//
// Compatibilidad (sin migración de datos):
//   - Tenants que NO vuelven a guardar los colores siguen con su theme_json
//     tal cual y se renderizan exactamente igual que antes.
//   - Al guardar con el editor simple, `simplifyBrandColors` reescribe
//     text/surface/border/fill con los neutros por defecto, borra las claves
//     que solo usaba el editor antiguo (buttons, text.muted, surface."3",
//     background, primary/secondary legacy) y marca `auto: true`. Con esos
//     neutros, resolveClientSurface deriva la misma escala neutra para todos.
//   - `auto: true` es la marca de "neutros gestionados por la app": un futuro
//     modo noche puede ignorar los neutros guardados (son de modo claro) y
//     derivar el lienzo oscuro solo a partir de brand/accent.

import { getContrastRatio } from "./contrast";
import { defaultTheme } from "./schema";

const HEX = /^#?[0-9a-f]{6}$/i;

/** Neutros que el editor simple escribe (los del tema por defecto). */
export const DERIVED_NEUTRALS = {
  text: { ...defaultTheme.colors.text },
  surface: { ...defaultTheme.colors.surface },
  border: defaultTheme.colors.border,
  fill: defaultTheme.colors.fill,
} as const;

/** Claves de `colors` que ya no edita nadie y se derivan. */
const DERIVED_KEYS = new Set([
  "text",
  "surface",
  "border",
  "fill",
  "buttons",
  "background",
  "primary",
  "secondary",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normHex(v: unknown): string | null {
  if (typeof v !== "string" || !HEX.test(v.trim())) return null;
  const t = v.trim().toLowerCase();

  return t.startsWith("#") ? t : `#${t}`;
}

/**
 * `colors` listo para guardar desde el editor simple. Conserva claves que
 * no son de color editable (p. ej. shadows legacy), fija brand/accent y
 * reemplaza todo lo derivado por los neutros. Sin secundario válido, el
 * secundario es el principal.
 */
export function simplifyBrandColors(
  current: unknown,
  input: { brand?: unknown; accent?: unknown }
): Record<string, unknown> {
  const prev = isRecord(current) ? current : {};
  const kept = Object.fromEntries(
    Object.entries(prev).filter(([k]) => !DERIVED_KEYS.has(k))
  );
  const brand =
    normHex(input.brand) ?? normHex(prev.brand) ?? defaultTheme.colors.brand;
  const accent = normHex(input.accent) ?? brand;

  return {
    ...kept,
    brand,
    accent,
    auto: true,
    text: { ...DERIVED_NEUTRALS.text },
    surface: { ...DERIVED_NEUTRALS.surface },
    border: DERIVED_NEUTRALS.border,
    fill: DERIVED_NEUTRALS.fill,
  };
}

/**
 * true si el tenant aún tiene textos/fondos personalizados del editor
 * antiguo (guardar con el editor simple los sustituirá por los derivados).
 */
export function hasLegacyCustomColors(colors: unknown): boolean {
  if (!isRecord(colors) || colors.auto === true) return false;
  const text = isRecord(colors.text) ? colors.text : {};
  const surface = isRecord(colors.surface) ? colors.surface : {};
  const pairs: [unknown, string][] = [
    [text.primary, DERIVED_NEUTRALS.text.primary],
    [text.secondary, DERIVED_NEUTRALS.text.secondary],
    [surface["1"], DERIVED_NEUTRALS.surface["1"]],
    [surface["2"], DERIVED_NEUTRALS.surface["2"]],
    [colors.border, DERIVED_NEUTRALS.border],
    [colors.fill, DERIVED_NEUTRALS.fill],
  ];

  return pairs.some(([v, d]) => {
    const h = normHex(v);

    return h !== null && h !== d;
  });
}

/**
 * Aviso suave (no bloquea) cuando el color principal funciona mal como
 * botón. El texto encima se elige solo (pickForegroundHSL, APCA): sobre
 * cualquier color blanco u oscuro alcanzan Lc >= ~54, así que la legibilidad
 * del texto ya está cubierta. Lo que el pipeline NO arregla es un principal
 * tan pálido que el botón se pierde sobre el fondo claro (amarillo/menta
 * pastel, grises claros): eso es lo que se avisa.
 */
export function brandColorHint(hex: string): string | null {
  const h = normHex(hex);

  if (!h || getContrastRatio(h, "#ffffff") >= 1.5) return null;

  return "Es un color muy claro: los botones apenas se distinguirán del fondo. El texto encima se ajusta solo, pero un tono más intenso se verá mejor.";
}

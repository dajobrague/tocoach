/**
 * Tinta de marca para las gráficas del portal del cliente (opt-in `ink`).
 * Los colores salen de los tokens del tema del tenant, así que siguen al
 * modo oscuro y a la marca del entrenador; el trainer sigue con la paleta
 * por métrica (lib/charts/palette.ts) y sus grises fijos.
 *
 * `hsl(var(--heroui-*))`: las vars de HeroUI son tripletes HSL.
 */
export const INK = {
  mark: "hsl(var(--heroui-primary))",
  surface: "hsl(var(--heroui-content1))",
  grid: "hsl(var(--heroui-default-200))",
  tick: "hsl(var(--heroui-default-500))",
  cursor: "hsl(var(--heroui-default-100))",
} as const;

/** Barras anteriores a la última (prototipo: solo la actual a tinta plena). */
export const INK_PAST_OPACITY = 0.35;

export const TOOLTIP_CLASSES = {
  default: {
    box: "rounded-[10px] border-0 shadow-md text-xs text-gray-900 px-3 py-2 bg-white",
    period: "text-[10px] text-gray-500 mb-1 leading-snug",
    label: "text-[11px] text-gray-600 mb-0.5",
  },
  ink: {
    box: "rounded-[10px] border-0 shadow-medium text-xs text-foreground px-3 py-2 bg-content1",
    period: "text-[10px] text-default-500 mb-1 leading-snug",
    label: "text-[11px] text-default-500 mb-0.5",
  },
} as const;

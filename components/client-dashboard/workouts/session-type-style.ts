// Estilo visual fijo para cada tipo de sesión (fuerza, cardio, etc.).
//
// Por qué no usamos el sistema de colores de HeroUI (`color="primary"` /
// `color="danger"`): el theme primario es dinámico por tenant — el
// trainer puede haber elegido un primario amarillo, rosa pastel o gris.
// El variant `flat` de HeroUI compone bg + text del MISMO token de
// color, así que en temas claros el chip queda con texto pastel sobre
// fondo casi blanco e ilegible. Hard-codear texto blanco tampoco
// funciona porque a veces queremos un fondo soft (donde blanco
// desaparece).
//
// Solución: paleta fija de Tailwind por tipo de sesión. La identidad
// visual del tipo (fuerza = azul, cardio = rojo) es global del producto,
// no de la marca del trainer, así que usar tokens de Tailwind es lo
// correcto.
//
// El portal no lleva clase `dark` (el fondo oscuro sale del tema del
// tenant), así que los tonos de icono son medios (500/600): ≥3:1 tanto sobre
// blanco como sobre un fondo casi negro. Los fondos van en alpha.

import type { SessionType } from "@/types/training";

export interface SessionTypeStyle {
  label: string;
  icon: string;
  // Tailwind utility classes para el chip (bg + text).
  chipClass: string;
  /** Tile del tipo (fondo alpha + icono), legible en claro y oscuro. */
  tileClass: string;
  /** Punto de color sólido (cabeceras de grupo). */
  dotClass: string;
}

// Orden estable para agrupar sesiones por tipo en la pantalla del
// cliente. Fuerza primero (es lo más común), después cardio, luego el
// resto. "other" siempre al final.
export const SESSION_TYPE_ORDER: SessionType[] = [
  "strength",
  "cardio",
  "flexibility",
  "sports",
  "recovery",
  "other",
];

export const SESSION_TYPE_STYLES: Record<SessionType, SessionTypeStyle> = {
  strength: {
    label: "Fuerza",
    icon: "solar:dumbbell-bold",
    chipClass: "bg-blue-500/15 text-foreground",
    tileClass: "bg-blue-500/15 text-blue-500",
    dotClass: "bg-blue-500",
  },
  cardio: {
    label: "Cardio",
    icon: "solar:heart-pulse-bold",
    chipClass: "bg-rose-500/15 text-foreground",
    tileClass: "bg-rose-500/15 text-rose-500",
    dotClass: "bg-rose-500",
  },
  flexibility: {
    label: "Flexibilidad",
    icon: "solar:body-bold",
    chipClass: "bg-violet-500/15 text-foreground",
    tileClass: "bg-violet-500/15 text-violet-500",
    dotClass: "bg-violet-500",
  },
  sports: {
    label: "Deportes",
    icon: "solar:medal-star-bold",
    chipClass: "bg-amber-500/15 text-foreground",
    tileClass: "bg-amber-500/15 text-amber-600",
    dotClass: "bg-amber-600",
  },
  recovery: {
    label: "Descanso activo",
    icon: "solar:sleeping-bold",
    chipClass: "bg-emerald-500/15 text-foreground",
    tileClass: "bg-emerald-500/15 text-emerald-600",
    dotClass: "bg-emerald-600",
  },
  other: {
    label: "Otro",
    icon: "solar:dumbbell-linear",
    chipClass: "bg-slate-500/15 text-foreground",
    tileClass: "bg-slate-500/15 text-slate-500",
    dotClass: "bg-slate-500",
  },
};

export function getSessionTypeStyle(
  type: SessionType | null | undefined
): SessionTypeStyle {
  return SESSION_TYPE_STYLES[type ?? "other"];
}

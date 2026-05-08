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

import type { SessionType } from "@/types/training";

export interface SessionTypeStyle {
  label: string;
  icon: string;
  // Tailwind utility classes para el chip (bg + text + border).
  chipClass: string;
  // Color de icono (fondo del placeholder cuando no hay imagen).
  iconBgClass: string;
  iconColorClass: string;
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
    chipClass: "bg-blue-100 text-blue-700 border border-blue-200/60",
    iconBgClass: "bg-blue-100",
    iconColorClass: "text-blue-700",
  },
  cardio: {
    label: "Cardio",
    icon: "solar:heart-pulse-bold",
    chipClass: "bg-rose-100 text-rose-700 border border-rose-200/60",
    iconBgClass: "bg-rose-100",
    iconColorClass: "text-rose-700",
  },
  flexibility: {
    label: "Flexibilidad",
    icon: "solar:body-bold",
    chipClass: "bg-violet-100 text-violet-700 border border-violet-200/60",
    iconBgClass: "bg-violet-100",
    iconColorClass: "text-violet-700",
  },
  sports: {
    label: "Deportes",
    icon: "solar:medal-star-bold",
    chipClass: "bg-amber-100 text-amber-700 border border-amber-200/60",
    iconBgClass: "bg-amber-100",
    iconColorClass: "text-amber-700",
  },
  recovery: {
    label: "Descanso activo",
    icon: "solar:sleeping-bold",
    chipClass: "bg-emerald-100 text-emerald-700 border border-emerald-200/60",
    iconBgClass: "bg-emerald-100",
    iconColorClass: "text-emerald-700",
  },
  other: {
    label: "Otro",
    icon: "solar:dumbbell-linear",
    chipClass: "bg-slate-100 text-slate-700 border border-slate-200/60",
    iconBgClass: "bg-slate-100",
    iconColorClass: "text-slate-700",
  },
};

export function getSessionTypeStyle(
  type: SessionType | null | undefined
): SessionTypeStyle {
  return SESSION_TYPE_STYLES[type ?? "other"];
}

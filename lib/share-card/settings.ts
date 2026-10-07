// Ajustes de la tarjeta "Comparte tu sesión" que elige el entrenador
// (Fase 2, JC 23 sep). Viven en tenants.features.share_card, que ya llega
// al portal del cliente vía ClientTenantInfo. Puro: lo usan la pestaña de
// ajustes, las rutas de imagen y el botón del cliente.

// Todos transparentes, como los stickers de Strava (David, 23 sep):
//   panel — un panel oscuro translúcido detrás de la tarjeta.
//   white — sin tarjetas, texto blanco (fotos oscuras).
//   ink   — sin tarjetas, texto oscuro (fotos claras).
export const SHARE_CARD_STYLES = ["panel", "white", "ink"] as const;

export type ShareCardStyle = (typeof SHARE_CARD_STYLES)[number];

/** Orden = orden en la tarjeta. */
export const SHARE_CARD_STATS = [
  "volume",
  "sets",
  "cardio",
  "exercises",
  "reps",
  "records",
  "sessionCount",
] as const;

export type ShareCardStat = (typeof SHARE_CARD_STATS)[number];

export const SHARE_CARD_STAT_LABELS: Record<ShareCardStat, string> = {
  volume: "Volumen (kg)",
  sets: "Series",
  cardio: "Cardio (minutos y km)",
  exercises: "Ejercicios",
  reps: "Repeticiones",
  records: "Récords del día",
  sessionCount: "Nº de sesión",
};

export interface ShareCardSettings {
  enabled: boolean;
  style: ShareCardStyle;
  stats: ShareCardStat[];
  /** Nombre en la tarjeta; "" = el nombre de la marca (JC, 3 oct). */
  displayName: string;
  /** Usuario de Instagram sin @; "" = no se muestra. */
  instagram: string;
  /** Lista de ejercicios bajo la firma ("Press banca · 4 series"). */
  exerciseList: boolean;
  /** "topcoach.io" al pie. */
  showTopcoach: boolean;
}

// JC (3 oct): fuera volumen, reps, series y "Sesiones con…"; la lista de
// ejercicios cuenta la sesión. Lista y topcoach.io son campos propios (no
// stats) para que los ajustes ya guardados también los tengan activados.
export const DEFAULT_SHARE_CARD_SETTINGS: ShareCardSettings = {
  enabled: true,
  style: "panel",
  stats: ["cardio", "records"],
  displayName: "",
  instagram: "",
  exerciseList: true,
  showTopcoach: true,
};

const DISPLAY_NAME_MAX = 40;
const INSTAGRAM_RE = /^[A-Za-z0-9._]{1,30}$/;

const cleanDisplayName = (value: unknown): string =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, DISPLAY_NAME_MAX)
    : "";

/** "@usuario" o "usuario" → "usuario"; null si no es un usuario válido. */
export function cleanInstagram(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const handle = value.trim().replace(/^@/, "");

  if (handle === "") return "";

  return INSTAGRAM_RE.test(handle) ? handle : null;
}

const isStyle = (value: unknown): value is ShareCardStyle =>
  (SHARE_CARD_STYLES as readonly unknown[]).includes(value);

const isStat = (value: unknown): value is ShareCardStat =>
  (SHARE_CARD_STATS as readonly unknown[]).includes(value);

/** Lee y sanea un valor cualquiera; lo inválido cae al default campo a campo. */
export function parseShareCardSettings(value: unknown): ShareCardSettings {
  const raw =
    value !== null && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const stats = Array.isArray(raw.stats)
    ? SHARE_CARD_STATS.filter((stat) => (raw.stats as unknown[]).includes(stat))
    : DEFAULT_SHARE_CARD_SETTINGS.stats;

  return {
    enabled:
      typeof raw.enabled === "boolean"
        ? raw.enabled
        : DEFAULT_SHARE_CARD_SETTINGS.enabled,
    style: isStyle(raw.style) ? raw.style : DEFAULT_SHARE_CARD_SETTINGS.style,
    stats,
    displayName: cleanDisplayName(raw.displayName),
    instagram: cleanInstagram(raw.instagram) ?? "",
    exerciseList:
      typeof raw.exerciseList === "boolean"
        ? raw.exerciseList
        : DEFAULT_SHARE_CARD_SETTINGS.exerciseList,
    showTopcoach:
      typeof raw.showTopcoach === "boolean"
        ? raw.showTopcoach
        : DEFAULT_SHARE_CARD_SETTINGS.showTopcoach,
  };
}

/** Ajustes del tenant a partir de su columna `features`. */
export function shareCardSettingsFromFeatures(
  features: unknown
): ShareCardSettings {
  const shareCard =
    features !== null && typeof features === "object"
      ? (features as Record<string, unknown>).share_card
      : undefined;

  return parseShareCardSettings(shareCard);
}

/** Valida estricto un body del PUT: null si algo no encaja. */
export function validateShareCardSettings(
  value: unknown
): ShareCardSettings | null {
  if (value === null || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw.enabled !== "boolean" || !isStyle(raw.style)) return null;
  if (!Array.isArray(raw.stats) || !raw.stats.every(isStat)) return null;
  if (raw.displayName !== undefined && typeof raw.displayName !== "string") {
    return null;
  }
  if (raw.instagram !== undefined && cleanInstagram(raw.instagram) === null) {
    return null;
  }
  for (const key of ["exerciseList", "showTopcoach"] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== "boolean") return null;
  }

  return parseShareCardSettings(raw);
}

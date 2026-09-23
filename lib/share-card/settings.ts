// Ajustes de la tarjeta "Comparte tu sesión" que elige el entrenador
// (Fase 2, JC 23 sep). Viven en tenants.features.share_card, que ya llega
// al portal del cliente vía ClientTenantInfo. Puro: lo usan la pestaña de
// ajustes, las rutas de imagen y el botón del cliente.

// Todos transparentes, como los stickers de Strava (David, 23 sep):
//   panel — recuadro oscuro redondeado sobre fondo transparente.
//   white — sin recuadro, texto blanco (fotos oscuras).
//   ink   — sin recuadro, texto oscuro (fotos claras).
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
}

export const DEFAULT_SHARE_CARD_SETTINGS: ShareCardSettings = {
  enabled: true,
  style: "panel",
  stats: [...SHARE_CARD_STATS],
};

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

  return parseShareCardSettings(raw);
}

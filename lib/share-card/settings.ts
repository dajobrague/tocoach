// Ajustes de "Compartir" que pone el entrenador. Desde el 14 oct (JC) el
// cliente compone la imagen (plantilla, fondo, datos, color); el entrenador
// solo firma: si se puede compartir, su nombre, su Instagram y el pie
// "topcoach.io". Logo y color salen del tema. Viven en
// tenants.features.share_card; campos antiguos (style, stats, exerciseList)
// se ignoran al leer.

export interface ShareCardSettings {
  enabled: boolean;
  /** Nombre en la imagen; "" = el nombre de la marca. */
  displayName: string;
  /** Usuario de Instagram sin @; "" = no se muestra. */
  instagram: string;
  /** Mostrar el pie. */
  showTopcoach: boolean;
  /** Texto del pie (p. ej. el nombre del programa); "" = "topcoach.io". */
  footer: string;
}

export const DEFAULT_SHARE_CARD_SETTINGS: ShareCardSettings = {
  enabled: true,
  displayName: "",
  instagram: "",
  showTopcoach: true,
  footer: "",
};

const DISPLAY_NAME_MAX = 40;
const FOOTER_MAX = 40;
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

const cleanFooter = (value: unknown): string =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, FOOTER_MAX)
    : "";

const bool = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

/** Lee y sanea un valor cualquiera; lo inválido cae al default campo a campo. */
export function parseShareCardSettings(value: unknown): ShareCardSettings {
  const raw =
    value !== null && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    enabled: bool(raw.enabled, DEFAULT_SHARE_CARD_SETTINGS.enabled),
    displayName: cleanDisplayName(raw.displayName),
    instagram: cleanInstagram(raw.instagram) ?? "",
    showTopcoach: bool(
      raw.showTopcoach,
      DEFAULT_SHARE_CARD_SETTINGS.showTopcoach
    ),
    footer: cleanFooter(raw.footer),
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

  if (typeof raw.enabled !== "boolean") return null;
  if (raw.displayName !== undefined && typeof raw.displayName !== "string") {
    return null;
  }
  if (raw.instagram !== undefined && cleanInstagram(raw.instagram) === null) {
    return null;
  }
  if (raw.showTopcoach !== undefined && typeof raw.showTopcoach !== "boolean") {
    return null;
  }

  if (raw.footer !== undefined && typeof raw.footer !== "string") return null;

  return parseShareCardSettings(raw);
}

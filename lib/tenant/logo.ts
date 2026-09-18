// Pure helpers (no server-only): usados por el loader, rutas y componentes.

/**
 * `true` solo para una URL https real. Rechaza `blob:` (vista previa del
 * navegador, muere al cerrar la pestaña), `data:` y cadenas sueltas: nada de
 * eso sirve como logo para otros usuarios.
 */
export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * El logo que ven los clientes. Un tenant puede tener el logo en cuatro
 * sitios (columna `logo_url`, `theme_json.assets.logo`, `theme_json.logo.url`,
 * `theme_json.meta.logoUrl`) y en prod hubo filas con un `blob:` en los dos
 * primeros y el archivo real en el tercero: el cliente veía el icono de
 * fallback en vez del logo. Devuelve la primera URL https utilizable o "".
 */
export function resolveTenantLogoUrl(
  logoUrl: unknown,
  themeJson: unknown
): string {
  const theme =
    themeJson !== null && typeof themeJson === "object"
      ? (themeJson as Record<string, any>)
      : {};
  const candidates = [
    logoUrl,
    theme.assets?.logo,
    theme.logo?.url,
    theme.meta?.logoUrl,
  ];

  for (const candidate of candidates) {
    if (isHttpsUrl(candidate)) {
      return candidate;
    }
  }

  return "";
}

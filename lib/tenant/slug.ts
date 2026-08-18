// Validación de formato del slug/host de tenant. El slug es el primer
// segmento de la URL pública del cliente (app.topcoach.io/[slug]/...) y la
// PK de `tenants` (host), así que SOLO admite ASCII url-safe: un slug con
// caracteres fuera de este set (p.ej. "danielmuñoz") viaja percent-encoded
// en la URL y el middleware nunca lo matchea contra la tabla → 404 perpetuo
// del portal del cliente. El wizard ya sanea en el input; esto es la
// barrera del lado servidor para save-domain / save-configuration /
// check-domain.

/** Minúsculas, dígitos y guiones; empieza y termina alfanumérico; 3-30 chars. */
export function validateSlugFormat(slug: string): boolean {
  const pattern = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

  return pattern.test(slug.toLowerCase().trim());
}

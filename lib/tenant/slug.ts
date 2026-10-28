// Tenant slug rules, shared by the admin UI and the create-trainer API.
// A slug is the first path segment of the client portal (/<slug>), so it must
// be URL-safe ASCII — "danielmuñoz" percent-encoded and 404'd the portal.

// Same shape the setup wizard's check-domain route enforces.
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

// First path segments the middleware routes elsewhere (middleware.ts
// excludedRoutes); a tenant with one of these slugs would be unreachable.
export const RESERVED_SLUGS = new Set([
  "trainer",
  "admin",
  "auth",
  "api",
  "brands",
  "about",
  "blog",
  "docs",
  "pricing",
  "icons",
  "404",
  "500",
]);

/** "José Peña" → "jose-pena". */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, 30)
    .replace(/^-+|-+$/g, "");
}

/** Spanish error for an invalid slug, or null when the format is fine. */
export function slugFormatError(slug: string): string | null {
  if (slug.length < 3) return "Mínimo 3 caracteres.";
  if (!SLUG_PATTERN.test(slug)) {
    return "Solo minúsculas, números y guiones, sin guion al inicio ni al final.";
  }
  if (RESERVED_SLUGS.has(slug)) return "Esta dirección está reservada.";

  return null;
}

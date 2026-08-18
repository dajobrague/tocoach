/**
 * Normalize a trainer-entered product URL so it renders as an absolute link.
 * The inventory form accepts free text ("www.tienda.com/x"), and a scheme-less
 * href becomes a relative link that 404s inside the app — prefixing https://
 * at render time also fixes rows already stored without a scheme.
 */
export function normalizeProductUrl(url: string): string {
  const trimmed = url.trim();

  if (trimmed.length === 0) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  return `https://${trimmed}`;
}

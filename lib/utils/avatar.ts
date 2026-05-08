/**
 * Rewrites a Supabase Storage public URL to use the image rendering endpoint,
 * which returns a server-side resized version. Avoids the noisy downscale that
 * happens when a high-definition camera photo is rendered into a small circle.
 *
 * Non-Supabase URLs (external CDNs, etc.) are returned untouched.
 */
export function thumbnailUrl(url: string, size: number): string {
  if (!url) return url;
  const objectPath = "/storage/v1/object/public/";
  const renderPath = "/storage/v1/render/image/public/";

  if (!url.includes(objectPath)) return url;
  const rewritten = url.replace(objectPath, renderPath);
  const separator = rewritten.includes("?") ? "&" : "?";

  return `${rewritten}${separator}width=${size}&height=${size}&resize=cover&quality=80`;
}

/**
 * Builds the two-letter initials shown when no profile picture is available.
 * Returns "?" if both inputs are missing so the avatar slot is never empty.
 */
export function buildInitials(
  firstName: string | undefined,
  lastName: string | undefined
): string {
  const result = `${firstName?.charAt(0) ?? ""}${lastName?.charAt(0) ?? ""}`
    .toUpperCase()
    .trim();

  return result || "?";
}

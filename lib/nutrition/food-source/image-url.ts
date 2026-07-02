/**
 * Derive a larger Open Food Facts image URL for a lightbox/expanded view.
 *
 * OFF encodes the rendered size as the last numeric segment of the filename
 * (e.g. `front_fr.715.200.jpg` → 200px). We store the small thumbnail; this
 * swaps it to the 400px variant for a crisper expanded image. If the URL does
 * not match the expected pattern it is returned unchanged, so a non-OFF or
 * future URL shape degrades to showing the thumbnail at size.
 */
export function largerImageUrl(url: string): string {
  return url.replace(/\.\d+\.jpg$/i, ".400.jpg");
}

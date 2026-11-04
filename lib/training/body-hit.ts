// Tap/hover on the shaded body: the overlays are transparent images, so a
// muscle is "under the pointer" when its overlay has opaque pixels there.
// Each overlay is drawn once into a small canvas (cached); if the browser
// refuses to read it (no CORS on the image host) the helpers answer null and
// the muscle chips stay the way to pick.

import { BODY_OVERLAYS, bodyFile, type BodyView } from "./body-overlays";
import { MUSCLES, type MuscleId } from "./muscles";

const W = 128;
const H = Math.round((W * 1864) / 640); // same aspect as the kit's canvas
const OPAQUE = 70;

const alphaCache = new Map<string, Promise<Uint8ClampedArray | null>>();

function alphaOf(url: string): Promise<Uint8ClampedArray | null> {
  const key = url.split("?")[0]!; // the signed token changes, the file doesn't
  let cached = alphaCache.get(key);

  if (!cached) {
    cached = new Promise((resolve) => {
      const img = new Image();

      img.crossOrigin = "anonymous";
      img.onerror = () => resolve(null);
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");

          canvas.width = W;
          canvas.height = H;
          const ctx = canvas.getContext("2d");

          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, W, H);
          const rgba = ctx.getImageData(0, 0, W, H).data;
          const alpha = new Uint8ClampedArray(W * H);

          for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3]!;
          resolve(alpha);
        } catch {
          resolve(null); // tainted canvas
        }
      };
      img.src = url;
    });
    alphaCache.set(key, cached);
  }

  return cached;
}

/**
 * Muscle group under the point (u, v in 0..1 of the figure) or null. The
 * lateral deltoid is skipped: it shares one shape with the anterior/posterior
 * heads, so those win and the lateral head is picked from the chips.
 */
export async function hitMuscle(
  view: BodyView,
  files: Record<string, string>,
  u: number,
  v: number
): Promise<MuscleId | null> {
  const x = Math.min(W - 1, Math.max(0, Math.floor(u * W)));
  const y = Math.min(H - 1, Math.max(0, Math.floor(v * H)));

  for (const { id } of MUSCLES) {
    if (id === "deltoides_lateral") continue;

    for (const name of BODY_OVERLAYS[id][view] ?? []) {
      const url = files[bodyFile(view, name)];
      const alpha = url ? await alphaOf(url) : null;

      if (alpha && alpha[y * W + x]! > OPAQUE) return id;
    }
  }

  return null;
}

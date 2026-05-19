// scripts/generate-topcoach-icons.mjs
//
// Regenerates the static TopCoach PNG icons from the canonical WebP mark.
// Run when public/brands/topcoach/mark.webp changes.
//
// Usage: node scripts/generate-topcoach-icons.mjs
//
// Output: public/icons/icon-{size}x{size}.png for sizes
//   72, 96, 128, 144, 152, 180, 192, 384, 512.
//
// The mark is rendered onto a transparent canvas at the target dimension
// using fit:"contain" so non-square sources letterbox without crop.
// (The provided mark is already square with built-in background; this
// is defensive in case the source is ever swapped.)

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SOURCE = join(ROOT, "public/brands/topcoach/mark.webp");
const OUT_DIR = join(ROOT, "public/icons");
const SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512];

async function main() {
  const source = await readFile(SOURCE);
  await mkdir(OUT_DIR, { recursive: true });

  for (const size of SIZES) {
    const out = join(OUT_DIR, `icon-${size}x${size}.png`);
    const buffer = await sharp(source)
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toBuffer();
    await writeFile(out, buffer);
    console.log(`✓ wrote ${out} (${buffer.length} bytes)`);
  }

  console.log(`\nDone. Regenerated ${SIZES.length} icons.`);
}

main().catch((err) => {
  console.error("Failed to generate icons:", err);
  process.exit(1);
});

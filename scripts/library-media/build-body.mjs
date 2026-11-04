// Offline: RepDB muscle_heatmap kit (per-muscle L/R overlays, ~1500x4000) ->
// phone-sized WebP: <view>_base.webp and <view>_<muscle>.webp (L+R merged).
// All files of a view share one canvas, so resizing keeps them aligned.
//   node scripts/library-media/build-body.mjs <bundleDir> <male|female> <outDir>
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

const [bundle, sex, out] = process.argv.slice(2);

if (!bundle || !["male", "female"].includes(sex) || !out) {
  console.error("usage: build-body.mjs <bundleDir> <male|female> <outDir>");
  process.exit(1);
}

const WIDTH = 640;
const dir = join(bundle, "images/muscle_heatmap");
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));

mkdirSync(out, { recursive: true });
let total = 0;
const save = async (img, name, quality) => {
  const file = join(out, name);

  await img.resize({ width: WIDTH }).webp({ quality, alphaQuality: 85 }).toFile(file);
  total += statSync(file).size;
};

for (const view of ["front", "back"]) {
  const { base, muscles } = manifest[view];

  await save(sharp(join(dir, base)), `${view}_base.webp`, 80);

  const byName = Map.groupBy(muscles, (m) => m.name);

  for (const [name, sides] of byName) {
    const [first, ...rest] = sides.map((s) => join(dir, s.file));
    // Merge at full size first (sharp resizes before compositing otherwise).
    const merged = await sharp(first)
      .composite(rest.map((input) => ({ input })))
      .png()
      .toBuffer();

    await save(sharp(merged), `${view}_${name}.webp`, 75);
  }
  console.log(view, byName.size, "muscles");
}
console.log(`${sex}: ${(total / 1e6).toFixed(2)} MB total`);

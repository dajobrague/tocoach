// Offline: RepDB animated WebP (960px, transparent, ~3.7MB) -> light assets.
//   <slug>.mp4   H.264 480px on white, hardware-decodable everywhere, ~25-50KB
//   <slug>.webp  poster (first frame / still), ~10-20KB
// ffmpeg cannot decode animated WebP, so frames come from sharp and are piped
// raw into ffmpeg. Usage:
//   node scripts/library-media/build.mjs <bundleDir> <male|female> <outDir> [--limit N | slug ...]
// ponytail: uniform frame rate (average delay), white background only; add a
// dark variant when the client app gets dark mode.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

const [bundle, sex, out, ...rest] = process.argv.slice(2);

if (!bundle || !["male", "female"].includes(sex) || !out) {
  console.error(
    "usage: build.mjs <bundleDir> <male|female> <outDir> [--limit N | slug ...]"
  );
  process.exit(1);
}

const SIZE = 480;
const animDir = join(bundle, "images/animations");
const stillDir = join(bundle, "images/classic");
// Animated exercises plus stills-only ones (holds, stretches: <slug>-main|start.webp).
const stillRe = /-(main|start)\.webp$/;
const all = [
  ...new Set([
    ...readdirSync(animDir)
      .filter((f) => f.endsWith(".webp"))
      .map((f) => f.slice(0, -5)),
    ...readdirSync(stillDir)
      .filter((f) => stillRe.test(f))
      .map((f) => f.replace(stillRe, "")),
  ]),
].sort();
const limitAt = rest.indexOf("--limit");
const slugs =
  limitAt >= 0
    ? all
        .filter(
          (_, i) => i % Math.floor(all.length / Number(rest[limitAt + 1])) === 0
        )
        .slice(0, Number(rest[limitAt + 1]))
    : rest.length
      ? rest
      : all;

mkdirSync(out, { recursive: true });

const encode = (raw, fps) =>
  new Promise((resolve, reject) => {
    const dest = raw.dest;
    const ff = spawn(ffmpegPath, [
      "-y",
      "-v",
      "error",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "-s",
      `${SIZE}x${SIZE}`,
      "-framerate",
      String(fps),
      "-i",
      "-",
      "-c:v",
      "libx264",
      "-crf",
      "28",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      dest,
    ]);

    ff.on("error", reject);
    ff.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))
    );
    ff.stdin.end(raw.data);
  });

const flat = (img) =>
  img
    .resize(SIZE, SIZE, { fit: "contain", background: "#fff" })
    .flatten({ background: "#fff" });
let totalBytes = 0;

for (const slug of slugs) {
  const anim = join(animDir, `${slug}.webp`);
  const mp4 = join(out, `${slug}.mp4`);
  const poster = join(out, `${slug}.webp`);

  if (existsSync(anim)) {
    const meta = await sharp(anim, { animated: true }).metadata();
    const delays = meta.delay?.length ? meta.delay : [40];
    const fps =
      Math.round(
        (1000 / (delays.reduce((a, b) => a + b, 0) / delays.length)) * 100
      ) / 100;
    const { data } = await flat(sharp(anim, { animated: true, pages: -1 }))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    await encode({ data, dest: mp4 }, fps);
    await flat(sharp(anim, { page: 0 }))
      .webp({ quality: 70 })
      .toFile(poster);
  } else {
    const still = ["main", "start"]
      .map((k) => join(stillDir, `${slug}-${k}.webp`))
      .find(existsSync);

    if (!still) {
      console.warn("skip (no media):", slug);
      continue;
    }
    await flat(sharp(still)).webp({ quality: 70 }).toFile(poster);
  }
  const bytes = [mp4, poster]
    .filter(existsSync)
    .reduce((a, f) => a + statSync(f).size, 0);

  totalBytes += bytes;
  console.log(`${slug.padEnd(34)} ${(bytes / 1e3).toFixed(0).padStart(5)} KB`);
}
console.log(
  `${sex}: ${slugs.length} exercises, ${(totalBytes / 1e6).toFixed(2)} MB total`
);

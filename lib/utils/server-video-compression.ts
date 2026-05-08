// Server-side video compression backed by the native ffmpeg binary shipped
// by `ffmpeg-static` (no system install or third-party service needed). Runs
// inside the Next.js Node runtime on Railway and is wired into the upload
// API routes so quality/encoding is controlled server-side instead of by a
// WASM build in the browser.

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import ffmpegStaticPath from "ffmpeg-static";

// `ffmpeg-static` computes its binary path at module-load time using
// `__dirname`. Bundlers (Turbopack, webpack) sometimes rewrite `__dirname`
// to a virtual prefix like `/ROOT`, which makes the exported path point
// somewhere that doesn't exist on disk. `next.config.js` declares this
// package as a server external so the bundler leaves it alone, but if that
// guard ever slips we want a useful error rather than a cryptic ENOENT.
function resolveFfmpegBinary(): string {
  if (ffmpegStaticPath && existsSync(ffmpegStaticPath)) {
    return ffmpegStaticPath;
  }

  const fallback = join(
    process.cwd(),
    "node_modules",
    "ffmpeg-static",
    "ffmpeg"
  );

  if (existsSync(fallback)) {
    return fallback;
  }

  throw new Error(
    `ffmpeg binary not found. Tried: ${ffmpegStaticPath ?? "(unset)"} and ${fallback}. ` +
      "Ensure the `ffmpeg-static` package is installed and listed under " +
      "`serverExternalPackages` in next.config.js so its `__dirname`-based " +
      "path resolution survives bundling."
  );
}

export interface CompressedVideo {
  buffer: Buffer;
  contentType: "video/mp4";
  filename: string;
}

const FFMPEG_ARGS = (input: string, output: string): string[] => [
  "-y",
  "-i",
  input,
  // Cap longest side at 1920px (1080p) regardless of orientation, keep
  // even dimensions for libx264, preserve aspect ratio.
  "-vf",
  "scale='min(1920,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
  // Video: H.264, balanced quality/size, 4:2:0 chroma for universal playback.
  "-c:v",
  "libx264",
  "-crf",
  "23",
  "-preset",
  "medium",
  "-pix_fmt",
  "yuv420p",
  // Tag the output with standard SDR Rec. 709 metadata so players don't
  // misinterpret colors. Phones often record HDR (HLG/PQ) or wide-gamut
  // (Display P3); without this, re-encoded SDR output looks washed out.
  "-color_primaries",
  "bt709",
  "-color_trc",
  "bt709",
  "-colorspace",
  "bt709",
  // Audio: AAC LC 128 kbps stereo — universally playable.
  "-c:a",
  "aac",
  "-b:a",
  "128k",
  // Move the moov atom to the front so the file streams while downloading.
  "-movflags",
  "+faststart",
  output,
];

export interface CompressOptions {
  /**
   * Hard ceiling on encoding wall-clock time (ms). If exceeded, the ffmpeg
   * child is killed and the caller falls back to the original file. Defaults
   * to 9 minutes so the upload routes (maxDuration = 600s) still have time
   * to write the result to storage before the request budget runs out. With
   * the 1 GB raw cap, this covers most long phone clips end-to-end and
   * avoids the worst case of a multi-hundred-MB raw file getting stored
   * uncompressed.
   */
  timeoutMs?: number;
}

export async function compressVideo(
  input: { buffer: Buffer; filename: string },
  options: CompressOptions = {}
): Promise<CompressedVideo> {
  const ffmpegBinary = resolveFfmpegBinary();
  const { timeoutMs = 9 * 60 * 1000 } = options;

  const workDir = await mkdtemp(join(tmpdir(), "tc-vid-"));
  const inputExt = extractExtension(input.filename) || ".bin";
  const inputPath = join(workDir, `in-${randomUUID()}${inputExt}`);
  const outputPath = join(workDir, `out-${randomUUID()}.mp4`);

  try {
    // `writeFile`'s Buffer overload is rejected under @types/node 20.5.7 +
    // modern TS due to a benign Iterator type mismatch in `Uint8Array.entries`;
    // hand it the underlying bytes as a plain Uint8Array view to satisfy the
    // signature without changing runtime behavior.
    const inputView = new Uint8Array(
      input.buffer.buffer,
      input.buffer.byteOffset,
      input.buffer.byteLength
    );

    await writeFile(inputPath, inputView);

    await runFFmpeg(
      ffmpegBinary,
      FFMPEG_ARGS(inputPath, outputPath),
      timeoutMs
    );

    const buffer = await readFile(outputPath);

    return {
      buffer,
      contentType: "video/mp4",
      filename: replaceExtension(input.filename, ".mp4"),
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {
      // best-effort cleanup; tmpdir is reaped on container restart
    });
  }
}

function runFFmpeg(
  binary: string,
  args: string[],
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "ignore", "pipe"] });

    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      // ffmpeg writes its progress + diagnostics to stderr. Keep only the
      // tail so a runaway process doesn't blow up memory while still giving
      // a useful error if encoding fails.
      stderr += chunk.toString();
      if (stderr.length > 16 * 1024) {
        stderr = stderr.slice(-16 * 1024);
      }
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`ffmpeg timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `ffmpeg exited with code ${code} signal ${signal}: ${stderr}`
          )
        );
      }
    });
  });
}

function extractExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");

  return dot >= 0 ? filename.slice(dot) : "";
}

function replaceExtension(filename: string, newExt: string): string {
  const dot = filename.lastIndexOf(".");
  const base = dot >= 0 ? filename.slice(0, dot) : filename;

  return base + newExt;
}

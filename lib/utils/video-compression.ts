import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;

  ffmpeg = new FFmpeg();

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  return ffmpeg;
}

export function isCompressionSupported(): boolean {
  try {
    return typeof WebAssembly === "object" && typeof Worker !== "undefined";
  } catch {
    return false;
  }
}

export async function compressVideo(
  file: File,
  onProgress?: (percent: number) => void
): Promise<File> {
  const instance = await getFFmpeg();

  if (onProgress) {
    instance.on("progress", ({ progress }) => {
      onProgress(Math.round(Math.min(progress * 100, 100)));
    });
  }

  const inputName = "input" + getExtension(file.name);

  await instance.writeFile(inputName, await fetchFile(file));

  await instance.exec([
    "-i",
    inputName,
    "-vf",
    "scale=-2:'min(720,ih)'",
    "-c:v",
    "libx264",
    "-crf",
    "28",
    "-preset",
    "fast",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "output.mp4",
  ]);

  const data = await instance.readFile("output.mp4");

  await instance.deleteFile(inputName);
  await instance.deleteFile("output.mp4");

  const blob = new Blob([data], { type: "video/mp4" });

  return new File([blob], replaceExtension(file.name, ".mp4"), {
    type: "video/mp4",
  });
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");

  return dot >= 0 ? filename.substring(dot) : "";
}

function replaceExtension(filename: string, newExt: string): string {
  const dot = filename.lastIndexOf(".");
  const base = dot >= 0 ? filename.substring(0, dot) : filename;

  return base + newExt;
}

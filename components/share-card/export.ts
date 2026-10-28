"use client";

// Exportar el sticker: SVG (con la fuente incrustada) → <img> → canvas → PNG.
// Sin servidor y sin librerías: es el mismo nodo que ve el cliente, así que
// la imagen sale idéntica a la vista previa. El logo ya viene en data URI,
// por eso el canvas no queda "tainted" y toBlob funciona.

import { embeddedFontCss } from "./fonts";

export const STORY_W = 1080;
export const STORY_H = 1920;
/** Ancho del sticker en la historia a escala 1 (como el prototipo: 86%). */
export const STICKER_SHARE = 0.86;

export type Background =
  | { kind: "transparent" }
  | { kind: "color"; color: string }
  | { kind: "photo"; url: string };

async function svgImage(
  svg: SVGSVGElement,
  width: number
): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const [, , vw = 1000, vh = 1000] = (clone.getAttribute("viewBox") ?? "")
    .split(/\s+/)
    .map(Number);
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");

  style.textContent = await embeddedFontCss();
  clone.insertBefore(style, clone.firstChild);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(Math.round((width * vh) / vw)));
  clone.removeAttribute("class");

  const markup = new XMLSerializer().serializeToString(clone);
  const img = new Image();

  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await img.decode();

  return img;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();

  img.src = url;
  await img.decode();

  return img;
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png"
    )
  );
}

/** Solo el sticker, fondo transparente (para pegarlo en Instagram). */
export async function renderSticker(
  svg: SVGSVGElement,
  width = STORY_W
): Promise<Blob> {
  const img = await svgImage(svg, width);
  const canvas = document.createElement("canvas");

  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext("2d")!.drawImage(img, 0, 0);

  return canvasBlob(canvas);
}

/**
 * Historia 9:16 completa: fondo (color o foto recortada como object-fit
 * cover) y el sticker en su sitio. `x`/`y` son el centro del sticker en
 * fracciones de la historia; `scale` multiplica el ancho base.
 */
export async function renderStory(
  svg: SVGSVGElement,
  background: Background,
  placement: { x: number; y: number; scale: number }
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  canvas.width = STORY_W;
  canvas.height = STORY_H;

  if (background.kind === "color") {
    ctx.fillStyle = background.color;
    ctx.fillRect(0, 0, STORY_W, STORY_H);
  } else if (background.kind === "photo") {
    const photo = await loadImage(background.url);
    const ratio = Math.max(STORY_W / photo.width, STORY_H / photo.height);
    const w = photo.width * ratio;
    const h = photo.height * ratio;

    ctx.drawImage(photo, (STORY_W - w) / 2, (STORY_H - h) / 2, w, h);
  }

  const width = Math.round(STORY_W * STICKER_SHARE * placement.scale);
  const sticker = await svgImage(svg, width);

  ctx.drawImage(
    sticker,
    placement.x * STORY_W - sticker.width / 2,
    placement.y * STORY_H - sticker.height / 2
  );

  return canvasBlob(canvas);
}

export const canCopyImage = () =>
  typeof navigator !== "undefined" &&
  typeof navigator.clipboard?.write === "function" &&
  typeof ClipboardItem !== "undefined";

/**
 * Copiar al portapapeles DENTRO del gesto: Safari exige llamar a write()
 * sin awaits antes, por eso recibe la promesa del PNG (ClipboardItem la
 * acepta) en vez del PNG ya hecho.
 */
export function copyPng(png: Promise<Blob>): Promise<void> {
  return navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

export const canShareFile = (file: File) =>
  typeof navigator !== "undefined" &&
  typeof navigator.canShare === "function" &&
  navigator.canShare({ files: [file] });

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function shareFileName(title: string, date: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${slug || "entreno"}-${date}.png`;
}

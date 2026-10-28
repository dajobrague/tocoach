"use client";

// La tarjeta usa Geist servida desde /fonts/share. Dos usos:
//   1. En pantalla: FontFace en document.fonts para la vista previa y para
//      medir textos (recortar nombres largos) con canvas.measureText.
//   2. Al exportar: un SVG pintado en <img>/canvas no ve las fuentes de la
//      página, así que se incrusta como data URI en el propio SVG.

export const SHARE_FONT = "ShareGeist";

const FACES = [
  { weight: "400", url: "/fonts/share/Geist-400.ttf" },
  { weight: "600", url: "/fonts/share/Geist-600.ttf" },
] as const;

let loading: Promise<void> | null = null;

/** Carga las caras una vez; resuelve aunque falle (cae a la sans del sistema). */
export function ensureShareFonts(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  loading ??= Promise.all(
    FACES.map(async ({ weight, url }) => {
      const face = new FontFace(SHARE_FONT, `url(${url})`, { weight });

      document.fonts.add(await face.load());
    })
  )
    .then(() => undefined)
    .catch((error) => {
      console.warn("[ShareCard] font load failed:", error);
    });

  return loading;
}

let embedded: Promise<string> | null = null;

/** `@font-face` con las fuentes en base64, para meter dentro del SVG. */
export function embeddedFontCss(): Promise<string> {
  embedded ??= Promise.all(
    FACES.map(async ({ weight, url }) => {
      const buffer = await fetch(url).then((res) => res.arrayBuffer());
      const bytes = new Uint8Array(buffer);
      let binary = "";

      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }

      return `@font-face{font-family:${SHARE_FONT};font-weight:${weight};src:url(data:font/ttf;base64,${btoa(binary)}) format("truetype");}`;
    })
  ).then((faces) => faces.join(""));

  return embedded;
}

let ctx: CanvasRenderingContext2D | null = null;

export function textWidth(text: string, size: number, weight = 600): number {
  if (typeof document === "undefined") return text.length * size * 0.55;
  ctx ??= document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * size * 0.55;
  ctx.font = `${weight} ${size}px ${SHARE_FONT}, system-ui, sans-serif`;

  return ctx.measureText(text).width;
}

/** Recorta con "…" hasta que quepa en `max` unidades. */
export function fitText(
  text: string,
  size: number,
  max: number,
  weight = 600
): string {
  if (textWidth(text, size, weight) <= max) return text;
  let cut = text;

  while (cut.length > 1 && textWidth(`${cut}…`, size, weight) > max) {
    cut = cut.slice(0, -1);
  }

  return `${cut.trimEnd()}…`;
}

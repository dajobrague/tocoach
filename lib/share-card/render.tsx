import "server-only";

// Dibujo de la tarjeta de sesión (next/og / Satori: solo flexbox, cada
// contenedor con display:flex). Lo usan la ruta del cliente y la vista
// previa del entrenador, así ambos ven exactamente la misma imagen.
//
// Diseño D, "Firma" (7 oct): la protagonista es la firma de la sesión, una
// barra por serie (lib/share-card/signature.ts) con el récord en el color
// del entrenador. Alrededor, tipografía tranquila: marca arriba, nombre de
// la sesión, una línea destacada y una línea de datos.
//
// Todos los estilos son 1080×1350 con fondo TRANSPARENTE (sticker):
//   panel — un panel oscuro translúcido detrás de todo. Default.
//   white — sin panel, texto blanco con sombra (fotos oscuras).
//   ink   — sin panel, texto oscuro con halo claro (fotos claras).

import type { ShareCardBranding } from "./branding";
import type { ShareCardSettings } from "./settings";
import type { ShareCardStats } from "@/lib/training/share-card-stats";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { layoutSignature } from "./signature";

export interface ShareCardContent {
  branding: ShareCardBranding;
  programName: string | null;
  sessionName: string;
  /** YYYY-MM-DD */
  date: string;
  stats: ShareCardStats;
  sessionNumber: number | null;
}

const WIDTH = 1080;
const HEIGHT = 1350;
const SIGNATURE_HEIGHT = 520;
/** Hueco sobre las barras para la etiqueta del récord. */
const LABEL_SPACE = 56;

// Cargadas una vez por proceso (outputFileTracingIncludes las copia al
// standalone — ver next.config.js).
let fontsPromise: Promise<[Buffer, Buffer, Buffer, Buffer]> | null = null;

function loadFonts() {
  const font = (name: string) =>
    readFile(join(process.cwd(), `assets/fonts/${name}.ttf`));

  fontsPromise ??= Promise.all([
    font("Geist-400"),
    font("Geist-500"),
    font("Geist-600"),
    font("GeistMono-500"),
  ]);

  return fontsPromise;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255
  ) as [number, number, number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

interface Palette {
  ink: string;
  muted: string;
  faint: string;
  bar: string;
  cardioBar: string;
  /** Récord: el color del entrenador si se lee sobre la foto, si no oro. */
  accent: string;
  textShadow: string;
  barShadow: string;
  /** Panel detrás de todo; null = sin panel. */
  panelBg: string | null;
}

function paletteFor(
  style: ShareCardSettings["style"],
  brand: string | null
): Palette {
  const lum = brand !== null ? luminance(brand) : null;

  if (style === "ink") {
    // Sobre foto clara: oscuro, pero distinguible del texto.
    const readable = lum !== null && lum <= 0.6 && lum > 0.23;

    return {
      ink: "#12161C",
      muted: "rgba(18, 22, 28, 0.64)",
      faint: "rgba(18, 22, 28, 0.2)",
      bar: "rgba(18, 22, 28, 0.88)",
      cardioBar: "rgba(18, 22, 28, 0.5)",
      accent: readable && brand !== null ? brand : "#8A5A00",
      textShadow: "0 1px 12px rgba(255, 255, 255, 0.7)",
      barShadow: "0 1px 10px rgba(255, 255, 255, 0.5)",
      panelBg: null,
    };
  }

  // Sobre foto oscura: claro, pero distinguible del blanco.
  const readable = lum !== null && lum >= 0.25 && lum < 0.85;
  const light = {
    ink: "#FFFFFF",
    muted: "rgba(255, 255, 255, 0.74)",
    faint: "rgba(255, 255, 255, 0.26)",
    bar: "rgba(255, 255, 255, 0.92)",
    cardioBar: "rgba(255, 255, 255, 0.6)",
    accent: readable && brand !== null ? brand : "#FFC94D",
  };

  if (style === "white") {
    return {
      ...light,
      textShadow: "0 2px 14px rgba(0, 0, 0, 0.55)",
      barShadow: "0 2px 12px rgba(0, 0, 0, 0.35)",
      panelBg: null,
    };
  }

  return {
    ...light,
    textShadow: "none",
    barShadow: "none",
    panelBg: "rgba(10, 12, 16, 0.46)",
  };
}

const numberEs = (n: number, digits = 0) =>
  n.toLocaleString("es-ES", {
    maximumFractionDigits: digits,
    useGrouping: true,
  });

function shortDate(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`)
    .toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })
    .replace(".", "")
    .toUpperCase();
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

type Headline = {
  text: string;
  record: boolean;
  used: "cardio" | "volume" | null;
};

/** Línea destacada: récord > cardio > volumen, según lo elegido y lo que haya. */
function headlineFor(
  stats: ShareCardStats,
  chosen: ShareCardSettings["stats"]
): Headline | null {
  const [record] = chosen.includes("records") ? stats.records : [];

  if (record !== undefined) {
    const more = stats.records.length - 1;

    return {
      text: `Récord · ${record.exerciseName} · ${numberEs(record.weightKg, 1)} kg × ${record.reps}${more > 0 ? ` · +${more}` : ""}`,
      record: true,
      used: null,
    };
  }
  if (chosen.includes("cardio") && stats.cardioMeters > 0) {
    const minutes = Math.round(stats.cardioSeconds / 60);

    return {
      text: `${numberEs(stats.cardioMeters / 1000, 1)} km${minutes > 0 ? ` · ${minutes} min de cardio` : ""}`,
      record: false,
      used: "cardio",
    };
  }
  if (chosen.includes("volume") && stats.volumeKg > 0) {
    return {
      text: `${numberEs(stats.volumeKg)} kg de volumen`,
      record: false,
      used: "volume",
    };
  }

  return null;
}

/** Resto de datos en una línea, en el orden de SHARE_CARD_STATS (máx. 4). */
function statLine(
  stats: ShareCardStats,
  chosen: ShareCardSettings["stats"],
  used: Headline["used"]
): string {
  const parts: string[] = [];

  for (const stat of chosen) {
    if (stat === "volume" && used !== "volume" && stats.volumeKg > 0) {
      parts.push(`${numberEs(stats.volumeKg)} kg`);
    }
    if (stat === "sets" && stats.sets > 0) parts.push(`${stats.sets} series`);
    if (stat === "cardio" && used !== "cardio" && stats.cardioSeconds > 0) {
      parts.push(`${Math.round(stats.cardioSeconds / 60)} min de cardio`);
    }
    if (stat === "exercises" && stats.exercises > 0) {
      parts.push(`${stats.exercises} ejercicios`);
    }
    if (stat === "reps" && stats.reps > 0) parts.push(`${stats.reps} reps`);
  }

  return parts.slice(0, 4).join("  ·  ");
}

export async function renderShareCard(
  content: ShareCardContent,
  settings: ShareCardSettings,
  headers: Record<string, string>
): Promise<ImageResponse> {
  const [regular, medium, semibold, mono] = await loadFonts();
  const { branding, stats } = content;
  const palette = paletteFor(settings.style, branding.brandColor);
  const record = settings.stats.includes("records")
    ? stats.records[0]
    : undefined;

  const outerPad = palette.panelBg !== null ? 40 : 72;
  const innerPad = palette.panelBg !== null ? 56 : 0;
  const contentWidth = WIDTH - 2 * outerPad - 2 * innerPad;

  const bars = layoutSignature(stats.signature, contentWidth).map((bar) => ({
    ...bar,
    // Nunca más baja que ancha: la cápsula se vería como un punto.
    px: Math.max(bar.width, bar.height * SIGNATURE_HEIGHT),
  }));
  const headline = headlineFor(stats, settings.stats);
  const line = statLine(stats, settings.stats, headline?.used ?? null);
  const sessionLabel =
    settings.stats.includes("sessionCount") &&
    content.sessionNumber !== null &&
    content.sessionNumber > 0
      ? `SESIÓN ${content.sessionNumber}  ·  ${shortDate(content.date)}`
      : shortDate(content.date);

  const name = content.sessionName;
  const nameSize = name.length <= 16 ? 96 : name.length <= 24 ? 80 : 64;
  const monoText = { fontFamily: "Geist Mono", fontWeight: 500 } as const;
  const baseline = LABEL_SPACE + SIGNATURE_HEIGHT;

  const mark = branding.logoSrc ? (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      src={branding.logoSrc}
      style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 14 }}
    />
  ) : (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 56,
        height: 56,
        borderRadius: 14,
        backgroundColor: branding.brandColor ?? palette.faint,
        color:
          branding.brandColor !== null && luminance(branding.brandColor) >= 0.6
            ? "#12161C"
            : "#FFFFFF",
        fontSize: 22,
        fontWeight: 600,
        textShadow: "none",
      }}
    >
      {initials(branding.trainerName)}
    </div>
  );

  const recordBar =
    record !== undefined ? bars.find((bar) => bar.record) : undefined;

  // Etiqueta del récord por encima de la barra más alta que tenga debajo;
  // si queda lejos de la barra del récord, una línea fina las une.
  let recordLabel: {
    text: string;
    left: number;
    top: number;
    width: number;
    stem: number;
  } | null = null;

  if (recordBar !== undefined && record !== undefined) {
    const text = `${numberEs(record.weightKg, 1)} × ${record.reps}`;
    // Geist Mono a 28px ≈ 17px por carácter.
    const width = text.length * 17 + 16;
    const left = Math.min(
      contentWidth - width,
      Math.max(0, recordBar.x + recordBar.width / 2 - width / 2)
    );
    const clearance = Math.max(
      ...bars
        .filter((bar) => bar.x < left + width && bar.x + bar.width > left)
        .map((bar) => bar.px)
    );
    const top = baseline - clearance - 46;
    const gap = clearance - recordBar.px;

    recordLabel = { text, left, top, width, stem: gap > 24 ? gap - 4 : 0 };
  }

  const signature =
    bars.length > 0 ? (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: contentWidth,
          height: baseline + 2,
          marginTop: 56,
        }}
      >
        {bars.map((bar, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: bar.x,
              top: baseline - bar.px,
              width: bar.width,
              height: bar.px,
              borderRadius: bar.width / 2,
              backgroundColor:
                bar === recordBar
                  ? palette.accent
                  : bar.cardio
                    ? palette.cardioBar
                    : palette.bar,
              boxShadow: palette.barShadow,
            }}
          />
        ))}
        {recordLabel !== null ? (
          <div
            style={{
              ...monoText,
              position: "absolute",
              left: recordLabel.left,
              top: recordLabel.top,
              width: recordLabel.width,
              display: "flex",
              justifyContent: "center",
              fontSize: 28,
              lineHeight: 1,
              color: palette.accent,
            }}
          >
            {recordLabel.text}
          </div>
        ) : null}
        {recordLabel !== null && recordLabel.stem > 0 && recordBar ? (
          <div
            style={{
              position: "absolute",
              left: recordBar.x + recordBar.width / 2 - 1,
              top: recordLabel.top + 38,
              width: 2,
              height: recordLabel.stem,
              backgroundColor: palette.accent,
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: baseline,
            width: contentWidth,
            height: 2,
            backgroundColor: palette.faint,
          }}
        />
      </div>
    ) : null;

  const element = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Geist",
        color: palette.ink,
        textShadow: palette.textShadow,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: WIDTH - 2 * outerPad,
          padding: innerPad,
          borderRadius: 48,
          ...(palette.panelBg !== null
            ? { backgroundColor: palette.panelBg }
            : {}),
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {mark}
            <span
              style={{ fontSize: 32, fontWeight: 600, letterSpacing: -0.5 }}
            >
              {branding.trainerName}
            </span>
          </div>
          <span
            style={{
              ...monoText,
              fontSize: 22,
              letterSpacing: 1.8,
              color: palette.muted,
            }}
          >
            {sessionLabel}
          </span>
        </div>

        {signature}

        <div
          style={{
            display: "flex",
            marginTop: 64,
            fontSize: nameSize,
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: -0.035 * nameSize,
          }}
        >
          {name}
        </div>

        {headline !== null ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginTop: 22,
              fontSize: 32,
              fontWeight: 500,
            }}
          >
            {headline.record ? (
              <div
                style={{
                  display: "flex",
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: palette.accent,
                }}
              />
            ) : null}
            <span>{headline.text}</span>
          </div>
        ) : null}

        {line ? (
          <div
            style={{
              display: "flex",
              marginTop: 12,
              fontSize: 30,
              fontWeight: 400,
              color: palette.muted,
            }}
          >
            {line}
          </div>
        ) : null}

        <div
          style={{
            ...monoText,
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 48,
            fontSize: 20,
            color: palette.muted,
          }}
        >
          topcoach.io
        </div>
      </div>
    </div>
  );

  return new ImageResponse(element, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: "Geist", data: regular, weight: 400, style: "normal" },
      { name: "Geist", data: medium, weight: 500, style: "normal" },
      { name: "Geist", data: semibold, weight: 600, style: "normal" },
      { name: "Geist Mono", data: mono, weight: 500, style: "normal" },
    ],
    headers,
  });
}

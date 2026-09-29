import "server-only";

// Dibujo de la tarjeta de sesión (next/og / Satori: solo flexbox, cada
// contenedor con display:flex). Lo usan la ruta del cliente y la vista
// previa del entrenador, así ambos ven exactamente la misma imagen.
//
// Todos los estilos son 1080×1350 con fondo TRANSPARENTE (sticker). El
// cliente elige una foto y el botón la compone debajo (9:16) antes de
// compartir; sin foto se comparte el sticker tal cual.
//   panel — tarjetas "cristal" semitransparentes, texto blanco. Default.
//   white — sin tarjetas, texto blanco con sombra (fotos oscuras).
//   ink   — sin tarjetas, texto oscuro con halo claro (fotos claras).

import type { ShareCardBranding } from "./branding";
import type { ShareCardSettings } from "./settings";
import type { ShareCardStats } from "@/lib/training/share-card-stats";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export interface ShareCardContent {
  branding: ShareCardBranding;
  programName: string | null;
  sessionName: string;
  /** YYYY-MM-DD */
  date: string;
  stats: ShareCardStats;
  sessionNumber: number | null;
}

// Cargadas una vez por proceso (outputFileTracingIncludes las copia al
// standalone — ver next.config.js).
let fontsPromise: Promise<[Buffer, Buffer]> | null = null;

function loadFonts() {
  fontsPromise ??= Promise.all([
    readFile(join(process.cwd(), "assets/fonts/BarlowCondensed-500.ttf")),
    readFile(join(process.cwd(), "assets/fonts/BarlowCondensed-700.ttf")),
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
  accent: string;
  recordInk: string;
  /** Tarjeta cristal detrás de cada cifra; null = sin tarjeta. */
  tileBg: string | null;
  tileBorder: string;
  textShadow: string;
}

function paletteFor(
  style: ShareCardSettings["style"],
  brand: string | null
): Palette {
  if (style === "ink") {
    const ink = "#151A21";

    return {
      ink,
      accent: brand !== null && luminance(brand) <= 0.6 ? brand : ink,
      recordInk: "#8A5A00",
      tileBg: null,
      tileBorder: "transparent",
      textShadow: "0 1px 12px rgba(255, 255, 255, 0.7)",
    };
  }

  // El color de marca solo como acento si se lee sobre una foto oscura.
  const accent = brand !== null && luminance(brand) >= 0.25 ? brand : "#FFFFFF";

  if (style === "white") {
    return {
      ink: "#FFFFFF",
      accent,
      recordInk: "#FFC94D",
      tileBg: null,
      tileBorder: "transparent",
      textShadow: "0 2px 14px rgba(0, 0, 0, 0.55)",
    };
  }

  return {
    ink: "#FFFFFF",
    accent,
    recordInk: "#FFC94D",
    tileBg: "rgba(255, 255, 255, 0.12)",
    tileBorder: "rgba(255, 255, 255, 0.24)",
    textShadow: "0 2px 10px rgba(0, 0, 0, 0.4)",
  };
}

const numberEs = (n: number, digits = 0) =>
  n.toLocaleString("es-ES", {
    maximumFractionDigits: digits,
    useGrouping: true,
  });

function formatDate(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

interface Tile {
  value: string;
  unit?: string;
  label: string;
}

/** Hasta 4 cifras, en el orden de SHARE_CARD_STATS y solo las elegidas. */
function tilesFor(
  content: ShareCardContent,
  chosen: ShareCardSettings["stats"]
) {
  const { stats, sessionNumber } = content;
  const tiles: Tile[] = [];

  // Como la referencia (David, 29 sep): "Sesiones con <marca>" va primero.
  if (
    chosen.includes("sessionCount") &&
    sessionNumber !== null &&
    sessionNumber > 0
  ) {
    tiles.push({
      value: String(sessionNumber),
      label: `Sesiones con ${content.branding.trainerName}`,
    });
  }

  for (const stat of chosen) {
    if (stat === "volume" && stats.volumeKg > 0) {
      tiles.push({
        value: numberEs(stats.volumeKg),
        unit: "kg",
        label: "Volumen total",
      });
    }
    if (stat === "sets" && stats.sets > 0) {
      tiles.push({ value: String(stats.sets), label: "Series" });
    }
    if (stat === "cardio") {
      if (stats.cardioSeconds > 0) {
        tiles.push({
          value: String(Math.round(stats.cardioSeconds / 60)),
          unit: "min",
          label: "Cardio",
        });
      }
      if (stats.cardioMeters > 0) {
        tiles.push({
          value: numberEs(stats.cardioMeters / 1000, 1),
          unit: "km",
          label: "Distancia",
        });
      }
    }
    if (stat === "exercises" && stats.exercises > 0) {
      tiles.push({ value: String(stats.exercises), label: "Ejercicios" });
    }
    if (stat === "reps" && stats.reps > 0) {
      tiles.push({ value: String(stats.reps), label: "Repeticiones" });
    }
  }

  return tiles.slice(0, 4);
}

export async function renderShareCard(
  content: ShareCardContent,
  settings: ShareCardSettings,
  headers: Record<string, string>
): Promise<ImageResponse> {
  const [regular, bold] = await loadFonts();
  const palette = paletteFor(settings.style, content.branding.brandColor);
  const tiles = tilesFor(content, settings.stats);
  const [record] = settings.stats.includes("records")
    ? content.stats.records
    : [];
  const moreRecords = content.stats.records.length - 1;

  const box = {
    display: "flex",
    flexDirection: "column",
    borderRadius: 36,
    ...(palette.tileBg !== null
      ? {
          padding: "28px 32px",
          backgroundColor: palette.tileBg,
          border: `2px solid ${palette.tileBorder}`,
        }
      : { padding: "16px 0" }),
  } as const;
  const label = {
    display: "flex",
    fontSize: 30,
    fontWeight: 700,
    letterSpacing: 3,
    textTransform: "uppercase",
    opacity: 0.85,
  } as const;

  const element = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "56px 72px",
        fontFamily: "Barlow",
        color: palette.ink,
        textShadow: palette.textShadow,
      }}
    >
      <div style={label}>Entreno completado</div>
      <div
        style={{
          display: "flex",
          marginTop: 12,
          fontSize: 116,
          fontWeight: 700,
          lineHeight: 1,
          textTransform: "uppercase",
        }}
      >
        {content.sessionName}
      </div>
      <div style={{ display: "flex", marginTop: 14, fontSize: 40 }}>
        {content.programName
          ? `${content.programName} · ${formatDate(content.date)}`
          : formatDate(content.date)}
      </div>

      {record !== undefined ? (
        <div style={{ ...box, marginTop: 44 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={label}>Récord personal</span>
            {moreRecords > 0 ? (
              <span
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  color: palette.recordInk,
                }}
              >
                {`+${moreRecords} más`}
              </span>
            ) : null}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 6,
              fontSize: 92,
              fontWeight: 700,
              lineHeight: 1.05,
            }}
          >
            {`${numberEs(record.weightKg, 1)} kg × ${record.reps}`}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              textTransform: "uppercase",
              opacity: 0.9,
            }}
          >
            {record.exerciseName}
          </div>
        </div>
      ) : null}

      {tiles.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            marginTop: 24,
            rowGap: 24,
          }}
        >
          {tiles.map((tile) => (
            <div key={tile.label} style={{ ...box, width: 456 }}>
              <span style={{ ...label, fontSize: 26 }}>{tile.label}</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  marginTop: 10,
                }}
              >
                <span style={{ fontSize: 96, fontWeight: 700, lineHeight: 1 }}>
                  {tile.value}
                </span>
                {tile.unit ? (
                  <span style={{ fontSize: 40, fontWeight: 500 }}>
                    {tile.unit}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: 56,
          gap: 8,
        }}
      >
        <span style={{ ...label, fontSize: 26 }}>Powered by</span>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {content.branding.logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img
              src={content.branding.logoSrc}
              style={{
                width: 72,
                height: 72,
                objectFit: "contain",
                borderRadius: 16,
              }}
            />
          ) : null}
          <span
            style={{
              fontSize: 60,
              fontWeight: 700,
              textTransform: "uppercase",
              color: palette.accent,
            }}
          >
            {content.branding.trainerName}
          </span>
        </div>
      </div>
    </div>
  );

  return new ImageResponse(element, {
    width: 1080,
    height: 1350,
    fonts: [
      { name: "Barlow", data: regular, weight: 500, style: "normal" },
      { name: "Barlow", data: bold, weight: 700, style: "normal" },
    ],
    headers,
  });
}

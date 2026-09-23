import "server-only";

// Dibujo de la tarjeta de sesión (next/og / Satori: solo flexbox, cada
// contenedor con display:flex). Lo usan la ruta del cliente y la vista
// previa del entrenador, así ambos ven exactamente la misma imagen.
//
// Estilos (Fase 2):
//   dark    — 1080×1920, fondo oscuro. Default.
//   light   — 1080×1920, fondo claro con el color de marca.
//   sticker — 1080×1350 con fondo TRANSPARENTE: un panel para poner encima
//             de una foto propia en Stories (como Hevy/Strava).

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
  background: string;
  ink: string;
  accent: string;
  recordBg: string;
  recordInk: string;
}

function paletteFor(
  style: ShareCardSettings["style"],
  brand: string | null
): Palette {
  if (style === "light") {
    // El color de marca solo si se lee sobre blanco.
    const ink = "#151A21";

    return {
      background: "linear-gradient(170deg, #FFFFFF 0%, #EEF1F4 100%)",
      ink,
      accent: brand !== null && luminance(brand) <= 0.6 ? brand : ink,
      recordBg: "#FFF1CC",
      recordInk: "#7A5200",
    };
  }

  const ink = "#F2F5F8";

  return {
    background: "linear-gradient(170deg, #1E2833 0%, #0B0F14 72%)",
    ink,
    accent: brand !== null && luminance(brand) >= 0.25 ? brand : ink,
    recordBg: "rgba(255, 196, 64, 0.16)",
    recordInk: "#FFC94D",
  };
}

const numberEs = (n: number, digits = 0) =>
  n.toLocaleString("es-ES", {
    maximumFractionDigits: digits,
    useGrouping: true,
  });

function formatDate(ymd: string): string {
  const text = new Date(`${ymd}T12:00:00Z`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface Tile {
  value: string;
  unit?: string;
  label: string;
}

/** Hasta 4 cifras, en el orden de SHARE_CARD_STATS y solo las elegidas. */
function tilesFor(stats: ShareCardStats, chosen: ShareCardSettings["stats"]) {
  const tiles: Tile[] = [];

  for (const stat of chosen) {
    if (stat === "volume" && stats.volumeKg > 0) {
      tiles.push({
        value: numberEs(stats.volumeKg),
        unit: "kg",
        label: "Volumen",
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

function recordText(stats: ShareCardStats): string | null {
  const [first] = stats.records;

  if (first === undefined) return null;
  if (stats.records.length > 1)
    return `${stats.records.length} récords nuevos hoy`;

  return `Nuevo récord · ${first.exerciseName} ${numberEs(first.weightKg, 1)} kg × ${first.reps}`;
}

export async function renderShareCard(
  content: ShareCardContent,
  settings: ShareCardSettings,
  headers: Record<string, string>
): Promise<ImageResponse> {
  const [regular, bold] = await loadFonts();
  const sticker = settings.style === "sticker";
  const palette = paletteFor(settings.style, content.branding.brandColor);
  const tiles = tilesFor(content.stats, settings.stats);
  const record = settings.stats.includes("records")
    ? recordText(content.stats)
    : null;
  const sessionNumber =
    settings.stats.includes("sessionCount") &&
    content.sessionNumber !== null &&
    content.sessionNumber > 0
      ? `Sesión nº ${content.sessionNumber}`
      : "";
  const initials = content.branding.trainerName
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  // El sticker es más compacto: escala tipográfica ~0.8.
  const s = sticker ? 0.8 : 1;
  const px = (n: number) => Math.round(n * s);

  const brandRow = (
    <div style={{ display: "flex", alignItems: "center", gap: px(32) }}>
      {content.branding.logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img
          src={content.branding.logoSrc}
          style={{
            width: px(132),
            height: px(132),
            objectFit: "contain",
            borderRadius: px(28),
          }}
        />
      ) : (
        <div
          style={{
            width: px(132),
            height: px(132),
            borderRadius: px(28),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.accent,
            color: settings.style === "light" ? "#FFFFFF" : "#0B0F14",
            fontSize: px(56),
            fontWeight: 700,
          }}
        >
          {initials}
        </div>
      )}
      <div
        style={{
          display: "flex",
          fontSize: px(54),
          fontWeight: 500,
          letterSpacing: 1,
        }}
      >
        {content.branding.trainerName}
      </div>
    </div>
  );

  // Un div, no un fragmento: Satori maqueta los fragmentos como fila.
  const body = (
    <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: sticker ? px(70) : "auto",
          gap: px(18),
        }}
      >
        {content.programName ? (
          <div
            style={{
              display: "flex",
              fontSize: px(38),
              fontWeight: 500,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: palette.accent,
            }}
          >
            {content.programName}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            fontSize: px(150),
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {content.sessionName}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: px(44),
            fontWeight: 500,
            opacity: 0.7,
          }}
        >
          {formatDate(content.date)}
        </div>
      </div>

      {tiles.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            marginTop: px(90),
            rowGap: px(64),
          }}
        >
          {tiles.map((tile) => (
            <div
              key={tile.label}
              style={{ display: "flex", flexDirection: "column", width: "50%" }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span
                  style={{ fontSize: px(130), fontWeight: 700, lineHeight: 1 }}
                >
                  {tile.value}
                </span>
                {tile.unit ? (
                  <span
                    style={{ fontSize: px(52), fontWeight: 500, opacity: 0.75 }}
                  >
                    {tile.unit}
                  </span>
                ) : null}
              </div>
              <span
                style={{
                  fontSize: px(34),
                  fontWeight: 500,
                  letterSpacing: 6,
                  textTransform: "uppercase",
                  opacity: 0.6,
                  marginTop: 8,
                }}
              >
                {tile.label}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {record !== null ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: px(24),
            marginTop: px(80),
            padding: `${px(30)}px ${px(36)}px`,
            borderRadius: px(32),
            backgroundColor: palette.recordBg,
            color: palette.recordInk,
            fontSize: px(48),
            fontWeight: 700,
          }}
        >
          {/* SVG: Barlow no trae el glifo ★ (salía un cuadro). */}
          <svg height={px(52)} viewBox="0 0 24 24" width={px(52)}>
            <path
              d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7L12 17.5 5.8 21.2l1.6-7L2 9.5l7.1-.6L12 2z"
              fill={palette.recordInk}
            />
          </svg>
          {record}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: px(90),
          fontSize: px(32),
          fontWeight: 500,
          letterSpacing: 4,
          textTransform: "uppercase",
          opacity: 0.5,
        }}
      >
        <span>{sessionNumber}</span>
        <span>powered by TopCoach</span>
      </div>
    </div>
  );

  const element = sticker ? (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        fontFamily: "Barlow",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          padding: "72px 72px 64px",
          borderRadius: 64,
          backgroundColor: "rgba(11, 15, 20, 0.86)",
          color: palette.ink,
        }}
      >
        {brandRow}
        {body}
      </div>
    </div>
  ) : (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "120px 96px 110px",
        color: palette.ink,
        fontFamily: "Barlow",
        backgroundImage: palette.background,
      }}
    >
      {brandRow}
      {body}
    </div>
  );

  return new ImageResponse(element, {
    width: 1080,
    height: sticker ? 1350 : 1920,
    fonts: [
      { name: "Barlow", data: regular, weight: 500, style: "normal" },
      { name: "Barlow", data: bold, weight: 700, style: "normal" },
    ],
    headers,
  });
}

"use client";

// El sticker de "Compartir" (prototipo aprobado por JC, 14 oct): un SVG de
// 1000 unidades de ancho con la plantilla elegida. El mismo nodo sirve de
// vista previa y es lo que se exporta a PNG, así que todo va con atributos
// explícitos (nada de clases ni fuentes de la página). Las medidas salen del
// prototipo: 1 "cqw" de entonces ≈ 11,6 unidades aquí.

import type {
  ShareBranding,
  ShareExercise,
  ShareSession,
  Stat,
} from "@/lib/share-card/session-data";

import { type ReactNode, forwardRef } from "react";

import {
  BodyFigure,
  type MapMode,
  figureHeight,
  figureViews,
} from "./body-figure";
import { SHARE_FONT, fitText, textWidth } from "./fonts";

import {
  formatMinutes,
  heroSet,
  isCardioOnly,
  muscleHeat,
  setText,
} from "@/lib/share-card/session-data";
import { estimateOneRepMax } from "@/lib/training/e1rm";
import { muscleVolume } from "@/lib/training/muscle-volume";
import { muscleLabel } from "@/lib/training/muscles";

export const STICKER_WIDTH = 1000;
const CX = STICKER_WIDTH / 2;

export type Ink = "white" | "dark" | "brand";

export type SessionTemplate =
  | "datos"
  | "musculos"
  | "record"
  | "lista"
  | "minimo";
export type ExerciseTemplate = "ex-hero" | "ex-series" | "ex-min";
export type TemplateId = SessionTemplate | ExerciseTemplate;

export interface TemplateDef<T extends TemplateId> {
  id: T;
  name: string;
  /** Centro vertical por defecto en la historia (0–1). */
  y: number;
}

export const SESSION_TEMPLATES: TemplateDef<SessionTemplate>[] = [
  { id: "datos", name: "Datos", y: 0.5 },
  { id: "musculos", name: "Músculos", y: 0.48 },
  { id: "record", name: "Récord", y: 0.5 },
  { id: "lista", name: "Lista", y: 0.5 },
  { id: "minimo", name: "Mínimo", y: 0.8 },
];

export const EXERCISE_TEMPLATES: TemplateDef<ExerciseTemplate>[] = [
  { id: "ex-hero", name: "Ejercicio", y: 0.5 },
  { id: "ex-series", name: "Series", y: 0.5 },
  { id: "ex-min", name: "Mínimo", y: 0.82 },
];

/** Plantillas que tienen algo que enseñar con estos datos. */
export function sessionTemplatesFor(session: ShareSession) {
  const hasSets = session.exercises.some((e) => e.sets.length > 0);
  const hasMuscles = session.exercises.some(
    (e) => e.primary.length + e.secondary.length > 0
  );

  return SESSION_TEMPLATES.filter(
    (t) =>
      (t.id !== "record" || hasSets) &&
      (t.id !== "musculos" || hasMuscles) &&
      (t.id !== "lista" || session.exercises.length > 0)
  );
}

export function exerciseTemplatesFor(exercise: ShareExercise) {
  return EXERCISE_TEMPLATES.filter(
    (t) => t.id !== "ex-series" || exercise.sets.length > 0
  );
}

export const brandAccent = (branding: ShareBranding) =>
  branding.brandColor ?? "#ff5a1f";

export function stickerColors(
  branding: ShareBranding,
  ink: Ink,
  onBrandBg: boolean
) {
  const brand = brandAccent(branding);
  const inkColor =
    ink === "dark"
      ? "#121212"
      : ink === "brand" && !onBrandBg
        ? brand
        : "#ffffff";

  // Sobre fondo de marca el acento sería invisible: usa el color del texto.
  return { ink: inkColor, accent: onBrandBg ? inkColor : brand };
}

export interface StickerProps {
  /** Prefijo único para los ids internos (clipPath, filtros). */
  id: string;
  template: TemplateId;
  session: ShareSession;
  exercise: ShareExercise | null;
  stats: Stat[];
  branding: ShareBranding;
  ink: Ink;
  onBrandBg: boolean;
  shadow: boolean;
  mapMode: MapMode;
  className?: string;
}

// ---------------------------------------------------------------------------
// Mini motor de maquetación vertical: bloques con alto fijo, centrados.

interface Block {
  h: number;
  draw: (top: number) => ReactNode;
}

const space = (h: number): Block => ({ h, draw: () => null });

function column(blocks: (Block | null | false)[], gap = 0): Block {
  const list = blocks.filter((b): b is Block => Boolean(b) && b !== false);
  const h =
    list.reduce((sum, b) => sum + b.h, 0) + gap * Math.max(0, list.length - 1);

  return {
    h,
    draw: (top) => {
      let y = top;

      return list.map((block, i) => {
        const node = <g key={i}>{block.draw(y)}</g>;

        y += block.h + gap;

        return node;
      });
    },
  };
}

interface TextOpts {
  size: number;
  weight?: number;
  fill: string;
  opacity?: number;
  anchor?: "start" | "middle" | "end";
  x?: number;
  letterSpacing?: number;
  children: ReactNode;
}

function Text({
  size,
  weight = 600,
  fill,
  opacity = 1,
  anchor = "middle",
  x = CX,
  letterSpacing = 0,
  top,
  children,
}: TextOpts & { top: number }) {
  return (
    <text
      dominantBaseline="alphabetic"
      fill={fill}
      fillOpacity={opacity}
      fontFamily={`${SHARE_FONT}, system-ui, sans-serif`}
      fontSize={size}
      fontWeight={weight}
      letterSpacing={letterSpacing}
      style={{ fontVariantNumeric: "tabular-nums" }}
      textAnchor={anchor}
      x={x}
      y={top + size * 0.8}
    >
      {children}
    </text>
  );
}

const line = (opts: TextOpts, h = opts.size * 1.05): Block => ({
  h,
  draw: (top) => <Text {...opts} top={top} />,
});

// ---------------------------------------------------------------------------

export const Sticker = forwardRef<SVGSVGElement, StickerProps>(
  function Sticker(props, ref) {
    const { ink, accent } = stickerColors(
      props.branding,
      props.ink,
      props.onBrandBg
    );
    const body = templateBlock(props, ink, accent);
    const pad = 40;
    const height = Math.ceil(body.h + pad * 2);
    const shadowId = `${props.id}-shadow`;

    return (
      <svg
        ref={ref}
        className={props.className}
        height={height}
        viewBox={`0 0 ${STICKER_WIDTH} ${height}`}
        width={STICKER_WIDTH}
        xmlns="http://www.w3.org/2000/svg"
      >
        {props.shadow ? (
          <defs>
            <filter height="140%" id={shadowId} width="140%" x="-20%" y="-20%">
              <feDropShadow
                dx="0"
                dy="4"
                floodColor="#000"
                floodOpacity="0.35"
                stdDeviation="14"
              />
            </filter>
          </defs>
        ) : null}
        <g filter={props.shadow ? `url(#${shadowId})` : undefined}>
          {body.draw(pad)}
        </g>
      </svg>
    );
  }
);

function templateBlock(p: StickerProps, ink: string, accent: string): Block {
  const mark = (compact = false) => markBlock(p, ink, accent, compact);
  const ex = p.exercise;

  switch (p.template) {
    case "datos":
      return column([
        statStack(p.stats, ink),
        space(48),
        dumbbell(accent),
        space(58),
        mark(),
      ]);

    case "musculos": {
      const figure = figureBlock(p, p.session.exercises, ink, accent, 700);
      const volume = volumeBlock(p.session.exercises, ink);

      return column([
        figure,
        figure && space(40),
        volume,
        volume && space(40),
        mark(true),
        space(56),
        statRow(p.stats, ink),
      ]);
    }

    case "record": {
      const recordEx = p.session.exercises.find((e) => e.recordIndex !== null);
      const source = recordEx ?? bestExercise(p.session.exercises);
      const set = source ? heroSet(source) : null;
      const minutes = durationLabel(p);

      return column([
        line({
          size: 40,
          fill: accent,
          letterSpacing: 3,
          children: recordEx ? "NUEVO RÉCORD" : "MEJOR SERIE",
        }),
        space(26),
        source &&
          line({
            size: 63,
            fill: ink,
            children: fitText(source.name, 63, 900),
          }),
        space(18),
        set && bigSet(set, ink),
        space(26),
        line({
          size: 42,
          weight: 400,
          fill: ink,
          opacity: 0.85,
          children: fitText(
            [p.session.sessionName, minutes].filter(Boolean).join(" · "),
            42,
            900,
            400
          ),
        }),
        space(58),
        mark(),
      ]);
    }

    case "lista":
      return column([
        line({
          size: 81,
          fill: ink,
          letterSpacing: -1,
          children: fitText(p.session.sessionName.toUpperCase(), 81, 900),
        }),
        space(46),
        exerciseRows(p.session.exercises, ink, accent),
        space(58),
        mark(),
      ]);

    case "minimo":
      return column([statRow(p.stats, ink), space(40), mark(true)]);

    case "ex-hero": {
      if (!ex) return column([mark()]);
      const set = heroSet(ex);
      const cardio = isCardioOnly(ex);
      const figure = figureBlock(p, [ex], ink, accent, 600);
      const rest = p.stats.filter((s) => s.label !== "Mejor serie");

      return column([
        line({
          size: 40,
          fill: accent,
          letterSpacing: 3,
          children:
            ex.recordIndex !== null
              ? "NUEVO RÉCORD"
              : cardio
                ? "CARDIO"
                : "MEJOR SERIE",
        }),
        space(26),
        line({ size: 63, fill: ink, children: fitText(ex.name, 63, 900) }),
        space(18),
        cardio
          ? bigValue(formatMinutes(ex.cardioMinutes), ink)
          : set && bigSet(set, ink),
        figure && space(56),
        figure,
        rest.length > 0 && space(56),
        rest.length > 0 && statRow(rest.slice(0, 3), ink),
        space(58),
        mark(),
      ]);
    }

    case "ex-series":
      if (!ex) return column([mark()]);

      return column([
        line({
          size: 81,
          fill: ink,
          letterSpacing: -1,
          children: fitText(ex.name.toUpperCase(), 81, 900),
        }),
        space(36),
        setRows(ex, ink, accent),
        space(58),
        mark(),
      ]);

    case "ex-min":
      return column([
        ex &&
          line({ size: 63, fill: ink, children: fitText(ex.name, 63, 900) }),
        space(34),
        statRow(p.stats, ink),
        space(40),
        mark(true),
      ]);
  }
}

function durationLabel(p: StickerProps): string | null {
  return p.stats.find((s) => s.label === "Duración")?.value ?? null;
}

function bestExercise(exercises: ShareExercise[]): ShareExercise | null {
  let best: { ex: ShareExercise; score: number } | null = null;

  for (const ex of exercises) {
    const set = heroSet(ex);

    if (!set) continue;
    const score =
      set.weightKg > 0 ? (estimateOneRepMax(set.weightKg, set.reps) ?? 0) : 0;

    if (best === null || score > best.score) best = { ex, score };
  }

  return best?.ex ?? null;
}

// ---------------------------------------------------------------------------
// Piezas

function statStack(stats: Stat[], ink: string): Block {
  return column(
    stats.map((stat) =>
      column([
        line({ size: 43, fill: ink, opacity: 0.9, children: stat.label }),
        space(12),
        line(
          {
            size: shrink(stat.value, 112, 900),
            fill: ink,
            letterSpacing: -1,
            children: stat.value,
          },
          112
        ),
      ])
    ),
    49
  );
}

function statRow(stats: Stat[], ink: string): Block {
  if (stats.length === 0) return space(0);
  const colW = Math.min(330, 960 / stats.length);

  return {
    h: 38 + 12 + 78,
    draw: (top) =>
      stats.map((stat, i) => {
        const x = CX + (i - (stats.length - 1) / 2) * colW;
        const size = shrink(stat.value, 74, colW - 24);

        return (
          <g key={stat.label}>
            <Text fill={ink} opacity={0.9} size={38} top={top} x={x}>
              {fitText(stat.label, 38, colW - 16)}
            </Text>
            <Text
              fill={ink}
              letterSpacing={-0.5}
              size={size}
              top={top + 50 + (74 - size) * 0.8}
              x={x}
            >
              {stat.value}
            </Text>
          </g>
        );
      }),
  };
}

/** Tamaño de letra que hace caber `text` en `max` (sin bajar del 60%). */
function shrink(text: string, size: number, max: number): number {
  const w = textWidth(text, size);

  return w <= max ? size : Math.max(size * 0.6, Math.floor((size * max) / w));
}

function bigSet(set: { reps: number; weightKg: number }, ink: string): Block {
  const big = 198;
  const small = 83;
  const parts =
    set.weightKg > 0
      ? [
          { text: String(set.weightKg).replace(".", ","), size: big },
          { text: "kg", size: small, dx: 8 },
          { text: ` × ${set.reps}`, size: big },
        ]
      : [
          { text: String(set.reps), size: big },
          { text: "reps", size: small, dx: 8 },
        ];
  const width = parts.reduce(
    (sum, part) => sum + textWidth(part.text, part.size) + (part.dx ?? 0),
    0
  );
  const scale = Math.min(1, 940 / width);

  return {
    h: big * scale * 0.95,
    draw: (top) => (
      <text
        fill={ink}
        fontFamily={`${SHARE_FONT}, system-ui, sans-serif`}
        fontWeight={600}
        letterSpacing={-4 * scale}
        style={{ fontVariantNumeric: "tabular-nums" }}
        textAnchor="middle"
        x={CX}
        y={top + big * scale * 0.78}
      >
        {parts.map((part, i) => (
          <tspan
            key={i}
            dx={(part.dx ?? 0) * scale}
            fontSize={part.size * scale}
          >
            {part.text}
          </tspan>
        ))}
      </text>
    ),
  };
}

function bigValue(text: string, ink: string): Block {
  const size = shrink(text, 198, 940);

  return line(
    { size, fill: ink, letterSpacing: -4, children: text },
    size * 0.95
  );
}

function exerciseRows(
  exercises: ShareExercise[],
  ink: string,
  accent: string
): Block {
  const max = 6;
  const shown =
    exercises.length > max ? exercises.slice(0, max - 1) : exercises;
  const rows: Block[] = shown.map((ex) => {
    const set = heroSet(ex);
    const value = isCardioOnly(ex)
      ? formatMinutes(ex.cardioMinutes)
      : set
        ? `${ex.sets.length} × ${setText(set)}`
        : "";
    const valueW = textWidth(value, 43, 600);

    return {
      h: 56,
      draw: (top) => (
        <>
          <Text anchor="start" fill={ink} size={51} top={top} x={70}>
            {fitText(ex.name, 51, 860 - valueW - 36)}
          </Text>
          <Text
            anchor="end"
            fill={ex.recordIndex !== null ? accent : ink}
            opacity={ex.recordIndex !== null ? 1 : 0.85}
            size={43}
            top={top + 7}
            x={930}
          >
            {value}
          </Text>
        </>
      ),
    };
  });

  if (exercises.length > max) {
    rows.push(
      line({
        size: 40,
        weight: 400,
        fill: ink,
        opacity: 0.7,
        children: `y ${exercises.length - shown.length} ejercicios más`,
      })
    );
  }

  return column(rows, 30);
}

function setRows(ex: ShareExercise, ink: string, accent: string): Block {
  const max = 8;
  const rows = ex.sets.slice(0, max).map((set, i) => ({
    h: 62,
    draw: (top: number) => (
      <>
        <Text
          anchor="start"
          fill={ink}
          opacity={0.7}
          size={42}
          top={top + 12}
          weight={400}
          x={93}
        >
          {`Serie ${i + 1}`}
        </Text>
        <Text
          anchor="end"
          fill={ex.recordIndex === i ? accent : ink}
          size={58}
          top={top}
          x={907}
        >
          {setText(set)}
        </Text>
      </>
    ),
  }));

  return column(rows, 26);
}

function dumbbell(accent: string): Block {
  const size = 116;

  return {
    h: size,
    draw: (top) => (
      <g transform={`translate(${CX - size / 2} ${top}) scale(${size / 24})`}>
        <path
          d="M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11"
          fill="none"
          stroke={accent}
          strokeLinecap="round"
          strokeWidth={2}
        />
      </g>
    ),
  };
}

/** Top 4 grupos musculares con sus series (principal 1, secundario 0,5). */
function volumeBlock(exercises: ShareExercise[], ink: string): Block | null {
  const top = muscleVolume(
    exercises.map((e) => ({
      sets: e.sets.length,
      primary: e.primary,
      secondary: e.secondary,
    }))
  ).slice(0, 4);

  if (top.length === 0) return null;

  return column(
    top.map(({ id, sets }) =>
      line({
        size: 44,
        fill: ink,
        children: fitText(
          `${muscleLabel(id).toUpperCase()} · ${fmtSets.format(sets)} ${sets === 1 ? "serie" : "series"}`,
          44,
          900
        ),
      })
    ),
    16
  );
}

const fmtSets = new Intl.NumberFormat("es", { maximumFractionDigits: 1 });

function figureBlock(
  p: StickerProps,
  exercises: ShareExercise[],
  ink: string,
  accent: string,
  width: number
): Block | null {
  const heat = muscleHeat(exercises);
  const views = figureViews(heat, p.mapMode);

  if (views.length === 0 || Object.keys(heat).length === 0) return null;
  const w = views.length === 1 ? width * 0.5 : width;
  const h = figureHeight(views, w);

  return {
    h,
    draw: (top) => (
      <BodyFigure
        accent={accent}
        heat={heat}
        id={p.id}
        ink={ink}
        views={views}
        width={w}
        x={CX - w / 2}
        y={top}
      />
    ),
  };
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase() || "TC";

function markBlock(
  p: StickerProps,
  ink: string,
  accent: string,
  compact: boolean
): Block {
  const { branding } = p;
  const mono = 88;
  const word = fitText(
    (branding.name || "Tu entrenador").toUpperCase(),
    72,
    760
  );
  const wordW = textWidth(word, 72);
  const rowW = mono + 26 + wordW;
  const x0 = CX - rowW / 2;
  const clipId = `${p.id}-logo`;

  const row: Block = {
    h: mono,
    draw: (top) => (
      <>
        <defs>
          <clipPath id={clipId}>
            <circle cx={x0 + mono / 2} cy={top + mono / 2} r={mono / 2} />
          </clipPath>
        </defs>
        {branding.logoSrc ? (
          <>
            <circle
              cx={x0 + mono / 2}
              cy={top + mono / 2}
              fill="#ffffff"
              r={mono / 2}
            />
            <image
              clipPath={`url(#${clipId})`}
              height={mono * 0.78}
              href={branding.logoSrc}
              preserveAspectRatio="xMidYMid meet"
              width={mono * 0.78}
              x={x0 + mono * 0.11}
              y={top + mono * 0.11}
            />
          </>
        ) : (
          <>
            <circle
              cx={x0 + mono / 2}
              cy={top + mono / 2}
              fill={accent}
              r={mono / 2}
            />
            <Text
              fill={accent === "#ffffff" ? "#121212" : "#ffffff"}
              size={34}
              top={top + mono / 2 - 15}
              x={x0 + mono / 2}
            >
              {initials(branding.name)}
            </Text>
          </>
        )}
        <Text
          anchor="start"
          fill={ink}
          letterSpacing={-0.5}
          size={72}
          top={top + (mono - 72) / 2 + 4}
          x={x0 + mono + 26}
        >
          {word}
        </Text>
      </>
    ),
  };

  return column([
    space(compact ? 0 : 0),
    row,
    branding.instagram ? space(16) : false,
    branding.instagram
      ? line({
          size: 38,
          fill: ink,
          opacity: 0.85,
          children: `@${branding.instagram}`,
        })
      : false,
    branding.showTopcoach ? space(12) : false,
    branding.showTopcoach
      ? line({
          size: 30,
          fill: ink,
          opacity: 0.55,
          letterSpacing: 0.6,
          children: "topcoach.io",
        })
      : false,
  ]);
}

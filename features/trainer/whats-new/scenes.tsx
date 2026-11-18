"use client";

// Escenas de Novedades: un fragmento de la app de verdad haciendo lo nuevo,
// con los colores del entrenador (solo tokens semánticos) y datos de muestra
// genéricos. Cada novedad tiene la suya; el diálogo la cambia al avanzar.

import { Icon } from "@iconify/react";
import { motion, useReducedMotion } from "framer-motion";
import { type ReactNode, useEffect, useState } from "react";

import { useLibraryMedia } from "@/lib/hooks/use-library-media";

export type SceneId =
  | "week-figures"
  | "pending-board"
  | "merged-chart"
  | "next-checkin"
  | "checkin-calendar"
  | "checkin-alerts"
  | "checkin-status"
  | "intake-form"
  | "scale"
  | "conditional"
  | "export"
  | "session-focus"
  | "rir-sides"
  | "weekly-volume"
  | "library"
  | "diet-pdfs"
  | "duplicate-recipe"
  | "food-search"
  | "dark-mode"
  | "brand-preview"
  | "video"
  | "details";

export const SCENE_CLIP_SLUGS = ["bench-press"] as const;

const EASE = [0.16, 1, 0.3, 1] as const;

export function Scene({ id }: { id: SceneId }) {
  switch (id) {
    case "week-figures":
      return <WeekFigures />;
    case "pending-board":
      return <PendingBoard />;
    case "merged-chart":
      return <MergedChart />;
    case "next-checkin":
      return <NextCheckin />;
    case "checkin-calendar":
      return <CheckinCalendar />;
    case "checkin-alerts":
      return <CheckinAlerts />;
    case "checkin-status":
      return <CheckinStatus />;
    case "intake-form":
      return <IntakeForm />;
    case "scale":
      return <ScaleScene />;
    case "conditional":
      return <Conditional />;
    case "export":
      return <ExportScene />;
    case "session-focus":
      return <SessionFocus />;
    case "rir-sides":
      return <RirSides />;
    case "weekly-volume":
      return <WeeklyVolume />;
    case "library":
      return <LibraryScene />;
    case "diet-pdfs":
      return <DietPdfs />;
    case "duplicate-recipe":
      return <DuplicateRecipe />;
    case "food-search":
      return <FoodSearch />;
    case "dark-mode":
      return <DarkMode />;
    case "brand-preview":
      return <BrandPreview />;
    case "video":
      return <VideoScene />;
    case "details":
      return <Details />;
  }
}

// ── Piezas comunes ──────────────────────────────────────────────────────

/** Superficie de la app: un paso de tono sobre el escenario, sin sombra. */
function Surface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-ui
      className={`w-full max-w-[380px] rounded-large bg-content1 p-5 text-left ${className}`}
    >
      {children}
    </div>
  );
}

/** Aparece tras `delay` segundos (o ya, con movimiento reducido). */
function useAfter(delay: number): boolean {
  const reduce = useReducedMotion();
  const [on, setOn] = useState(Boolean(reduce));

  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setOn(true), delay * 1000);

    return () => window.clearTimeout(t);
  }, [delay, reduce]);

  return on;
}

function Rise({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : 10 }}
      transition={{ delay: reduce ? 0 : delay, duration: 0.45, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function Chip({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "muted" | "success" | "warning";
}) {
  const cls = {
    brand: "bg-primary/10 text-primary",
    muted: "bg-default-100 text-default-600",
    success: "bg-success/15 text-success-700",
    warning: "bg-warning/15 text-warning-700",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function Bars({ values, delay = 0 }: { values: number[]; delay?: number }) {
  const reduce = useReducedMotion();
  const max = Math.max(...values);

  return (
    <div className="flex h-10 items-end gap-1">
      {values.map((v, i) => (
        <motion.span
          key={i}
          animate={{ scaleY: 1 }}
          className={`block w-full origin-bottom rounded-sm ${
            i === values.length - 1 ? "bg-primary" : "bg-primary/25"
          }`}
          initial={{ scaleY: reduce ? 1 : 0.15 }}
          style={{ height: `${(v / max) * 100}%` }}
          transition={{ delay: delay + i * 0.05, duration: 0.5, ease: EASE }}
        />
      ))}
    </div>
  );
}

// ── Inicio y gráficas ──────────────────────────────────────────────────

function WeekFigures() {
  const figures = [
    {
      label: "Sesiones hechas",
      value: "38",
      bars: [22, 28, 25, 31, 30, 34, 38],
    },
    {
      label: "Check-ins recibidos",
      value: "12",
      bars: [8, 9, 7, 11, 10, 9, 12],
    },
    {
      label: "Clientes activos",
      value: "24",
      bars: [19, 20, 20, 21, 22, 23, 24],
    },
  ];

  return (
    <Surface className="max-w-[420px]">
      <p className="text-sm font-semibold text-foreground">Esta semana</p>
      <div className="mt-4 grid grid-cols-3 gap-4">
        {figures.map((f, i) => (
          <Rise key={f.label} delay={0.1 + i * 0.08}>
            <p className="font-heading text-[2.5rem] font-semibold leading-none tracking-[-0.03em] text-foreground tabular-nums">
              {f.value}
            </p>
            <p className="mt-1.5 text-xs leading-snug text-default-500">
              {f.label}
            </p>
            <div className="mt-3">
              <Bars delay={0.25 + i * 0.08} values={f.bars} />
            </div>
          </Rise>
        ))}
      </div>
    </Surface>
  );
}

function PendingBoard() {
  const cols = [
    {
      title: "Por revisar",
      rows: [
        ["Laura M.", "Check-in · hace 1 día"],
        ["Pablo R.", "Check-in · hace 3 días"],
      ],
    },
    {
      title: "Vídeos",
      rows: [
        ["Marta G.", "Sentadilla · serie 3"],
        ["Diego S.", "Peso muerto · serie 1"],
      ],
    },
  ];

  return (
    <Surface className="max-w-[420px]">
      <p className="text-sm font-semibold text-foreground">Pendientes</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {cols.map((col, c) => (
          <div key={col.title} className="rounded-medium bg-default-100 p-3">
            <p className="flex items-center justify-between text-xs font-semibold text-foreground">
              {col.title}
              <span className="tabular-nums text-default-500">
                {col.rows.length}
              </span>
            </p>
            <div className="mt-2.5 space-y-2">
              {col.rows.map(([name, meta], r) => (
                <Rise key={name} delay={0.2 + c * 0.1 + r * 0.12}>
                  <div className="flex items-center justify-between gap-2 rounded-small bg-content1 px-2.5 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-foreground">
                        {name}
                      </span>
                      <span className="block truncate text-[11px] text-default-500">
                        {meta}
                      </span>
                    </span>
                    <Icon
                      className="shrink-0 text-primary"
                      icon="solar:arrow-right-linear"
                      width={14}
                    />
                  </div>
                </Rise>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function MergedChart() {
  const reduce = useReducedMotion();
  // Peso: los primeros puntos vienen del check-in, los últimos de hábitos.
  const points = [
    [8, 30],
    [52, 34],
    [96, 40],
    [140, 46],
    [184, 52],
    [214, 55],
    [244, 59],
    [274, 62],
    [304, 66],
  ] as const;
  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${100 - y}`)
    .join(" ");
  const split = 4; // hasta aquí, check-in

  return (
    <Surface>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Peso corporal</p>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          72,4 kg
        </p>
      </div>
      <svg
        aria-hidden
        className="mt-4 h-28 w-full overflow-visible"
        viewBox="0 0 312 100"
      >
        <motion.path
          animate={{ pathLength: 1 }}
          className="stroke-primary"
          d={path}
          fill="none"
          initial={{ pathLength: reduce ? 1 : 0 }}
          strokeLinecap="round"
          strokeWidth={2.5}
          transition={{ duration: 1.1, ease: EASE }}
        />
        {points.map(([x, y], i) => (
          <motion.circle
            key={x}
            animate={{ opacity: 1 }}
            className={
              i <= split
                ? "fill-content1 stroke-primary"
                : "fill-primary stroke-primary"
            }
            cx={x}
            cy={100 - y}
            initial={{ opacity: reduce ? 1 : 0 }}
            r={4}
            strokeWidth={2}
            transition={{ delay: reduce ? 0 : 0.2 + i * 0.09 }}
          />
        ))}
      </svg>
      <div className="mt-3 flex gap-2">
        <Chip tone="muted">○ Check-in</Chip>
        <Chip>● Registro diario</Chip>
      </div>
      <Rise
        className="mt-4 rounded-medium bg-default-100 px-3 py-2.5"
        delay={0.9}
      >
        <p className="text-[11px] text-default-500">Incluir también datos de</p>
        <p className="text-sm font-medium text-foreground">Peso · Check-in</p>
      </Rise>
    </Surface>
  );
}

// ── Check-ins ───────────────────────────────────────────────────────────

function NextCheckin() {
  const rows = [
    ["Laura Martín", "lun 24 nov"],
    ["Pablo Ruiz", "mié 26 nov"],
    ["Marta Gil", "vie 28 nov"],
  ] as const;

  return (
    <Surface>
      <p className="text-sm font-semibold text-foreground">Clientes</p>
      <div className="mt-3 space-y-2">
        {rows.map(([name, date], i) => (
          <Rise key={name} delay={0.1 + i * 0.1}>
            <div className="flex items-center justify-between gap-3 rounded-medium bg-default-100 px-3 py-2.5">
              <span className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {name.charAt(0)}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {name}
                </span>
              </span>
              <span className="text-right text-[11px] leading-tight text-default-500">
                Próximo check-in
                <span className="block text-xs font-semibold text-foreground">
                  {date}
                </span>
              </span>
            </div>
          </Rise>
        ))}
      </div>
    </Surface>
  );
}

function CheckinCalendar() {
  const moved = useAfter(1.1);
  const days = Array.from({ length: 28 }, (_, i) => i + 1);
  const checkins = new Set([3, 17]);

  return (
    <Surface>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Noviembre</p>
        <Chip>Cada 2 semanas</Chip>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center">
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <span key={d} className="text-[11px] text-default-500">
            {d}
          </span>
        ))}
        {days.map((d) => {
          const isMoved = moved && d === 19;
          const isFrom = d === 17;
          const isOn = checkins.has(d) && !(isFrom && moved);

          return (
            <span
              key={d}
              className={`flex aspect-square items-center justify-center rounded-medium text-xs tabular-nums transition-colors duration-300 ${
                isMoved || isOn
                  ? "bg-primary font-semibold text-primary-foreground"
                  : isFrom && moved
                    ? "bg-default-100 text-default-400 line-through"
                    : d === 1
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-foreground"
              }`}
            >
              {d}
            </span>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip tone="muted">1 nov · primer check-in</Chip>
        {moved ? (
          <Rise>
            <Chip>17 → 19 nov · movido</Chip>
          </Rise>
        ) : null}
      </div>
    </Surface>
  );
}

function CheckinAlerts() {
  const alerts = [
    [
      "solar:bell-linear",
      "Tu check-in ya está abierto",
      "Tienes hasta el viernes",
    ],
    [
      "solar:clock-circle-linear",
      "Tu check-in cierra mañana",
      "Aún no lo has enviado",
    ],
    [
      "solar:calendar-mark-linear",
      "Rellena tu registro de hoy",
      "Hábitos diarios · 08:00",
    ],
  ] as const;

  return (
    <div data-ui className="w-full max-w-[340px] space-y-2.5">
      {alerts.map(([icon, title, meta], i) => (
        <Rise key={title} delay={0.15 + i * 0.35}>
          <div className="flex items-start gap-3 rounded-large bg-content1 px-4 py-3.5 text-left shadow-[0_8px_24px_-16px_rgba(0,0,0,0.35)]">
            <Icon
              className="mt-0.5 shrink-0 text-primary"
              icon={icon}
              width={20}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">
                {title}
              </span>
              <span className="block text-xs text-default-500">{meta}</span>
            </span>
            <span className="ml-auto shrink-0 text-[11px] text-default-400">
              ahora
            </span>
          </div>
        </Rise>
      ))}
    </div>
  );
}

function CheckinStatus() {
  const applied = useAfter(1.4);
  const rows = [
    ["Laura Martín", "Enviado", "success"],
    ["Pablo Ruiz", "Pendiente", "muted"],
    ["Diego Sanz", "Expirado", "warning"],
  ] as const;

  return (
    <Surface>
      <div className="space-y-2">
        {rows.map(([name, status, tone], i) => (
          <Rise key={name} delay={0.1 + i * 0.1}>
            <div className="flex items-center justify-between rounded-medium bg-default-100 px-3 py-2.5">
              <span className="text-sm font-medium text-foreground">
                {name}
              </span>
              <Chip tone={tone}>{status}</Chip>
            </div>
          </Rise>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span
          className={`inline-flex h-9 items-center rounded-medium px-3.5 text-sm font-semibold transition-colors duration-300 ${
            applied
              ? "bg-default-100 text-default-500"
              : "bg-primary text-primary-foreground"
          }`}
        >
          Aplicar a todos
        </span>
        {applied ? (
          <Rise>
            <span className="flex items-center gap-1.5 text-xs text-default-600">
              <Icon
                className="text-success"
                icon="solar:check-circle-linear"
                width={16}
              />
              Ajustes de cada cliente conservados
            </span>
          </Rise>
        ) : null}
      </div>
    </Surface>
  );
}

// ── Formularios ─────────────────────────────────────────────────────────

function IntakeForm() {
  const picked = useAfter(1);
  const options = [
    "Perder grasa",
    "Ganar músculo",
    "Mejorar el rendimiento",
    "Salud general",
  ];

  return (
    <Surface>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          Formulario inicial
        </p>
        <span className="text-xs tabular-nums text-default-500">1 de 3</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <span className="h-1 rounded-full bg-primary" />
        <span className="h-1 rounded-full bg-default-200" />
        <span className="h-1 rounded-full bg-default-200" />
      </div>
      <p className="mt-5 font-heading text-lg font-semibold leading-snug text-foreground">
        ¿Cuál es tu objetivo principal?
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {options.map((o, i) => {
          const on = picked && i === 1;

          return (
            <span
              key={o}
              className={`rounded-medium px-3 py-2.5 text-sm transition-colors duration-300 ${
                on
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "bg-default-100 text-foreground"
              }`}
            >
              {o}
            </span>
          );
        })}
      </div>
    </Surface>
  );
}

function ScaleScene() {
  const [value, setValue] = useState<number | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      setValue(7);

      return;
    }
    const steps = [3, 5, 7];
    const timers = steps.map((v, i) =>
      window.setTimeout(() => setValue(v), 600 + i * 420)
    );

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduce]);

  return (
    <Surface>
      <p className="font-heading text-lg font-semibold leading-snug text-foreground">
        ¿Cuánto dolor tienes hoy?
      </p>
      <div className="mt-4 grid grid-cols-6 gap-1.5">
        {Array.from({ length: 11 }, (_, n) => (
          <span
            key={n}
            className={`flex h-10 items-center justify-center rounded-medium text-[15px] font-bold tabular-nums transition-colors duration-200 ${
              value === n
                ? "bg-primary text-primary-foreground"
                : "bg-default-100 text-foreground"
            }`}
          >
            {n}
          </span>
        ))}
      </div>
      <div className="mt-3 flex justify-between gap-4 text-xs text-default-500">
        <span>0 = Ningún dolor</span>
        <span className="text-right">10 = Peor dolor imaginable</span>
      </div>
    </Surface>
  );
}

function Conditional() {
  const answered = useAfter(0.9);
  const reduce = useReducedMotion();

  return (
    <Surface>
      <p className="font-heading text-lg font-semibold leading-snug text-foreground">
        ¿Has entrenado hoy?
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {["Sí", "No"].map((o) => (
          <span
            key={o}
            className={`flex h-10 items-center justify-center rounded-medium text-sm font-semibold transition-colors duration-300 ${
              answered && o === "Sí"
                ? "bg-primary text-primary-foreground"
                : "bg-default-100 text-foreground"
            }`}
          >
            {o}
          </span>
        ))}
      </div>
      <motion.div
        animate={
          answered ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0 }
        }
        className="overflow-hidden"
        initial={false}
        transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}
      >
        <div className="pt-5">
          <p className="text-sm font-semibold text-foreground">
            ¿Cómo ha ido la sesión?
          </p>
          <div className="mt-2.5 h-16 rounded-medium bg-default-100" />
        </div>
      </motion.div>
      <div className="mt-4">
        <Chip tone="warning">Solo si «¿Has entrenado hoy?»: Sí</Chip>
      </div>
    </Surface>
  );
}

function ExportScene() {
  const rows = [
    ["2026-11-17 09:12", "laura@…", "Sí", "3"],
    ["2026-11-17 10:40", "pablo@…", "No", "6"],
    ["2026-11-18 08:05", "marta@…", "Sí", "2"],
  ];

  return (
    <div className="w-full max-w-[420px] space-y-3">
      <Surface className="max-w-none">
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold text-foreground">
              Descargar respuestas
            </span>
            <span className="block text-xs text-default-500">
              Todas · todos tus clientes
            </span>
          </span>
          <span className="inline-flex h-9 items-center gap-1.5 rounded-medium bg-foreground px-3.5 text-sm font-semibold text-background">
            <Icon icon="solar:download-minimalistic-linear" width={16} />
            Descargar CSV
          </span>
        </div>
      </Surface>
      <Rise delay={0.35}>
        <div data-ui className="overflow-hidden rounded-large bg-content1">
          <table className="w-full text-left text-[11px] tabular-nums">
            <thead className="bg-default-100 text-default-600">
              <tr>
                {["Timestamp", "Email Address", "¿Entrenaste?", "Dolor"].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 font-semibold">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <motion.tr
                  key={r[0]}
                  animate={{ opacity: 1 }}
                  className="border-t border-default-100 text-foreground"
                  initial={{ opacity: 0 }}
                  transition={{ delay: 0.5 + i * 0.12 }}
                >
                  {r.map((c, j) => (
                    <td key={j} className="px-3 py-2">
                      {c}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Rise>
    </div>
  );
}

// ── Entreno ─────────────────────────────────────────────────────────────

function SessionFocus() {
  const media = useLibraryMedia(SCENE_CLIP_SLUGS);
  const clip = media["bench-press"];

  return (
    <div data-ui className="w-full max-w-[340px] space-y-2.5 text-left">
      <Rise>
        <div className="flex items-center justify-between rounded-large bg-foreground px-4 py-2.5 text-background">
          <span className="text-sm font-semibold">Descanso</span>
          <span className="font-heading text-lg font-semibold tabular-nums">
            1:24
          </span>
          <span className="rounded-full bg-background/15 px-2.5 py-0.5 text-xs font-semibold">
            +15 s
          </span>
        </div>
      </Rise>
      <Rise delay={0.12}>
        <div className="overflow-hidden rounded-large bg-content1">
          <div className="aspect-[16/10] bg-white">
            {clip?.video ? (
              <video
                aria-hidden
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover"
                poster={clip.poster}
                src={clip.video}
              />
            ) : (
              <div className="h-full w-full animate-pulse bg-default-100 motion-reduce:animate-none" />
            )}
          </div>
          <div className="p-4">
            <p className="font-heading text-lg font-semibold text-foreground">
              Press de banca
            </p>
            <p className="mt-0.5 text-sm text-default-500">
              4 × 8 · RIR 2 · 90 s
            </p>
            <span className="mt-3 flex h-10 items-center justify-center rounded-medium bg-primary text-sm font-semibold text-primary-foreground">
              Registrar series
            </span>
          </div>
        </div>
      </Rise>
      {["Remo con barra", "Fondos en paralelas"].map((name, i) => (
        <Rise key={name} delay={0.25 + i * 0.08}>
          <div className="flex items-center justify-between rounded-medium bg-content1 px-4 py-2.5">
            <span className="text-sm text-foreground">{name}</span>
            <span className="text-xs text-default-500">3 × 10</span>
          </div>
        </Rise>
      ))}
    </div>
  );
}

function RirSides() {
  const typed = useAfter(0.8);
  const sets = [
    ["1", "12", "10", "10", "2"],
    ["2", "12", "9", "8", "1"],
  ];

  return (
    <Surface>
      <p className="text-sm font-semibold text-foreground">Zancada búlgara</p>
      <p className="text-xs text-default-500">Por lado · RIR 1–2</p>
      <div className="mt-4 grid grid-cols-[28px_1fr_1fr_1fr_52px] gap-1.5 text-xs font-semibold text-default-500">
        <span className="text-center">Serie</span>
        <span>Peso</span>
        <span>Der.</span>
        <span>Izq.</span>
        <span className="text-center">RIR</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {sets.map((s, i) => (
          <div
            key={s[0]}
            className="grid grid-cols-[28px_1fr_1fr_1fr_52px] gap-1.5"
          >
            <span className="flex h-10 items-center justify-center rounded-medium bg-default-100 text-sm font-bold text-default-500">
              {s[0]}
            </span>
            {s.slice(1).map((v, j) => {
              const show = typed || (i === 0 && j === 0);

              return (
                <span
                  key={j}
                  className={`flex h-10 items-center justify-center rounded-medium text-sm tabular-nums transition-all duration-300 ${
                    j === 3
                      ? "bg-primary/10 font-semibold text-primary"
                      : "bg-default-100 text-foreground"
                  } ${show ? "opacity-100" : "opacity-40"}`}
                  style={{ transitionDelay: `${(i * 4 + j) * 70}ms` }}
                >
                  {show ? (j === 0 ? `${v} kg` : v) : "–"}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </Surface>
  );
}

function WeeklyVolume() {
  const days = [
    ["L", 2650],
    ["M", 0],
    ["X", 3120],
    ["J", 0],
    ["V", 2890],
    ["S", 3820],
    ["D", 0],
  ] as const;

  return (
    <Surface>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map(([d, v], i) => (
          <Rise key={d} delay={0.05 + i * 0.05}>
            <div
              className={`flex h-16 flex-col items-center justify-center rounded-medium text-xs ${
                v > 0
                  ? "bg-primary/10 text-primary"
                  : "bg-default-100 text-default-400"
              }`}
            >
              <span className="font-semibold">{d}</span>
              <span className="mt-1 text-[10px]">{v > 0 ? "Hecho" : "—"}</span>
            </div>
          </Rise>
        ))}
      </div>
      <Rise className="mt-5" delay={0.5}>
        <p className="text-xs text-default-500">Volumen semanal</p>
        <p className="font-heading text-[2.25rem] font-semibold leading-tight tracking-[-0.03em] text-foreground tabular-nums">
          12.480
          <span className="ml-1.5 text-sm font-medium tracking-normal text-default-500">
            kg·reps
          </span>
        </p>
      </Rise>
    </Surface>
  );
}

function LibraryScene() {
  const flipped = useAfter(1);

  return (
    <Surface>
      <div className="inline-flex rounded-medium bg-default-100 p-1">
        {["Hombre", "Mujer"].map((o) => (
          <span
            key={o}
            className={`rounded-small px-4 py-1.5 text-sm font-medium transition-colors duration-300 ${
              (o === "Mujer") === flipped
                ? "bg-content1 text-foreground"
                : "text-default-500"
            }`}
          >
            {o}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {["Fuerza", "Cardio"].map((c) => (
          <Chip key={c} tone="muted">
            {c}
          </Chip>
        ))}
        <Rise delay={0.6}>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <span className="text-default-400 line-through">Flexibilidad</span>
            Movilidad
          </span>
        </Rise>
      </div>
    </Surface>
  );
}

// ── Nutrición ───────────────────────────────────────────────────────────

function DietPdfs() {
  const files = [
    ["Días de entreno", "2 páginas · 18 nov"],
    ["Días de descanso", "2 páginas · 18 nov"],
  ];

  return (
    <Surface>
      <p className="text-sm font-semibold text-foreground">Dieta en PDF</p>
      <div className="mt-3 space-y-2">
        {files.map(([name, meta], i) => (
          <Rise key={name} delay={0.15 + i * 0.2}>
            <div className="flex items-center gap-3 rounded-medium bg-default-100 px-3 py-3">
              <span className="flex h-10 w-8 items-end justify-center rounded-small bg-content1 pb-1 text-[9px] font-bold text-danger">
                PDF
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">
                  {name}
                </span>
                <span className="block text-xs text-default-500">{meta}</span>
              </span>
              <Icon
                className="text-default-400"
                icon="solar:eye-linear"
                width={18}
              />
            </div>
          </Rise>
        ))}
      </div>
    </Surface>
  );
}

function DuplicateRecipe() {
  const copied = useAfter(1);

  const card = (name: string) => (
    <div className="flex items-center gap-3 rounded-medium bg-default-100 p-3">
      <span className="h-12 w-12 shrink-0 rounded-medium bg-primary/15" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">
          {name}
        </span>
        <span className="block text-xs text-default-500">
          520 kcal · 42 g proteína
        </span>
      </span>
    </div>
  );

  return (
    <Surface>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Receta</p>
        <span
          className={`inline-flex h-8 items-center gap-1.5 rounded-medium px-3 text-xs font-semibold transition-colors duration-300 ${
            copied
              ? "bg-default-100 text-default-500"
              : "bg-primary/10 text-primary"
          }`}
        >
          <Icon icon="solar:copy-linear" width={15} />
          Duplicar
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {card("Bowl de pollo y arroz")}
        {copied ? <Rise>{card("Bowl de pollo y arroz (copia)")}</Rise> : null}
      </div>
    </Surface>
  );
}

function FoodSearch() {
  const query = "pollo";
  const [typed, setTyped] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      setTyped(query.length);

      return;
    }
    const timers = Array.from(query, (_, i) =>
      window.setTimeout(() => setTyped(i + 1), 400 + i * 110)
    );

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduce]);

  const results = [
    ["Pollo, pechuga", "110 kcal · 23 g proteína", true],
    ["Pollo, muslo", "177 kcal · 18 g proteína", true],
    ["Nuggets de pollo (marca)", "296 kcal · 15 g proteína", false],
  ] as const;

  return (
    <Surface>
      <div className="flex h-10 items-center gap-2 rounded-medium bg-default-100 px-3">
        <Icon
          className="text-default-500"
          icon="solar:magnifer-linear"
          width={16}
        />
        <span className="text-sm text-foreground">
          {query.slice(0, typed)}
          <span className="ml-px inline-block h-4 w-px translate-y-0.5 bg-foreground motion-safe:animate-pulse" />
        </span>
      </div>
      {typed === query.length ? (
        <div className="mt-3 space-y-1.5">
          {results.map(([name, meta, basic], i) => (
            <Rise key={name} delay={0.1 + i * 0.1}>
              <div className="flex items-center justify-between gap-3 rounded-medium px-2 py-2">
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    {name}
                  </span>
                  <span className="block text-xs text-default-500">{meta}</span>
                </span>
                {basic ? <Chip>Básico</Chip> : null}
              </div>
            </Rise>
          ))}
        </div>
      ) : null}
    </Surface>
  );
}

// ── Más mejoras ─────────────────────────────────────────────────────────

function DarkMode() {
  const dark = useAfter(1);

  return (
    <div className="flex w-full max-w-[380px] items-center gap-4">
      <div
        data-ui
        className={`w-44 shrink-0 rounded-[1.75rem] p-3 transition-colors duration-500 ${
          dark ? "bg-foreground" : "bg-content1"
        }`}
      >
        <p
          className={`text-sm font-semibold transition-colors duration-500 ${
            dark ? "text-background" : "text-foreground"
          }`}
        >
          Hola, Laura
        </p>
        <span className="mt-3 flex h-12 items-center rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground">
          Entreno de hoy
        </span>
        {[0, 1].map((i) => (
          <span
            key={i}
            className={`mt-2 block h-9 rounded-xl transition-colors duration-500 ${
              dark ? "bg-background/10" : "bg-default-100"
            }`}
          />
        ))}
      </div>
      <Surface className="p-4">
        <p className="text-sm font-semibold text-foreground">Apariencia</p>
        <div className="mt-2.5 space-y-1">
          {["Automático", "Claro", "Oscuro"].map((o) => (
            <span
              key={o}
              className={`block rounded-small px-2.5 py-1.5 text-sm transition-colors duration-300 ${
                (o === "Oscuro") === dark && (o === "Oscuro" || o === "Claro")
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-default-600"
              }`}
            >
              {o}
            </span>
          ))}
        </div>
      </Surface>
    </div>
  );
}

function BrandPreview() {
  return (
    <div className="flex w-full max-w-[380px] items-end justify-center gap-3">
      {["Inicio", "Entrenar", "Nutrición"].map((tab, i) => (
        <Rise key={tab} delay={0.1 + i * 0.12}>
          <div
            data-ui
            className={`w-[110px] rounded-[1.5rem] bg-content1 p-2.5 ${
              i === 1 ? "-translate-y-4" : ""
            }`}
          >
            <span className="block h-14 rounded-xl bg-primary" />
            <span className="mt-2 block h-2 w-14 rounded-full bg-default-200" />
            <span className="mt-1.5 block h-2 w-10 rounded-full bg-default-100" />
            <span className="mt-3 block h-10 rounded-lg bg-default-100" />
            <span className="mt-1.5 block h-10 rounded-lg bg-default-100" />
            <p className="mt-2 text-center text-[11px] font-medium text-default-500">
              {tab}
            </p>
          </div>
        </Rise>
      ))}
    </div>
  );
}

function VideoScene() {
  const media = useLibraryMedia(SCENE_CLIP_SLUGS);
  const clip = media["bench-press"];
  const reduce = useReducedMotion();

  return (
    <Surface className="p-3">
      <div className="relative aspect-video overflow-hidden rounded-medium bg-white">
        {clip?.video ? (
          <video
            aria-hidden
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover"
            poster={clip.poster}
            src={clip.video}
          />
        ) : (
          <div className="h-full w-full animate-pulse bg-default-100 motion-reduce:animate-none" />
        )}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-default-100">
        <motion.span
          animate={{ scaleX: 1 }}
          className="block h-full origin-left rounded-full bg-primary"
          initial={{ scaleX: reduce ? 1 : 0 }}
          transition={{ duration: 4, ease: "linear" }}
        />
      </div>
      <p className="mt-2.5 px-1 text-sm font-medium text-foreground">
        Serie 3 · Sentadilla
      </p>
    </Surface>
  );
}

function Details() {
  const fixes = [
    "El historial de un ejercicio cabe en pantallas bajas",
    "La pregunta de pasos se ve sin NEAT",
    "Los avisos de formularios, solo para tu cliente",
  ];

  return (
    <Surface>
      <div className="space-y-2.5">
        {fixes.map((f, i) => (
          <Rise key={f} delay={0.15 + i * 0.15}>
            <p className="flex items-start gap-2.5 text-sm text-foreground">
              <Icon
                className="mt-0.5 shrink-0 text-success"
                icon="solar:check-circle-linear"
                width={18}
              />
              {f}
            </p>
          </Rise>
        ))}
      </div>
    </Surface>
  );
}

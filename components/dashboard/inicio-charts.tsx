"use client";

// Banda superior de Inicio: las tres cifras de la semana en grande, cada una
// con su gráfica. Gráficas hechas a mano sobre los tokens del tema (sin
// librería): siguen la marca de cualquier tenant.

import type { InicioData } from "@/lib/trainer-inicio/types";

const LABEL = "text-[13px] font-medium text-default-600";
const BIG =
  "font-heading text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground";
const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"] as const;
const DAY_NAMES = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
] as const;

/** Sesiones por día: lo previsto en gris, lo hecho encima en color. */
function SessionBars({ sessions }: { sessions: InicioData["sessions"] }) {
  const max = Math.max(1, ...sessions.days.map((d) => d.planned));

  return (
    <div
      aria-label={`Sesiones por día: ${sessions.days
        .map((d, i) => `${DAY_NAMES[i]} ${d.done} de ${d.planned}`)
        .join(", ")}`}
      className="flex h-[76px] items-end gap-2"
      role="img"
    >
      {sessions.days.map((d, i) => (
        <div
          key={DAY_LETTERS[i]}
          className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
        >
          <div
            className="relative w-full max-w-[28px] overflow-hidden rounded-[3px] bg-default-200"
            style={{ height: `${Math.max(6, (d.planned / max) * 56)}px` }}
          >
            <div
              className="absolute inset-x-0 bottom-0 bg-primary"
              style={{
                height: d.planned > 0 ? `${(d.done / d.planned) * 100}%` : "0%",
              }}
            />
          </div>
          <span
            className={`text-[11px] leading-none ${
              i === sessions.todayIndex
                ? "font-semibold text-foreground"
                : "text-default-400"
            }`}
          >
            {DAY_LETTERS[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Línea de tendencia con el último punto marcado; usa el color de marca. */
function Trend({
  values,
  label,
}: {
  values: readonly number[];
  label: string;
}) {
  const W = 160;
  const H = 56;
  const min = Math.min(...values);
  const span = Math.max(1, Math.max(...values) - min);
  const pts = values.map(
    (v, i) =>
      [
        values.length > 1 ? (i / (values.length - 1)) * W : W,
        H - 4 - ((v - min) / span) * (H - 10),
      ] as const
  );
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1] ?? ([W, H / 2] as const);

  return (
    <div className="relative h-[56px] w-full text-primary">
      <svg
        aria-label={label}
        className="h-full w-full"
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${W} ${H}`}
      >
        <polygon
          className="fill-current opacity-10"
          points={`0,${H} ${line} ${W},${H}`}
        />
        <polyline
          fill="none"
          points={line}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* El punto va fuera del SVG: dentro se estiraría con la gráfica. */}
      <span
        aria-hidden
        className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-content1"
        style={{
          left: `${(last[0] / W) * 100}%`,
          top: `${(last[1] / H) * 100}%`,
        }}
      />
    </div>
  );
}

function Delta({ value, suffix }: { value: number; suffix: string }) {
  const up = value >= 0;

  if (value === 0) {
    return <p className="text-[13px] text-default-500">Igual: 0 {suffix}</p>;
  }

  return (
    <p className="text-[13px] text-default-500">
      <span
        className={`font-medium tabular-nums ${up ? "text-success-700" : "text-danger"}`}
      >
        {up ? "+" : "−"}
        {Math.abs(value)}
      </span>{" "}
      {suffix}
    </p>
  );
}

const Muted = ({ children }: { children: React.ReactNode }) => (
  <span className="text-2xl text-default-400">{children}</span>
);

export function WeekBand({ data }: { data: InicioData }) {
  const { sessions, checkins, clients } = data;
  const sessionPct =
    sessions.planned > 0
      ? Math.round((sessions.done / sessions.planned) * 100)
      : null;
  const now = checkins.trend[checkins.trend.length - 1] ?? 0;
  const before = checkins.trend[checkins.trend.length - 2] ?? 0;

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-large border border-default-200 bg-default-200 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <section className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 bg-content1 p-5">
        <div className="flex flex-col gap-2">
          <h2 className={LABEL}>Sesiones hechas esta semana</h2>
          <p className={BIG}>
            {sessionPct === null ? (
              "—"
            ) : (
              <>
                {sessionPct}
                <Muted>%</Muted>
              </>
            )}
          </p>
          <p className="text-[13px] text-default-500">
            {sessions.planned === 0 ? (
              "Sin sesiones previstas esta semana"
            ) : (
              <>
                <span className="tabular-nums">
                  {sessions.done} de {sessions.planned}
                </span>{" "}
                previstas
              </>
            )}
          </p>
          {sessionPct !== null && sessions.lastWeekPct !== null ? (
            <Delta
              suffix="puntos frente a la semana pasada a estas alturas"
              value={sessionPct - sessions.lastWeekPct}
            />
          ) : null}
        </div>
        <div className="w-full self-end sm:w-[260px]">
          <SessionBars sessions={sessions} />
        </div>
      </section>

      <section className="flex flex-col justify-between gap-4 bg-content1 p-5">
        <div className="flex flex-col gap-2">
          <h2 className={LABEL}>Check-ins recibidos esta semana</h2>
          <p className={BIG}>
            {checkins.due === 0 ? (
              "—"
            ) : (
              <>
                {checkins.received}
                <Muted> de {checkins.due}</Muted>
              </>
            )}
          </p>
          {checkins.due === 0 ? (
            <p className="text-[13px] text-default-500">
              Ningún check-in cierra esta semana
            </p>
          ) : (
            <Delta
              suffix="puntos frente a la semana pasada"
              value={now - before}
            />
          )}
        </div>
        <div>
          <Trend
            label={`Porcentaje de check-ins recibidos en las últimas ${checkins.trend.length} semanas: ${checkins.trend.join(", ")}`}
            values={checkins.trend}
          />
          <p className="mt-1.5 text-[11px] text-default-400">
            % recibido · últimas {checkins.trend.length} semanas
          </p>
        </div>
      </section>

      <section className="flex flex-col justify-between gap-4 bg-content1 p-5">
        <div className="flex flex-col gap-2">
          <h2 className={LABEL}>Clientes activos</h2>
          <p className={BIG}>{clients.active}</p>
          <p className="text-[13px] text-default-500">
            {clients.joinedLastMonth > 0 ? (
              <>
                <span className="font-medium tabular-nums text-success-700">
                  +{clients.joinedLastMonth}
                </span>{" "}
                {clients.joinedLastMonth === 1 ? "alta" : "altas"} en el último
                mes
              </>
            ) : (
              "Sin altas en el último mes"
            )}
          </p>
        </div>
        <div>
          <Trend
            label={`Cartera actual según fecha de alta, últimas ${clients.trend.length} semanas: ${clients.trend.join(", ")}`}
            values={clients.trend}
          />
          <p className="mt-1.5 text-[11px] text-default-400">
            Cartera actual por fecha de alta ·{" "}
            <span className="tabular-nums">{clients.activeToday}</span>{" "}
            {clients.activeToday === 1 ? "conectado" : "conectados"} hoy
          </p>
        </div>
      </section>
    </div>
  );
}

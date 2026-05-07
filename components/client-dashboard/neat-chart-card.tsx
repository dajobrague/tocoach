/**
 * <NeatChartCard>
 *
 * Render interno de la tarjeta "Actividad diaria". El header (icono +
 * label) lo monta el contenedor en `dashboard-content.tsx`. Aquí
 * pintamos:
 *
 *   1. Ring radial con los pasos de hoy sobre la meta — éxito en
 *      `success-500`, fondo neutro `default-100`. El número vive UNA sola
 *      vez, en el centro del ring (antes se duplicaba arriba + leyenda).
 *   2. Línea-resumen "Meta X · Faltan Y" debajo del ring.
 *   3. Tira de los últimos 7 días (mini-bar chart). Hoy resaltado en
 *      success; el resto en default-200. Da contexto semanal sin
 *      agrandar la tarjeta.
 *   4. Banner success-only cuando se alcanza la meta. Antes había tres
 *      estados (success / warning / danger) y los dos últimos sentían
 *      "nagging" al cliente — ahora se reservan para el desbloqueo
 *      celebratorio.
 *   5. Desglose de objetivos cuando hay >1 NEAT card aplicable.
 */

"use client";

import type { ClientNeatCard } from "@/types";

import { Icon } from "@iconify/react";
import { useMemo } from "react";
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts";

// Mismo orden que `week-date-selector.tsx` (Lunes-first); mantenemos la
// ambigüedad M/M para no introducir un patrón nuevo en este card.
const WEEKDAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

export interface WeekStep {
  /** YYYY-MM-DD en huso local del navegador (ver `getLocalYmd`). */
  date: string;
  /** `Date.getDay()` — 0=Domingo, 1=Lunes, … 6=Sábado. */
  weekday: number;
  steps: number;
  isToday: boolean;
}

interface NeatChartCardProps {
  neatCards: ClientNeatCard[];
  todaySteps: number;
  /**
   * Weekday del "hoy" del padre (0=Domingo, … 6=Sábado). Antes este
   * componente leía `new Date().getDay()` dentro del useMemo sin
   * deps — si el cliente cruzaba medianoche con la app abierta, las
   * cards aplicables al día anterior se filtraban con un weekday
   * stale y `totalGoal` quedaba en 0, ocultando la tarjeta. Ahora
   * llega como prop desde `dashboard-content` (que ya refresca su
   * `todayYmd` cada minuto + en window focus), garantizando que padre
   * e hijo siempre comparten el mismo "hoy".
   */
  todayWeekday: number;
  /** Últimos 7 días en orden cronológico (más antiguo → hoy). */
  weekSteps?: WeekStep[];
}

export function NeatChartCard({
  neatCards,
  todaySteps,
  todayWeekday,
  weekSteps,
}: NeatChartCardProps) {
  const { applicableCards, totalGoal, percentage } = useMemo(() => {
    const applicable = neatCards.filter(
      (card) =>
        !card.weekdays ||
        card.weekdays.length === 0 ||
        card.weekdays.includes(todayWeekday)
    );
    const goal = applicable.reduce(
      (sum, card) => sum + (card.steps_goal || 0),
      0
    );
    const pct = goal > 0 ? (todaySteps / goal) * 100 : 0;

    return { applicableCards: applicable, totalGoal: goal, percentage: pct };
  }, [neatCards, todaySteps, todayWeekday]);

  // Si no hay cards aplicables o meta, ocultamos el contenido. El
  // `shouldShowNeatChart` del padre normalmente ya nos protege, pero
  // dejamos la red por si cambia el shape.
  if (applicableCards.length === 0 || totalGoal === 0) {
    return null;
  }

  const remaining = Math.max(0, totalGoal - todaySteps);
  const stepsCapped = Math.min(todaySteps, totalGoal);
  const goalReached = percentage >= 100;

  // Una sola data-point: el ring se llena vs. el `domain` de
  // `PolarAngleAxis` ([0, totalGoal]). El truco con startAngle=90 +
  // endAngle=-270 deja el arco creciendo desde las 12 horarias en sentido
  // horario, como un anillo de progreso convencional.
  const ringData = [{ name: "pasos", value: stepsCapped }];

  return (
    <div>
      {/* Ring radial con número en el centro. Altura fija para evitar
          CLS al cargar Recharts. */}
      <div className="relative w-full h-[200px]">
        <ResponsiveContainer
          className="[&_.recharts-surface]:outline-hidden"
          height="100%"
          width="100%"
        >
          <RadialBarChart
            cx="50%"
            cy="50%"
            data={ringData}
            endAngle={-270}
            innerRadius={72}
            outerRadius={94}
            startAngle={90}
          >
            <PolarAngleAxis
              angleAxisId={0}
              domain={[0, totalGoal]}
              tick={false}
              type="number"
            />
            <RadialBar
              angleAxisId={0}
              animationDuration={900}
              animationEasing="ease-out"
              background={{ fill: "hsl(var(--heroui-default-100))" }}
              cornerRadius={9999}
              dataKey="value"
              fill="hsl(var(--heroui-success-500))"
              strokeWidth={0}
            />
          </RadialBarChart>
        </ResponsiveContainer>

        {/* Texto absoluto (HTML) en el centro del ring. Lo hacemos fuera
            de Recharts <text> para usar tokens HeroUI nativos y
            tabular-nums sin pelearme con SVG fonts. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-3xl font-bold tabular-nums text-foreground leading-none">
            {todaySteps.toLocaleString()}
          </p>
          <p className="text-[11px] text-foreground/55 mt-1.5 tracking-wide">
            pasos
          </p>
        </div>
      </div>

      {/* Resumen meta · faltan en una sola línea. Tabular-nums para que
          los dígitos no salten al actualizar. */}
      <p className="text-center text-xs text-foreground/60 mt-1 tabular-nums">
        Meta {totalGoal.toLocaleString()}
        {!goalReached ? (
          <>
            <span className="mx-1.5 text-foreground/30">·</span>
            Faltan {remaining.toLocaleString()}
          </>
        ) : null}
      </p>

      {/* Tira semanal — solo si tenemos datos (parent siempre debería
          pasarlos, pero la prop es opcional para no romper invocaciones
          externas). */}
      {weekSteps && weekSteps.length > 0 ? (
        <WeekStrip weekSteps={weekSteps} />
      ) : null}

      {/* Desglose de cards cuando hay varios objetivos aplicables hoy.
          Útil cuando el entrenador divide la meta diaria (e.g. mañana
          vs. tarde). Compactado vs. la versión anterior. */}
      {applicableCards.length > 1 ? (
        <div className="mt-4 pt-3 border-t border-default-100/60 space-y-1.5">
          <p className="text-[11px] font-medium text-foreground/55 tracking-wide mb-2">
            Objetivos de hoy
          </p>
          {applicableCards.map((card) => (
            <div
              key={card.id}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon
                  aria-hidden
                  className="text-default-400 flex-shrink-0"
                  icon="solar:target-bold"
                  width={12}
                />
                <span className="text-foreground/70 truncate">
                  {card.label}
                </span>
              </div>
              <span className="font-semibold text-foreground tabular-nums flex-shrink-0">
                {card.steps_goal?.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Banner success-only. Si aún no llega a meta, no mostramos nada
          (evita el "nagging" del banner warning/danger anterior). */}
      {goalReached ? (
        <div className="mt-4 p-3 rounded-lg bg-success/10 flex items-center gap-2">
          <Icon
            aria-hidden
            className="text-success flex-shrink-0"
            icon="solar:check-circle-bold"
            width={18}
          />
          <p className="text-xs text-success font-semibold">
            ¡Objetivo cumplido!
          </p>
        </div>
      ) : null}
    </div>
  );
}

interface WeekStripProps {
  weekSteps: WeekStep[];
}

/**
 * Mini-bar chart de los últimos 7 días. Cada barra escala vs. el máximo
 * de la semana (no vs. la meta) para que el patrón sea legible cuando
 * el cliente está bajo de meta varios días seguidos. Hoy se resalta con
 * `success`, el resto en `default-300`.
 */
function WeekStrip({ weekSteps }: WeekStripProps) {
  const maxSteps = useMemo(
    () => Math.max(0, ...weekSteps.map((d) => d.steps)),
    [weekSteps]
  );

  return (
    <div className="mt-4 pt-3 border-t border-default-100/60">
      <p className="text-[11px] font-medium text-foreground/55 tracking-wide mb-2">
        Esta semana
      </p>
      <div className="flex items-end justify-between gap-1.5 h-[44px]">
        {weekSteps.map((d) => {
          // Altura mínima ~6% para que un día con 0 pasos siga
          // marcándose visualmente como "vacío" en lugar de
          // desaparecer por completo.
          const heightPct =
            maxSteps > 0
              ? Math.max(6, Math.round((d.steps / maxSteps) * 100))
              : 6;

          return (
            <div
              key={d.date}
              className="flex flex-col items-center gap-1.5 flex-1 min-w-0"
            >
              <div className="w-full flex-1 flex items-end">
                <div
                  className={`w-full rounded-sm ${
                    d.isToday ? "bg-success" : "bg-default-200"
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-1.5 mt-1.5">
        {weekSteps.map((d) => {
          const labelIdx = d.weekday === 0 ? 6 : d.weekday - 1;

          return (
            <div
              key={`${d.date}-label`}
              className={`flex-1 text-center text-[10px] tracking-wide ${
                d.isToday ? "text-success font-semibold" : "text-foreground/40"
              }`}
            >
              {WEEKDAY_LETTERS[labelIdx]}
            </div>
          );
        })}
      </div>
    </div>
  );
}

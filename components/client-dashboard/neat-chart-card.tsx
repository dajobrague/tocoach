"use client";

import type { ClientNeatCard } from "@/types";

import { Icon } from "@iconify/react";
import { useMemo } from "react";
import {
  Cell,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface NeatChartCardProps {
  neatCards: ClientNeatCard[];
  todaySteps: number;
  selectedPeriod?: string;
}

export function NeatChartCard({ neatCards, todaySteps }: NeatChartCardProps) {
  // Calculate applicable NEAT goals for today
  const { applicableCards, totalGoal, percentage, color } = useMemo(() => {
    const today = new Date().getDay(); // 0=Sunday, 1=Monday, etc.

    const applicable = neatCards.filter(
      (card) =>
        !card.weekdays ||
        card.weekdays.length === 0 ||
        card.weekdays.includes(today)
    );

    const goal = applicable.reduce(
      (sum, card) => sum + (card.steps_goal || 0),
      0
    );

    const pct = goal > 0 ? (todaySteps / goal) * 100 : 0;

    // Determine color based on percentage
    let chartColor = "danger"; // < 70%

    if (pct >= 100) chartColor = "success";
    else if (pct >= 70) chartColor = "warning";

    return {
      applicableCards: applicable,
      totalGoal: goal,
      percentage: pct,
      color: chartColor,
    };
  }, [neatCards, todaySteps]);

  // Generate chart data with two segments: remaining (primary) and completed (secondary)
  const chartData = useMemo(() => {
    if (totalGoal === 0) return [];

    const actualSteps = Math.min(todaySteps, totalGoal);
    const remainingSteps = Math.max(0, totalGoal - todaySteps);

    return [
      {
        name: "Por Completar",
        value: remainingSteps,
        valueText: `${remainingSteps.toLocaleString()} pasos restantes`,
      },
      {
        name: "Completado",
        value: actualSteps,
        valueText: `${actualSteps.toLocaleString()} pasos completados`,
      },
    ];
  }, [todaySteps, totalGoal]);

  // If no applicable cards today or no goal, return null (hide chart)
  if (applicableCards.length === 0 || totalGoal === 0) {
    return null;
  }

  return (
    <div>
      {/* Main metric display */}
      <p className="text-5xl font-bold mb-1 text-foreground">
        {todaySteps.toLocaleString()}
      </p>
      <p className="text-sm text-foreground/70 mb-4">
        de {totalGoal.toLocaleString()} pasos hoy
      </p>

      {/* Radial Bar Chart with two segments */}
      <ResponsiveContainer
        className="[&_.recharts-surface]:outline-hidden"
        height={200}
        width="100%"
      >
        <RadialBarChart
          barSize={10}
          cx="50%"
          cy="50%"
          data={chartData}
          endAngle={-270}
          innerRadius={90}
          outerRadius={54}
          startAngle={90}
        >
          <Tooltip
            content={({ payload }) => (
              <div className="rounded-medium bg-background text-tiny shadow-small flex min-w-[160px] flex-col gap-y-1 p-2">
                {payload?.map((p, index) => {
                  const name = p.payload.name;
                  const value = p.value;
                  const isPrimary = index === 0; // First is remaining (primary)

                  return (
                    <div
                      key={`tooltip-${name}`}
                      className="flex w-full items-center gap-x-2"
                    >
                      <div
                        className="h-2 w-2 flex-none rounded-full"
                        style={{
                          backgroundColor: isPrimary
                            ? "hsl(var(--heroui-primary-500))"
                            : "hsl(var(--heroui-secondary-500))",
                        }}
                      />
                      <div className="text-default-700 flex w-full items-center justify-between gap-x-2 text-xs">
                        <span className="text-default-500">{name}</span>
                        <span className="text-default-700 font-mono font-medium">
                          {(value as number).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            cursor={false}
          />
          <RadialBar
            animationDuration={1000}
            animationEasing="ease"
            background={{ fill: "hsl(var(--heroui-default-100))" }}
            cornerRadius={12}
            dataKey="value"
            strokeWidth={0}
          >
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  index === 0
                    ? "hsl(var(--heroui-primary-500))" // Remaining steps - primary color
                    : "hsl(var(--heroui-secondary-500))" // Completed steps - secondary color
                }
              />
            ))}
          </RadialBar>
          <g>
            <text textAnchor="middle" x="50%" y="48%">
              <tspan
                className="fill-default-500 text-[0.6rem]"
                dy="-0.5em"
                x="50%"
              >
                Total
              </tspan>
              <tspan
                className="fill-foreground text-tiny font-semibold"
                dy="1.5em"
                x="50%"
              >
                {todaySteps.toLocaleString()} pasos
              </tspan>
            </text>
          </g>
        </RadialBarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: "hsl(var(--heroui-primary-500))" }}
            />
            <span className="text-foreground/70">Por Completar</span>
          </div>
          <span className="font-semibold text-foreground">
            {Math.max(0, totalGoal - todaySteps).toLocaleString()} pasos
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: "hsl(var(--heroui-secondary-500))" }}
            />
            <span className="text-foreground/70">Completado</span>
          </div>
          <span className="font-semibold text-foreground">
            {Math.min(todaySteps, totalGoal).toLocaleString()} pasos
          </span>
        </div>
      </div>

      {/* Cards breakdown */}
      {applicableCards.length > 1 && (
        <div className="mt-4 pt-4 border-t border-default-200 space-y-2">
          <p className="text-xs font-semibold text-foreground/70 mb-2">
            Objetivos de hoy:
          </p>
          {applicableCards.map((card) => (
            <div
              key={card.id}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <Icon
                  className="text-default-400"
                  icon="solar:target-bold"
                  width={14}
                />
                <span className="text-foreground/70">{card.label}</span>
              </div>
              <span className="font-semibold text-foreground">
                {card.steps_goal?.toLocaleString()} pasos
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Status message */}
      <div className="mt-4 p-3 rounded-lg bg-default-50">
        {percentage >= 100 ? (
          <div className="flex items-center gap-2">
            <Icon
              className="text-success"
              icon="solar:check-circle-bold"
              width={18}
            />
            <p className="text-xs text-success font-semibold">
              ¡Objetivo cumplido! 🎉
            </p>
          </div>
        ) : percentage >= 70 ? (
          <div className="flex items-center gap-2">
            <Icon
              className="text-warning"
              icon="solar:clock-circle-bold"
              width={18}
            />
            <p className="text-xs text-warning font-semibold">
              ¡Casi lo logras! Faltan{" "}
              {(totalGoal - todaySteps).toLocaleString()} pasos
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Icon
              className="text-danger"
              icon="solar:walking-bold"
              width={18}
            />
            <p className="text-xs text-danger font-semibold">
              Sigue adelante. Faltan {(totalGoal - todaySteps).toLocaleString()}{" "}
              pasos
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import type { CardioStats, StrengthStats } from "./helpers";

import { StatCard } from "../progress/ui-atoms";

export function StrengthStatsGrid({ stats }: { stats: StrengthStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard
        accent="blue"
        label="Máx."
        value={stats.maxWeight > 0 ? `${stats.maxWeight} kg` : "—"}
      />
      <StatCard
        accent="green"
        label="Último"
        value={stats.lastWeight > 0 ? `${stats.lastWeight} kg` : "—"}
      />
      <StatCard
        label="Media"
        value={stats.avgWeight > 0 ? `${stats.avgWeight} kg` : "—"}
      />
      <StatCard label="Sesiones" value={String(stats.sessionsCount)} />
    </div>
  );
}

export function CardioStatsGrid({ stats }: { stats: CardioStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard
        accent="blue"
        label="Mejor"
        value={stats.bestDistanceKm > 0 ? `${stats.bestDistanceKm} km` : "—"}
      />
      <StatCard
        accent="green"
        label="Último"
        value={stats.lastDistanceKm > 0 ? `${stats.lastDistanceKm} km` : "—"}
      />
      <StatCard
        label="Total"
        value={stats.totalDistanceKm > 0 ? `${stats.totalDistanceKm} km` : "—"}
      />
      <StatCard label="Sesiones" value={String(stats.sessionsCount)} />
    </div>
  );
}

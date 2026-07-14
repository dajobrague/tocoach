"use client";

import { Icon } from "@iconify/react";

/**
 * Canonical macro colors, shared visual language with the trainer builder
 * (day-nutrition-panel): protein blue, carbs emerald, fat amber. Deliberately
 * NOT tenant-themed — like the session-type colors, macro colors must stay
 * legible regardless of the tenant's primary color.
 */
export const MACRO_COLORS = {
  protein: { dot: "bg-blue-500", bar: "bg-blue-500" },
  carbs: { dot: "bg-emerald-500", bar: "bg-emerald-500" },
  fat: { dot: "bg-amber-500", bar: "bg-amber-500" },
} as const;

/**
 * Inline "P 32 · C 45 · G 12" macro line with the canonical color dots —
 * the compact per-item form used on option cards.
 */
export function MacroDotsLine({
  protein_g,
  carbs_g,
  fat_g,
  className = "",
}: {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  className?: string;
}) {
  const parts = [
    { key: "P", value: protein_g, dot: MACRO_COLORS.protein.dot },
    { key: "C", value: carbs_g, dot: MACRO_COLORS.carbs.dot },
    { key: "G", value: fat_g, dot: MACRO_COLORS.fat.dot },
  ];

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {parts.map((part) => (
        <span key={part.key} className="inline-flex items-center gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${part.dot}`} />
          <span className="text-default-500">
            {part.key}{" "}
            <span className="font-medium text-default-600 tabular-nums">
              {Math.round(part.value)}g
            </span>
          </span>
        </span>
      ))}
    </span>
  );
}

/** Thin rounded progress bar (mirror of the trainer builder's). */
export function MacroProgressBar({
  value,
  color,
  className = "",
}: {
  /** 0–100. */
  value: number;
  /** Tailwind bg-* class for the fill. */
  color: string;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-default-100 ${className}`}
    >
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/** Kcal progress ring with a fire icon center (mirror of the trainer's). */
export function KcalRing({ value }: { value: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);

  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
        <circle
          className="stroke-default-200"
          cx="32"
          cy="32"
          fill="none"
          r={radius}
          strokeWidth="5"
        />
        <circle
          className="stroke-primary"
          cx="32"
          cy="32"
          fill="none"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="5"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-primary">
        <Icon icon="solar:fire-bold" width={22} />
      </span>
    </div>
  );
}

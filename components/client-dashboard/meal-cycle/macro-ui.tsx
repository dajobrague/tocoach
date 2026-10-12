"use client";

import type { ReactNode } from "react";

import { Icon } from "@iconify/react";

/**
 * Canonical macro colors, shared visual language with the trainer builder
 * (day-nutrition-panel): protein blue, carbs emerald, fat amber. Deliberately
 * NOT tenant-themed — like the session-type colors, macro colors must stay
 * legible regardless of the tenant's primary color. A step lighter in dark
 * mode so they keep their contrast on dark surfaces.
 */
export const MACRO_COLORS = {
  protein: {
    dot: "bg-blue-500 dark:bg-blue-400",
    bar: "bg-blue-500 dark:bg-blue-400",
  },
  carbs: {
    dot: "bg-emerald-500 dark:bg-emerald-400",
    bar: "bg-emerald-500 dark:bg-emerald-400",
  },
  fat: {
    dot: "bg-amber-500 dark:bg-amber-400",
    bar: "bg-amber-500 dark:bg-amber-400",
  },
} as const;

/** Fill chip of the portal: neutral (status) or brand-tinted (call-outs). */
export function SoftChip({
  children,
  brand = false,
  className = "",
}: {
  children: ReactNode;
  brand?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${
        brand ? "bg-primary/10 text-primary" : "bg-default-100 text-default-500"
      } ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Empty / error / info state of the nutrition screens: icon in a soft circle,
 * title and an optional line + action, on a plain card (`flat` = soft fill,
 * for states that already sit on a surface, like inside a sheet).
 */
export function NutritionState({
  icon,
  title,
  subtitle,
  action,
  tone = "default",
  flat = false,
  testId,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  tone?: "default" | "danger";
  flat?: boolean;
  testId?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-large px-6 py-10 text-center ${
        flat ? "bg-default-100" : "bg-content1 shadow-small"
      }`}
      data-testid={testId}
    >
      <span
        className={`mb-1 flex h-14 w-14 items-center justify-center rounded-full ${
          tone === "danger"
            ? "bg-danger/10 text-danger"
            : flat
              ? "bg-content1 text-default-500"
              : "bg-default-100 text-default-500"
        }`}
      >
        <Icon icon={icon} width={28} />
      </span>
      <p className="text-[17px] font-semibold text-foreground [text-wrap:balance]">
        {title}
      </p>
      {subtitle !== undefined ? (
        <p className="max-w-[280px] text-sm leading-snug text-default-500">
          {subtitle}
        </p>
      ) : null}
      {action !== undefined ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * Four soft tiles "1.840 · 120 g · 45 g · 12 g" — the day summary without
 * goals and the recipe detail share it.
 */
export function MacroStrip({
  kcal,
  protein_g,
  carbs_g,
  fat_g,
  labels = ["Calorías", "Proteína", "Carbos", "Grasa"],
}: {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  labels?: readonly [string, string, string, string];
}) {
  const cells = [
    {
      label: labels[0],
      value: Math.round(kcal).toLocaleString("es"),
      dot: null,
    },
    {
      label: labels[1],
      value: `${Math.round(protein_g)} g`,
      dot: MACRO_COLORS.protein.dot,
    },
    {
      label: labels[2],
      value: `${Math.round(carbs_g)} g`,
      dot: MACRO_COLORS.carbs.dot,
    },
    {
      label: labels[3],
      value: `${Math.round(fat_g)} g`,
      dot: MACRO_COLORS.fat.dot,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="flex flex-col items-center gap-0.5 rounded-xl bg-default-100 px-1 py-2.5 text-center"
        >
          <span className="font-heading text-lg leading-tight tracking-[-0.01em] text-foreground tabular-nums">
            {cell.value}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-default-500">
            {cell.dot !== null ? (
              <span className={`h-2 w-2 rounded-full ${cell.dot}`} />
            ) : null}
            {cell.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Inline "P 32 g · C 45 g · G 12 g" macro line with the canonical color dots —
 * the compact per-item form used on option rows.
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
    <span
      className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-default-500 tabular-nums ${className}`}
    >
      {parts.map((part) => (
        <span key={part.key} className="inline-flex items-center gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${part.dot}`} />
          {part.key} {Math.round(part.value)} g
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
      className={`h-1.5 w-full overflow-hidden rounded-full bg-default-200 ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/** Kcal progress ring with a fire icon center, in the tenant's ink color. */
export function KcalRing({ value }: { value: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);

  return (
    <div
      aria-label={`${Math.round(value)}% del objetivo de calorías`}
      className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center text-primary"
      role="img"
    >
      <svg
        className="absolute inset-0 h-full w-full -rotate-90"
        viewBox="0 0 80 80"
      >
        <circle
          className="stroke-default-200"
          cx="40"
          cy="40"
          fill="none"
          r={radius}
          strokeWidth="7"
        />
        <circle
          className="transition-[stroke-dashoffset] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
          cx="40"
          cy="40"
          fill="none"
          r={radius}
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="7"
        />
      </svg>
      <Icon icon="solar:fire-linear" width={26} />
    </div>
  );
}

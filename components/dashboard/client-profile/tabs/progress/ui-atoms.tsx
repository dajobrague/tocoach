"use client";

import { Button, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";

import { DATE_RANGES } from "./helpers";

// ─── Accent color map ─────────────────────────────────────────────────────────

const ACCENT_COLORS: Record<
  string,
  { border: string; label: string; value: string; bg: string }
> = {
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    label: "text-blue-600",
    value: "text-blue-800",
  },
  green: {
    bg: "bg-green-50",
    border: "border-green-200",
    label: "text-green-600",
    value: "text-green-800",
  },
  purple: {
    bg: "bg-violet-50",
    border: "border-violet-200",
    label: "text-violet-600",
    value: "text-violet-800",
  },
  gray: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    label: "text-gray-500",
    value: "text-gray-900",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    label: "text-amber-600",
    value: "text-amber-800",
  },
};

// ─── StatCard ─────────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  accent = "gray",
  icon,
}: {
  label: string;
  value: string;
  accent?: string;
  icon?: string;
}) {
  const c = ACCENT_COLORS[accent] ?? ACCENT_COLORS["gray"]!;

  return (
    <div className={`${c.bg} rounded-xl p-4 border ${c.border}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon && <Icon className={c.label} icon={icon} width={14} />}
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${c.label}`}
        >
          {label}
        </p>
      </div>
      <p className={`text-xl font-bold ${c.value} truncate`}>{value}</p>
    </div>
  );
}

// ─── DateRangeSelector ────────────────────────────────────────────────────────

export function DateRangeSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {DATE_RANGES.map((r) => (
        <Button
          key={r.key}
          color={value === r.key ? "primary" : "default"}
          size="sm"
          variant={value === r.key ? "solid" : "flat"}
          onPress={() => onChange(r.key)}
        >
          {r.label}
        </Button>
      ))}
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

export function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: string;
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
        <Icon className="text-gray-600" icon={icon} width={18} />
      </div>
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      {count !== undefined && count > 0 && (
        <Chip className="h-5" size="sm" variant="flat">
          {count}
        </Chip>
      )}
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

export function Sparkline({
  data,
  color,
  height = 36,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
  if (data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 6) - 3}`
    )
    .join(" ");

  return (
    <svg
      className="w-full"
      preserveAspectRatio="none"
      style={{ height }}
      viewBox={`0 0 ${w} ${height}`}
    >
      <polyline
        fill="none"
        points={points}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

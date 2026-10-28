"use client";

import { Icon } from "@iconify/react";
import React from "react";

// Shared building blocks for the desktop admin: a dense, neutral look
// (system font, tabular numbers, hairline dividers) instead of icon cards.

const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["week", 7 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

// trainers/admin_users store `timestamp without time zone` (UTC); without an
// offset the browser would parse those as local time and show "dentro de 3 h".
export function parseTimestamp(iso: string): Date {
  return new Date(
    /[zZ]$|[+-]\d\d:?\d\d$/.test(iso) || iso.length <= 10 ? iso : `${iso}Z`
  );
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";

  return parseTimestamp(iso).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "Nunca";
  const seconds = (parseTimestamp(iso).getTime() - Date.now()) / 1000;

  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return rtf.format(Math.round(seconds / size), unit);
    }
  }

  return "Ahora";
}

/** Whole calendar days between a YYYY-MM-DD date and today (local). */
export function daysAgoForDay(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const then = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return Math.round((today.getTime() - then.getTime()) / 86_400_000);
}

/** "hoy", "ayer", "hace 3 días", "hace 2 semanas" for a date-only value. */
export function formatDayRelative(day: string): string {
  const n = daysAgoForDay(day);

  if (n <= 0) return "hoy";
  if (n < 14) return rtf.format(-n, "day");

  return rtf.format(-Math.round(n / 7), "week");
}

export function daysSince(iso: string | null): number {
  if (!iso) return Infinity;

  return (Date.now() - parseTimestamp(iso).getTime()) / 86_400_000;
}

/** Relative time with the exact date on hover; fades when stale/never. */
export function RelativeTime({
  iso,
  staleAfterDays = 30,
}: {
  iso: string | null;
  staleAfterDays?: number;
}) {
  const stale = daysSince(iso) > staleAfterDays;

  return (
    <span
      className={stale ? "text-slate-400" : "text-slate-700"}
      title={iso ? parseTimestamp(iso).toLocaleString("es-ES") : undefined}
    >
      {formatRelative(iso)}
    </span>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
      {initials || "?"}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-6">
      <div className="min-w-0">
        {breadcrumb}
        <h1 className="truncate text-[28px] font-semibold leading-tight tracking-[-0.02em] text-slate-900">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/** A titled white card — the dashboards' basic building block. */
export function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}
    >
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-[14px] font-semibold text-slate-900">{title}</h2>
        {subtitle ? (
          <span className="text-[12px] text-slate-400">{subtitle}</span>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export interface MetricItem {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}

/** One row of numbers separated by hairlines — reads at a glance. */
export function MetricStrip({ items }: { items: MetricItem[] }) {
  return (
    <dl
      className="grid divide-x divide-slate-200 rounded-xl border border-slate-200 bg-white"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((m) => (
        <div key={m.label} className="px-5 py-4">
          <dt className="text-[12px] font-medium text-slate-500">{m.label}</dt>
          <dd
            key={m.value === "—" ? "pending" : "ready"}
            className="admin-fade-in mt-1 text-[24px] font-semibold leading-none tracking-[-0.01em] text-slate-900 tabular-nums"
          >
            {m.value}
          </dd>
          {m.hint ? (
            <dd className="mt-1.5 text-[12px] text-slate-400 tabular-nums">
              {m.hint}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

export interface Segment<K extends string> {
  key: K;
  label: string;
  count?: number;
}

export function SegmentedControl<K extends string>({
  segments,
  value,
  onChange,
}: {
  segments: Segment<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  const refs = React.useRef(new Map<K, HTMLButtonElement>());
  const [pill, setPill] = React.useState<{ x: number; w: number } | null>(null);
  // The pill slides only after the first placement, never on mount.
  const placed = React.useRef(false);

  React.useLayoutEffect(() => {
    const el = refs.current.get(value);

    if (!el) return;
    const next = { x: el.offsetLeft, w: el.offsetWidth };

    // Counts arriving change widths; skip no-op updates (segments is a new
    // array every render, so an unconditional set would loop).
    setPill((p) => (p && p.x === next.x && p.w === next.w ? p : next));
  });

  React.useEffect(() => {
    if (pill) placed.current = true;
  }, [pill]);

  return (
    <div
      className="relative inline-flex rounded-lg bg-slate-100 p-0.5"
      role="tablist"
    >
      {pill ? (
        <span
          aria-hidden
          className="absolute top-0.5 left-0 h-7 rounded-md bg-white shadow-sm ring-1 ring-slate-900/5 motion-reduce:transition-none"
          style={{
            width: pill.w,
            transform: `translateX(${pill.x}px)`,
            transition: placed.current
              ? "transform 200ms var(--admin-ease-out), width 200ms var(--admin-ease-out)"
              : "none",
          }}
        />
      ) : null}
      {segments.map((s) => {
        const active = s.key === value;

        return (
          <button
            key={s.key}
            ref={(el) => {
              if (el) refs.current.set(s.key, el);
              else refs.current.delete(s.key);
            }}
            aria-selected={active}
            className={`relative flex h-7 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors duration-150 ${
              active ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
            }`}
            role="tab"
            type="button"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onChange(s.key);
            }}
            onPointerDown={() => onChange(s.key)}
          >
            {s.label}
            {s.count !== undefined ? (
              <span
                className={`tabular-nums ${active ? "text-slate-500" : "text-slate-400"}`}
              >
                {s.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Search field; "/" focuses it from anywhere on the page. */
export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      if (
        e.key === "/" &&
        !target.closest("input, textarea, [contenteditable]")
      ) {
        e.preventDefault();
        ref.current?.focus();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <label className="flex h-8 w-80 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-900/5">
      <Icon
        className="text-slate-400"
        icon="solar:magnifer-linear"
        width={15}
      />
      <input
        ref={ref}
        className="min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400"
        placeholder={placeholder}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onChange("");
            e.currentTarget.blur();
          }
        }}
      />
      {value ? null : (
        <kbd className="rounded border border-slate-200 px-1.5 font-sans text-[11px] text-slate-400">
          /
        </kbd>
      )}
    </label>
  );
}

export type SortDir = "asc" | "desc";

/** Sort state + a sorted copy. Nulls always sink to the bottom. */
export function useSort<T, K extends string>(
  rows: T[],
  accessors: Record<K, (row: T) => string | number | null>,
  initial: { key: NoInfer<K>; dir: SortDir }
) {
  const [sort, setSort] = React.useState(initial);

  const sorted = React.useMemo(() => {
    const get = accessors[sort.key];
    const sign = sort.dir === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);

      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === "string" && typeof vb === "string") {
        return va.localeCompare(vb, "es") * sign;
      }

      return (va < vb ? -1 : 1) * sign;
    });
    // accessors is a stable module-level object at every call site
  }, [rows, sort]);

  const toggle = (key: K) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" }
    );

  return { sorted, sort, toggle };
}

export function SortHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
  className = "",
}: {
  label: string;
  sortKey: K;
  sort: { key: K; dir: SortDir };
  onSort: (key: K) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort.key === sortKey;

  return (
    <th
      aria-sort={
        active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
      }
      className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"} ${className}`}
      scope="col"
    >
      <button
        className={`inline-flex items-center gap-1 rounded hover:text-slate-900 ${active ? "text-slate-900" : ""} ${align === "right" ? "flex-row-reverse" : ""}`}
        type="button"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <Icon
          className={active ? "opacity-100" : "opacity-0"}
          icon={
            active && sort.dir === "asc"
              ? "solar:alt-arrow-up-linear"
              : "solar:alt-arrow-down-linear"
          }
          width={12}
        />
      </button>
    </th>
  );
}

/** Shared table chrome: sticky translucent header, hairline rows. */
export const tableClasses = {
  wrapper: "overflow-clip rounded-xl border border-slate-200 bg-white",
  table: "w-full border-collapse text-[13px]",
  thead:
    "sticky top-0 z-10 border-b border-slate-200 bg-white/85 text-[12px] text-slate-500 backdrop-blur-md",
  row: "group cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 active:bg-slate-100",
  cell: "px-3 py-2.5 align-middle",
};

export function SkeletonRows({
  cols,
  rows = 8,
}: {
  cols: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="border-b border-slate-100">
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} className={tableClasses.cell}>
              <div
                className="h-3.5 animate-pulse rounded bg-slate-100"
                style={{ width: c === 0 ? "70%" : "45%" }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function StatusDot({
  tone,
  label,
}: {
  tone: "green" | "amber" | "red" | "gray";
  label: string;
}) {
  const color = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    gray: "bg-slate-300",
  }[tone];

  return (
    <span className="inline-flex items-center gap-1.5 text-slate-600">
      <span className={`size-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

// ---- Dialogs & forms -------------------------------------------------------

export const buttonClasses = {
  primary:
    "flex h-8 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-[13px] font-medium text-white transition-[transform,opacity] duration-100 hover:bg-slate-800 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
  danger:
    "flex h-8 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 text-[13px] font-medium text-white transition-[transform,opacity] duration-100 hover:bg-red-700 active:scale-[0.97] disabled:opacity-50",
  secondary:
    "flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 transition-transform duration-100 hover:bg-slate-50 active:scale-[0.97] disabled:opacity-50",
  ghost:
    "flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-slate-600 transition-transform duration-100 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.97] disabled:opacity-50",
};

/** classNames for HeroUI <Modal> so every admin dialog shares one look. */
export const dialogClassNames = {
  base: "rounded-2xl shadow-2xl ring-1 ring-slate-900/5",
  backdrop: "admin-backdrop bg-slate-900/20 backdrop-blur-[2px]",
};

export const inputClass =
  "h-9 w-full rounded-lg border bg-white px-3 text-[14px] text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:ring-2";

export function fieldTone(invalid: boolean) {
  return invalid
    ? "border-red-300 focus:border-red-400 focus:ring-red-500/10"
    : "border-slate-200 focus:border-slate-400 focus:ring-slate-900/5";
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        className="block text-[13px] font-medium text-slate-700"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      {children}
      <div className="min-h-[18px] text-[12px]">
        {error ? (
          <span className="text-red-600">{error}</span>
        ) : typeof hint === "string" ? (
          <span className="text-slate-400">{hint}</span>
        ) : (
          hint
        )}
      </div>
    </div>
  );
}

export function DialogHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-slate-900">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>
      ) : null}
    </div>
  );
}

/** Label/value rows in mono — credentials, ids, URLs. */
export function KeyValueList({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/60 text-[13px]">
      {rows.map(([k, v]) => (
        <div
          key={k}
          className="flex items-center justify-between gap-4 px-4 py-2.5"
        >
          <dt className="text-slate-500">{k}</dt>
          <dd className="truncate font-mono text-[12.5px] text-slate-900">
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function CopyButton({
  text,
  label,
  className = buttonClasses.primary,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  return (
    <button
      className={`${className} min-w-[168px]`}
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      <Icon
        icon={copied ? "solar:check-read-linear" : "solar:copy-linear"}
        width={15}
      />
      {copied ? "Copiado" : label}
    </button>
  );
}

export function SuccessHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <Icon icon="solar:check-circle-linear" width={20} />
      </span>
      <DialogHeader subtitle={subtitle} title={title} />
    </div>
  );
}

// ---- Charts ----------------------------------------------------------------

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

export interface WeekPoint {
  weekEnd: string;
  value: number;
  detail?: string;
}

/**
 * Single-series weekly columns. One hue, the latest week emphasised and
 * direct-labelled; hovering any column shows its range and detail.
 */
export function WeeklyColumnChart({
  points,
  max,
  unit,
}: {
  points: WeekPoint[];
  /** Fixed top of the scale (e.g. total clients); defaults to the data max. */
  max?: number;
  unit: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const top = Math.max(1, max ?? 0, ...points.map((p) => p.value));
  const active = hover ?? points.length - 1;
  const point = points[active];

  return (
    <div className="relative">
      <div className="relative flex h-44 items-end gap-1.5 border-b border-slate-200">
        {/* recessive scale line at the top value */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-slate-200" />
        <span className="pointer-events-none absolute -top-2 right-0 bg-white pl-1 text-[11px] tabular-nums text-slate-400">
          {top}
        </span>
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          const isActive = i === active;

          return (
            <button
              key={p.weekEnd}
              aria-label={`Semana hasta ${shortDate(p.weekEnd)}: ${p.value} ${unit}`}
              className="group/col relative flex h-full flex-1 items-end"
              type="button"
              onBlur={() => setHover(null)}
              onFocus={() => setHover(i)}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            >
              <span
                className={`block w-full rounded-t-[4px] transition-colors duration-100 ${
                  isActive
                    ? "bg-emerald-600"
                    : isLast
                      ? "bg-emerald-500"
                      : "bg-emerald-500/35 group-hover/col:bg-emerald-500/60"
                }`}
                style={{
                  height: `${(p.value / top) * 100}%`,
                  minHeight: p.value > 0 ? 3 : 0,
                }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5 text-[11px] tabular-nums text-slate-400">
        {points.map((p, i) => (
          <span key={p.weekEnd} className="flex-1 text-center">
            {i % 2 === (points.length - 1) % 2 ? shortDate(p.weekEnd) : ""}
          </span>
        ))}
      </div>
      {point ? (
        <div className="mt-3 flex items-baseline gap-2 text-[13px]">
          <span className="text-[20px] font-semibold tabular-nums text-slate-900">
            {point.value}
          </span>
          <span className="text-slate-600">{unit}</span>
          <span className="text-slate-400">
            · semana del{" "}
            {shortDate(
              new Date(
                Date.parse(`${point.weekEnd}T00:00:00Z`) - 6 * 86_400_000
              )
                .toISOString()
                .slice(0, 10)
            )}{" "}
            al {shortDate(point.weekEnd)}
            {point.detail ? ` · ${point.detail}` : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Tiny per-week bars for a table cell (e.g. last 4 weeks of training days). */
export function MiniBars({
  values,
  max = 7,
  label,
}: {
  values: number[];
  max?: number;
  label: string;
}) {
  return (
    <span
      aria-label={label}
      className="inline-flex h-4 items-end gap-[2px]"
      role="img"
      title={label}
    >
      {values.map((v, i) => (
        <span
          key={i}
          className={`w-1.5 rounded-t-[2px] ${v > 0 ? "bg-emerald-500" : "bg-slate-200"}`}
          style={{
            height:
              v > 0 ? `${Math.max(25, (Math.min(v, max) / max) * 100)}%` : 2,
          }}
        />
      ))}
    </span>
  );
}

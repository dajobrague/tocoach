interface ProgressBarProps {
  /** Fill percentage (0–100). */
  value: number;
  /** Tailwind bg-* class for the fill, e.g. "bg-emerald-500". */
  color: string;
  className?: string;
}

export function ProgressBar({ value, color, className }: ProgressBarProps) {
  const width = Math.min(100, Math.max(0, value));

  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-gray-100 ${className ?? ""}`}
    >
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

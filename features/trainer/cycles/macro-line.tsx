interface MacroLineProps {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** Hide the leading kcal value (when kcal is shown elsewhere in the row). */
  hideKcal?: boolean;
  /** Extra classes for sizing/color of the row (e.g. "text-xs text-default-500"). */
  className?: string;
}

/** Inline "kcal · P · C · G" nutrition row, shared by option rows and day headers. */
export function MacroLine({
  kcal,
  protein_g,
  carbs_g,
  fat_g,
  hideKcal,
  className,
}: MacroLineProps) {
  const macros = [
    { label: "P", value: protein_g },
    { label: "C", value: carbs_g },
    { label: "G", value: fat_g },
  ];

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      {hideKcal !== true && (
        <>
          <span className="font-semibold text-gray-900 tabular-nums">
            {Math.round(Number(kcal) || 0)} kcal
          </span>
          <span className="text-default-300">·</span>
        </>
      )}
      {macros.map((macro) => (
        <span key={macro.label} className="tabular-nums">
          <span className="text-default-400">{macro.label}</span>{" "}
          {Math.round(Number(macro.value) || 0)}g
        </span>
      ))}
    </div>
  );
}

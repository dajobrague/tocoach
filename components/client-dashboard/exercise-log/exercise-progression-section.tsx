// Progresión del ejercicio para el cliente: curva de 1RM estimado del
// último año + récords por rango de reps.
//
// Diseño:
// - Sparkline SVG inline (sin recharts): esta pantalla vive en la ruta de
//   workouts, que hoy no carga recharts — meter ~100KB de librería para
//   una curva de 80px sin ejes no compensa. El polyline se mapea con
//   preserveAspectRatio="none" + vector-effect para que el trazo siga
//   siendo de 2px reales; el punto final y su etiqueta son HTML absoluto
//   (así no se deforman al escalar).
// - Récords: chips por bucket de reps, medalla amber en el mejor. El
//   amber es literal a propósito, igual que el PR de
//   exercise-history-section: la paleta warning del theme pelea con el
//   primario del entrenador.
//
// Si hay menos de 2 puntos no renderiza nada: un punto suelto no es una
// progresión, es ruido.

import type { ProgressionPoint } from "@/lib/training/progression-query";
import type { RepMax } from "@/lib/training/e1rm";

import { formatKg } from "./helpers";
import { useExerciseProgression } from "./hooks/use-exercise-progression";

interface Props {
  exerciseId: string | null;
  isOpen: boolean;
  /** Nombre del ejercicio; hoy sólo se usa para etiquetas accesibles. */
  exerciseName?: string;
}

/** Mínimo de puntos para que la curva diga algo. */
const MIN_POINTS = 2;

/** Margen vertical dentro del viewBox para que la línea no toque bordes. */
const PAD_Y = 10;

export function ExerciseProgressionSection({
  exerciseId,
  isOpen,
  exerciseName,
}: Props) {
  const { data, isLoading } = useExerciseProgression(exerciseId, {
    enabled: isOpen,
  });

  if (!exerciseId || !isOpen) return null;
  // Sin skeleton a propósito: la mayoría de ejercicios nuevos no llegan a
  // 2 puntos, así que un skeleton sería un parpadeo que acaba en nada.
  if (isLoading || !data) return null;

  const series = data.e1rmSeries;

  if (series.length < MIN_POINTS) return null;

  const repMaxes = [...data.repMaxes].sort((a, b) => a.reps - b.reps);
  const bestBucket = pickBestBucket(data.repMaxes);

  return (
    <div className="rounded-lg border border-default-200 bg-content1 overflow-hidden">
      <p className="px-3 py-2 text-[11px] uppercase font-semibold text-default-500 border-b border-default-100 font-body">
        Tu progreso
      </p>

      <div className="px-3 pt-4 pb-2">
        <Sparkline exerciseName={exerciseName} series={series} />
      </div>

      {repMaxes.length > 0 ? (
        <>
          <p className="px-3 py-2 text-[11px] uppercase font-semibold text-default-500 border-y border-default-100 font-body">
            Tus récords
          </p>
          <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
            {repMaxes.map((rm) => (
              <RecordChip
                key={rm.bucket}
                isBest={rm.bucket === bestBucket}
                repMax={rm}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Sparkline({
  series,
  exerciseName,
}: {
  series: ProgressionPoint[];
  exerciseName: string | undefined;
}) {
  const last = series[series.length - 1];

  if (!last) return null;

  const values = series.map((p) => p.e1rm);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  // Serie plana: la dejamos centrada en vez de dividir por cero.
  const toY = (value: number): number =>
    span === 0 ? 50 : PAD_Y + ((max - value) / span) * (100 - PAD_Y * 2);

  const points = series
    .map((p, i) => {
      const x = series.length === 1 ? 100 : (i / (series.length - 1)) * 100;

      return `${x.toFixed(2)},${toY(p.e1rm).toFixed(2)}`;
    })
    .join(" ");

  const lastY = toY(last.e1rm);
  const label = `${formatKg(last.e1rm)} kg`;

  return (
    <div className="relative h-[78px]">
      {/* Zona de la curva; los ~62px de la derecha quedan libres para la
          etiqueta del último punto. */}
      <div className="absolute inset-y-0 left-0 right-[62px] text-primary">
        <svg
          aria-label={`Progresión de 1RM estimado${exerciseName ? ` de ${exerciseName}` : ""}`}
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 100 100"
        >
          <polyline
            fill="none"
            points={points}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <span
          className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-content1"
          style={{ left: "100%", top: `${lastY}%` }}
        />
        <span
          className="absolute left-full ml-2 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold text-foreground font-heading"
          style={{ top: `${lastY}%` }}
        >
          {label}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 border-b border-default-200" />
    </div>
  );
}

function RecordChip({ repMax, isBest }: { repMax: RepMax; isBest: boolean }) {
  const label = `${repMax.bucket}×${formatKg(repMax.weightKg)}`;

  return (
    <span
      className={
        isBest
          ? "inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-foreground font-body"
          : "inline-flex items-center gap-1 rounded-md border border-default-200 px-2 py-1 text-xs font-medium text-foreground/80 font-body"
      }
    >
      {isBest ? <span aria-label="Tu mejor marca">🏅</span> : null}
      {label}
    </span>
  );
}

/** Bucket con el 1RM estimado más alto; null si no hay récords. */
function pickBestBucket(repMaxes: RepMax[]): string | null {
  let best: RepMax | null = null;

  for (const rm of repMaxes) {
    if (!best || rm.e1rm > best.e1rm) best = rm;
  }

  return best?.bucket ?? null;
}

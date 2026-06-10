// "Datos del programa" — chips inline con los targets del entrenador
// (sets/reps/sistema/tempo para fuerza, duración/distancia/intensidad
// /zona FC para cardio). Solo presentación.

interface TargetExercise {
  sets?: number;
  reps?: string;
  tempo?: string;
  rest?: string;
  rir?: string;
  trainingSystem?: string;
  duration?: number;
  distance?: number;
  intensity?: string;
  heartRateZone?: { min: number; max: number };
}

interface Props {
  exercise: TargetExercise;
  isCardio: boolean;
}

export function ExerciseTargetSection({ exercise, isCardio }: Props) {
  const chips = isCardio
    ? buildCardioChips(exercise)
    : buildStrengthChips(exercise);

  if (chips.length === 0) return null;

  return (
    <div>
      <p className="text-[11px] uppercase font-semibold text-foreground/50 font-body mb-2">
        Datos del programa
      </p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span
            key={c.label}
            className="inline-flex items-center gap-1 rounded-md bg-default-100 px-2 py-1 text-xs font-body"
          >
            <span className="text-foreground/60">{c.label}</span>
            <span className="font-semibold text-foreground">{c.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

interface Chip {
  label: string;
  value: string;
}

function buildStrengthChips(e: TargetExercise): Chip[] {
  const chips: Chip[] = [];

  if (e.sets) chips.push({ label: "Series", value: String(e.sets) });
  if (e.reps) chips.push({ label: "Reps", value: String(e.reps) });
  if (e.rest) chips.push({ label: "Descanso", value: String(e.rest) });
  if (e.rir) chips.push({ label: "RIR", value: String(e.rir) });
  if (e.tempo) chips.push({ label: "Tempo", value: String(e.tempo) });
  if (e.trainingSystem)
    chips.push({ label: "Sistema", value: String(e.trainingSystem) });

  return chips;
}

function buildCardioChips(e: TargetExercise): Chip[] {
  const chips: Chip[] = [];

  if (e.duration) chips.push({ label: "Duración", value: `${e.duration} min` });
  if (e.distance) chips.push({ label: "Distancia", value: `${e.distance} km` });
  if (e.intensity) chips.push({ label: "Intensidad", value: e.intensity });
  if (e.heartRateZone)
    chips.push({
      label: "Zona FC",
      value: `${e.heartRateZone.min}-${e.heartRateZone.max} bpm`,
    });

  return chips;
}

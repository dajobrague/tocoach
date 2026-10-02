// Objetivo del programa en UNA línea compacta ("3 × 12 · 90s descanso ·
// RIR 2"): sets/reps/descanso/RIR/tempo/sistema para fuerza,
// duración/distancia/intensidad/zona FC para cardio. Solo presentación.

import { Icon } from "@iconify/react";

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
  const parts = isCardio
    ? buildCardioParts(exercise)
    : buildStrengthParts(exercise);

  if (parts.length === 0) return null;

  return (
    <p className="flex items-start gap-2 rounded-medium bg-default-100 px-3 py-2 text-sm text-foreground">
      <Icon
        aria-hidden
        className="mt-0.5 shrink-0 text-default-500"
        icon="solar:target-linear"
        width={16}
      />
      <span>
        <span className="sr-only">Objetivo: </span>
        {parts.join(" · ")}
      </span>
    </p>
  );
}

function buildStrengthParts(e: TargetExercise): string[] {
  const parts: string[] = [];

  if (e.sets && e.reps) parts.push(`${e.sets} × ${e.reps}`);
  else if (e.sets) parts.push(`${e.sets} series`);
  else if (e.reps) parts.push(`${e.reps} reps`);
  if (e.rest) parts.push(`${e.rest} descanso`);
  if (e.rir) parts.push(`RIR ${e.rir}`);
  if (e.tempo) parts.push(`Tempo ${e.tempo}`);
  if (e.trainingSystem) parts.push(e.trainingSystem);

  return parts;
}

function buildCardioParts(e: TargetExercise): string[] {
  const parts: string[] = [];

  if (e.duration) parts.push(`${e.duration} min`);
  if (e.distance) parts.push(`${e.distance} km`);
  if (e.intensity) parts.push(`Intensidad ${e.intensity.toLowerCase()}`);
  if (e.heartRateZone) {
    parts.push(`${e.heartRateZone.min}-${e.heartRateZone.max} bpm`);
  }

  return parts;
}

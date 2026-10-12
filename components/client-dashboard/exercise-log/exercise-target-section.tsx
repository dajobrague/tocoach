// "Datos del programa" — chips inline con los targets del entrenador
// (sets/reps/sistema/tempo para fuerza, duración/distancia/intensidad
// /zona FC para cardio). Solo presentación.

import { Icon } from "@iconify/react";

import { formatKg } from "./helpers";

interface TargetExercise {
  sets?: number;
  weightKg?: number | null;
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
  /** El entrenador pidió subir peso (lib/training/increase-weight). */
  increaseWeight?: boolean;
}

export function ExerciseTargetSection({
  exercise,
  isCardio,
  increaseWeight = false,
}: Props) {
  const chips = isCardio
    ? buildCardioChips(exercise)
    : buildStrengthChips(exercise);

  if (chips.length === 0 && !increaseWeight) return null;

  return (
    <section>
      <h3 className="mb-2.5 text-[15px] font-semibold text-foreground">
        Datos del programa
      </h3>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <span
            key={c.label}
            className="flex min-w-16 flex-col rounded-xl bg-content1 px-3 py-2 shadow-small"
          >
            <span className="text-xs font-medium text-default-500">
              {c.label}
            </span>
            <span className="mt-px text-base font-bold tabular-nums text-foreground">
              {c.value}
            </span>
          </span>
        ))}
      </div>
      {increaseWeight ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-success-700">
          <Icon
            aria-hidden
            className="shrink-0"
            icon="solar:arrow-up-linear"
            width={16}
          />
          Tu entrenador te pide subir peso en este ejercicio.
        </p>
      ) : null}
    </section>
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
  if (e.weightKg != null)
    chips.push({ label: "Peso", value: `${formatKg(e.weightKg)} kg` });
  // Descanso siempre con unidad: el entrenador a veces escribe solo "90".
  if (e.rest) {
    const rest = String(e.rest).trim();

    chips.push({
      label: "Descanso",
      value: /^\d+$/.test(rest) ? `${rest} s` : rest,
    });
  }
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

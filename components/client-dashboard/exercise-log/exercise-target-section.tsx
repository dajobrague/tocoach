// "Datos del Programa" — bloque read-only con los targets que armó el
// entrenador para este ejercicio (sets/reps/sistema/tempo para fuerza,
// duración/distancia/intensidad/zona FC para cardio). Solo presentación;
// la lógica de qué tipo es la calcula el orquestador.

interface TargetExercise {
  sets?: number;
  reps?: string;
  tempo?: string;
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
  return (
    <div className="bg-default-50 p-4 rounded-lg space-y-2">
      <p className="text-xs text-foreground/60 font-body uppercase font-semibold">
        Datos del Programa
      </p>

      {isCardio ? (
        <div className="grid grid-cols-2 gap-3">
          {exercise.duration ? (
            <Field label="Duración" value={`${exercise.duration} min`} />
          ) : null}
          {exercise.distance ? (
            <Field label="Distancia" value={`${exercise.distance} km`} />
          ) : null}
          {exercise.intensity ? (
            <Field label="Intensidad" value={exercise.intensity} />
          ) : null}
          {exercise.heartRateZone ? (
            <Field
              label="Zona FC"
              value={`${exercise.heartRateZone.min}-${exercise.heartRateZone.max} bpm`}
            />
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Series" value={`${exercise.sets ?? "-"} series`} />
          <Field label="Repeticiones" value={`${exercise.reps ?? "-"} reps`} />
          <Field label="Sistema" value={exercise.trainingSystem ?? "-"} />
          <Field label="Tempo" value={exercise.tempo ?? "-"} />
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-foreground/60 font-body">{label}</p>
      <p className="text-sm font-semibold text-foreground font-heading">
        {value}
      </p>
    </div>
  );
}

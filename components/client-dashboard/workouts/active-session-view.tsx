// Modo "sesión activa": ocupa la pantalla principal del cliente cuando
// éste tap "Comenzar" en una sesión. Las otras sesiones desaparecen y
// queda solo esta — banner destacado + progreso + lista de ejercicios.
//
// Persistencia: NO se persiste activeSessionId. Si el cliente recarga,
// vuelve al modo lista. El estado real (logs guardados) sigue en BD.

import type { WorkoutProgram } from "@/types/training";
import type { OpenLogPayload } from "./available-sessions-list";
import type { AvailableSession } from "./hooks/use-available-sessions";

import { Button, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo } from "react";

interface ExerciseLike {
  order: number;
  name: string;
  imageUrl?: string;
  exercise_id?: string;
}

interface ExerciseLogLike {
  exercise_id?: string;
  scheduled_date?: string;
}

interface Props {
  session: AvailableSession;
  programs: WorkoutProgram[];
  exerciseLogs: ExerciseLogLike[];
  scheduledDate: string;
  onExit: () => void;
  onLogExercise: (payload: OpenLogPayload) => void;
}

const TYPE_LABEL: Record<string, string> = {
  strength: "Fuerza",
  cardio: "Cardio",
  flexibility: "Flexibilidad",
  sports: "Deportes",
  recovery: "Descanso activo",
  other: "Otro",
};

const TYPE_COLOR: Record<
  string,
  "primary" | "danger" | "warning" | "secondary" | "success" | "default"
> = {
  strength: "primary",
  cardio: "danger",
  flexibility: "secondary",
  sports: "warning",
  recovery: "success",
  other: "default",
};

export function ActiveSessionView({
  session,
  programs,
  exerciseLogs,
  scheduledDate,
  onExit,
  onLogExercise,
}: Props) {
  const exercises = useMemo(
    () => findExercisesForSession(programs, session.id),
    [programs, session.id]
  );

  const trackable = exercises.filter(
    (e) => typeof e.exercise_id === "string" && e.exercise_id.length > 0
  );
  const loggedIds = new Set(
    exerciseLogs
      .filter((log) => log.scheduled_date === scheduledDate)
      .map((log) => log.exercise_id)
      .filter((id): id is string => Boolean(id))
  );
  const completed = trackable.filter((e) =>
    loggedIds.has(e.exercise_id as string)
  ).length;
  const total = trackable.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const typeKey = session.session_type ?? "other";
  const typeLabel = TYPE_LABEL[typeKey] ?? "Sesión";
  const typeColor = TYPE_COLOR[typeKey] ?? "default";

  return (
    <section className="w-full space-y-4">
      <Button
        className="text-default-600"
        size="sm"
        startContent={<Icon icon="solar:alt-arrow-left-linear" width={18} />}
        variant="light"
        onPress={onExit}
      >
        Cambiar entrenamiento
      </Button>

      <div className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-5 space-y-2">
        <Chip color={typeColor} size="sm" variant="flat">
          {typeLabel}
        </Chip>
        <h2 className="text-2xl font-heading font-bold text-warning-900 leading-tight">
          {session.name}
        </h2>
        <p className="text-xs text-warning-800 font-body">
          {session.exercise_count}{" "}
          {session.exercise_count === 1 ? "ejercicio" : "ejercicios"}
        </p>
      </div>

      {total > 0 ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-body text-default-600">
            <span>
              {completed} de {total} hechos
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-default-200 overflow-hidden">
            <div
              className="h-full bg-success transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {exercises.length === 0 ? (
        <div className="rounded-md border border-default-200 bg-content1 p-3 text-sm text-default-500 font-body">
          Esta sesión no tiene ejercicios todavía.
        </div>
      ) : (
        <ul className="space-y-2">
          {exercises.map((exercise) => {
            const exerciseId = exercise.exercise_id ?? "";
            const existingLog = exerciseId
              ? exerciseLogs.find(
                  (log) =>
                    log.exercise_id === exerciseId &&
                    log.scheduled_date === scheduledDate
                )
              : undefined;
            const isLogged = Boolean(existingLog);

            return (
              <li key={`${session.id}-${exercise.order}`}>
                <button
                  className="flex w-full items-center gap-3 rounded-lg border border-default-200 bg-content1 p-3 text-left hover:bg-default-50 transition-colors"
                  type="button"
                  onClick={() =>
                    onLogExercise({
                      exercise,
                      sessionId: session.id,
                      scheduledDate,
                      existingLog: existingLog ?? null,
                    })
                  }
                >
                  {exercise.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={exercise.name}
                      className="h-12 w-12 rounded-md object-cover"
                      src={exercise.imageUrl}
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-default-200">
                      <Icon
                        className="text-default-500"
                        icon="solar:dumbbell-bold"
                        width={20}
                      />
                    </div>
                  )}
                  <span className="flex-1 truncate text-sm font-medium text-foreground">
                    {exercise.name}
                  </span>
                  <Icon
                    className={isLogged ? "text-success" : "text-default-300"}
                    icon={
                      isLogged
                        ? "solar:check-circle-bold"
                        : "solar:check-circle-linear"
                    }
                    width={24}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function findExercisesForSession(
  programs: WorkoutProgram[],
  sessionId: string
): Array<ExerciseLike & Record<string, unknown>> {
  for (const program of programs) {
    if (program.status !== "active") continue;
    const sessions = (program as unknown as { sessions?: unknown[] }).sessions;

    if (!Array.isArray(sessions)) continue;
    for (const s of sessions) {
      const sObj = s as { id?: string; exercises?: unknown[] };

      if (sObj.id === sessionId && Array.isArray(sObj.exercises)) {
        return sObj.exercises as Array<ExerciseLike & Record<string, unknown>>;
      }
    }
  }

  return [];
}

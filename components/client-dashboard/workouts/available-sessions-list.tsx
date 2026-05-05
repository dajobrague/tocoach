// Lista "Escoge tu siguiente entrenamiento". Itera sobre useAvailableSessions
// y mapea contra los programas activos (de usePrograms) para tener las
// exercises completas dentro de la expansión. La lógica de log de cada
// ejercicio individual se delega al padre vía onLogExercise (que abre
// ExerciseLogModal — sigue siendo el flujo existente, ver Fase 4 para
// el rediseño del modal).

import type { WorkoutProgram } from "@/types/training";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { type AvailableSession } from "./hooks/use-available-sessions";
import { SessionCard } from "./session-card";

interface ExerciseLike {
  order: number;
  name: string;
  imageUrl?: string;
  exercise_id?: string;
}

export interface OpenLogPayload {
  exercise: ExerciseLike & Record<string, unknown>;
  sessionId: string;
  scheduledDate: string;
  existingLog: unknown | null;
}

interface ExerciseLogLike {
  exercise_id?: string;
  scheduled_date?: string;
}

interface Props {
  availableSessions: AvailableSession[];
  programs: WorkoutProgram[];
  exerciseLogs: ExerciseLogLike[];
  scheduledDate: string;
  onLogExercise: (payload: OpenLogPayload) => void;
}

export function AvailableSessionsList({
  availableSessions,
  programs,
  exerciseLogs,
  scheduledDate,
  onLogExercise,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Index de session_id → exercises del programa activo. Hecho una vez
  // por render para no recorrer programas dentro del .map de cards.
  const exercisesBySession = buildExercisesIndex(programs);

  if (availableSessions.length === 0) return null;

  return (
    <section className="w-full">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="text-primary" icon="solar:dumbbell-bold" width={20} />
        <h2 className="text-xl font-heading font-semibold text-foreground">
          Escoge tu siguiente entrenamiento
        </h2>
      </div>
      <div className="space-y-3 w-full">
        {availableSessions.map((session) => {
          const isExpanded = expandedId === session.id;
          const exercises = exercisesBySession.get(session.id) ?? [];

          return (
            <div
              key={session.id}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={() =>
                setExpandedId((curr) =>
                  curr === session.id ? null : session.id
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpandedId((curr) =>
                    curr === session.id ? null : session.id
                  );
                }
              }}
            >
              <SessionCard
                exerciseCount={session.exercise_count}
                expandedContent={
                  <ExerciseList
                    exerciseLogs={exerciseLogs}
                    exercises={exercises}
                    scheduledDate={scheduledDate}
                    sessionId={session.id}
                    onLogExercise={onLogExercise}
                  />
                }
                isExpanded={isExpanded}
                name={session.name}
                rightContent={
                  <Button
                    color="primary"
                    size="sm"
                    startContent={
                      <Icon
                        icon={
                          isExpanded
                            ? "solar:alt-arrow-up-linear"
                            : "solar:play-bold"
                        }
                        width={16}
                      />
                    }
                    variant={isExpanded ? "flat" : "solid"}
                    onPress={() => {
                      setExpandedId((curr) =>
                        curr === session.id ? null : session.id
                      );
                    }}
                  >
                    {isExpanded ? "Cerrar" : "Comenzar"}
                  </Button>
                }
                sessionType={session.session_type}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function buildExercisesIndex(
  programs: WorkoutProgram[]
): Map<string, Array<ExerciseLike & Record<string, unknown>>> {
  const map = new Map<string, Array<ExerciseLike & Record<string, unknown>>>();

  for (const program of programs) {
    if (program.status !== "active") continue;
    const sessions = (program as unknown as { sessions?: unknown[] }).sessions;

    if (!Array.isArray(sessions)) continue;

    for (const session of sessions) {
      const s = session as { id?: string; exercises?: unknown[] };

      if (typeof s.id === "string" && Array.isArray(s.exercises)) {
        map.set(
          s.id,
          s.exercises as Array<ExerciseLike & Record<string, unknown>>
        );
      }
    }
  }

  return map;
}

interface ExerciseListProps {
  exercises: Array<ExerciseLike & Record<string, unknown>>;
  exerciseLogs: ExerciseLogLike[];
  scheduledDate: string;
  sessionId: string;
  onLogExercise: (payload: OpenLogPayload) => void;
}

function ExerciseList({
  exercises,
  exerciseLogs,
  scheduledDate,
  sessionId,
  onLogExercise,
}: ExerciseListProps) {
  if (exercises.length === 0) {
    return (
      <p className="text-sm text-foreground/60 font-body">
        Esta sesión no tiene ejercicios todavía.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {exercises.map((exercise) => {
        const exerciseId = (exercise.exercise_id ?? "") as string;
        const existingLog = exerciseId
          ? exerciseLogs.find(
              (log) =>
                log.exercise_id === exerciseId &&
                log.scheduled_date === scheduledDate
            )
          : undefined;
        const isLogged = Boolean(existingLog);

        return (
          <li
            key={`${sessionId}-${exercise.order}`}
            className="flex items-center gap-3 rounded-lg bg-default-50 p-3"
          >
            <button
              className="flex flex-1 items-center gap-3 text-left"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLogExercise({
                  exercise,
                  sessionId,
                  scheduledDate,
                  existingLog: existingLog ?? null,
                });
              }}
            >
              {exercise.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={exercise.name}
                  className="h-10 w-10 rounded-md object-cover"
                  src={exercise.imageUrl}
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-default-200">
                  <Icon
                    className="text-foreground/50"
                    icon="solar:dumbbell-bold"
                    width={18}
                  />
                </div>
              )}
              <span className="flex-1 truncate text-sm text-foreground">
                {exercise.name}
              </span>
            </button>
            <Icon
              className={isLogged ? "text-success" : "text-foreground/30"}
              icon={
                isLogged
                  ? "solar:check-circle-bold"
                  : "solar:check-circle-linear"
              }
              width={22}
            />
          </li>
        );
      })}
    </ul>
  );
}

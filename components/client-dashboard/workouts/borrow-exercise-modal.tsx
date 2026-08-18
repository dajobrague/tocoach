"use client";

// Selector "agregar ejercicio de otro día" (feature llamada 15-jul): el
// cliente está entrenando y quiere meter un ejercicio que pertenece a OTRA
// sesión de su programa (máquina libre, tiempo extra). Todo sale del cache de
// programas ya cargado — cero fetches nuevos.
//
// El ejercicio elegido se agrega a la lista de la sesión activa y se loguea
// como cualquier otro; la procedencia (nombre de la sesión de origen) viaja
// en el log para que el trainer la vea en su detalle del día.

import type { ExerciseLike } from "./active-session-view";
import type { WorkoutProgram, WorkoutSession } from "@/types/training";

import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo } from "react";

import { getSessionTypeStyle } from "./session-type-style";

interface Props {
  isOpen: boolean;
  programs: WorkoutProgram[];
  /** Sesión activa — sus ejercicios no se ofrecen (ya están en la lista). */
  currentSessionId: string;
  /** exercise_ids ya visibles en la sesión activa (template + extras). */
  excludedExerciseIds: Set<string>;
  onClose: () => void;
  onPick: (exercise: ExerciseLike & Record<string, unknown>) => void;
}

interface BorrowGroup {
  session: WorkoutSession;
  exercises: Array<ExerciseLike & Record<string, unknown>>;
}

/**
 * WorkoutExercise → ExerciseLike prestado. CRÍTICO: se descartan `id` y
 * cualquier slot — el session_exercise_id de la OTRA sesión atribuiría el log
 * al slot equivocado (el bug "false done" de atribución por slot).
 */
function toBorrowedExercise(
  raw: Record<string, unknown>,
  sessionName: string,
  order: number
): ExerciseLike & Record<string, unknown> {
  const {
    id: _id,
    session_exercise_id: _slot,
    ...rest
  } = raw as { id?: unknown; session_exercise_id?: unknown } & Record<
    string,
    unknown
  >;

  return {
    ...rest,
    order,
    borrowedFromSessionName: sessionName,
  } as ExerciseLike & Record<string, unknown>;
}

export function BorrowExerciseModal({
  isOpen,
  programs,
  currentSessionId,
  excludedExerciseIds,
  onClose,
  onPick,
}: Props) {
  const groups = useMemo<BorrowGroup[]>(() => {
    const result: BorrowGroup[] = [];

    for (const program of programs) {
      if (program.status !== "active") continue;

      for (const session of program.sessions ?? []) {
        if (session.id === currentSessionId) continue;

        const candidates = (session.exercises ?? []).filter((exercise) => {
          const libraryId = (exercise as { exercise_id?: string }).exercise_id;

          return (
            typeof libraryId === "string" &&
            libraryId.length > 0 &&
            !excludedExerciseIds.has(libraryId)
          );
        });

        if (candidates.length === 0) continue;

        result.push({
          session,
          exercises: candidates.map((exercise, index) =>
            toBorrowedExercise(
              exercise as unknown as Record<string, unknown>,
              session.name,
              // Orden alto para que caigan al final de la lista activa.
              2000 + index
            )
          ),
        });
      }
    }

    return result;
  }, [programs, currentSessionId, excludedExerciseIds]);

  return (
    <Modal
      isOpen={isOpen}
      placement="center"
      scrollBehavior="inside"
      size="md"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex-col gap-0.5 pb-2">
          <span className="text-base font-heading">
            Agregar ejercicio de otro día
          </span>
          <span className="text-xs font-normal text-foreground/60 font-body">
            Se suma al entrenamiento de hoy; tu coach verá de qué sesión salió
          </span>
        </ModalHeader>
        <ModalBody className="pb-4">
          {groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-foreground/50 font-body">
              No hay ejercicios de otras sesiones para agregar
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {groups.map((group) => {
                const typeStyle = getSessionTypeStyle(
                  group.session.sessionType
                );

                return (
                  <div key={group.session.id}>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/50 font-body">
                      <Icon icon={typeStyle.icon} width={13} />
                      {group.session.name}
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {group.exercises.map((exercise) => (
                        <li key={String(exercise.exercise_id)}>
                          <button
                            className="flex w-full items-center gap-2.5 rounded-lg border border-default-200 bg-content1 px-3 py-2 text-left transition-colors hover:bg-default-50"
                            type="button"
                            onClick={() => {
                              onPick(exercise);
                              onClose();
                            }}
                          >
                            {typeof exercise.imageUrl === "string" &&
                            exercise.imageUrl.length > 0 ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                alt=""
                                className="h-9 w-9 shrink-0 rounded-md object-cover"
                                decoding="async"
                                loading="lazy"
                                src={exercise.imageUrl}
                              />
                            ) : (
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-default-100">
                                <Icon
                                  className="text-default-400"
                                  icon={typeStyle.icon}
                                  width={16}
                                />
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground font-body">
                                {exercise.name}
                              </span>
                              <span className="block text-[11px] text-foreground/50 font-body tabular-nums">
                                {summaryOf(exercise)}
                              </span>
                            </span>
                            <Icon
                              className="shrink-0 text-foreground/40"
                              icon="solar:add-circle-linear"
                              width={18}
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

/** "4 × 10-12" para fuerza, "30 min" / "5 km" para cardio, "" si no hay data. */
function summaryOf(exercise: ExerciseLike): string {
  if (exercise.sets && exercise.reps) {
    return `${exercise.sets} × ${exercise.reps}`;
  }

  const parts = [
    exercise.duration ? `${exercise.duration} min` : null,
    exercise.distance ? `${exercise.distance} km` : null,
  ].filter((part): part is string => part !== null);

  return parts.join(" · ");
}

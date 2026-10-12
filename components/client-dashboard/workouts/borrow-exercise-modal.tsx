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

import { ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo } from "react";

import { ClientSheet, ClientSheetGrabber } from "../client-sheet";

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
    <ClientSheet isOpen={isOpen} size="md" onClose={onClose}>
      <ModalContent>
        {(close) => (
          <>
            <ClientSheetGrabber onClose={close} />
            <ModalHeader className="flex-col gap-1 pb-2 pt-1">
              <span className="font-heading text-[22px] leading-tight text-foreground">
                Agregar ejercicio de otro día
              </span>
              <span className="text-sm font-normal text-default-500">
                Se suma al entrenamiento de hoy; tu coach verá de qué sesión
                salió
              </span>
            </ModalHeader>
            <ModalBody className="pb-6">
              {groups.length === 0 ? (
                <div className="flex flex-col items-center gap-2.5 px-5 py-7 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-default-100 text-default-500">
                    <Icon icon="solar:dumbbell-linear" width={22} />
                  </span>
                  <p className="text-[15px] text-default-500">
                    No hay ejercicios de otras sesiones para agregar
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {groups.map((group) => {
                    const typeStyle = getSessionTypeStyle(
                      group.session.sessionType
                    );

                    return (
                      <div key={group.session.id}>
                        <p className="mb-2.5 ml-1 flex items-center gap-2 text-sm font-semibold text-default-500">
                          <span
                            aria-hidden
                            className={`h-2 w-2 rounded-full ${typeStyle.dotClass}`}
                          />
                          {group.session.name}
                        </p>
                        <ul className="divide-y divide-default-100 overflow-hidden rounded-large bg-content1 shadow-small">
                          {group.exercises.map((exercise) => (
                            <li key={String(exercise.exercise_id)}>
                              <button
                                aria-label={`Agregar ${exercise.name}`}
                                className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-default-100 [@media(hover:hover)]:hover:bg-default-50"
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
                                    className="h-11 w-11 shrink-0 rounded-xl bg-default-100 object-cover"
                                    decoding="async"
                                    loading="lazy"
                                    src={exercise.imageUrl}
                                  />
                                ) : (
                                  <span
                                    aria-hidden
                                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${typeStyle.tileClass}`}
                                  >
                                    <Icon icon={typeStyle.icon} width={22} />
                                  </span>
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[15px] font-semibold text-foreground">
                                    {exercise.name}
                                  </span>
                                  <span className="mt-0.5 block text-[13px] tabular-nums text-default-500">
                                    {summaryOf(exercise)}
                                  </span>
                                </span>
                                <span
                                  aria-hidden
                                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                                >
                                  <Icon icon="solar:add-linear" width={20} />
                                </span>
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
          </>
        )}
      </ModalContent>
    </ClientSheet>
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

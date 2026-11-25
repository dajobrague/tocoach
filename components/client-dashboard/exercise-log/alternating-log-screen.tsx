// Registro de series alternas (JC, nov): 2–3 ejercicios que se hacen por
// turnos. Una sola pantalla para el grupo; cada ronda es una serie de cada
// ejercicio y se rellena de arriba abajo, igual que se entrena.
//
// Por debajo sigue habiendo UN log por ejercicio (mismo writer y mismo body
// que ExerciseLogModal), así que historial, récords y gráficas no cambian.
//
// ponytail: aquí solo se teclean kilos y repeticiones. Vídeo por serie, RIR,
// reps por lado y notas siguen en la ficha de cada ejercicio (se abre tocando
// su nombre); lo que ya tuviera el log se conserva al guardar desde aquí.

/* eslint-disable no-console */
"use client";

import type { SetDraftWithTarget } from "./helpers";

import { addToast, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { buildBaseFormData, defaultSet, LOG_INPUT_CLASS } from "./helpers";

import { ClientScreen } from "@/components/client-dashboard/client-screen";
import { clientFetch } from "@/lib/auth/client-token-storage";

export interface AlternatingMember {
  exercise: {
    name: string;
    exercise_id?: string;
    session_exercise_id?: string;
    sets?: number;
    reps?: string;
    rest?: string;
    borrowedFromSessionName?: string;
  } & Record<string, unknown>;
  existingLog: any;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  members: AlternatingMember[];
  sessionId: string;
  scheduledDate: string;
  clientId: string;
  onSuccess: () => void;
  /** Abre el siguiente ejercicio pendiente tras el grupo, si lo hay. */
  onNext?: (() => void) | undefined;
  /** Abre la ficha completa de un miembro (vídeo, historial, RIR…). */
  onOpenMember: (index: number) => void;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const ROW = "grid grid-cols-[minmax(0,1fr)_84px_72px] items-center gap-2";

export function AlternatingLogScreen({
  isOpen,
  onClose,
  members,
  sessionId,
  scheduledDate,
  clientId,
  onSuccess,
  onNext,
  onOpenMember,
}: Props) {
  // Se hidrata una vez al montar (el padre monta una instancia por grupo):
  // un re-hidratado tras cada autosave pisaría lo que el cliente teclea.
  const [sets, setSets] = useState<SetDraftWithTarget[][]>(() =>
    members.map(
      (m) => buildBaseFormData(m.exercise as never, m.existingLog).sets
    )
  );
  const notesRef = useRef(
    members.map(
      (m) => buildBaseFormData(m.exercise as never, m.existingLog).notes
    )
  );
  // Solo se autoguardan los ejercicios que el cliente ha tocado: las reps
  // prellenadas de la prescripción no son un registro.
  const dirtyRef = useRef(new Set<number>());
  const savingRef = useRef<Promise<boolean> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [justFinalized, setJustFinalized] = useState(false);
  // Reintenta el autosave si quedaron cambios hechos durante un guardado.
  const [retry, setRetry] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const rounds = Math.max(...sets.map((s) => s.length), 0);
  const rest = members[members.length - 1]?.exercise.rest;

  const update = (
    member: number,
    round: number,
    patch: Partial<SetDraftWithTarget>
  ) => {
    dirtyRef.current.add(member);
    setJustFinalized(false);
    setSets((prev) =>
      prev.map((list, m) =>
        m !== member
          ? list
          : list.map((set, r) => (r === round ? { ...set, ...patch } : set))
      )
    );
  };

  const addRound = () => {
    setJustFinalized(false);
    setSets((prev) =>
      prev.map((list) => {
        const padded = [...list];

        while (padded.length < rounds + 1) padded.push(defaultSet());

        return padded;
      })
    );
  };

  const saveMembers = useCallback(
    async (indexes: number[], finalize: boolean): Promise<boolean> => {
      const results = await Promise.all(
        indexes.map(async (index) => {
          const member = members[index];
          const list = sets[index];

          if (!member || !list) return true;
          try {
            const response = await clientFetch(
              `/api/clients/${clientId}/exercise-logs`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sessionId,
                  exerciseId: member.exercise.exercise_id ?? "",
                  sessionExerciseId:
                    member.exercise.session_exercise_id ?? null,
                  scheduledDate,
                  notes: notesRef.current[index] ?? "",
                  videoUrl: null,
                  borrowedFromSessionName:
                    member.exercise.borrowedFromSessionName ?? null,
                  sets: list.map((s) => ({
                    reps: s.reps ? parseInt(s.reps) : null,
                    weight: s.weight || null,
                    videoUrl: s.videoUrl || null,
                    rir: s.rir ? parseInt(s.rir) : null,
                    repsLeft: s.repsLeft ? parseInt(s.repsLeft) : null,
                  })),
                  finalize,
                }),
              }
            );
            const data = (await response.json()) as {
              success?: boolean;
              newRecords?: unknown[] | null;
            };

            if (!data.success) return false;
            dirtyRef.current.delete(index);
            if (
              finalize &&
              Array.isArray(data.newRecords) &&
              data.newRecords.length > 0
            ) {
              addToast({
                color: "success",
                description: member.exercise.name,
                title: "¡Nuevo récord!",
              });
            }

            return true;
          } catch (err) {
            console.error("[AlternatingLogScreen] Error saving log:", err);

            return false;
          }
        })
      );
      const ok = results.every(Boolean);

      setSaveState(ok ? "saved" : "error");
      if (ok) onSuccess();

      return ok;
    },
    [clientId, members, onSuccess, scheduledDate, sessionId, sets]
  );

  // Autosave con el mismo debounce que el registro de un ejercicio.
  useEffect(() => {
    if (!isOpen || dirtyRef.current.size === 0 || isFinalizing) return;
    const t = window.setTimeout(() => {
      if (savingRef.current) return;
      setSaveState("saving");
      savingRef.current = saveMembers([...dirtyRef.current], false).finally(
        () => {
          savingRef.current = null;
          if (dirtyRef.current.size > 0) setRetry((n) => n + 1);
        }
      );
    }, 1500);

    return () => window.clearTimeout(t);
  }, [sets, isOpen, isFinalizing, saveMembers, retry]);

  // Cerrar con cambios aún en el debounce: se guardan antes de salir.
  const handleClose = () => {
    if (dirtyRef.current.size > 0 && !savingRef.current) {
      void saveMembers([...dirtyRef.current], false);
    }
    onClose();
  };

  const handleFinalize = async () => {
    setIsFinalizing(true);
    try {
      // Un autosave en vuelo termina antes: dos escrituras del mismo log a
      // la vez podrían dejar la versión sin finalizar encima.
      if (savingRef.current) await savingRef.current;
      setSaveState("saving");
      const ok = await saveMembers(
        members.map((_, i) => i),
        true
      );

      if (!ok) {
        addToast({
          color: "danger",
          description: "Revisa tu conexión e inténtalo de nuevo.",
          title: "No se pudo guardar el registro",
        });

        return;
      }
      if (onNext) setJustFinalized(true);
      else onClose();
    } finally {
      setIsFinalizing(false);
    }
  };

  // Enter pasa al siguiente campo en vez de enviar a medias.
  const focusNextField = (current: HTMLInputElement) => {
    const fields = [
      ...(formRef.current?.querySelectorAll<HTMLInputElement>("input") ?? []),
    ];
    const next = fields[fields.indexOf(current) + 1];

    if (next) next.focus();
    else current.blur();
  };

  return (
    <ClientScreen
      backLabel="Sesión"
      closeOnEscape={false}
      footer={
        <div className="flex flex-col gap-2.5">
          {justFinalized ? (
            <p
              className="flex items-center justify-center gap-1.5 text-[13px] text-default-500"
              role="status"
            >
              <Icon
                aria-hidden
                className="text-success"
                icon="solar:check-circle-bold"
                width={16}
              />
              {members.length} ejercicios guardados
            </p>
          ) : null}
          <div className="grid grid-cols-[1fr_1.6fr] gap-2.5">
            <Button
              className="h-[52px] bg-default-100 text-[17px] font-semibold text-foreground"
              isDisabled={isFinalizing}
              radius="lg"
              onPress={handleClose}
            >
              Cerrar
            </Button>
            {justFinalized && onNext ? (
              <Button
                className="h-[52px] text-[17px] font-semibold"
                color="primary"
                endContent={
                  <Icon icon="solar:alt-arrow-right-linear" width={20} />
                }
                radius="lg"
                onPress={onNext}
              >
                Siguiente
              </Button>
            ) : (
              <Button
                className="h-[52px] text-[17px] font-semibold"
                color="primary"
                isDisabled={isFinalizing}
                isLoading={isFinalizing}
                radius="lg"
                onPress={handleFinalize}
              >
                {isFinalizing ? "Guardando..." : "Finalizado"}
              </Button>
            )}
          </div>
        </div>
      }
      isOpen={isOpen}
      title="Series alternas"
      onClose={handleClose}
    >
      <div className="flex flex-col gap-6 px-4 pb-8 pt-4">
        {/* Qué se alterna. Cada fila abre la ficha del ejercicio: vídeo,
            historial y los detalles que aquí no se teclean. */}
        <div className="flex flex-col gap-2">
          <ul className="divide-y divide-default-100 overflow-hidden rounded-large bg-content1 shadow-small">
            {members.map((member, index) => (
              <li key={member.exercise.session_exercise_id ?? index}>
                <button
                  className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-default-100 [@media(hover:hover)]:hover:bg-default-50"
                  type="button"
                  onClick={() => onOpenMember(index)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-foreground">
                      {member.exercise.name}
                    </span>
                    {member.exercise.sets && member.exercise.reps ? (
                      <span className="block text-[13px] tabular-nums text-default-500">
                        {member.exercise.sets} × {member.exercise.reps}
                      </span>
                    ) : null}
                  </span>
                  <Icon
                    aria-hidden
                    className="shrink-0 text-default-300"
                    icon="solar:alt-arrow-right-linear"
                    width={18}
                  />
                </button>
              </li>
            ))}
          </ul>
          <p className="px-1 text-[13px] leading-snug text-default-500">
            Una serie de cada ejercicio, por turnos
            {rest ? `. Descansa ${rest} al acabar cada ronda` : ""}.
          </p>
        </div>

        <form
          ref={formRef}
          className="flex flex-col gap-4"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-heading text-[22px] leading-tight tracking-[-0.015em] text-foreground">
              Tus rondas de hoy
            </h2>
            <SaveStatus state={saveState} />
          </div>

          <div
            aria-hidden
            className={`${ROW} text-xs font-semibold text-default-500`}
          >
            <span />
            <span>Peso (kg)</span>
            <span>Reps</span>
          </div>

          {Array.from({ length: rounds }, (_, round) => (
            <fieldset
              key={round}
              className="flex flex-col gap-2 border-t border-default-100 pt-4 first:border-t-0 first:pt-0"
            >
              <legend className="float-left mb-2 w-full text-[13px] font-semibold text-default-500">
                Ronda {round + 1}
              </legend>
              {members.map((member, index) => {
                const set = sets[index]?.[round];
                const fieldId = `alt-${index}-${round}`;

                return (
                  <div key={fieldId} className={`${ROW} clear-both`}>
                    <span className="line-clamp-2 text-[15px] font-medium leading-snug text-foreground">
                      {member.exercise.name}
                    </span>
                    {set ? (
                      <>
                        <input
                          aria-label={`Peso en kilos, ${member.exercise.name}, ronda ${round + 1}`}
                          autoComplete="off"
                          className={LOG_INPUT_CLASS}
                          enterKeyHint="next"
                          id={`${fieldId}-kg`}
                          inputMode="decimal"
                          placeholder="kg"
                          type="text"
                          value={set.weight}
                          onChange={(e) =>
                            update(index, round, { weight: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              focusNextField(e.currentTarget);
                            }
                          }}
                        />
                        <input
                          aria-label={`Repeticiones, ${member.exercise.name}, ronda ${round + 1}`}
                          autoComplete="off"
                          className={LOG_INPUT_CLASS}
                          enterKeyHint="next"
                          id={`${fieldId}-reps`}
                          inputMode="numeric"
                          placeholder={set.repsPlaceholder ?? ""}
                          type="text"
                          value={set.reps}
                          onChange={(e) =>
                            update(index, round, { reps: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              focusNextField(e.currentTarget);
                            }
                          }}
                        />
                      </>
                    ) : (
                      // Prescripción con menos series que su compañero.
                      <span className="col-span-2 text-[13px] text-default-400">
                        Sin serie en esta ronda
                      </span>
                    )}
                  </div>
                );
              })}
            </fieldset>
          ))}

          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-medium bg-default-100 text-[15px] font-semibold text-foreground active:scale-[0.97] motion-reduce:transform-none [@media(hover:hover)]:hover:bg-default-200"
            type="button"
            onClick={addRound}
          >
            <Icon aria-hidden icon="solar:add-circle-linear" width={18} />
            Añadir ronda
          </button>
        </form>
      </div>
    </ClientScreen>
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  return (
    <span
      aria-live="polite"
      className="whitespace-nowrap text-[13px] font-semibold"
      role="status"
    >
      {state === "saving" ? (
        <span className="inline-flex items-center gap-1 text-default-500">
          <Icon
            className="animate-spin motion-reduce:animate-none"
            icon="solar:refresh-linear"
            width={14}
          />
          Guardando
        </span>
      ) : state === "saved" ? (
        <span className="inline-flex items-center gap-1 text-success-700">
          <Icon icon="solar:check-circle-bold" width={14} />
          Guardado
        </span>
      ) : state === "error" ? (
        <span className="inline-flex items-center gap-1 text-danger">
          <Icon icon="solar:danger-triangle-linear" width={14} />
          Error al guardar
        </span>
      ) : null}
    </span>
  );
}

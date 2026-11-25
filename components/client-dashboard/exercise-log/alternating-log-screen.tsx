// Registro de series alternas (JC, nov): 2–3 ejercicios que se hacen por
// turnos. Una sola pantalla para el grupo; cada ronda es una serie de cada
// ejercicio y se rellena de arriba abajo, igual que se entrena.
//
// Por debajo sigue habiendo UN log por ejercicio (mismo writer y mismo body
// que ExerciseLogModal), así que historial, récords y gráficas no cambian.
//
// Cada serie de cada ejercicio usa la misma fila que el registro individual
// (ExerciseSetRow): vídeo por serie, RIR y repeticiones por lado cuando el
// entrenador los activó. Historial y vídeo de demostración siguen en la ficha
// del ejercicio, que se abre tocando su nombre.

/* eslint-disable no-console */
"use client";

import type { SetDraftWithTarget } from "./helpers";

import { addToast, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ExerciseSetRow } from "./exercise-set-row";
import { buildBaseFormData, defaultSet } from "./helpers";
import { deleteSetVideo, uploadSetVideo } from "./hooks/use-set-videos";

import { ClientScreen } from "@/components/client-dashboard/client-screen";
import { clientFetch } from "@/lib/auth/client-token-storage";
import {
  altGroupName,
  altGroupRestLine,
  restWithUnit,
} from "@/lib/training/alt-groups";

export interface AlternatingMember {
  exercise: {
    name: string;
    exercise_id?: string;
    session_exercise_id?: string;
    sets?: number;
    reps?: string;
    rest?: string;
    /** RIR prescrito: activa el selector de RIR por serie. */
    rir?: string;
    /** Unilateral: repeticiones por lado (derecho / izquierdo). */
    perSide?: boolean;
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
  /** Abre la ficha de un miembro (vídeo de demostración, historial). */
  onOpenMember: (index: number) => void;
}

type SaveState = "idle" | "saving" | "saved" | "error";

// Mismas columnas que el registro individual, sin la del número de serie.
const GRID =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-2";
const GRID_RIR =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_56px_44px] items-center gap-2";

const HELP =
  "flex items-start gap-2 rounded-medium bg-default-100 px-3 py-2.5 text-[13px] leading-snug text-default-600";
const NOTES_CLASS =
  "min-h-20 w-full rounded-medium border border-default-200 bg-content1 px-4 py-3 text-[17px] text-foreground caret-primary outline-none transition-[border-color,box-shadow] placeholder:text-default-400 focus:border-primary focus:ring-4 focus:ring-primary/20 motion-reduce:transition-none";

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
  const [notes, setNotes] = useState<string[]>(() =>
    members.map(
      (m) => buildBaseFormData(m.exercise as never, m.existingLog).notes
    )
  );
  // Serie que está subiendo vídeo ("miembro-serie"), para su spinner.
  const [uploading, setUploading] = useState<string | null>(null);
  // Solo se autoguardan los ejercicios que el cliente ha tocado: las reps
  // prellenadas de la prescripción no son un registro.
  const dirtyRef = useRef(new Set<number>());
  const savingRef = useRef<Promise<boolean> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [justFinalized, setJustFinalized] = useState(false);
  // Reintenta el autosave si quedaron cambios hechos durante un guardado.
  const [retry, setRetry] = useState(0);

  const rounds = Math.max(...sets.map((s) => s.length), 0);
  const rest = restWithUnit(members[members.length - 1]?.exercise.rest);

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

  // Quitar una serie la quita de todos los ejercicios del grupo.
  const removeRound = (round: number) => {
    if (rounds <= 1) return;
    members.forEach((_, i) => dirtyRef.current.add(i));
    setJustFinalized(false);
    setSets((prev) => prev.map((list) => list.filter((_, r) => r !== round)));
  };

  const pickVideo = async (member: number, round: number, file: File) => {
    setUploading(`${member}-${round}`);
    try {
      const uploaded = await uploadSetVideo(clientId, file);

      if (uploaded) {
        update(member, round, {
          videoUrl: uploaded.url,
          videoPath: uploaded.path,
        });
      }
    } finally {
      setUploading(null);
    }
  };

  const removeVideo = (member: number, round: number) => {
    const videoPath = sets[member]?.[round]?.videoPath;

    dirtyRef.current.add(member);
    setJustFinalized(false);
    setSets((prev) =>
      prev.map((list, m) =>
        m !== member
          ? list
          : list.map((set, r) => {
              if (r !== round) return set;
              // Sin las claves de vídeo (no se pueden dejar en undefined).
              const { videoUrl: _u, videoPath: _p, ...rest } = set;

              void _u;
              void _p;

              return rest;
            })
      )
    );
    if (videoPath) void deleteSetVideo(clientId, videoPath);
  };

  // Columnas extra por ejercicio: solo si el entrenador las activó (o el
  // registro ya trae datos de ese tipo).
  const options = members.map((m, i) => ({
    showRir:
      Boolean(String(m.exercise.rir ?? "").trim()) ||
      (sets[i] ?? []).some((set) => Boolean(set.rir)),
    perSide:
      m.exercise.perSide === true ||
      (sets[i] ?? []).some((set) => Boolean(set.repsLeft)),
  }));
  const rirTargets = members
    .filter((m) => String(m.exercise.rir ?? "").trim())
    .map((m) => `${String(m.exercise.rir).trim()} en ${m.exercise.name}`);

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
                  notes: notes[index] ?? "",
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
    [clientId, members, notes, onSuccess, scheduledDate, sessionId, sets]
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
  }, [sets, notes, isOpen, isFinalizing, saveMembers, retry]);

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
                isDisabled={isFinalizing || uploading !== null}
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
      title={altGroupName(members.length)}
      onClose={handleClose}
    >
      <div className="flex flex-col gap-6 px-4 pb-8 pt-4 [html[data-rest-band]_&]:pt-[76px]">
        {/* Qué se alterna. Cada fila abre la ficha del ejercicio: vídeo de
            demostración del entrenador e historial. */}
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
            {altGroupRestLine(members.length, rest)}
          </p>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-heading text-[22px] leading-tight tracking-[-0.015em] text-foreground">
              Tus números de hoy
            </h2>
            <SaveStatus state={saveState} />
          </div>

          {options.some((o) => o.perSide) ? (
            <p className={HELP}>
              <Icon
                aria-hidden
                className="mt-px shrink-0 text-primary"
                icon="solar:transfer-horizontal-linear"
                width={16}
              />
              <span>
                Donde veas <b>Der.</b> e <b>Izq.</b>, anota las repeticiones de
                cada lado por separado.
              </span>
            </p>
          ) : null}
          {options.some((o) => o.showRir) ? (
            <p className={HELP}>
              <Icon
                aria-hidden
                className="mt-px shrink-0 text-primary"
                icon="solar:info-circle-linear"
                width={16}
              />
              <span>
                <b>RIR</b> = repeticiones que te quedaban en reserva. Al acabar
                cada serie, elige cuántas más podrías haber hecho (0 = ni una
                más).
                {rirTargets.length > 0 ? (
                  <>
                    {" "}
                    Tu entrenador te pide <b>{rirTargets.join(" y ")}</b>.
                  </>
                ) : null}
              </span>
            </p>
          ) : null}

          {Array.from({ length: rounds }, (_, round) => (
            <section
              key={round}
              aria-label={`Serie ${round + 1}`}
              className="flex flex-col gap-3 border-t border-default-100 pt-4 first:border-t-0 first:pt-0"
            >
              <div className="flex min-h-9 items-center justify-between gap-2">
                <h3 className="text-[15px] font-semibold text-foreground">
                  Serie {round + 1}
                </h3>
                {rounds > 1 ? (
                  <button
                    aria-label={`Quitar la serie ${round + 1}`}
                    className="flex h-9 w-9 items-center justify-center rounded-[10px] text-default-500 active:bg-default-100"
                    type="button"
                    onClick={() => removeRound(round)}
                  >
                    <Icon
                      icon="solar:trash-bin-minimalistic-linear"
                      width={18}
                    />
                  </button>
                ) : null}
              </div>
              {members.map((member, index) => {
                const set = sets[index]?.[round];
                const { showRir, perSide } = options[index] ?? {
                  showRir: false,
                  perSide: false,
                };
                const grid = showRir ? GRID_RIR : GRID;

                return (
                  <div
                    key={member.exercise.session_exercise_id ?? index}
                    className="flex flex-col gap-1.5"
                  >
                    <p className="truncate text-[13px] font-medium text-default-600">
                      {member.exercise.name}
                    </p>
                    {/* Cabeceras solo en la primera serie: debajo se repite
                        la misma rejilla. */}
                    {round === 0 && set ? (
                      <div
                        aria-hidden
                        className={`${grid} text-xs font-semibold text-default-500`}
                      >
                        <span>Peso (kg)</span>
                        <span>{perSide ? "Reps der. · izq." : "Reps"}</span>
                        {showRir ? (
                          <span className="text-center">RIR</span>
                        ) : null}
                        <span className="text-center">Vídeo</span>
                      </div>
                    ) : null}
                    {set ? (
                      <ExerciseSetRow
                        hideIndex
                        ariaContext={member.exercise.name}
                        canRemove={false}
                        gridClass={grid}
                        index={round}
                        isLast={
                          round === rounds - 1 && index === members.length - 1
                        }
                        isUploading={uploading === `${index}-${round}`}
                        perSide={perSide}
                        set={set}
                        showRir={showRir}
                        onPickVideo={(file) =>
                          void pickVideo(index, round, file)
                        }
                        onRemove={() => undefined}
                        onRemoveVideo={() => removeVideo(index, round)}
                        onUpdate={(field, value) =>
                          update(index, round, { [field]: value })
                        }
                      />
                    ) : (
                      // Prescripción con menos series que su compañero.
                      <p className="text-[13px] text-default-400">
                        No tiene esta serie
                      </p>
                    )}
                  </div>
                );
              })}
            </section>
          ))}

          {!sets.some((list) => list.some((set) => set.videoUrl)) ? (
            <p className="flex items-start gap-2 text-[13px] leading-snug text-default-500">
              <Icon
                aria-hidden
                className="mt-px shrink-0 text-primary"
                icon="solar:videocamera-record-linear"
                width={16}
              />
              Graba una serie y tu entrenador revisará tu técnica.
            </p>
          ) : null}

          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-medium bg-default-100 text-[15px] font-semibold text-foreground active:scale-[0.97] motion-reduce:transform-none [@media(hover:hover)]:hover:bg-default-200"
            type="button"
            onClick={addRound}
          >
            <Icon aria-hidden icon="solar:add-linear" width={18} />
            Añadir serie
          </button>

          {members.map((member, index) => {
            const id = `alt-notes-${index}`;

            return (
              <div key={id} className="flex flex-col gap-2">
                <label
                  className="text-[13px] font-semibold text-default-500"
                  htmlFor={id}
                >
                  Notas · {member.exercise.name}
                </label>
                <textarea
                  className={NOTES_CLASS}
                  id={id}
                  placeholder="Sensaciones, molestias, ajustes…"
                  rows={2}
                  value={notes[index] ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;

                    dirtyRef.current.add(index);
                    setJustFinalized(false);
                    setNotes((prev) =>
                      prev.map((n, i) => (i === index ? value : n))
                    );
                  }}
                />
              </div>
            );
          })}
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

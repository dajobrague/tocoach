"use client";

// Completar músculos en lote (David, 28 oct): lista los ejercicios de fuerza
// sin músculos con una sugerencia para cada uno y el entrenador acepta,
// corrige o descarta. Sugerencias, en este orden y sin coste para lo que ya
// existe: la guardada por el asistente, la de su propio texto antiguo, y
// las nuevas del asistente cuando pulsa "Analizar". Nada se guarda sin
// pulsar "Guardar".

import type { Exercise } from "@/types/training";

import {
  Button,
  Checkbox,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { sendJson } from "./fetch-json";
import { MusclePicker } from "./muscle-picker";

import { OutlineChip } from "@/components/shared/outline-chip";
import {
  type MuscleSelection,
  legacyToMuscles,
  muscleLabel,
  parseMuscles,
} from "@/lib/training/muscles";

const BATCH = 10;
const CONCURRENCY = 2;

type RowStatus = "ready" | "pending" | "loading" | "empty" | "error";

interface Row {
  exercise: Exercise;
  suggestion: MuscleSelection | null;
  status: RowStatus;
  include: boolean;
}

function initialSuggestion(exercise: Exercise): MuscleSelection | null {
  const saved = exercise.metadata?.muscle_suggestion as
    | { primary?: unknown; secondary?: unknown }
    | undefined;
  const parsed = saved
    ? parseMuscles(saved.primary, saved.secondary)
    : undefined;

  if (parsed?.ok === true && parsed.muscles.primary.length > 0) {
    return parsed.muscles;
  }
  const legacy = legacyToMuscles(exercise.muscle_groups, exercise.name);

  return legacy.primary.length > 0
    ? { primary: legacy.primary, secondary: legacy.secondary }
    : null;
}

export function MuscleAssistantReview({
  isOpen,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: number) => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setRows(null);
    setLoadError(false);
    setAssistantError(null);
    setExpanded(null);
    fetch("/api/exercises?muscle=none&limit=1000", { cache: "no-store" })
      .then((res) => res.json())
      .then((body: { success?: boolean; exercises?: Exercise[] }) => {
        if (!body.success) throw new Error("load failed");
        setRows(
          (body.exercises ?? [])
            .filter((exercise) => exercise.category !== "cardio")
            .map((exercise) => {
              const suggestion = initialSuggestion(exercise);

              return {
                exercise,
                suggestion,
                status: suggestion ? "ready" : "pending",
                include: suggestion !== null,
              };
            })
        );
      })
      .catch(() => setLoadError(true));
  }, [isOpen]);

  const patch = (id: string, next: Partial<Row>) =>
    setRows(
      (current) =>
        current?.map((row) =>
          row.exercise.id === id ? { ...row, ...next } : row
        ) ?? null
    );

  const pending =
    rows?.filter((row) => row.status === "pending" || row.status === "error") ??
    [];
  const accepted =
    rows?.filter((row) => row.include && row.suggestion?.primary.length) ?? [];
  const done = rows
    ? rows.length -
      pending.length -
      rows.filter((r) => r.status === "loading").length
    : 0;

  const analyze = async () => {
    const queue = pending.map((row) => row.exercise.id);
    const chunks: string[][] = [];

    for (let i = 0; i < queue.length; i += BATCH)
      chunks.push(queue.slice(i, i + BATCH));
    setAnalyzing(true);
    setAssistantError(null);

    const worker = async () => {
      for (let chunk = chunks.shift(); chunk; chunk = chunks.shift()) {
        const ids = chunk;

        ids.forEach((id) => patch(id, { status: "loading" }));
        try {
          const data = await sendJson<
            Record<string, { primary?: unknown; secondary?: unknown } | null>
          >("/api/exercises/muscle-assistant", "POST", { exerciseIds: ids });

          ids.forEach((id) => {
            const raw = data[id];
            const parsed = raw
              ? parseMuscles(raw.primary, raw.secondary)
              : undefined;
            const suggestion =
              parsed?.ok === true && parsed.muscles.primary.length > 0
                ? parsed.muscles
                : null;

            patch(id, {
              suggestion,
              status: suggestion ? "ready" : "empty",
              include: suggestion !== null,
            });
          });
        } catch (error) {
          ids.forEach((id) => patch(id, { status: "error" }));
          setAssistantError(
            error instanceof Error
              ? error.message
              : "El asistente no pudo responder."
          );
          chunks.length = 0; // 429/503: no seguir gastando intentos
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setAnalyzing(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await sendJson<{ updated: number }>(
        "/api/exercises/muscle-assistant/apply",
        "POST",
        {
          items: accepted.map((row) => ({
            id: row.exercise.id,
            primary: row.suggestion!.primary,
            secondary: row.suggestion!.secondary,
          })),
        }
      );

      onSaved(result.updated);
      onClose();
    } catch (error) {
      setAssistantError(
        error instanceof Error ? error.message : "No se pudo guardar."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      classNames={{
        header: "border-b border-default-200",
        footer: "border-t border-default-200",
      }}
      isDismissable={!analyzing && !saving}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="3xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span className="text-lg font-semibold text-foreground">
            Completar músculos
          </span>
          <span className="text-sm font-normal text-default-500">
            Revisa cada sugerencia: puedes aceptarla, corregirla o quitarla.
            Nada se guarda hasta que pulses Guardar.
          </span>
        </ModalHeader>

        <ModalBody className="py-4">
          {loadError ? (
            <p className="py-10 text-center text-sm text-danger">
              No pudimos cargar tus ejercicios. Cierra y vuelve a intentarlo.
            </p>
          ) : rows === null ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-default-500">
              Todos tus ejercicios de fuerza ya tienen músculos.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {pending.length > 0 || analyzing ? (
                <div className="flex flex-col gap-2 rounded-xl bg-default-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-default-700">
                      {analyzing
                        ? `Analizando… ${done} de ${rows.length}`
                        : `${pending.length} ejercicio${pending.length === 1 ? "" : "s"} sin sugerencia todavía.`}
                    </span>
                    {!analyzing ? (
                      <Button
                        color="primary"
                        size="sm"
                        startContent={
                          <Icon icon="solar:magic-stick-3-linear" width={16} />
                        }
                        onPress={analyze}
                      >
                        Analizar con el asistente
                      </Button>
                    ) : null}
                  </div>
                  {analyzing ? (
                    <Progress
                      aria-label="Progreso del asistente"
                      size="sm"
                      value={(done / rows.length) * 100}
                    />
                  ) : null}
                </div>
              ) : null}
              {assistantError ? (
                <p className="text-sm text-danger">{assistantError}</p>
              ) : null}

              <ul className="divide-y divide-default-100 rounded-xl border border-default-200">
                {rows.map((row) => {
                  const id = row.exercise.id;
                  const open = expanded === id;

                  return (
                    <li key={id} className="flex flex-col gap-3 px-3 py-2.5">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          aria-label={`Guardar ${row.exercise.name}`}
                          className="mt-0.5"
                          isDisabled={!row.suggestion?.primary.length}
                          isSelected={
                            row.include &&
                            Boolean(row.suggestion?.primary.length)
                          }
                          onValueChange={(include) => patch(id, { include })}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {row.exercise.name}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {row.status === "loading" ? (
                              <span className="flex items-center gap-1.5 text-xs text-default-500">
                                <Spinner size="sm" /> Analizando…
                              </span>
                            ) : row.suggestion ? (
                              <>
                                {row.suggestion.primary.map((m) => (
                                  <span
                                    key={m}
                                    className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                                  >
                                    {muscleLabel(m)}
                                  </span>
                                ))}
                                {row.suggestion.secondary.map((m) => (
                                  <OutlineChip key={m} tone="muted">
                                    {muscleLabel(m)}
                                  </OutlineChip>
                                ))}
                              </>
                            ) : (
                              <span className="text-xs text-default-500">
                                {row.status === "empty"
                                  ? "El asistente no lo reconoce. Elige los músculos a mano."
                                  : row.status === "error"
                                    ? "Sin respuesta del asistente."
                                    : "Sin sugerencia todavía."}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          className="shrink-0"
                          size="sm"
                          variant="light"
                          onPress={() => setExpanded(open ? null : id)}
                        >
                          {open
                            ? "Listo"
                            : row.suggestion
                              ? "Editar"
                              : "Elegir"}
                        </Button>
                      </div>
                      {open ? (
                        <div className="rounded-lg bg-default-50 p-3">
                          <MusclePicker
                            category={row.exercise.category ?? "strength"}
                            exerciseName={row.exercise.name}
                            value={
                              row.suggestion ?? { primary: [], secondary: [] }
                            }
                            onChange={(suggestion) =>
                              patch(id, {
                                suggestion,
                                status: "ready",
                                include: suggestion.primary.length > 0,
                              })
                            }
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </ModalBody>

        <ModalFooter className="items-center justify-between">
          <span className="text-sm text-default-500">
            {accepted.length} de {rows?.length ?? 0} listos para guardar
          </span>
          <div className="flex gap-2">
            <Button isDisabled={saving} variant="light" onPress={onClose}>
              Cerrar
            </Button>
            <Button
              color="primary"
              isDisabled={accepted.length === 0 || analyzing}
              isLoading={saving}
              onPress={save}
            >
              Guardar {accepted.length > 0 ? accepted.length : ""}
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

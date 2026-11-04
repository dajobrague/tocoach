"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { sendJson } from "./fetch-json";

import { MuscleBody } from "@/components/shared/muscle-body";
import {
  MISSING_PRIMARY_ERROR,
  MUSCLE_REGIONS,
  MUSCLES,
  legacyToMuscles,
  muscleLabel,
  parseMuscles,
  primaryMuscleRequired,
  type MuscleId,
  type MuscleSelection,
} from "@/lib/training/muscles";

/** Lo que el asistente necesita para sugerir: un ejercicio guardado o el borrador. */
export type AssistantRequest =
  | { exerciseIds: string[] }
  | {
      draft: {
        name: string;
        category: string;
        description: string;
        equipment: string[];
        movement_pattern: string;
        instructions: string[];
      };
    };

interface MusclePickerProps {
  value: MuscleSelection;
  onChange: (value: MuscleSelection) => void;
  category: string;
  exerciseName: string;
  /** Old free-text muscle_groups, used as the first suggestion source. */
  legacy?: readonly string[] | null | undefined;
  /** Sugerencia del asistente ya guardada (metadata.muscle_suggestion). */
  savedSuggestion?: unknown;
  /** Cómo pedirle una sugerencia al asistente para este ejercicio. */
  assistantRequest?: () => AssistantRequest;
  /** Set after a save attempt without a primary muscle. */
  showError?: boolean;
  disabled?: boolean;
}

export const MUSCLE_PICKER_ID = "muscle-picker";

/**
 * Primary/secondary muscle picker (Oct 14 call, JC). A tap cycles a muscle
 * through principal → secundario → off, on the chips or on the body. When
 * nothing is picked yet it offers a suggestion — the trainer's old free
 * text, a saved assistant suggestion, or a fresh one from the assistant
 * (Claude, David 28 oct) — applied only when the trainer taps it.
 */
export function MusclePicker({
  value,
  onChange,
  category,
  exerciseName,
  legacy,
  savedSuggestion,
  assistantRequest,
  showError = false,
  disabled = false,
}: MusclePickerProps) {
  const [hovered, setHovered] = useState<MuscleId | null>(null);
  const required = primaryMuscleRequired(category);
  const empty = value.primary.length === 0 && value.secondary.length === 0;

  const fromLegacy = legacyToMuscles(legacy, exerciseName);
  const legacySuggestion =
    fromLegacy.primary.length > 0
      ? { primary: fromLegacy.primary, secondary: fromLegacy.secondary }
      : null;
  const saved = (() => {
    const s = savedSuggestion as { primary?: unknown; secondary?: unknown };
    const parsed = s ? parseMuscles(s.primary, s.secondary) : undefined;

    return parsed?.ok === true && parsed.muscles.primary.length > 0
      ? parsed.muscles
      : null;
  })();
  const [assistant, setAssistant] = useState<{
    status: "idle" | "loading" | "empty" | "error";
    result: MuscleSelection | null;
    message?: string;
  }>({ status: "idle", result: null });
  const suggestion = assistant.result ?? legacySuggestion ?? saved;
  const source = assistant.result
    ? "assistant"
    : legacySuggestion
      ? "legacy"
      : saved
        ? "assistant"
        : null;

  const askAssistant = async () => {
    if (!assistantRequest) return;
    setAssistant({ status: "loading", result: null });
    try {
      const data = await sendJson<Record<string, unknown>>(
        "/api/exercises/muscle-assistant",
        "POST",
        assistantRequest()
      );
      const raw = Object.values(data)[0] as
        | { primary?: unknown; secondary?: unknown }
        | null
        | undefined;
      const parsed = raw ? parseMuscles(raw.primary, raw.secondary) : undefined;

      setAssistant(
        parsed?.ok === true &&
          parsed.muscles.primary.length + parsed.muscles.secondary.length > 0
          ? { status: "idle", result: parsed.muscles }
          : { status: "empty", result: null }
      );
    } catch (error) {
      setAssistant({
        status: "error",
        result: null,
        message:
          error instanceof Error ? error.message : "No se pudo consultar",
      });
    }
  };

  const cycle = (id: MuscleId) => {
    if (disabled) return;
    if (value.primary.includes(id)) {
      onChange({
        primary: value.primary.filter((m) => m !== id),
        secondary: [...value.secondary, id],
      });
    } else if (value.secondary.includes(id)) {
      onChange({
        ...value,
        secondary: value.secondary.filter((m) => m !== id),
      });
    } else {
      onChange({ ...value, primary: [...value.primary, id] });
    }
  };

  const missing = showError && required && value.primary.length === 0;

  return (
    <div className="flex flex-col gap-3" id={MUSCLE_PICKER_ID}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-gray-700">
          Músculos{" "}
          <span className="font-normal text-default-500">
            {required ? "· principal obligatorio" : "· opcional en cardio"}
          </span>
        </span>
        <span className="flex items-center gap-3 text-xs text-default-500">
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" />
            Principal
          </span>
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/40" />
            Secundario
          </span>
        </span>
      </div>

      {empty && suggestion && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary/10 px-3 py-2.5 text-sm">
          <span className="min-w-0">
            <span className="font-medium">Sugerencia: </span>
            {suggestion.primary.map(muscleLabel).join(", ")}
            {suggestion.secondary.length > 0 && (
              <span className="text-default-500">
                {" · "}
                {suggestion.secondary.map(muscleLabel).join(", ")}
              </span>
            )}
            <span className="block text-xs text-default-500">
              {source === "legacy"
                ? "Sale de lo que tenías escrito en este ejercicio."
                : "Sugerida por el asistente. Revísala antes de guardar."}
            </span>
          </span>
          <span className="flex items-center gap-1">
            {source === "legacy" && assistantRequest ? (
              <Button
                isDisabled={disabled}
                isLoading={assistant.status === "loading"}
                size="sm"
                variant="light"
                onPress={askAssistant}
              >
                Preguntar al asistente
              </Button>
            ) : null}
            <Button
              color="primary"
              isDisabled={disabled}
              size="sm"
              variant="flat"
              onPress={() => onChange(suggestion)}
            >
              Usar sugerencia
            </Button>
          </span>
        </div>
      )}

      {empty && !suggestion && assistantRequest ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-default-300 px-3 py-2.5 text-sm">
          <span className="min-w-0 text-default-600">
            {assistant.status === "empty"
              ? "El asistente no reconoce este ejercicio. Elige los músculos a mano."
              : assistant.status === "error"
                ? assistant.message
                : "¿No sabes cuáles marcar? El asistente lo sugiere según el nombre y las instrucciones."}
          </span>
          <Button
            isDisabled={disabled || assistant.status === "empty"}
            isLoading={assistant.status === "loading"}
            size="sm"
            startContent={
              assistant.status === "loading" ? null : (
                <Icon icon="solar:magic-stick-3-linear" width={16} />
              )
            }
            variant="flat"
            onPress={askAssistant}
          >
            Sugerir con asistente
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
        <div className="flex flex-col gap-3">
          {MUSCLE_REGIONS.map((region) => (
            <div key={region} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-default-500">
                {region}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {MUSCLES.filter((m) => m.region === region).map((m) => {
                  const state = value.primary.includes(m.id)
                    ? "p"
                    : value.secondary.includes(m.id)
                      ? "s"
                      : null;

                  return (
                    <button
                      key={m.id}
                      aria-pressed={state !== null}
                      className={`compact-control inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-[transform,background-color,border-color] duration-150 active:scale-[0.97] disabled:opacity-50 ${
                        state === "p"
                          ? "border-primary bg-primary text-primary-foreground"
                          : state === "s"
                            ? "border-transparent bg-primary/15 text-foreground"
                            : "border-default-200 bg-content1 text-foreground hover:border-primary"
                      }`}
                      disabled={disabled}
                      type="button"
                      onClick={() => cycle(m.id)}
                      onPointerEnter={() => setHovered(m.id)}
                      onPointerLeave={() => setHovered(null)}
                    >
                      {m.label}
                      {state && (
                        <span className="sr-only">
                          {state === "p" ? "Principal" : "Secundario"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="order-first flex flex-col gap-1 md:order-none">
          <MuscleBody
            className="mx-auto w-full max-w-[150px]"
            highlight={hovered}
            primary={value.primary}
            secondary={value.secondary}
            onHover={setHovered}
            onToggle={cycle}
          />
          <p className="min-h-[1.25rem] text-center text-xs text-default-500">
            {hovered
              ? muscleLabel(hovered)
              : "Toca un músculo: principal, secundario, quitar"}
          </p>
        </div>
      </div>

      {missing && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-danger">
          <Icon icon="solar:danger-circle-linear" width={16} />
          {MISSING_PRIMARY_ERROR}
        </p>
      )}
    </div>
  );
}

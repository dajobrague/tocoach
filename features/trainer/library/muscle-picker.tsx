"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getJson } from "./fetch-json";

import { MuscleMap } from "@/components/shared/muscle-map";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import {
  MISSING_PRIMARY_ERROR,
  MUSCLE_REGIONS,
  MUSCLES,
  legacyToMuscles,
  muscleLabel,
  normalizeExerciseName,
  primaryMuscleRequired,
  type MuscleId,
  type MuscleSelection,
} from "@/lib/training/muscles";

interface MusclePickerProps {
  value: MuscleSelection;
  onChange: (value: MuscleSelection) => void;
  category: string;
  exerciseName: string;
  /** Old free-text muscle_groups, used as the first suggestion source. */
  legacy?: readonly string[] | null | undefined;
  /** Set after a save attempt without a primary muscle. */
  showError?: boolean;
  disabled?: boolean;
}

export const MUSCLE_PICKER_ID = "muscle-picker";

/**
 * Primary/secondary muscle picker (Oct 14 call, JC). A tap cycles a muscle
 * through principal → secundario → off, on the chips or on the body. When
 * nothing is picked yet it offers a suggestion — from the trainer's old
 * free text, else from exercises with the same name — that the trainer
 * applies with one tap; it is never applied on its own.
 */
export function MusclePicker({
  value,
  onChange,
  category,
  exerciseName,
  legacy,
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
  const name = useDebouncedValue(normalizeExerciseName(exerciseName), 500);
  const remote = useQuery({
    queryKey: ["muscle-suggestion", name],
    queryFn: () =>
      getJson<MuscleSelection | null>(
        `/api/exercises/muscle-suggestion?name=${encodeURIComponent(name)}`
      ),
    enabled: empty && legacySuggestion === null && name.length >= 3,
    staleTime: 5 * 60_000,
  });
  const suggestion = legacySuggestion ?? remote.data ?? null;

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
              {legacySuggestion
                ? "Sale de lo que tenías escrito en este ejercicio."
                : "Sale de otros ejercicios con el mismo nombre."}
            </span>
          </span>
          <Button
            color="primary"
            isDisabled={disabled}
            size="sm"
            variant="flat"
            onPress={() => onChange(suggestion)}
          >
            Usar sugerencia
          </Button>
        </div>
      )}

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
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-[transform,background-color,border-color] duration-150 active:scale-[0.97] disabled:opacity-50 ${
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
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide ${
                            state === "s" ? "text-primary" : ""
                          }`}
                        >
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
          <MuscleMap
            className="mx-auto w-full max-w-[260px]"
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

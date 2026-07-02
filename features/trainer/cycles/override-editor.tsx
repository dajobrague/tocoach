"use client";

import type { OverrideFormInput } from "./overrides-api";
import type { OverrideScope } from "@/lib/nutrition/cycles/override-types";

import { Button, Textarea } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { SCOPE_OPTIONS } from "./overrides-api";

interface NoteEditorProps {
  anchorDate: string;
  /** Rotation index of `anchorDate`; `null` if the date is outside the cycle. */
  dayIndex: number | null;
  busy: boolean;
  onSubmit: (input: OverrideFormInput) => void;
}

/**
 * Author a note for the client on a date, choosing how far it applies (this day,
 * this day onward, or every cycle on this rotation day). Swaps are handled from
 * the meal's own "⋯" menu, so this editor is notes-only.
 */
export function NoteEditor({
  anchorDate,
  dayIndex,
  busy,
  onSubmit,
}: NoteEditorProps) {
  const [scope, setScope] = useState<OverrideScope>("single_day");
  const [noteText, setNoteText] = useState("");

  const everyCycleEnabled = dayIndex !== null;
  // Keep an out-of-cycle date from sitting on a now-disabled scope.
  const effectiveScope =
    scope === "every_cycle" && everyCycleEnabled === false
      ? "single_day"
      : scope;

  function submitNote() {
    if (noteText.trim().length === 0) return;

    onSubmit({
      overrideType: "note",
      scope: effectiveScope,
      anchorDate,
      dayIndex,
      noteText: noteText.trim(),
    });
    setNoteText("");
  }

  return (
    <div className="flex flex-col gap-3 rounded-large border border-gray-200 bg-gray-50/60 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Icon icon="solar:notes-linear" width={17} />
        </span>
        <div className="flex flex-col">
          <p className="text-sm font-semibold text-gray-900">
            Nota para el día
          </p>
          <p className="text-xs text-default-500">
            Un recordatorio que el cliente verá en esta fecha.
          </p>
        </div>
      </div>

      <Textarea
        aria-label="Nota para el cliente"
        minRows={2}
        placeholder="p. ej. Bebe más agua hoy, o entrena en ayunas"
        value={noteText}
        variant="bordered"
        onValueChange={setNoteText}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-default-600">
          ¿A qué se aplica?
        </span>
        <div className="flex flex-wrap gap-2">
          {SCOPE_OPTIONS.map((option) => {
            const disabled =
              option.key === "every_cycle" && everyCycleEnabled === false;
            const selected = effectiveScope === option.key;

            return (
              <Button
                key={option.key}
                className={selected ? "bg-black text-white" : ""}
                isDisabled={disabled}
                size="sm"
                variant={selected ? "solid" : "bordered"}
                onPress={() => setScope(option.key)}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>

      <Button
        className="bg-black text-white"
        color="primary"
        isDisabled={busy || noteText.trim().length === 0}
        startContent={<Icon icon="solar:add-circle-linear" width={18} />}
        onPress={submitNote}
      >
        Agregar nota
      </Button>
    </div>
  );
}

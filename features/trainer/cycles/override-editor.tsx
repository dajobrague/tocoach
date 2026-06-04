"use client";

import type { OverrideFormInput } from "./overrides-api";
import type { OptionSelection } from "./cycle-api";
import type { OverrideScope } from "@/lib/nutrition/cycles/override-types";

import {
  Button,
  Radio,
  RadioGroup,
  Select,
  SelectItem,
  Tab,
  Tabs,
  Textarea,
} from "@heroui/react";
import { useState } from "react";

import { PickerDrawer } from "./picker-drawer";
import { SCOPE_OPTIONS } from "./overrides-api";

interface SlotChoice {
  id: string;
  label: string;
}

interface OverrideEditorProps {
  anchorDate: string;
  /** Rotation index of `anchorDate`; `null` if the date is outside the cycle. */
  dayIndex: number | null;
  /** The day's slots — the possible swap targets. */
  slots: SlotChoice[];
  busy: boolean;
  onSubmit: (input: OverrideFormInput) => void;
}

/** Clearly-labelled scope picker — the reviewer checks this is unambiguous. */
function ScopePicker({
  scope,
  everyCycleEnabled,
  onChange,
}: {
  scope: OverrideScope;
  everyCycleEnabled: boolean;
  onChange: (scope: OverrideScope) => void;
}) {
  return (
    <RadioGroup
      label="¿A qué se aplica?"
      value={scope}
      onValueChange={(value) => onChange(value as OverrideScope)}
    >
      {SCOPE_OPTIONS.map((option) => (
        <Radio
          key={option.key}
          isDisabled={
            option.key === "every_cycle" && everyCycleEnabled === false
          }
          value={option.key}
        >
          {option.label}
        </Radio>
      ))}
    </RadioGroup>
  );
}

/**
 * Author a note (date-level) or a swap (on a chosen slot) with a scope. The swap
 * source is chosen via the shared {@link PickerDrawer}; the snapshot is frozen
 * server-side on create.
 */
export function OverrideEditor({
  anchorDate,
  dayIndex,
  slots,
  busy,
  onSubmit,
}: OverrideEditorProps) {
  const [mode, setMode] = useState<"note" | "swap">("note");
  const [scope, setScope] = useState<OverrideScope>("single_day");
  const [noteText, setNoteText] = useState("");
  const [slotId, setSlotId] = useState<string>(slots[0]?.id ?? "");
  const [swap, setSwap] = useState<OptionSelection | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const everyCycleEnabled = dayIndex !== null;
  // Keep an out-of-cycle date from sitting on a now-disabled scope.
  const effectiveScope =
    scope === "every_cycle" && everyCycleEnabled === false
      ? "single_day"
      : scope;

  function submitNote() {
    if (noteText.trim().length === 0) {
      return;
    }

    onSubmit({
      overrideType: "note",
      scope: effectiveScope,
      anchorDate,
      dayIndex,
      noteText: noteText.trim(),
    });
    setNoteText("");
  }

  function submitSwap() {
    if (swap === null || slotId.length === 0) {
      return;
    }

    onSubmit({
      overrideType: "swap",
      scope: effectiveScope,
      anchorDate,
      dayIndex,
      slotId,
      swap,
    });
    setSwap(null);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-default-200 p-3">
      <Tabs
        aria-label="Tipo de ajuste"
        selectedKey={mode}
        onSelectionChange={(key) => setMode(key as "note" | "swap")}
      >
        <Tab key="note" title="Nota" />
        <Tab key="swap" title="Intercambio" />
      </Tabs>

      {mode === "note" ? (
        <>
          <Textarea
            label="Nota para el cliente"
            minRows={2}
            placeholder="p. ej. Bebe más agua hoy"
            value={noteText}
            onValueChange={setNoteText}
          />
          <ScopePicker
            everyCycleEnabled={everyCycleEnabled}
            scope={effectiveScope}
            onChange={setScope}
          />
          <Button
            color="primary"
            isDisabled={busy || noteText.trim().length === 0}
            onPress={submitNote}
          >
            Agregar nota
          </Button>
        </>
      ) : (
        <>
          <Select
            isDisabled={slots.length === 0}
            label="Comida a intercambiar"
            selectedKeys={slotId ? [slotId] : []}
            onSelectionChange={(keys) => setSlotId(String([...keys][0] ?? ""))}
          >
            {slots.map((slot) => (
              <SelectItem key={slot.id}>
                {slot.label.trim().length > 0 ? slot.label : "Comida"}
              </SelectItem>
            ))}
          </Select>

          <Button variant="flat" onPress={() => setPickerOpen(true)}>
            {swap === null ? "Elegir receta o alimento…" : "Cambiar selección"}
          </Button>
          {swap !== null ? (
            <p className="text-xs text-success-600">
              Selección lista — elige el alcance y agrega.
            </p>
          ) : null}

          <ScopePicker
            everyCycleEnabled={everyCycleEnabled}
            scope={effectiveScope}
            onChange={setScope}
          />
          <Button
            color="primary"
            isDisabled={busy || swap === null || slotId.length === 0}
            onPress={submitSwap}
          >
            Agregar intercambio
          </Button>

          <PickerDrawer
            isAdding={false}
            isOpen={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onSelect={(selection) => {
              setSwap(selection);
              setPickerOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
}

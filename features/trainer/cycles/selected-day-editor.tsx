"use client";

import type { DayGroup, GoalPreset, SlotOption } from "./cycle-api";

import {
  Card,
  CardBody,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { DayNutritionPanel } from "./day-nutrition-panel";
import { dayStatus, dayTotals, type MacroTotals } from "./cycle-math";
import { MealRow } from "./meal-row";

const MEAL_PRESETS = [
  "Desayuno",
  "Almuerzo",
  "Comida",
  "Cena",
  "Merienda",
  "Snack",
];
const CUSTOM_MEAL_KEY = "__custom__";

interface SelectedDayEditorProps {
  day: DayGroup;
  disabled: boolean;
  onAddSlot: (label?: string) => void;
  onAddComponent: (slotId: string) => void;
  onAddAlternative: (slotId: string, groupIndex: number) => void;
  onMakePrimary: (slotId: string, orderedOptionIds: string[]) => void;
  onRemoveSlot: (slotId: string) => void;
  onRemoveOption: (slotId: string, optionId: string) => void;
  onEditPortions: (slotId: string, option: SlotOption) => void;
  onRelabelSlot: (slotId: string, label: string) => void;
  onClearDay: () => void;
  onDuplicateDay: () => void;
  onCopyFromDay: () => void;
  targets: MacroTotals;
  /** Named objectives + this day's assignment (day-target selector). */
  presets?: GoalPreset[];
  assignedPresetId?: string | null;
  onAssignPreset?: (presetId: string | null) => void;
  /** Menu name of this day ("Día de entreno"), editable when the handler is set. */
  dayName?: string | null;
  onRenameDay?: (name: string) => void;
}

/**
 * Inline editor for the day's menu name. Shows the name (or a subtle "Nombrar
 * día" affordance), switches to an input on click, saves on Enter/blur. Keyed
 * by day+name from the parent so switching days resets the draft.
 */
function DayNameEditor({
  name,
  disabled,
  onRename,
}: {
  name: string | null;
  disabled: boolean;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name ?? "");

  const save = () => {
    setEditing(false);
    const trimmed = draft.trim();

    if (trimmed !== (name ?? "")) onRename(trimmed);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        aria-label="Nombre del día"
        className="w-56"
        placeholder="Ej. Día de entreno"
        size="sm"
        value={draft}
        variant="bordered"
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
          if (event.key === "Escape") {
            setDraft(name ?? "");
            setEditing(false);
          }
        }}
        onValueChange={setDraft}
      />
    );
  }

  return (
    <button
      className="group flex min-w-0 items-center gap-1.5 rounded-medium px-1.5 py-0.5 text-sm transition-colors hover:bg-gray-100 disabled:opacity-50"
      disabled={disabled}
      type="button"
      onClick={() => setEditing(true)}
    >
      <span
        className={`truncate font-medium ${
          name !== null && name.length > 0
            ? "text-gray-900"
            : "text-default-400"
        }`}
      >
        {name !== null && name.length > 0 ? name : "Nombrar día"}
      </span>
      <Icon
        className="shrink-0 text-default-300 group-hover:text-default-500"
        icon="solar:pen-2-linear"
        width={14}
      />
    </button>
  );
}

export function SelectedDayEditor({
  day,
  disabled,
  onAddSlot,
  onAddComponent,
  onAddAlternative,
  onMakePrimary,
  onRemoveSlot,
  onRemoveOption,
  onEditPortions,
  onRelabelSlot,
  onClearDay,
  onDuplicateDay,
  onCopyFromDay,
  targets,
  presets,
  assignedPresetId = null,
  onAssignPreset,
  dayName = null,
  onRenameDay,
}: SelectedDayEditorProps) {
  const plannedMeals = day.slots.filter(
    (slot) => slot.options.length > 0
  ).length;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <Card className="border border-gray-200 bg-white shadow-sm lg:col-span-2">
        <CardBody className="gap-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Icon
              className="text-default-500"
              icon="solar:clipboard-list-linear"
              width={18}
            />
            <h3 className="text-sm font-semibold text-gray-900">
              Plan del día
            </h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-default-500">
              Día {day.dayIndex + 1}
            </span>
            {onRenameDay !== undefined && (
              <DayNameEditor
                key={`${day.dayIndex}-${dayName ?? ""}`}
                disabled={disabled}
                name={dayName}
                onRename={onRenameDay}
              />
            )}
          </div>

          {day.slots.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-large border border-dashed border-gray-200 bg-gray-50/60 py-10 text-center">
              <Icon
                className="text-default-300"
                icon="solar:plate-linear"
                width={30}
              />
              <p className="text-sm text-default-500">
                No hay comidas planificadas para este día.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {day.slots.map((slot) => (
                <MealRow
                  key={slot.id}
                  disabled={disabled}
                  slot={slot}
                  onAddAlternative={(groupIndex) =>
                    onAddAlternative(slot.id, groupIndex)
                  }
                  onAddComponent={() => onAddComponent(slot.id)}
                  onEditPortions={(option) => onEditPortions(slot.id, option)}
                  onMakePrimary={(orderedOptionIds) =>
                    onMakePrimary(slot.id, orderedOptionIds)
                  }
                  onRelabel={(label) => onRelabelSlot(slot.id, label)}
                  onRemoveOption={(optionId) =>
                    onRemoveOption(slot.id, optionId)
                  }
                  onRemoveSlot={() => onRemoveSlot(slot.id)}
                />
              ))}
            </div>
          )}

          {disabled ? null : (
            <Dropdown placement="bottom-start">
              <DropdownTrigger>
                <button
                  className="flex w-full items-center justify-center gap-1.5 rounded-large border border-dashed border-gray-300 py-3 text-sm font-medium text-blue-600 transition-colors hover:border-blue-300 hover:bg-blue-50/40"
                  type="button"
                >
                  <Icon icon="solar:add-circle-linear" width={18} />
                  Añadir comida
                </button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Tipo de comida"
                onAction={(key) =>
                  onAddSlot(key === CUSTOM_MEAL_KEY ? undefined : String(key))
                }
              >
                {[
                  ...MEAL_PRESETS.map((preset) => (
                    <DropdownItem key={preset}>{preset}</DropdownItem>
                  )),
                  <DropdownItem
                    key={CUSTOM_MEAL_KEY}
                    className="text-default-500"
                  >
                    Personalizada…
                  </DropdownItem>,
                ]}
              </DropdownMenu>
            </Dropdown>
          )}
        </CardBody>
      </Card>

      <DayNutritionPanel
        assignedPresetId={assignedPresetId}
        disabled={disabled}
        plannedMeals={plannedMeals}
        status={dayStatus(day.slots)}
        target={targets}
        totals={dayTotals(day.slots)}
        onClear={onClearDay}
        {...(presets !== undefined ? { presets } : {})}
        {...(onAssignPreset !== undefined ? { onAssignPreset } : {})}
        {...(disabled
          ? {}
          : { onCopyFrom: onCopyFromDay, onDuplicate: onDuplicateDay })}
      />
    </div>
  );
}

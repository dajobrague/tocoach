"use client";

import type { OverrideRow } from "./overrides-api";
import type { MealCycleTree } from "@/lib/nutrition/cycles/meal-cycle-service";

import { Button, Card, CardBody, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import {
  buildMonthGrid,
  dayNumber,
  monthTitle,
  shiftMonth,
  firstOfMonth,
} from "./calendar-helpers";
import { OverrideEditor } from "./override-editor";
import { scopeLabel } from "./overrides-api";
import { useClientCycles } from "./use-cycles";
import {
  useCycleTreeFull,
  useOverrides,
  useOverrideMutations,
} from "./use-overrides";

import { currentCycleDayIndex } from "@/lib/nutrition/cycles/cycle-day";
import {
  overrideAppliesToDate,
  resolveOverridesForDate,
} from "@/lib/nutrition/cycles/override-resolution";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

function rotationIndex(tree: MealCycleTree, date: string): number | null {
  const pos = currentCycleDayIndex(tree.start_date, tree.duration_days, date);

  return pos.started ? pos.dayIndex : null;
}

function MonthGrid({
  tree,
  overrides,
  anchor,
  selectedDate,
  onSelect,
}: {
  tree: MealCycleTree;
  overrides: OverrideRow[];
  anchor: string;
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const weeks = buildMonthGrid(anchor);

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-default-400">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]!.date} className="grid grid-cols-7 gap-1">
          {week.map((cell) => {
            const inCycle = rotationIndex(tree, cell.date) !== null;
            const hasOverride = overrides.some((override) =>
              overrideAppliesToDate(
                override,
                cell.date,
                rotationIndex(tree, cell.date)
              )
            );
            const isSelected = cell.date === selectedDate;

            return (
              <button
                key={cell.date}
                className={`flex h-12 flex-col items-center justify-center rounded-lg border text-sm transition-colors ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : inCycle
                      ? "border-default-200 bg-content1 text-foreground"
                      : "border-transparent text-default-300"
                }`}
                data-testid="calendar-day"
                type="button"
                onClick={() => onSelect(cell.date)}
              >
                <span className={cell.inMonth ? "" : "opacity-40"}>
                  {dayNumber(cell.date)}
                </span>
                {hasOverride ? (
                  <span
                    className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                      isSelected ? "bg-primary-foreground" : "bg-warning-500"
                    }`}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function SelectedDayPanel({
  tree,
  overrides,
  date,
  onDelete,
  deleting,
}: {
  tree: MealCycleTree;
  overrides: OverrideRow[];
  date: string;
  onDelete: (overrideId: string) => void;
  deleting: boolean;
}) {
  const dayIndex = rotationIndex(tree, date);
  const effective = resolveOverridesForDate(tree, overrides, date);
  const onDate = overrides.filter((override) =>
    overrideAppliesToDate(override, date, dayIndex)
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{date}</p>
        <Chip size="sm" variant="flat">
          {dayIndex === null ? "Fuera del ciclo" : `Día ${dayIndex + 1}`}
        </Chip>
      </div>

      {effective.notes.length > 0 ? (
        <div className="rounded-lg border border-warning-200 bg-warning-50 p-2 text-sm">
          {effective.notes.map((note) => (
            <p key={note.id}>📝 {note.text}</p>
          ))}
        </div>
      ) : null}

      {effective.slots.length === 0 ? (
        <p className="text-sm text-default-400">Sin comidas este día.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {effective.slots.map((slot) => (
            <li
              key={slot.slotId}
              className="flex items-center justify-between rounded-lg bg-default-50 px-3 py-2 text-sm"
            >
              <span className="font-medium">
                {slot.label.trim().length > 0 ? slot.label : "Comida"}
              </span>
              <span className="text-default-600">
                {slot.swap !== null
                  ? `${slot.swap.snapshot.name}`
                  : slot.options
                      .map((option) => option.item_snapshot.name)
                      .join(" / ") || "—"}
                {slot.swap !== null ? (
                  <Chip
                    className="ml-2"
                    color="warning"
                    size="sm"
                    variant="flat"
                  >
                    intercambio
                  </Chip>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {onDate.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase text-default-400">
            Ajustes en esta fecha
          </p>
          {onDate.map((override) => (
            <div
              key={override.id}
              className="flex items-center justify-between rounded-lg border border-default-200 px-3 py-2 text-sm"
            >
              <span>
                {override.override_type === "note"
                  ? `Nota: ${override.note_text}`
                  : `Intercambio: ${override.swap_snapshot?.name ?? ""}`}
                <span className="ml-2 text-xs text-default-400">
                  · {scopeLabel(override.scope)}
                </span>
              </span>
              <Button
                isIconOnly
                isDisabled={deleting}
                size="sm"
                variant="light"
                onPress={() => onDelete(override.id)}
              >
                <Icon icon="solar:trash-bin-trash-linear" width={16} />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The trainer "Calendario" tab (P7-T3): the client's plan laid out over calendar
 * dates with existing overrides resolved onto their dates, plus authoring (note
 * / swap + scope) and delete. Reads the active cycle; all writes go through the
 * overrides API.
 */
export function CalendarSection({ clientId }: { clientId: number }) {
  const { data: cycles, isPending } = useClientCycles(clientId);
  const activeCycle = useMemo(() => {
    const list = cycles ?? [];

    return list.find((cycle) => cycle.status === "active") ?? list[0] ?? null;
  }, [cycles]);
  const cycleId = activeCycle?.id ?? null;

  const { data: tree } = useCycleTreeFull(cycleId);
  const { data: overrides } = useOverrides(cycleId);
  const { createM, deleteM } = useOverrideMutations(cycleId ?? "none");

  const [anchor, setAnchor] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (tree !== undefined && anchor === null) {
      setAnchor(firstOfMonth(tree.start_date));
      setSelectedDate(tree.start_date);
    }
  }, [tree, anchor]);

  if (isPending) {
    return (
      <div className="flex justify-center p-8">
        <Spinner color="primary" />
      </div>
    );
  }

  if (activeCycle === null || tree === undefined) {
    return (
      <Card>
        <CardBody className="px-6 py-10 text-center text-sm text-default-500">
          Este cliente aún no tiene un ciclo. Crea uno en la pestaña Plan.
        </CardBody>
      </Card>
    );
  }

  const overrideRows = overrides ?? [];
  const month = anchor ?? firstOfMonth(tree.start_date);
  const date = selectedDate ?? tree.start_date;
  const dayIndex = rotationIndex(tree, date);
  const effective = resolveOverridesForDate(tree, overrideRows, date);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button
          isIconOnly
          size="sm"
          variant="light"
          onPress={() => setAnchor(shiftMonth(month, -1))}
        >
          <Icon icon="solar:alt-arrow-left-linear" width={18} />
        </Button>
        <p className="text-sm font-semibold capitalize text-foreground">
          {monthTitle(month)}
        </p>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          onPress={() => setAnchor(shiftMonth(month, 1))}
        >
          <Icon icon="solar:alt-arrow-right-linear" width={18} />
        </Button>
      </div>

      <MonthGrid
        anchor={month}
        overrides={overrideRows}
        selectedDate={date}
        tree={tree}
        onSelect={setSelectedDate}
      />

      <Card>
        <CardBody className="gap-4">
          <SelectedDayPanel
            date={date}
            deleting={deleteM.isPending}
            overrides={overrideRows}
            tree={tree}
            onDelete={(overrideId) => deleteM.mutate(overrideId)}
          />

          <OverrideEditor
            anchorDate={date}
            busy={createM.isPending}
            dayIndex={dayIndex}
            slots={effective.slots.map((slot) => ({
              id: slot.slotId,
              label: slot.label,
            }))}
            onSubmit={(input) => createM.mutate(input)}
          />
        </CardBody>
      </Card>
    </div>
  );
}

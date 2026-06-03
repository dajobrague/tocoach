"use client";

import { Button, Input, Spinner } from "@heroui/react";
import { useMemo, useState } from "react";

import { CycleApiError, groupSlotsByDay } from "./cycle-api";
import { CycleControls } from "./cycle-controls";
import { CycleGrid } from "./cycle-grid";
import { PickerDrawer } from "./picker-drawer";
import {
  useClientCycles,
  useCreateCycle,
  useCycleMutations,
  useCycleTree,
  useUpdateCycle,
} from "./use-cycles";

interface CycleBuilderContentProps {
  clientId: number;
}

export function CycleBuilderContent({ clientId }: CycleBuilderContentProps) {
  const { data: cycles, isLoading } = useClientCycles(clientId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeId = selectedId ?? cycles?.[0]?.id ?? null;
  const { data: tree } = useCycleTree(activeId);

  const create = useCreateCycle(clientId);
  const update = useUpdateCycle(clientId, activeId ?? "none");
  const mutations = useCycleMutations(activeId ?? "none");

  const [pickerSlotId, setPickerSlotId] = useState<string | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);

  const days = useMemo(
    () =>
      tree !== undefined ? groupSlotsByDay(tree.slots, tree.duration_days) : [],
    [tree]
  );

  const disabled = tree?.status === "archived";

  function handleCreate(input: {
    name: string;
    durationDays: number;
    startDate?: string;
  }): void {
    create.mutate(input, { onSuccess: (cycle) => setSelectedId(cycle.id) });
  }

  function handleActivate(): void {
    setActivateError(null);
    update.mutate(
      { status: "active" },
      {
        onError: (error) =>
          setActivateError(
            error instanceof CycleApiError && error.status === 409
              ? "Este cliente ya tiene un ciclo activo. Archiva el otro primero."
              : "No se pudo activar el ciclo."
          ),
      }
    );
  }

  function reorder(dayIndex: number, orderedSlotIds: string[]): void {
    orderedSlotIds.forEach((slotId, position) => {
      mutations.updateSlotM.mutate({ slotId, patch: { position } });
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-gray-900">Plan de comidas</h1>
        <p className="text-sm text-default-500">
          Construye el ciclo de comidas del cliente.
        </p>
      </div>

      <CreateCycleForm pending={create.isPending} onCreate={handleCreate} />

      {isLoading ? <Spinner color="primary" /> : null}

      {tree !== undefined ? (
        <>
          <CycleControls
            activateError={activateError}
            cycle={tree}
            isUpdating={update.isPending}
            onActivate={handleActivate}
            onArchive={() => update.mutate({ status: "archived" })}
          />

          <CycleGrid
            days={days}
            disabled={disabled === true}
            onAddOption={(slotId) => setPickerSlotId(slotId)}
            onAddSlot={(dayIndex) =>
              mutations.addSlotM.mutate({
                dayIndex,
                position: days[dayIndex]?.slots.length ?? 0,
              })
            }
            onRelabelSlot={(slotId, label) =>
              mutations.updateSlotM.mutate({ slotId, patch: { label } })
            }
            onRemoveOption={(slotId, optionId) =>
              mutations.deleteOptionM.mutate({ slotId, optionId })
            }
            onRemoveSlot={(slotId) => mutations.deleteSlotM.mutate(slotId)}
            onReorder={reorder}
          />
        </>
      ) : null}

      <PickerDrawer
        isAdding={mutations.addOptionM.isPending}
        isOpen={pickerSlotId !== null}
        onClose={() => setPickerSlotId(null)}
        onSelect={(selection) => {
          if (pickerSlotId === null) return;

          mutations.addOptionM.mutate(
            { slotId: pickerSlotId, selection },
            { onSuccess: () => setPickerSlotId(null) }
          );
        }}
      />
    </div>
  );
}

function CreateCycleForm({
  pending,
  onCreate,
}: {
  pending: boolean;
  onCreate: (input: {
    name: string;
    durationDays: number;
    startDate?: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("7");
  const [startDate, setStartDate] = useState("");

  const durationDays = Number(duration);
  const canSubmit =
    name.trim().length > 0 &&
    Number.isInteger(durationDays) &&
    durationDays > 0;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <Input
        className="max-w-xs"
        label="Nombre"
        size="sm"
        value={name}
        onValueChange={setName}
      />
      <Input
        className="max-w-[8rem]"
        label="Duración (días)"
        min={1}
        size="sm"
        type="number"
        value={duration}
        onValueChange={setDuration}
      />
      <Input
        className="max-w-[12rem]"
        label="Inicio"
        size="sm"
        type="date"
        value={startDate}
        onValueChange={setStartDate}
      />
      <Button
        color="primary"
        isDisabled={canSubmit === false || pending}
        isLoading={pending}
        onPress={() =>
          onCreate({
            name: name.trim(),
            durationDays,
            ...(startDate.length > 0 ? { startDate } : {}),
          })
        }
      >
        Crear ciclo
      </Button>
    </div>
  );
}

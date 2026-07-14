"use client";

import type { SlotOption } from "./cycle-api";
import type { MacroTotals } from "./cycle-math";

import {
  Button,
  Card,
  CardBody,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  Tab,
  Tabs,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import { AddDayModal } from "./add-day-modal";
import { CycleApiError, dayReorderMapping, groupSlotsByDay } from "./cycle-api";
import { DEFAULT_TARGETS, dayTotals, slotComponents } from "./cycle-math";
import { CycleSummaryCard } from "./cycle-summary-card";
import { DayCopyModal, type DayCopyMode } from "./day-copy-modal";
import { DaySelector } from "./day-selector";
import { DietPdfSection } from "./diet-pdf-section";
import { EditPortionsModal } from "./edit-portions-modal";
import { GoalsSection } from "./goals-section";
import { MealPlanHeader } from "./meal-plan-header";
import { NewCycleModal } from "./new-cycle-modal";
import { PickerDrawer } from "./picker-drawer";
import { RemoveDayModal } from "./remove-day-modal";
import { SelectedDayEditor } from "./selected-day-editor";
import {
  useAssignDayTarget,
  useClientCycles,
  useClientGoals,
  useCreateCycle,
  useCycleMutations,
  useCycleTree,
  useGoalPresets,
  useRenameDay,
  useUpdateCycle,
} from "./use-cycles";

interface CycleBuilderContentProps {
  clientId: number;
  /** Switches the parent Nutrición tab to Calendario (omitted on the standalone page). */
  onViewCalendar?: () => void;
}

export function CycleBuilderContent({
  clientId,
  onViewCalendar,
}: CycleBuilderContentProps) {
  const { data: cycles, isLoading } = useClientCycles(clientId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default to the client's ACTIVE plan (what the client actually sees);
  // fall back to the newest one when none is active.
  const activeId =
    selectedId ??
    cycles?.find((cycle) => cycle.status === "active")?.id ??
    cycles?.[0]?.id ??
    null;
  const { data: tree } = useCycleTree(activeId);

  const create = useCreateCycle(clientId);
  const update = useUpdateCycle(clientId, activeId ?? "none");
  const mutations = useCycleMutations(activeId ?? "none");
  const { data: goals } = useClientGoals(clientId);
  const { data: presets } = useGoalPresets(clientId);
  const assignTarget = useAssignDayTarget(activeId ?? "none");
  const renameDayM = useRenameDay(activeId ?? "none");
  const targets = goals ?? DEFAULT_TARGETS;

  const [builderTab, setBuilderTab] = useState<"plan" | "goals" | "pdf">(
    "plan"
  );
  const [selectedDay, setSelectedDay] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{
    slotId: string;
    groupIndex: number;
  } | null>(null);
  const [editing, setEditing] = useState<{
    slotId: string;
    option: SlotOption;
  } | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [clearDayOpen, setClearDayOpen] = useState(false);
  const [dayCopyMode, setDayCopyMode] = useState<DayCopyMode | null>(null);
  const [removeDayTarget, setRemoveDayTarget] = useState<number | null>(null);
  const [addDayOpen, setAddDayOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  useEffect(() => {
    setSelectedDay(0);
  }, [activeId]);

  const days = useMemo(
    () =>
      tree !== undefined ? groupSlotsByDay(tree.slots, tree.duration_days) : [],
    [tree]
  );

  const disabled = tree?.status === "archived";
  const day = days[Math.min(selectedDay, Math.max(0, days.length - 1))];
  const hasCycles = (cycles?.length ?? 0) > 0;

  // The selected day's effective objective: its assigned preset when it still
  // exists, otherwise the client's default goals.
  const presetList = presets ?? [];
  const assignedPresetId =
    day !== undefined
      ? ((tree?.day_targets ?? {})[String(day.dayIndex)] ?? null)
      : null;
  const assignedPreset =
    presetList.find((preset) => preset.id === assignedPresetId) ?? null;
  const dayTargets = assignedPreset ?? targets;

  function handleCreate(input: {
    name: string;
    durationDays: number;
    startDate?: string;
  }): void {
    create.mutate(input, {
      onSuccess: (cycle) => {
        setSelectedId(cycle.id);
        setNewOpen(false);
      },
    });
  }

  function handleActivate(): void {
    setActivateError(null);
    update.mutate(
      { status: "active" },
      {
        onError: (error) =>
          setActivateError(
            error instanceof CycleApiError && error.status === 409
              ? "Este cliente ya tiene un plan activo. Archiva el otro primero."
              : "No se pudo activar el plan."
          ),
      }
    );
  }

  async function clearDay(): Promise<void> {
    if (day === undefined) return;
    // Await every delete so a mid-flight failure surfaces as a partially
    // cleared day on refetch instead of a silently "confirmed" clear.
    await Promise.allSettled(
      day.slots.map((slot) => mutations.deleteSlotM.mutateAsync(slot.id))
    );
    setClearDayOpen(false);
  }

  function confirmRemoveDay(): void {
    if (removeDayTarget === null) return;
    const target = removeDayTarget;

    // The plan shrinks by one day; clamp so the selection never lands past it.
    const lastAfterRemove = Math.max(0, days.length - 2);

    mutations.removeDayM.mutate(target, {
      onSuccess: () => {
        // Days after the removed one shift down, so follow the selection.
        setSelectedDay((current) =>
          Math.min(current > target ? current - 1 : current, lastAfterRemove)
        );
        setRemoveDayTarget(null);
      },
    });
  }

  function confirmAddDay(copyFromDayIndex?: number): void {
    mutations.addDayM.mutate(
      copyFromDayIndex !== undefined ? { copyFromDayIndex } : {},
      { onSuccess: () => setAddDayOpen(false) }
    );
  }

  function confirmArchive(): void {
    update.mutate({ status: "archived" });
    setArchiveOpen(false);
  }

  function handleReorderDay(fromIndex: number, toIndex: number): void {
    mutations.reorderDayM.mutate({ fromIndex, toIndex });
    // Keep the selection on the same day content as it renumbers.
    const mapping = dayReorderMapping(days.length, fromIndex, toIndex);

    setSelectedDay((current) => mapping[current] ?? current);
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6 lg:p-8">
        <MealPlanHeader
          activeId={activeId}
          cycles={cycles ?? []}
          onNewCycle={() => setNewOpen(true)}
          onSelectCycle={setSelectedId}
          {...(onViewCalendar !== undefined ? { onViewCalendar } : {})}
        />

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner color="primary" />
          </div>
        ) : null}

        {isLoading === false && (
          <Tabs
            aria-label="Sección del plan"
            classNames={{
              tabList: "rounded-large bg-gray-100 p-1 gap-1",
              cursor: "rounded-medium bg-white shadow-sm",
              tab: "h-9 min-w-[11rem] px-6",
              tabContent:
                "font-medium text-default-500 group-data-[selected=true]:text-gray-900",
            }}
            selectedKey={builderTab}
            variant="light"
            onSelectionChange={(key) =>
              setBuilderTab(key as "plan" | "goals" | "pdf")
            }
          >
            <Tab
              key="goals"
              title={
                <span className="flex items-center gap-1.5">
                  <Icon icon="solar:target-linear" width={16} />
                  Objetivos
                </span>
              }
            />
            <Tab
              key="plan"
              title={
                <span className="flex items-center gap-1.5">
                  <Icon icon="solar:clipboard-list-linear" width={16} />
                  Plan de comidas
                </span>
              }
            />
            <Tab
              key="pdf"
              title={
                <span className="flex items-center gap-1.5">
                  <Icon icon="solar:document-text-linear" width={16} />
                  Dieta PDF
                </span>
              }
            />
          </Tabs>
        )}

        {isLoading === false && builderTab === "goals" ? (
          <GoalsSection clientId={clientId} />
        ) : null}

        {isLoading === false && builderTab === "pdf" ? (
          <DietPdfSection clientId={clientId} />
        ) : null}

        {isLoading === false && builderTab === "plan" && hasCycles === false ? (
          <EmptyState onCreate={() => setNewOpen(true)} />
        ) : null}

        {tree !== undefined && builderTab === "plan" ? (
          <>
            <CycleSummaryCard
              activateError={activateError}
              cycle={tree}
              isUpdating={update.isPending}
              targets={targets}
              onActivate={handleActivate}
              onArchive={() => setArchiveOpen(true)}
              onChangeStartDate={(startDate) => update.mutate({ startDate })}
              onRename={(name) => update.mutate({ name })}
            />

            <DaySelector
              dayNames={tree.day_names ?? {}}
              days={days}
              disabled={disabled === true}
              selectedDay={selectedDay}
              onReorderDay={handleReorderDay}
              onRequestAddDay={() => setAddDayOpen(true)}
              onRequestRemoveDay={(dayIndex) => setRemoveDayTarget(dayIndex)}
              onSelect={setSelectedDay}
            />

            {day !== undefined ? (
              <SelectedDayEditor
                assignedPresetId={assignedPresetId}
                day={day}
                dayName={(tree.day_names ?? {})[String(day.dayIndex)] ?? null}
                disabled={disabled === true}
                presets={presetList}
                targets={dayTargets}
                onAddAlternative={(slotId, groupIndex) =>
                  setPickerTarget({ slotId, groupIndex })
                }
                onAddComponent={(slotId) => {
                  const slot = day.slots.find((item) => item.id === slotId);
                  // Next free index, not the count — after deleting a middle
                  // component the count can collide with a surviving group and
                  // silently turn the new component into an alternative.
                  const components =
                    slot !== undefined ? slotComponents(slot) : [];
                  const groupIndex =
                    components.length > 0
                      ? (components[components.length - 1]?.groupIndex ?? -1) +
                        1
                      : 0;

                  setPickerTarget({ slotId, groupIndex });
                }}
                onAddSlot={(label) =>
                  mutations.addSlotM.mutate({
                    dayIndex: day.dayIndex,
                    position: day.slots.length,
                    ...(label !== undefined ? { label } : {}),
                  })
                }
                onAssignPreset={(presetId) =>
                  assignTarget.mutate({ dayIndex: day.dayIndex, presetId })
                }
                onClearDay={() => setClearDayOpen(true)}
                onCopyFromDay={() => setDayCopyMode("copyFrom")}
                onDuplicateDay={() => setDayCopyMode("duplicate")}
                onEditPortions={(slotId, option) =>
                  setEditing({ slotId, option })
                }
                onRelabelSlot={(slotId, label) =>
                  mutations.updateSlotM.mutate({ slotId, patch: { label } })
                }
                onRemoveOption={(slotId, optionId) =>
                  mutations.deleteOptionM.mutate({ slotId, optionId })
                }
                onRemoveSlot={(slotId) => mutations.deleteSlotM.mutate(slotId)}
                onRenameDay={(name) =>
                  renameDayM.mutate({ dayIndex: day.dayIndex, name })
                }
              />
            ) : null}
          </>
        ) : null}
      </div>

      <NewCycleModal
        isOpen={newOpen}
        pending={create.isPending}
        onClose={() => setNewOpen(false)}
        onCreate={handleCreate}
      />

      <PickerDrawer
        collectRecipePortions
        isAdding={mutations.addOptionM.isPending}
        isOpen={pickerTarget !== null}
        {...(() => {
          if (pickerTarget === null) return {};
          const slot = day?.slots.find((s) => s.id === pickerTarget.slotId);
          const ctx: {
            mealLabel?: string;
            dayNumber?: number;
            cycleName?: string;
            dayTotals?: MacroTotals;
          } = {};

          if (slot !== undefined && slot.label.length > 0)
            ctx.mealLabel = slot.label;
          if (day !== undefined) {
            ctx.dayNumber = day.dayIndex + 1;
            ctx.dayTotals = dayTotals(day.slots);
          }
          if (tree !== undefined) ctx.cycleName = tree.name;

          return ctx;
        })()}
        onClose={() => setPickerTarget(null)}
        onSelect={(selection) => {
          if (pickerTarget === null) return;

          mutations.addOptionM.mutate(
            {
              slotId: pickerTarget.slotId,
              selection: { ...selection, groupIndex: pickerTarget.groupIndex },
            },
            { onSuccess: () => setPickerTarget(null) }
          );
        }}
      />

      <EditPortionsModal
        busy={mutations.updateOptionIngredientsM.isPending}
        option={editing?.option ?? null}
        onClose={() => setEditing(null)}
        onSave={(edits, trainerComment) => {
          if (editing === null) return;

          mutations.updateOptionIngredientsM.mutate(
            {
              slotId: editing.slotId,
              optionId: editing.option.id,
              edits,
              trainerComment,
            },
            { onSuccess: () => setEditing(null) }
          );
        }}
      />

      <DayCopyModal
        currentDayIndex={day?.dayIndex ?? 0}
        days={days}
        mode={dayCopyMode}
        pending={mutations.copyDayM.isPending}
        onClose={() => setDayCopyMode(null)}
        onConfirm={(sourceDayIndex, targetDayIndex) =>
          mutations.copyDayM.mutate(
            { sourceDayIndex, targetDayIndex },
            { onSuccess: () => setDayCopyMode(null) }
          )
        }
      />

      <RemoveDayModal
        dayNumber={(removeDayTarget ?? 0) + 1}
        isOpen={removeDayTarget !== null}
        pending={mutations.removeDayM.isPending}
        onClose={() => setRemoveDayTarget(null)}
        onConfirm={confirmRemoveDay}
      />

      <AddDayModal
        days={days}
        isOpen={addDayOpen}
        pending={mutations.addDayM.isPending}
        onClose={() => setAddDayOpen(false)}
        onConfirm={confirmAddDay}
      />

      <Modal
        isOpen={archiveOpen}
        placement="center"
        size="sm"
        onClose={() => setArchiveOpen(false)}
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-default-100 text-default-600">
              <Icon icon="solar:archive-linear" width={20} />
            </span>
            Archivar plan
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              El cliente dejará de ver este plan hasta que lo actives de nuevo.
              No se pierde ninguna comida — puedes reactivarlo cuando quieras.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setArchiveOpen(false)}>
              Cancelar
            </Button>
            <Button
              color="default"
              startContent={<Icon icon="solar:archive-linear" width={18} />}
              onPress={confirmArchive}
            >
              Archivar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={clearDayOpen}
        placement="center"
        size="sm"
        onClose={() => setClearDayOpen(false)}
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-danger-50 text-danger">
              <Icon icon="solar:trash-bin-trash-linear" width={20} />
            </span>
            Eliminar comidas del día
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              Se quitarán todas las comidas del{" "}
              <span className="font-semibold text-gray-900">
                Día {(day?.dayIndex ?? 0) + 1}
              </span>
              . Esta acción no se puede deshacer.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setClearDayOpen(false)}>
              Cancelar
            </Button>
            <Button
              color="danger"
              startContent={
                <Icon icon="solar:trash-bin-trash-linear" width={18} />
              }
              onPress={clearDay}
            >
              Eliminar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardBody className="flex flex-col items-center gap-3 p-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-700">
          <Icon icon="solar:calendar-linear" width={26} />
        </span>
        <div className="flex max-w-md flex-col gap-1">
          <p className="font-semibold text-gray-900">
            Aún no hay planes de comidas
          </p>
          <p className="text-sm text-default-500">
            Crea un plan para empezar a construir la alimentación de este
            cliente: días, comidas, opciones, porciones y totales de nutrición.
          </p>
        </div>
        <Button
          className="bg-slate-900 text-white"
          color="primary"
          startContent={<Icon icon="solar:add-circle-bold" width={18} />}
          onPress={onCreate}
        >
          Crear primer plan
        </Button>
      </CardBody>
    </Card>
  );
}

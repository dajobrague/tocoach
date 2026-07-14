"use client";

import type { GoalPreset, NutritionGoals } from "./cycle-api";

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
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { DEFAULT_TARGETS } from "./cycle-math";
import { GoalsModal } from "./goals-modal";
import { PresetModal } from "./preset-modal";
import {
  useClientGoals,
  useGoalPresetMutations,
  useGoalPresets,
  useSaveClientGoals,
} from "./use-cycles";

/**
 * The "Objetivos" tab of the meal-plan builder: the client's default daily
 * goals (the fallback) plus their named objectives ("Día de entrenamiento",
 * "Día de descanso", …). Each plan day can then point at one objective from
 * the day editor; days without one measure against the default goals.
 */
export function GoalsSection({ clientId }: { clientId: number }) {
  const { data: goals } = useClientGoals(clientId);
  const saveGoals = useSaveClientGoals(clientId);
  const presetsQuery = useGoalPresets(clientId);
  const { createM, updateM, deleteM } = useGoalPresetMutations(clientId);

  const [goalsOpen, setGoalsOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<GoalPreset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GoalPreset | null>(null);

  const presets = presetsQuery.data ?? [];
  const defaults = goals ?? DEFAULT_TARGETS;
  const presetSaving = createM.isPending || updateM.isPending;
  const presetError =
    (editingPreset === null ? createM.error : updateM.error)?.message ?? null;

  const openCreate = () => {
    createM.reset();
    setEditingPreset(null);
    setPresetOpen(true);
  };

  const openEdit = (preset: GoalPreset) => {
    updateM.reset();
    setEditingPreset(preset);
    setPresetOpen(true);
  };

  const savePreset = (input: { name: string } & NutritionGoals) => {
    const close = { onSuccess: () => setPresetOpen(false) };

    if (editingPreset === null) {
      createM.mutate(input, close);
    } else {
      updateM.mutate({ presetId: editingPreset.id, input }, close);
    }
  };

  const confirmDelete = () => {
    if (deleteTarget === null) return;
    deleteM.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <Card className="border border-gray-200 bg-white shadow-sm">
        <CardBody className="gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon
                className="text-emerald-600"
                icon="solar:target-linear"
                width={18}
              />
              <h3 className="text-sm font-semibold text-gray-900">
                Metas por defecto
              </h3>
            </div>
            <Button
              size="sm"
              startContent={<Icon icon="solar:pen-2-linear" width={15} />}
              variant="bordered"
              onPress={() => setGoalsOpen(true)}
            >
              Editar
            </Button>
          </div>

          <p className="text-xs text-default-500">
            Se usan en los días sin objetivo asignado.
            {goals === null || goals === undefined
              ? " (mostrando los valores por defecto)"
              : ""}
          </p>

          <MacroStrip goals={defaults} />
        </CardBody>
      </Card>

      <Card className="border border-gray-200 bg-white shadow-sm lg:col-span-2">
        <CardBody className="gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon
                className="text-default-500"
                icon="solar:layers-minimalistic-linear"
                width={18}
              />
              <h3 className="text-sm font-semibold text-gray-900">
                Objetivos por día
              </h3>
            </div>
            <Button
              className="bg-slate-900 text-white"
              color="primary"
              size="sm"
              startContent={<Icon icon="solar:add-circle-bold" width={16} />}
              onPress={openCreate}
            >
              Nuevo objetivo
            </Button>
          </div>

          <p className="text-xs text-default-500">
            Define objetivos con nombre (día de entrenamiento, día de descanso,
            …) y asígnalos a cada día desde el plan de comidas.
          </p>

          {presetsQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : presets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-large border border-dashed border-gray-200 bg-gray-50/60 py-8 text-center">
              <Icon
                className="text-default-300"
                icon="solar:target-linear"
                width={26}
              />
              <p className="max-w-sm text-sm text-default-500">
                Aún no hay objetivos. Crea el primero para poder asignarlo a los
                días del plan.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex flex-wrap items-center gap-3 rounded-large border border-gray-200 bg-white p-3"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                    {preset.name}
                  </span>
                  <span className="text-xs text-default-500 tabular-nums">
                    {preset.kcal.toLocaleString("es")} kcal · P{" "}
                    {preset.protein_g}g · C {preset.carbs_g}g · G {preset.fat_g}
                    g
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      isIconOnly
                      aria-label={`Editar ${preset.name}`}
                      size="sm"
                      variant="light"
                      onPress={() => openEdit(preset)}
                    >
                      <Icon icon="solar:pen-2-linear" width={16} />
                    </Button>
                    <Button
                      isIconOnly
                      aria-label={`Eliminar ${preset.name}`}
                      className="text-danger"
                      size="sm"
                      variant="light"
                      onPress={() => setDeleteTarget(preset)}
                    >
                      <Icon icon="solar:trash-bin-trash-linear" width={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <GoalsModal
        initial={defaults}
        isCustom={goals !== null && goals !== undefined}
        isOpen={goalsOpen}
        saving={saveGoals.isPending}
        onClose={() => setGoalsOpen(false)}
        onSave={(next) =>
          saveGoals.mutate(next, { onSuccess: () => setGoalsOpen(false) })
        }
      />

      <PresetModal
        error={presetError}
        isOpen={presetOpen}
        preset={editingPreset}
        saving={presetSaving}
        onClose={() => setPresetOpen(false)}
        onSave={savePreset}
      />

      <Modal
        isOpen={deleteTarget !== null}
        placement="center"
        size="sm"
        onClose={() => setDeleteTarget(null)}
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-danger-50 text-danger">
              <Icon icon="solar:trash-bin-trash-linear" width={20} />
            </span>
            Eliminar objetivo
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              Se eliminará{" "}
              <span className="font-semibold text-gray-900">
                {deleteTarget?.name}
              </span>
              . Los días que lo usen volverán a medirse contra las metas por
              defecto.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={deleteM.isPending}
              variant="light"
              onPress={() => setDeleteTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              color="danger"
              isLoading={deleteM.isPending}
              onPress={confirmDelete}
            >
              Eliminar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

/** The four daily targets as a compact stat strip. */
function MacroStrip({ goals }: { goals: NutritionGoals }) {
  const stats = [
    { label: "Calorías", value: goals.kcal.toLocaleString("es"), unit: "kcal" },
    { label: "Proteína", value: String(goals.protein_g), unit: "g" },
    { label: "Carbos", value: String(goals.carbs_g), unit: "g" },
    { label: "Grasa", value: String(goals.fat_g), unit: "g" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col gap-0.5 rounded-large border border-gray-200 bg-gray-50/60 px-3 py-2"
        >
          <span className="text-sm font-bold text-gray-900 tabular-nums">
            {stat.value}
            <span className="ml-0.5 text-[10px] font-medium text-default-400">
              {stat.unit}
            </span>
          </span>
          <span className="text-[11px] text-default-500">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}

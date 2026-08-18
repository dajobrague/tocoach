"use client";

import type { CycleSlot, SlotOption } from "./cycle-api";

import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRef, useState } from "react";

import { optionKcal, resolveRelabel } from "./cycle-api";
import { mealVisual } from "./cycle-format";
import { slotComponents, slotTotals } from "./cycle-math";
import { MacroLine } from "./macro-line";

import { snapshotBrand } from "@/lib/nutrition/cycles/option-snapshot";

interface MealRowProps {
  slot: CycleSlot;
  disabled: boolean;
  /** Add a new component (food/recipe that sums into the meal). */
  onAddComponent: () => void;
  /** Add an alternative to an existing component. */
  onAddAlternative: (groupIndex: number) => void;
  /** Promote an alternative: the component's option ids, new primary first. */
  onMakePrimary: (orderedOptionIds: string[]) => void;
  onRemoveSlot: () => void;
  onRemoveOption: (optionId: string) => void;
  onEditPortions: (option: SlotOption) => void;
  onRelabel: (label: string) => void;
}

const DEFAULT_LABEL = "Comida";

export function MealRow({
  slot,
  disabled,
  onAddComponent,
  onAddAlternative,
  onMakePrimary,
  onRemoveSlot,
  onRemoveOption,
  onEditPortions,
  onRelabel,
}: MealRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const skipBlurRef = useRef(false);

  const label = slot.label.length > 0 ? slot.label : DEFAULT_LABEL;
  const visual = mealVisual(label);
  const components = slotComponents(slot);
  const mealKcal = slotTotals(slot).kcal;

  function startRename(): void {
    setDraft(slot.label);
    setEditing(true);
  }

  function commit(): void {
    const patch = resolveRelabel(draft, slot.label);

    if (patch !== null) onRelabel(patch.label);

    setEditing(false);
  }

  return (
    <div className="rounded-large border border-gray-200 bg-white">
      <div className="flex items-center gap-3 border-b border-gray-100 px-3 py-2.5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${visual.bg} ${visual.fg}`}
        >
          <Icon icon={visual.icon} width={18} />
        </span>

        {editing ? (
          <Input
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            aria-label="Nombre de la comida"
            className="max-w-[12rem]"
            size="sm"
            value={draft}
            variant="bordered"
            onBlur={() => {
              if (skipBlurRef.current) {
                skipBlurRef.current = false;

                return;
              }
              commit();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit();
              } else if (event.key === "Escape") {
                event.preventDefault();
                skipBlurRef.current = true;
                setEditing(false);
              }
            }}
            onValueChange={setDraft}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
            {label}
          </span>
        )}

        {components.length > 0 && (
          <span className="shrink-0 text-sm font-semibold text-gray-900 tabular-nums">
            {mealKcal} kcal
          </span>
        )}

        {disabled ? null : (
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button
                isIconOnly
                aria-label={`Acciones de ${label}`}
                className="shrink-0 text-default-400"
                radius="full"
                size="sm"
                variant="light"
              >
                <Icon icon="solar:menu-dots-bold" width={18} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Acciones de comida"
              onAction={(key) => {
                if (key === "rename") startRename();
                else if (key === "remove") onRemoveSlot();
              }}
            >
              <DropdownItem
                key="rename"
                startContent={
                  <Icon icon="solar:text-field-linear" width={16} />
                }
              >
                Renombrar comida
              </DropdownItem>
              <DropdownItem
                key="remove"
                className="text-danger"
                color="danger"
                startContent={
                  <Icon icon="solar:trash-bin-trash-linear" width={16} />
                }
              >
                Quitar comida
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        )}
      </div>

      <div className="flex flex-col gap-2 p-3">
        {components.length === 0 ? (
          <button
            className="flex items-center justify-center gap-1.5 rounded-medium border border-dashed border-gray-300 py-3 text-sm font-medium text-blue-600 transition-colors hover:border-blue-300 hover:bg-blue-50/40 disabled:opacity-50"
            disabled={disabled}
            type="button"
            onClick={onAddComponent}
          >
            <Icon icon="solar:add-circle-linear" width={18} />
            Añadir recetas o alimentos
          </button>
        ) : (
          <>
            {components.map((component) => (
              <ComponentBlock
                key={component.groupIndex}
                component={component}
                disabled={disabled}
                onAddAlternative={() => onAddAlternative(component.groupIndex)}
                onEditPortions={onEditPortions}
                onMakePrimary={(option) =>
                  onMakePrimary([
                    option.id,
                    ...component.options
                      .filter((item) => item.id !== option.id)
                      .map((item) => item.id),
                  ])
                }
                onRemoveOption={onRemoveOption}
              />
            ))}

            {disabled ? null : (
              <button
                className="flex items-center gap-1.5 self-start text-xs font-medium text-blue-600 hover:text-blue-700"
                type="button"
                onClick={onAddComponent}
              >
                <Icon icon="solar:add-circle-linear" width={16} />
                Añadir alimento que se suma a esta comida
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ComponentBlock({
  component,
  disabled,
  onAddAlternative,
  onMakePrimary,
  onRemoveOption,
  onEditPortions,
}: {
  component: { groupIndex: number; options: SlotOption[] };
  disabled: boolean;
  onAddAlternative: () => void;
  onMakePrimary: (option: SlotOption) => void;
  onRemoveOption: (optionId: string) => void;
  onEditPortions: (option: SlotOption) => void;
}) {
  const primary = component.options[0];
  const alternatives = component.options.slice(1);

  if (primary === undefined) return null;

  return (
    <div className="rounded-medium border border-gray-100 bg-gray-50/40 p-2">
      <div className="flex items-center gap-3">
        <OptionThumb option={primary} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">
            {primary.item_snapshot.name}
            {snapshotBrand(primary.item_snapshot) !== null && (
              <span className="font-normal text-default-400">
                {" · "}
                {snapshotBrand(primary.item_snapshot)}
              </span>
            )}
          </p>
          <MacroLine
            hideKcal
            carbs_g={primary.item_snapshot.totals.carbs_g}
            className="text-xs text-default-500"
            fat_g={primary.item_snapshot.totals.fat_g}
            kcal={0}
            protein_g={primary.item_snapshot.totals.protein_g}
          />
        </div>
        {alternatives.length > 0 && (
          <span
            className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
            title="Esta opción cuenta en los totales del plan; el cliente puede elegir cualquiera de las alternativas"
          >
            Por defecto
          </span>
        )}
        <span
          className="shrink-0 text-sm font-semibold text-gray-900 tabular-nums"
          data-testid="option-kcal"
        >
          {optionKcal(primary)} kcal
        </span>

        {disabled ? null : (
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button
                isIconOnly
                aria-label={`Acciones de ${primary.item_snapshot.name}`}
                className="shrink-0 text-default-400"
                radius="full"
                size="sm"
                variant="light"
              >
                <Icon icon="solar:menu-dots-bold" width={16} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Acciones del alimento"
              onAction={(key) => {
                if (key === "portions") onEditPortions(primary);
                else if (key === "alt") onAddAlternative();
                else if (key === "remove") onRemoveOption(primary.id);
              }}
            >
              <DropdownItem
                key="portions"
                startContent={<Icon icon="solar:pen-linear" width={16} />}
              >
                Editar porciones
              </DropdownItem>
              <DropdownItem
                key="alt"
                startContent={
                  <Icon
                    icon="solar:posts-carousel-vertical-linear"
                    width={16}
                  />
                }
              >
                Añadir alternativa
              </DropdownItem>
              <DropdownItem
                key="remove"
                className="text-danger"
                color="danger"
                startContent={
                  <Icon icon="solar:trash-bin-trash-linear" width={16} />
                }
              >
                Quitar alimento
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        )}
      </div>

      {alternatives.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1 border-t border-gray-100 pt-1.5">
          {alternatives.map((alt) => (
            <div
              key={alt.id}
              className="flex items-center gap-2 pl-[3.25rem] text-xs"
            >
              <span className="rounded bg-gray-100 px-1 text-[10px] font-medium text-default-500">
                o
              </span>
              <span className="min-w-0 flex-1 truncate text-gray-700">
                {alt.item_snapshot.name}
                {snapshotBrand(alt.item_snapshot) !== null && (
                  <span className="text-default-400">
                    {" · "}
                    {snapshotBrand(alt.item_snapshot)}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-default-500 tabular-nums">
                {optionKcal(alt)} kcal
              </span>
              {disabled ? null : (
                <>
                  <button
                    className="shrink-0 text-[11px] font-medium text-default-400 hover:text-emerald-700"
                    title="Hacer que esta alternativa cuente en los totales del plan"
                    type="button"
                    onClick={() => onMakePrimary(alt)}
                  >
                    Hacer principal
                  </button>
                  <button
                    aria-label={`Quitar ${alt.item_snapshot.name}`}
                    className="shrink-0 text-default-400 hover:text-danger"
                    type="button"
                    onClick={() => onRemoveOption(alt.id)}
                  >
                    <Icon icon="solar:close-circle-linear" width={15} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {disabled ? null : (
        <button
          className="mt-1.5 flex items-center gap-1 pl-[3.25rem] text-[11px] font-medium text-blue-600 hover:text-blue-700"
          title="El cliente elige una entre las alternativas; solo la principal cuenta en los totales"
          type="button"
          onClick={onAddAlternative}
        >
          <Icon icon="solar:posts-carousel-vertical-linear" width={13} />
          Añadir alternativa (el cliente elige una)
        </button>
      )}
    </div>
  );
}

function OptionThumb({ option }: { option: SlotOption }) {
  const image = option.item_snapshot.images[0]?.url;

  if (image === undefined) {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-medium border border-gray-200 bg-white">
        <Icon
          className="text-default-300"
          icon={
            option.item_snapshot.sourceType === "recipe"
              ? "solar:chef-hat-linear"
              : "solar:cup-hot-linear"
          }
          width={18}
        />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className="h-11 w-11 shrink-0 rounded-medium border border-gray-200 object-cover"
      loading="lazy"
      src={image}
    />
  );
}

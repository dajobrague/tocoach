"use client";

import type { OptionSelection } from "./cycle-api";
import type { OverrideRow } from "./overrides-api";
import type { MealSlotOptionRow } from "@/lib/nutrition/cycles/meal-slot-option-service";
import type { MealCycleTree } from "@/lib/nutrition/cycles/meal-cycle-service";

import {
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import {
  buildMonthGrid,
  dayNumber,
  monthTitle,
  shiftMonth,
  firstOfMonth,
} from "./calendar-helpers";
import { mealVisual } from "./cycle-format";
import { MealOverrideDrawer, type MealCartItem } from "./meal-override-drawer";
import { NoteEditor } from "./override-editor";
import { scopeLabel } from "./overrides-api";
import { useClientCycles } from "./use-cycles";
import {
  useClientActivity,
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

/** The menu the date actually follows: the client's choice ?? the rotation. */
function effectiveIndex(
  tree: MealCycleTree,
  date: string,
  choices: Record<string, number>
): { index: number | null; hasChoice: boolean } {
  const rotation = rotationIndex(tree, date);
  const choice = choices[date];
  const valid =
    rotation !== null &&
    choice !== undefined &&
    Number.isInteger(choice) &&
    choice >= 0 &&
    choice < tree.duration_days;

  return { index: valid ? choice : rotation, hasChoice: valid };
}

/** "Día de entreno" when the day is named; "Día N" otherwise. */
function menuName(
  dayNames: Record<string, string>,
  index: number | null
): string {
  if (index === null) return "Fuera del plan";

  return dayNames[String(index)] ?? `Día ${index + 1}`;
}

/** Today's calendar date as YYYY-MM-DD (local), to mark the current day. */
function todayIso(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "miércoles, 3 de junio" — a friendly full date; falls back to the ISO. */
function formatFullDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);

  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

interface KcalOption {
  group_index?: number;
  item_snapshot: { totals: { kcal?: number } };
}

/** Sum the PRIMARY option of each component (group) — meal/day kcal estimate. */
function sumPrimaryKcal(options: KcalOption[]): number {
  const primaryByGroup = new Map<number, KcalOption>();

  for (const option of options) {
    const group = option.group_index ?? 0;

    if (primaryByGroup.has(group) === false) primaryByGroup.set(group, option);
  }

  let sum = 0;

  for (const option of primaryByGroup.values()) {
    sum += Number(option.item_snapshot?.totals?.kcal) || 0;
  }

  return Math.round(sum);
}

interface ProductOption {
  id?: string;
  group_index?: number;
  item_snapshot: { name: string; images?: { url: string }[] };
}

interface MealProduct {
  name: string;
  image: string | null;
  /** True when this is the alternative the client currently picks. */
  chosen?: boolean;
}

/**
 * One entry per meal component (group). When the client's standing selection
 * lands in a group, that alternative is shown (marked as chosen); otherwise
 * the alternatives are joined with "o" and the primary's image is used.
 */
function groupProducts(
  options: ProductOption[],
  chosenOptionId: string | null = null
): MealProduct[] {
  const byGroup = new Map<number, ProductOption[]>();

  for (const option of options) {
    const group = option.group_index ?? 0;
    const list = byGroup.get(group) ?? [];

    list.push(option);
    byGroup.set(group, list);
  }

  return Array.from(byGroup.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, opts]) => {
      const chosen =
        chosenOptionId !== null && opts.length > 1
          ? opts.find((option) => option.id === chosenOptionId)
          : undefined;

      if (chosen !== undefined) {
        return {
          name: chosen.item_snapshot.name,
          image: chosen.item_snapshot.images?.[0]?.url ?? null,
          chosen: true,
        };
      }

      return {
        name: opts.map((option) => option.item_snapshot.name).join(" o "),
        image: opts[0]?.item_snapshot.images?.[0]?.url ?? null,
      };
    });
}

/** Rebuild a picker selection from a frozen snapshot (for pre-filling the cart).
 *  applyPortions stores native-unit amounts, so the ingredient quantities map
 *  straight back to the selection. */
function snapshotToSelection(snapshot: {
  sourceType: "recipe" | "food";
  sourceRefId: string;
  ingredients: { quantity: number }[];
}): OptionSelection {
  if (snapshot.sourceType === "recipe") {
    return {
      kind: "recipe",
      recipeId: snapshot.sourceRefId,
      quantities: snapshot.ingredients.map((line) => line.quantity),
    };
  }

  return {
    kind: "food",
    ingredientId: snapshot.sourceRefId,
    quantity: snapshot.ingredients[0]?.quantity ?? 0,
  };
}

/** The primary option of each component (group), in group order. */
function primaryOptions(options: MealSlotOptionRow[]): MealSlotOptionRow[] {
  const byGroup = new Map<number, MealSlotOptionRow>();

  for (const option of options) {
    const group = option.group_index ?? 0;

    if (byGroup.has(group) === false) byGroup.set(group, option);
  }

  return Array.from(byGroup.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, option]) => option);
}

interface CartSnapshot {
  sourceType: "recipe" | "food";
  sourceRefId: string;
  name: string;
  images?: { url: string }[];
  ingredients: { name: string; unit: string; quantity: number }[];
}

/** A snapshot → cart entry, carrying recipe ingredient lines for per-ingredient
 *  editing (foods edit grams, so they need no lines). */
function snapshotToCartItem(snapshot: CartSnapshot): MealCartItem {
  return {
    selection: snapshotToSelection(snapshot),
    name: snapshot.name,
    image: snapshot.images?.[0]?.url ?? null,
    ...(snapshot.sourceType === "recipe"
      ? {
          ingredients: snapshot.ingredients.map((line) => ({
            name: line.name,
            unit: line.unit,
            quantity: line.quantity,
          })),
        }
      : {}),
  };
}

/** The meal's current items as cart entries (for the "Ajustar cantidad" prefill). */
function slotCartItems(
  swapSnapshots: CartSnapshot[] | null,
  options: MealSlotOptionRow[]
): MealCartItem[] {
  if (swapSnapshots !== null) {
    return swapSnapshots.map(snapshotToCartItem);
  }

  return primaryOptions(options).map((option) =>
    snapshotToCartItem(option.item_snapshot)
  );
}

/** kcal summed across a swap's frozen snapshots. */
function snapshotsKcal(snapshots: { totals: { kcal?: number } }[]): number {
  return Math.round(
    snapshots.reduce((sum, snap) => sum + (Number(snap.totals?.kcal) || 0), 0)
  );
}

/** Product rows (name + image) for a swap's frozen snapshots. */
function swapProducts(
  snapshots: { name: string; images?: { url: string }[] }[]
): MealProduct[] {
  return snapshots.map((snap) => ({
    name: snap.name,
    image: snap.images?.[0]?.url ?? null,
  }));
}

/** kcal per rotation day (0..duration-1) from the base plan (overrides aside). */
function baseKcalByDay(tree: MealCycleTree): number[] {
  const kcals = new Array<number>(Math.max(0, tree.duration_days)).fill(0);

  for (const slot of tree.slots) {
    if (slot.day_index >= 0 && slot.day_index < kcals.length) {
      kcals[slot.day_index] =
        (kcals[slot.day_index] ?? 0) + sumPrimaryKcal(slot.options);
    }
  }

  return kcals;
}

function MonthGrid({
  tree,
  overrides,
  anchor,
  selectedDate,
  today,
  kcalByDay,
  choices,
  dayNames,
  onSelect,
}: {
  tree: MealCycleTree;
  overrides: OverrideRow[];
  anchor: string;
  selectedDate: string;
  today: string;
  kcalByDay: number[];
  choices: Record<string, number>;
  dayNames: Record<string, string>;
  onSelect: (date: string) => void;
}) {
  const weeks = buildMonthGrid(anchor);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-7 gap-1.5 px-1 text-center text-[11px] font-semibold uppercase tracking-wide text-default-400">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]!.date} className="grid grid-cols-7 gap-1.5">
          {week.map((cell) => {
            const { index: idx, hasChoice } = effectiveIndex(
              tree,
              cell.date,
              choices
            );
            const inCycle = idx !== null;
            const isFuture = cell.date > today;
            const hasOverride = overrides.some((override) =>
              overrideAppliesToDate(override, cell.date, idx)
            );
            const isSelected = cell.date === selectedDate;
            const isToday = cell.date === today;
            const kcal = idx !== null ? (kcalByDay[idx] ?? 0) : 0;

            return (
              <button
                key={cell.date}
                className={`relative flex h-[4.5rem] flex-col items-start gap-1 rounded-large border p-1.5 text-left transition-all ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500"
                    : inCycle
                      ? "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                      : "border-transparent bg-gray-50/60"
                } ${cell.inMonth ? "" : "opacity-40"}`}
                data-testid="calendar-day"
                type="button"
                onClick={() => onSelect(cell.date)}
              >
                <span className="flex w-full items-center justify-between">
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums ${
                      isToday
                        ? "bg-slate-900 text-white"
                        : inCycle
                          ? "text-gray-900"
                          : "text-default-300"
                    }`}
                  >
                    {dayNumber(cell.date)}
                  </span>
                  <span className="flex items-center gap-0.5">
                    {hasChoice ? (
                      <Icon
                        className="text-blue-500"
                        icon="solar:user-check-rounded-bold"
                        width={12}
                      />
                    ) : null}
                    {hasOverride ? (
                      <Icon
                        className="text-amber-500"
                        icon="solar:pen-2-bold"
                        width={12}
                      />
                    ) : null}
                  </span>
                </span>

                {inCycle ? (
                  // Past/today = what the client follows (their choice wins);
                  // the future is only the rotation's recommendation, dimmed.
                  <span
                    className={`mt-auto flex w-full flex-col gap-0.5 ${
                      isFuture ? "opacity-55" : ""
                    }`}
                  >
                    <span
                      className={`w-fit max-w-full truncate rounded-full px-1.5 py-px text-[10px] font-semibold ${
                        isFuture
                          ? "border border-dashed border-gray-300 text-default-500"
                          : hasChoice
                            ? "bg-blue-100 text-blue-700"
                            : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {menuName(dayNames, idx)}
                    </span>
                    {kcal > 0 && isFuture === false ? (
                      <span className="text-[10px] tabular-nums text-default-500">
                        {kcal} kcal
                      </span>
                    ) : null}
                  </span>
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
  today,
  choices,
  selections,
  dayNames,
  onDelete,
  onEditMeal,
  deleting,
}: {
  tree: MealCycleTree;
  overrides: OverrideRow[];
  date: string;
  today: string;
  choices: Record<string, number>;
  selections: Record<string, string>;
  dayNames: Record<string, string>;
  onDelete: (overrideId: string) => void;
  onEditMeal: (target: {
    slotId: string;
    label: string;
    initialItems: MealCartItem[];
  }) => void;
  deleting: boolean;
}) {
  const { index: dayIndex, hasChoice } = effectiveIndex(tree, date, choices);
  const isFuture = date > today;
  const effective = resolveOverridesForDate(
    tree,
    overrides,
    date,
    "UTC",
    choices[date]
  );
  const onDate = overrides.filter((override) =>
    overrideAppliesToDate(override, date, dayIndex)
  );

  const dayKcal = effective.slots.reduce(
    (sum, slot) =>
      sum +
      (slot.swap !== null
        ? snapshotsKcal(slot.swap.snapshots)
        : sumPrimaryKcal(slot.options)),
    0
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold capitalize text-gray-900">
            {formatFullDate(date)}
          </p>
          <Chip
            color={
              dayIndex === null ? "default" : hasChoice ? "primary" : "success"
            }
            size="sm"
            variant="flat"
          >
            {menuName(dayNames, dayIndex)}
          </Chip>
          {dayIndex !== null ? (
            hasChoice ? (
              <Chip
                color="primary"
                size="sm"
                startContent={
                  <Icon icon="solar:user-check-rounded-bold" width={13} />
                }
                variant="flat"
              >
                Elegido por el cliente
              </Chip>
            ) : (
              <Chip size="sm" variant="flat">
                {isFuture ? "Recomendado" : "Según el plan"}
              </Chip>
            )
          ) : null}
        </div>
        {dayKcal > 0 ? (
          <Chip
            size="sm"
            startContent={
              <Icon
                className="text-emerald-600"
                icon="solar:fire-linear"
                width={13}
              />
            }
            variant="flat"
          >
            <span className="tabular-nums">{dayKcal} kcal</span>
          </Chip>
        ) : null}
      </div>

      {effective.notes.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-large border border-amber-200 bg-amber-50 p-3">
          {effective.notes.map((note) => (
            <p
              key={note.id}
              className="flex items-start gap-1.5 text-sm text-amber-900"
            >
              <Icon
                className="mt-0.5 shrink-0 text-amber-500"
                icon="solar:notes-linear"
                width={15}
              />
              {note.text}
            </p>
          ))}
        </div>
      ) : null}

      {effective.slots.length === 0 ? (
        <div className="rounded-large border border-dashed border-gray-200 bg-gray-50/60 px-4 py-6 text-center text-sm text-default-500">
          Sin comidas este día.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {effective.slots.map((slot) => {
            const visual = mealVisual(slot.label);
            const kcal =
              slot.swap !== null
                ? snapshotsKcal(slot.swap.snapshots)
                : sumPrimaryKcal(slot.options);
            const products: MealProduct[] =
              slot.swap !== null
                ? swapProducts(slot.swap.snapshots)
                : groupProducts(slot.options, selections[slot.slotId] ?? null);
            const label = slot.label.trim().length > 0 ? slot.label : "Comida";
            const currentItems = slotCartItems(
              slot.swap !== null ? slot.swap.snapshots : null,
              slot.options
            );

            return (
              <li
                key={slot.slotId}
                className="flex flex-col gap-2 rounded-large border border-gray-200 bg-white px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                    {slot.label.trim().length > 0 ? slot.label : "Comida"}
                    {slot.swap !== null ? (
                      <Chip color="warning" size="sm" variant="flat">
                        intercambio
                      </Chip>
                    ) : null}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {kcal > 0 ? (
                      <span className="text-xs font-medium tabular-nums text-default-600">
                        {kcal} kcal
                      </span>
                    ) : null}
                    <Dropdown placement="bottom-end">
                      <DropdownTrigger>
                        <Button
                          isIconOnly
                          aria-label="Opciones de la comida"
                          radius="full"
                          size="sm"
                          variant="light"
                        >
                          <Icon icon="solar:menu-dots-bold" width={18} />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        aria-label="Opciones de la comida"
                        onAction={(key) => {
                          if (key === "swap") {
                            onEditMeal({
                              slotId: slot.slotId,
                              label,
                              initialItems: [],
                            });
                          } else if (key === "quantity") {
                            onEditMeal({
                              slotId: slot.slotId,
                              label,
                              initialItems: currentItems,
                            });
                          }
                        }}
                      >
                        <DropdownItem
                          key="swap"
                          startContent={
                            <Icon icon="solar:refresh-linear" width={16} />
                          }
                        >
                          Intercambiar comida
                        </DropdownItem>
                        <DropdownItem
                          key="quantity"
                          startContent={
                            <Icon icon="solar:tuning-2-linear" width={16} />
                          }
                        >
                          Ajustar cantidad
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </div>
                </div>

                {products.length === 0 ? (
                  <span className="text-xs text-default-400">—</span>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {products.map((product, index) => (
                      <div
                        key={`${product.name}-${index}`}
                        className="flex items-center gap-2.5"
                      >
                        {product.image !== null ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={product.name}
                            className="h-9 w-9 shrink-0 rounded-medium border border-gray-200 object-cover"
                            loading="lazy"
                            src={product.image}
                          />
                        ) : (
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-medium ${visual.bg} ${visual.fg}`}
                          >
                            <Icon icon={visual.icon} width={16} />
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                          {product.name}
                        </span>
                        {product.chosen === true ? (
                          <span className="flex shrink-0 items-center gap-1 rounded-full border border-blue-300 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                            <Icon icon="solar:check-circle-bold" width={11} />
                            Su elección
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {onDate.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-default-400">
            Ajustes en esta fecha
          </p>
          {onDate.map((override) => (
            <div
              key={override.id}
              className="flex items-center justify-between gap-2 rounded-large border border-gray-200 px-3 py-2 text-sm"
            >
              <span className="min-w-0">
                {override.override_type === "note"
                  ? `Nota: ${override.note_text}`
                  : `Intercambio: ${(
                      override.swap_snapshots ??
                      (override.swap_snapshot !== null
                        ? [override.swap_snapshot]
                        : [])
                    )
                      .map((snap) => snap.name)
                      .join(" + ")}`}
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
export function CalendarSection({
  clientId,
  onBack,
}: {
  clientId: number;
  onBack: () => void;
}) {
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
  const [editTarget, setEditTarget] = useState<{
    slotId: string;
    label: string;
    initialItems: MealCartItem[];
  } | null>(null);

  // The visible grid's date range → the client's menu choices for it.
  const gridRange = useMemo(() => {
    if (anchor === null) return { from: "", to: "" };
    const weeks = buildMonthGrid(anchor);
    const lastWeek = weeks[weeks.length - 1];

    return {
      from: weeks[0]?.[0]?.date ?? "",
      to: lastWeek?.[lastWeek.length - 1]?.date ?? "",
    };
  }, [anchor]);
  const { data: activity } = useClientActivity(
    cycleId,
    gridRange.from,
    gridRange.to
  );

  useEffect(() => {
    if (tree !== undefined && anchor === null) {
      // Open on today so the trainer lands on the client's current day.
      const start = todayIso();

      setAnchor(firstOfMonth(start));
      setSelectedDate(start);
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
      <div className="flex flex-col gap-4">
        <Button
          className="self-start"
          size="sm"
          startContent={<Icon icon="solar:alt-arrow-left-linear" width={16} />}
          variant="light"
          onPress={onBack}
        >
          Volver al plan
        </Button>
        <Card>
          <CardBody className="px-6 py-10 text-center text-sm text-default-500">
            Este cliente aún no tiene un plan de comidas. Créalo en la pestaña
            del plan.
          </CardBody>
        </Card>
      </div>
    );
  }

  const overrideRows = overrides ?? [];
  const month = anchor ?? firstOfMonth(tree.start_date);
  const date = selectedDate ?? tree.start_date;
  const today = todayIso();
  const kcalByDay = baseKcalByDay(tree);
  const dayNames = tree.day_names ?? {};
  const choices = activity?.choices ?? {};
  const selections = activity?.selections ?? {};
  // Overrides authored from this panel anchor to the menu the date follows.
  const { index: dayIndex } = effectiveIndex(tree, date, choices);

  const goToday = () => {
    setAnchor(firstOfMonth(today));
    setSelectedDate(today);
  };

  return (
    <div className="flex flex-col gap-4">
      <Button
        className="self-start"
        size="sm"
        startContent={<Icon icon="solar:alt-arrow-left-linear" width={16} />}
        variant="light"
        onPress={onBack}
      >
        Volver al plan
      </Button>

      <Card className="border border-gray-200 bg-white shadow-sm">
        <CardBody className="gap-4 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <p className="truncate text-base font-bold capitalize text-gray-900">
                {monthTitle(month)}
              </p>
              <p className="truncate text-xs text-default-500">{tree.name}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" variant="flat" onPress={goToday}>
                Hoy
              </Button>
              <Button
                isIconOnly
                aria-label="Mes anterior"
                size="sm"
                variant="light"
                onPress={() => setAnchor(shiftMonth(month, -1))}
              >
                <Icon icon="solar:alt-arrow-left-linear" width={18} />
              </Button>
              <Button
                isIconOnly
                aria-label="Mes siguiente"
                size="sm"
                variant="light"
                onPress={() => setAnchor(shiftMonth(month, 1))}
              >
                <Icon icon="solar:alt-arrow-right-linear" width={18} />
              </Button>
            </div>
          </div>

          <MonthGrid
            anchor={month}
            choices={choices}
            dayNames={dayNames}
            kcalByDay={kcalByDay}
            overrides={overrideRows}
            selectedDate={date}
            today={today}
            tree={tree}
            onSelect={setSelectedDate}
          />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-[11px] text-default-500">
            <span className="flex items-center gap-1.5">
              <span className="rounded-full bg-emerald-100 px-1.5 py-px text-[10px] font-semibold text-emerald-700">
                Día N
              </span>
              Según el plan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="rounded-full bg-blue-100 px-1.5 py-px text-[10px] font-semibold text-blue-700">
                Día N
              </span>
              Elegido por el cliente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="rounded-full border border-dashed border-gray-300 px-1.5 py-px text-[10px] font-semibold text-default-500">
                Día N
              </span>
              Futuro (recomendación)
            </span>
            <span className="flex items-center gap-1.5">
              <Icon
                className="text-amber-500"
                icon="solar:pen-2-bold"
                width={12}
              />
              Ajuste en la fecha
            </span>
            <span className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[9px] font-semibold text-white">
                3
              </span>
              Hoy
            </span>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="gap-4">
          <SelectedDayPanel
            choices={choices}
            date={date}
            dayNames={dayNames}
            deleting={deleteM.isPending}
            overrides={overrideRows}
            selections={selections}
            today={today}
            tree={tree}
            onDelete={(overrideId) => deleteM.mutate(overrideId)}
            onEditMeal={setEditTarget}
          />

          <NoteEditor
            anchorDate={date}
            busy={createM.isPending}
            dayIndex={dayIndex}
            onSubmit={(input) => createM.mutate(input)}
          />
        </CardBody>
      </Card>

      <MealOverrideDrawer
        busy={createM.isPending}
        initialItems={editTarget?.initialItems ?? []}
        isOpen={editTarget !== null}
        mealLabel={editTarget?.label ?? ""}
        onClose={() => setEditTarget(null)}
        onSave={(selections) => {
          if (editTarget === null) return;

          createM.mutate(
            {
              overrideType: "swap",
              scope: "single_day",
              anchorDate: date,
              dayIndex,
              slotId: editTarget.slotId,
              swapItems: selections,
            },
            { onSuccess: () => setEditTarget(null) }
          );
        }}
      />
    </div>
  );
}

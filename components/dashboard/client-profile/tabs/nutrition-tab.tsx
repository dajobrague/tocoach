/* eslint-disable no-console */
"use client";

import type {
  NutritionIngredient,
  NutritionMealOptionWithIngredients,
  NutritionMealWithIngredients,
  NutritionPlanMode,
  NutritionPlanWithDays,
} from "@/types/nutrition";

function addIngredientToMealNested(
  meal: NutritionMealWithIngredients,
  ingredient: NutritionIngredient
): NutritionMealWithIngredients {
  const primary = meal.options[0];
  const targetOptionId = primary?.id ?? ingredient.option_id;
  const resolved: NutritionIngredient = {
    ...ingredient,
    option_id: ingredient.option_id || targetOptionId,
  };
  const nextIngredients = [...meal.ingredients, resolved];
  const nextOptions =
    meal.options.length === 0
      ? [
          {
            id: targetOptionId,
            meal_id: meal.id,
            name: "Opción 1",
            option_order: 1,
            protein: null,
            carbs: null,
            fats: null,
            calories: null,
            image_url: null,
            created_at: resolved.created_at,
            updated_at: resolved.updated_at,
            ingredients: [resolved],
          },
        ]
      : meal.options.map((opt) =>
          opt.id === targetOptionId
            ? { ...opt, ingredients: [...opt.ingredients, resolved] }
            : opt
        );

  return { ...meal, ingredients: nextIngredients, options: nextOptions };
}

function removeIngredientFromMealNested(
  meal: NutritionMealWithIngredients,
  ingredientId: string
): NutritionMealWithIngredients {
  return {
    ...meal,
    ingredients: meal.ingredients.filter((i) => i.id !== ingredientId),
    options: meal.options.map((opt) => ({
      ...opt,
      ingredients: opt.ingredients.filter((i) => i.id !== ingredientId),
    })),
  };
}

function replaceIngredientInMealNested(
  meal: NutritionMealWithIngredients,
  tempId: string,
  real: NutritionIngredient
): NutritionMealWithIngredients {
  return {
    ...meal,
    ingredients: meal.ingredients.map((i) => (i.id === tempId ? real : i)),
    options: meal.options.map((opt) => ({
      ...opt,
      ingredients: opt.ingredients.map((i) => (i.id === tempId ? real : i)),
    })),
  };
}

/**
 * Apply a shallow patch to a single ingredient inside a meal tree, keeping the
 * flat `meal.ingredients` and the per-option `opt.ingredients` arrays in sync.
 * Used by optimistic-update handlers (Fase 4) so the UI reflects edits
 * instantly without waiting for a full refreshPlan() round-trip.
 */
function updateIngredientInMealNested(
  meal: NutritionMealWithIngredients,
  ingredientId: string,
  changes: Partial<NutritionIngredient>
): NutritionMealWithIngredients {
  return {
    ...meal,
    ingredients: meal.ingredients.map((i) =>
      i.id === ingredientId ? { ...i, ...changes } : i
    ),
    options: meal.options.map((opt) => ({
      ...opt,
      ingredients: opt.ingredients.map((i) =>
        i.id === ingredientId ? { ...i, ...changes } : i
      ),
    })),
  };
}

/**
 * Apply a shallow patch to a single option inside a meal tree. Used by
 * optimistic-update handlers (Fase 4) for option-name and option-macros edits.
 * Does NOT touch ingredient totals — the option's macros (protein/carbs/fats/
 * calories) are edited directly by the trainer on the option row.
 */
function updateOptionInMealNested(
  meal: NutritionMealWithIngredients,
  optionId: string,
  changes: Partial<NutritionMealOptionWithIngredients>
): NutritionMealWithIngredients {
  return {
    ...meal,
    options: meal.options.map((opt) =>
      opt.id === optionId ? { ...opt, ...changes } : opt
    ),
  };
}

type MacroTotals = {
  protein: number;
  carbs: number;
  fats: number;
  calories: number;
};

function sumIngredientMacros(ingredients: NutritionIngredient[]): MacroTotals {
  return ingredients.reduce(
    (acc, ing) => ({
      protein: acc.protein + (ing.protein ?? 0),
      carbs: acc.carbs + (ing.carbs ?? 0),
      fats: acc.fats + (ing.fats ?? 0),
      calories: acc.calories + (ing.calories ?? 0),
    }),
    { protein: 0, carbs: 0, fats: 0, calories: 0 }
  );
}

function optionDisplayMacros(
  opt: NutritionMealOptionWithIngredients
): MacroTotals {
  const fromIng = sumIngredientMacros(opt.ingredients);
  const hasDetail =
    fromIng.protein > 0 ||
    fromIng.carbs > 0 ||
    fromIng.fats > 0 ||
    fromIng.calories > 0;

  if (hasDetail) return fromIng;

  return {
    protein: Number(opt.protein) || 0,
    carbs: Number(opt.carbs) || 0,
    fats: Number(opt.fats) || 0,
    calories: Number(opt.calories) || 0,
  };
}

function mealOptionMacroRanges(meal: NutritionMealWithIngredients): {
  protein: [number, number];
  carbs: [number, number];
  fats: [number, number];
  calories: [number, number];
} | null {
  if (meal.options.length < 2) return null;
  const rows = meal.options.map(optionDisplayMacros);
  const mm = (key: keyof MacroTotals): [number, number] => {
    const vals = rows.map((r) => r[key]);

    return [Math.min(...vals), Math.max(...vals)];
  };

  return {
    protein: mm("protein"),
    carbs: mm("carbs"),
    fats: mm("fats"),
    calories: mm("calories"),
  };
}

function formatMacroRange(
  [min, max]: [number, number],
  decimals: number,
  suffix: string
): string {
  if (min === max) return `${min.toFixed(decimals)}${suffix}`;

  return `${min.toFixed(decimals)}–${max.toFixed(decimals)}${suffix}`;
}

function nextAlternativeOptionName(meal: NutritionMealWithIngredients): string {
  const letter = String.fromCharCode(65 + meal.options.length);

  return `Opción ${letter}`;
}

function isMultiOptionMeal(meal: NutritionMealWithIngredients): boolean {
  return meal.options.length > 1;
}

/** Build option shape from POST/PATCH API row (snake_case fields). */
function normalizeOptionRowFromApi(
  raw: Record<string, unknown>
): NutritionMealOptionWithIngredients {
  return {
    id: String(raw.id ?? ""),
    meal_id: String(raw.meal_id ?? ""),
    name: String(raw.name ?? ""),
    option_order: Number(raw.option_order ?? 0),
    protein:
      raw.protein !== undefined && raw.protein !== null
        ? Number(raw.protein)
        : null,
    carbs:
      raw.carbs !== undefined && raw.carbs !== null ? Number(raw.carbs) : null,
    fats: raw.fats !== undefined && raw.fats !== null ? Number(raw.fats) : null,
    calories:
      raw.calories !== undefined && raw.calories !== null
        ? Number(raw.calories)
        : null,
    image_url:
      raw.image_url != null && String(raw.image_url).trim() !== ""
        ? String(raw.image_url)
        : null,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    ingredients: [],
  };
}

function mapPlanWithNewOption(
  plan: NutritionPlanWithDays,
  mealId: string,
  rawOption: Record<string, unknown>
): NutritionPlanWithDays {
  const newOption = normalizeOptionRowFromApi(rawOption);

  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      meals: day.meals.map((meal) => {
        if (meal.id !== mealId) return meal;
        const nextOptions = [...meal.options, newOption].sort(
          (a, b) => a.option_order - b.option_order
        );

        return {
          ...meal,
          has_alternatives: nextOptions.length > 1,
          options: nextOptions,
          ingredients: nextOptions.flatMap((o) => o.ingredients),
        };
      }),
    })),
  };
}

import {
  addToast,
  Badge,
  Button,
  Card,
  CardBody,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  Divider,
  ModalHeader,
  Select,
  SelectItem,
  Spinner,
  Switch,
  Tab,
  Tabs,
  Textarea,
} from "@heroui/react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import { NutritionPlanPdfBlock } from "@/components/dashboard/nutrition-plan-pdf-block";
import { MealImageTrainerField } from "@/components/dashboard/nutrition-trainer-meal-image-field";
import { OptionImageTrainerField } from "@/components/dashboard/nutrition-trainer-option-image-field";
import SaveNutritionTemplateModal from "@/components/dashboard/save-nutrition-template-modal";
import { NutritionProgressView } from "@/components/dashboard/client-profile/tabs/progress/nutrition-section";

interface NutritionTabProps {
  clientId: string;
}

type WeeklyOptionSelectionRow = {
  id: string;
  selected_date: string;
  meal_id: string;
  option_id: string;
  meal_label: string;
  option_name: string;
};

// Helper to auto-detect weekdays from Spanish day names
const detectWeekdaysFromLabel = (label: string): number[] => {
  const lowerLabel = label.toLowerCase();
  const weekdayMap: { [key: string]: number } = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miércoles: 3,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sábado: 6,
    sabado: 6,
  };

  for (const [name, day] of Object.entries(weekdayMap)) {
    if (lowerLabel.includes(name)) {
      return [day];
    }
  }

  return [];
};

// Helper to get weekday name in Spanish
const getWeekdayName = (day: number, short: boolean = false): string => {
  const names = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  const shortNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  return short ? shortNames[day] || "Día" : names[day] || "Día desconocido";
};

// Helper to format weekdays array into a readable string
const formatWeekdays = (weekdays: number[]): string => {
  if (!weekdays || weekdays.length === 0) return "Sin asignar";

  const sorted = [...weekdays].sort((a, b) => a - b);

  return sorted.map((day) => getWeekdayName(day, true)).join(", ");
};

function SortableMealItem({
  id,
  children,
}: {
  id: string;
  children: (dragHandleProps: {
    attributes: Record<string, any>;
    listeners: Record<string, any> | undefined;
  }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners })}
    </div>
  );
}

export default function NutritionTab({ clientId }: NutritionTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"setup" | "progress">(
    "setup"
  );
  const [nutritionPlan, setNutritionPlan] =
    useState<NutritionPlanWithDays | null>(null);
  const [allPlans, setAllPlans] = useState<NutritionPlanWithDays[]>([]);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddDayModalOpen, setIsAddDayModalOpen] = useState(false);
  const [isAddMealModalOpen, setIsAddMealModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planModalMode, setPlanModalMode] = useState<"create" | "edit">(
    "create"
  );
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [addingIngredientContext, setAddingIngredientContext] = useState<{
    mealId: string;
    optionId: string;
  } | null>(null);

  const [mealActiveOptionTab, setMealActiveOptionTab] = useState<
    Record<string, string>
  >({});

  const [editingOptionName, setEditingOptionName] = useState<string | null>(
    null
  );
  const [editingOptionNameValue, setEditingOptionNameValue] = useState("");
  const [editingOptionMacrosId, setEditingOptionMacrosId] = useState<
    string | null
  >(null);
  const [optionMacrosForm, setOptionMacrosForm] = useState({
    protein: "",
    carbs: "",
    fats: "",
    calories: "",
  });
  // Item 2.4: per-option recipe editor. Null = no option has its recipe
  // open in edit mode (trainer is either viewing the read-only summary or
  // the recipe section is collapsed).
  const [editingOptionRecipeId, setEditingOptionRecipeId] = useState<
    string | null
  >(null);
  const [optionRecipeForm, setOptionRecipeForm] = useState({
    instructions: "",
    prep_time_minutes: "",
    cooking_time_minutes: "",
    servings: "",
    recipe_notes: "",
  });
  const [addingAlternativeForMealId, setAddingAlternativeForMealId] = useState<
    string | null
  >(null);

  const [optionDeleteConfirm, setOptionDeleteConfirm] = useState<{
    optionId: string;
    mealId: string;
    name: string;
    ingredientCount: number;
  } | null>(null);
  const [optionDeleteLoading, setOptionDeleteLoading] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<string | null>(
    null
  );
  const [editingMealMacros, setEditingMealMacros] = useState<string | null>(
    null
  );
  const [editingDayMacros, setEditingDayMacros] = useState<string | null>(null);

  const [dayForm, setDayForm] = useState({
    dayLabel: "",
    notes: "",
    protein: "",
    carbs: "",
    fats: "",
    calories: "",
    weekdays: [] as number[],
  });

  const [editingDayWeekdays, setEditingDayWeekdays] = useState<string | null>(
    null
  );
  const [weekdaysForm, setWeekdaysForm] = useState<number[]>([]);

  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);

  // Delete confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: "plan" | "day" | "meal" | "ingredient";
    id: string;
    name: string;
  } | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  // Inline editing state for day name and meal name
  const [editingDayName, setEditingDayName] = useState<string | null>(null);
  const [editingDayNameValue, setEditingDayNameValue] = useState("");
  const [editingMealName, setEditingMealName] = useState<string | null>(null);
  const [editingMealNameValue, setEditingMealNameValue] = useState("");

  const [createPlanTab, setCreatePlanTab] = useState<"blank" | "template">(
    "blank"
  );
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  const [mealForm, setMealForm] = useState({
    label: "",
    notes: "",
    protein: "",
    carbs: "",
    fats: "",
    calories: "",
  });

  const [planForm, setPlanForm] = useState({
    name: "",
    start_date: new Date().toISOString().split("T")[0],
    status: "active" as "active" | "completed" | "paused" | "cancelled",
    notes: "",
    show_meal_images: true,
    // Item 2.3: plan-level calorie visibility. Default true matches
    // backward-compatible behaviour (existing plans showed calories).
    show_calories: true,
  });

  const [macrosForm, setMacrosForm] = useState({
    protein: "",
    carbs: "",
    fats: "",
    calories: "",
  });

  const [dayMacrosForm, setDayMacrosForm] = useState({
    protein: "",
    carbs: "",
    fats: "",
    calories: "",
  });

  const [newIngredient, setNewIngredient] = useState({
    name: "",
    quantity: "",
    unit: "",
  });

  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());

  const [weeklyOptionSelections, setWeeklyOptionSelections] = useState<
    WeeklyOptionSelectionRow[]
  >([]);
  const [weeklyOptionRange, setWeeklyOptionRange] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [weeklyOptionLoading, setWeeklyOptionLoading] = useState(false);
  const [weeklyPrefsDetailOpen, setWeeklyPrefsDetailOpen] = useState(false);

  const [planModeSaving, setPlanModeSaving] = useState(false);

  const toggleMealCollapse = (mealId: string) => {
    setExpandedMeals((prev) => {
      const next = new Set(prev);

      if (next.has(mealId)) {
        next.delete(mealId);
      } else {
        next.add(mealId);
      }

      return next;
    });
  };

  // Drag-and-drop sensors for meal reordering
  const mealDndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleMealDragEnd = async (dayId: string, event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !nutritionPlan) return;

    const day = nutritionPlan.days.find((d) => d.id === dayId);

    if (!day) return;

    const oldIndex = day.meals.findIndex((m) => m.id === active.id);
    const newIndex = day.meals.findIndex((m) => m.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Snapshot the previous meals order so we can revert if the server
    // PATCH fails. The previous fire-and-forget pattern silently lost
    // the new order on a network blip — Carlos Torres reported items
    // jumping back to the bottom after edits.
    const previousMeals = day.meals;
    const reorderedMeals = arrayMove(day.meals, oldIndex, newIndex);

    setNutritionPlan((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        days: prev.days.map((d) =>
          d.id === dayId ? { ...d, meals: reorderedMeals } : d
        ),
      };
    });

    const reorderPayload = reorderedMeals.map((m, i) => ({
      id: m.id,
      meal_order: i,
    }));

    try {
      const res = await fetch("/api/nutrition/meals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder: reorderPayload }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || json?.success === false) {
        throw new Error(json?.error ?? "No se pudo guardar el orden");
      }
    } catch (err) {
      console.error("[Nutrition] Failed to persist meal reorder:", err);

      // Revert local state — without this the trainer thinks the order
      // was saved and only discovers otherwise on the next page load.
      setNutritionPlan((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          days: prev.days.map((d) =>
            d.id === dayId ? { ...d, meals: previousMeals } : d
          ),
        };
      });

      addToast({
        title: "No se pudo guardar el orden",
        description:
          err instanceof Error
            ? err.message
            : "Revisa tu conexión e inténtalo de nuevo.",
        color: "danger",
      });
    }
  };

  // Fetch nutrition plans for this client
  useEffect(() => {
    const fetchNutritionPlans = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/nutrition/plans/${clientId}`);
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
          setAllPlans(result.data);
          // Set the first plan or maintain current selection
          const indexToUse =
            selectedPlanIndex < result.data.length ? selectedPlanIndex : 0;

          setSelectedPlanIndex(indexToUse);
          setNutritionPlan(result.data[indexToUse]);
        } else {
          setAllPlans([]);
          setNutritionPlan(null);
        }
        setError(null);
      } catch (err) {
        console.error("Error fetching nutrition plans:", err);
        setError("Error al cargar el plan nutricional");
      } finally {
        setIsLoading(false);
      }
    };

    fetchNutritionPlans();
  }, [clientId]);

  // Helper to refresh the plan data
  const refreshPlan = async () => {
    try {
      const response = await fetch(`/api/nutrition/plans/${clientId}`);
      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        setAllPlans(result.data);
        const indexToUse =
          selectedPlanIndex < result.data.length ? selectedPlanIndex : 0;

        setSelectedPlanIndex(indexToUse);
        setNutritionPlan(result.data[indexToUse]);
      } else {
        setAllPlans([]);
        setNutritionPlan(null);
      }
    } catch (err) {
      console.error("Error refreshing plan:", err);
    }
  };

  useEffect(() => {
    if (!clientId || activeSubTab !== "setup") return;

    let cancelled = false;

    setWeeklyOptionLoading(true);

    void fetch(
      `/api/clients/${encodeURIComponent(clientId)}/nutrition/option-selections`
    )
      .then((r) => r.json())
      .then(
        (j: {
          success?: boolean;
          data?: WeeklyOptionSelectionRow[];
          range?: { from: string; to: string };
        }) => {
          if (cancelled) return;

          if (j.success && Array.isArray(j.data)) {
            setWeeklyOptionSelections(j.data);
            setWeeklyOptionRange(j.range ?? null);
          } else {
            setWeeklyOptionSelections([]);
            setWeeklyOptionRange(null);
          }

          setWeeklyOptionLoading(false);
        }
      )
      .catch(() => {
        if (!cancelled) {
          setWeeklyOptionSelections([]);
          setWeeklyOptionRange(null);
          setWeeklyOptionLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, activeSubTab]);

  const weeklyOptionSummaryLines = useMemo(() => {
    const mealMap = new Map<string, Map<string, number>>();

    for (const r of weeklyOptionSelections) {
      const ml = r.meal_label?.trim() || "Comida";
      const on = r.option_name?.trim() || "Opción";

      if (!mealMap.has(ml)) mealMap.set(ml, new Map());
      const om = mealMap.get(ml)!;

      om.set(on, (om.get(on) || 0) + 1);
    }

    const lines: string[] = [];

    for (const [meal, opts] of mealMap) {
      const parts = [...opts.entries()].map(([name, n]) => `${name} ×${n}`);

      lines.push(`${meal}: ${parts.join(" · ")}`);
    }

    return lines;
  }, [weeklyOptionSelections]);

  const handlePlanModeChange = async (next: string) => {
    if (!nutritionPlan) return;

    const allowed: NutritionPlanMode[] = ["structured", "pdf", "hybrid"];

    if (!allowed.includes(next as NutritionPlanMode)) return;

    const mode = next as NutritionPlanMode;
    const current = nutritionPlan.plan_mode || "structured";

    if (current === mode) return;

    setPlanModeSaving(true);

    try {
      const res = await fetch(`/api/nutrition/plans/${nutritionPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_mode: mode }),
      });
      const result = await res.json();

      if (!result.success) {
        alert(result.error || "Error al guardar el modo del plan");

        return;
      }

      await refreshPlan();
    } catch (err) {
      console.error("Error updating plan mode:", err);
      alert("Error al guardar el modo del plan");
    } finally {
      setPlanModeSaving(false);
    }
  };

  // Switch between plans
  const handleSwitchPlan = (index: number) => {
    if (index >= 0 && index < allPlans.length) {
      setSelectedPlanIndex(index);
      setNutritionPlan(allPlans[index] || null);
    }
  };

  // Plan modal handlers
  const handleOpenCreatePlan = async () => {
    setPlanModalMode("create");
    setPlanForm({
      name: "",
      start_date: new Date().toISOString().split("T")[0],
      status: "active",
      notes: "",
      show_meal_images: true,
      show_calories: true,
    });
    setCreatePlanTab("blank");
    setSelectedTemplateId("");

    // Fetch available nutrition templates
    setIsLoadingTemplates(true);
    try {
      const response = await fetch("/api/templates?type=nutrition");
      const result = await response.json();

      if (result.success) {
        const nutritionTemplates = result.templates.filter(
          (t: any) => t.templateType === "nutrition"
        );

        setAvailableTemplates(nutritionTemplates);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setIsLoadingTemplates(false);
    }

    setIsPlanModalOpen(true);
  };

  const handleOpenEditPlan = () => {
    if (!nutritionPlan) return;
    setPlanModalMode("edit");
    setPlanForm({
      name: nutritionPlan.name,
      start_date: nutritionPlan.start_date,
      status: nutritionPlan.status,
      notes: nutritionPlan.notes || "",
      show_meal_images: nutritionPlan.show_meal_images !== false,
      // Item 2.3: same default-true semantics as the DB column.
      show_calories: nutritionPlan.show_calories !== false,
    });
    setIsPlanModalOpen(true);
  };

  const handleClosePlanModal = () => {
    setIsPlanModalOpen(false);
    setPlanForm({
      name: "",
      start_date: new Date().toISOString().split("T")[0],
      status: "active",
      notes: "",
      show_meal_images: true,
      show_calories: true,
    });
  };

  const handleSavePlan = async () => {
    if (planModalMode === "create") {
      try {
        const requestBody: any = {
          client_id: clientId,
          name: planForm.name,
          start_date: planForm.start_date,
          status: planForm.status,
          notes: planForm.notes,
        };

        // If creating from template, include templateId
        if (createPlanTab === "template" && selectedTemplateId) {
          requestBody.templateId = selectedTemplateId;
        }

        const response = await fetch("/api/nutrition/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const result = await response.json();

        if (result.success) {
          await refreshPlan();
          handleClosePlanModal();
        } else {
          alert(`Error al crear plan: ${result.error || "Error desconocido"}`);
        }
      } catch (err) {
        console.error("Error creating plan:", err);
        alert("Error al crear plan. Por favor intenta de nuevo.");
      }
    } else {
      // Edit mode
      if (!nutritionPlan) return;
      try {
        const response = await fetch(
          `/api/nutrition/plans/${nutritionPlan.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: planForm.name,
              start_date: planForm.start_date,
              status: planForm.status,
              notes: planForm.notes,
              show_meal_images: planForm.show_meal_images,
              show_calories: planForm.show_calories,
            }),
          }
        );
        const result = await response.json();

        if (result.success) {
          await refreshPlan();
          handleClosePlanModal();
        } else {
          alert(
            `Error al actualizar plan: ${result.error || "Error desconocido"}`
          );
        }
      } catch (err) {
        console.error("Error updating plan:", err);
        alert("Error al actualizar plan. Por favor intenta de nuevo.");
      }
    }
  };

  const handleDeletePlan = () => {
    if (!nutritionPlan) return;
    setDeleteConfirm({
      isOpen: true,
      type: "plan",
      id: nutritionPlan.id,
      name: nutritionPlan.name || "Plan Nutricional",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusColor = (
    status: string
  ): "success" | "primary" | "warning" | "danger" => {
    switch (status) {
      case "active":
        return "success";
      case "completed":
        return "primary";
      case "paused":
        return "warning";
      case "cancelled":
        return "danger";
      default:
        return "primary";
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "active":
        return "Activo";
      case "completed":
        return "Completado";
      case "paused":
        return "Pausado";
      case "cancelled":
        return "Cancelado";
      default:
        return status;
    }
  };

  // Day handlers
  const handleOpenAddDay = () => {
    setIsAddDayModalOpen(true);
  };

  const handleCloseAddDay = () => {
    setIsAddDayModalOpen(false);
    setDayForm({
      dayLabel: "",
      notes: "",
      protein: "",
      carbs: "",
      fats: "",
      calories: "",
      weekdays: [],
    });
  };

  const handleSaveDay = async () => {
    if (!nutritionPlan) return;

    if (!dayForm.dayLabel.trim()) {
      alert("El nombre del día es obligatorio");

      return;
    }

    // Auto-detect weekdays from day label if not manually set
    const autoDetectedWeekdays = detectWeekdaysFromLabel(dayForm.dayLabel);
    const weekdaysToUse =
      dayForm.weekdays.length > 0 ? dayForm.weekdays : autoDetectedWeekdays;

    // Create optimistic day
    const optimisticDay = {
      id: `temp-${Date.now()}`,
      nutrition_plan_id: nutritionPlan.id,
      tenant_host: nutritionPlan.tenant_host,
      day_label: dayForm.dayLabel,
      day_order: nutritionPlan.days.length,
      protein: parseFloat(dayForm.protein) || 0,
      carbs: parseFloat(dayForm.carbs) || 0,
      fats: parseFloat(dayForm.fats) || 0,
      calories: parseFloat(dayForm.calories) || 0,
      weekdays: weekdaysToUse,
      meals: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistically add day to UI
    setNutritionPlan((prevPlan) => {
      if (!prevPlan) return prevPlan;

      return {
        ...prevPlan,
        days: [...prevPlan.days, optimisticDay],
      };
    });

    handleCloseAddDay();

    // Make API call in background
    try {
      const response = await fetch("/api/nutrition/days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nutrition_plan_id: nutritionPlan.id,
          day_label: dayForm.dayLabel,
          protein: optimisticDay.protein,
          carbs: optimisticDay.carbs,
          fats: optimisticDay.fats,
          calories: optimisticDay.calories,
          weekdays: weekdaysToUse,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Replace optimistic day with real one
        setNutritionPlan((prevPlan) => {
          if (!prevPlan) return prevPlan;

          return {
            ...prevPlan,
            days: prevPlan.days.map((day) =>
              day.id === optimisticDay.id ? result.data : day
            ),
          };
        });
      } else {
        console.error("Error creating day:", result.error);
        await refreshPlan();
        alert(`Error al crear día: ${result.error || "Error desconocido"}`);
      }
    } catch (err) {
      console.error("Error saving day:", err);
      await refreshPlan();
      alert("Error al crear día. Por favor intenta de nuevo.");
    }
  };

  const handleEditDay = (dayId: string) => {
    const day = nutritionPlan?.days.find((d) => d.id === dayId);

    if (day) {
      setEditingDayName(dayId);
      setEditingDayNameValue(day.day_label);
    }
  };

  const handleSaveDayName = async (dayId: string) => {
    if (!editingDayNameValue.trim()) return;

    // Optimistic update
    setNutritionPlan((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        days: prev.days.map((d) =>
          d.id === dayId ? { ...d, day_label: editingDayNameValue.trim() } : d
        ),
      };
    });
    setEditingDayName(null);

    try {
      const response = await fetch(`/api/nutrition/days/${dayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day_label: editingDayNameValue.trim() }),
      });

      if (!response.ok) {
        await refreshPlan();
      }
    } catch (err) {
      console.error("Error saving day name:", err);
      await refreshPlan();
    }
  };

  const handleDeleteDay = (dayId: string) => {
    const day = nutritionPlan?.days.find((d) => d.id === dayId);

    setDeleteConfirm({
      isOpen: true,
      type: "day",
      id: dayId,
      name: day?.day_label || "Día",
    });
  };

  // Meal handlers
  const handleOpenAddMeal = (dayId: string) => {
    setSelectedDayId(dayId);
    setIsAddMealModalOpen(true);
  };

  const handleCloseAddMeal = () => {
    setIsAddMealModalOpen(false);
    setSelectedDayId(null);
    setMealForm({
      label: "",
      notes: "",
      protein: "",
      carbs: "",
      fats: "",
      calories: "",
    });
  };

  const handleSaveMeal = async () => {
    if (!selectedDayId || !nutritionPlan) return;

    const mealTs = Date.now();
    const tempMealId = `temp-meal-${mealTs}`;
    const tempOptionId = `temp-opt-${mealTs}`;
    const nowIso = new Date().toISOString();

    const optimisticMeal: NutritionMealWithIngredients = {
      id: tempMealId,
      nutrition_day_id: selectedDayId,
      tenant_host: nutritionPlan.tenant_host,
      label: mealForm.label,
      meal_order: 0,
      notes: mealForm.notes,
      protein: parseFloat(mealForm.protein) || 0,
      carbs: parseFloat(mealForm.carbs) || 0,
      fats: parseFloat(mealForm.fats) || 0,
      calories: parseFloat(mealForm.calories) || 0,
      has_alternatives: false,
      image_url: null,
      options: [
        {
          id: tempOptionId,
          meal_id: tempMealId,
          name: "Opción 1",
          option_order: 1,
          protein: null,
          carbs: null,
          fats: null,
          calories: null,
          image_url: null,
          created_at: nowIso,
          updated_at: nowIso,
          ingredients: [],
        },
      ],
      ingredients: [],
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Optimistically add meal to UI
    setNutritionPlan((prevPlan) => {
      if (!prevPlan) return prevPlan;

      return {
        ...prevPlan,
        days: prevPlan.days.map((day) =>
          day.id === selectedDayId
            ? { ...day, meals: [...day.meals, optimisticMeal] }
            : day
        ),
      };
    });

    handleCloseAddMeal();

    // Make API call in background
    try {
      const response = await fetch("/api/nutrition/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nutrition_day_id: selectedDayId,
          label: mealForm.label,
          notes: mealForm.notes,
          protein: optimisticMeal.protein,
          carbs: optimisticMeal.carbs,
          fats: optimisticMeal.fats,
          calories: optimisticMeal.calories,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Replace optimistic meal with real one
        setNutritionPlan((prevPlan) => {
          if (!prevPlan) return prevPlan;

          return {
            ...prevPlan,
            days: prevPlan.days.map((day) => ({
              ...day,
              meals: day.meals.map((meal) =>
                meal.id === optimisticMeal.id ? result.data : meal
              ),
            })),
          };
        });
      } else {
        console.error("Error creating meal:", result.error);
        await refreshPlan();
        alert(`Error al crear comida: ${result.error || "Error desconocido"}`);
      }
    } catch (err) {
      console.error("Error saving meal:", err);
      await refreshPlan();
      alert("Error al crear comida. Por favor intenta de nuevo.");
    }
  };

  const handleEditMeal = (mealId: string) => {
    let foundMeal: NutritionMealWithIngredients | null = null;

    nutritionPlan?.days.forEach((day) => {
      const meal = day.meals.find((m) => m.id === mealId);

      if (meal) foundMeal = meal;
    });
    if (foundMeal) {
      setEditingMealName(mealId);
      setEditingMealNameValue(
        (foundMeal as NutritionMealWithIngredients).label
      );
    }
  };

  const handleSaveMealName = async (mealId: string) => {
    if (!editingMealNameValue.trim()) return;

    // Optimistic update
    setNutritionPlan((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        days: prev.days.map((day) => ({
          ...day,
          meals: day.meals.map((m) =>
            m.id === mealId ? { ...m, label: editingMealNameValue.trim() } : m
          ),
        })),
      };
    });
    setEditingMealName(null);

    try {
      const response = await fetch(`/api/nutrition/meals/${mealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editingMealNameValue.trim() }),
      });

      if (!response.ok) {
        await refreshPlan();
      }
    } catch (err) {
      console.error("Error saving meal name:", err);
      await refreshPlan();
    }
  };

  const handleDeleteMeal = (mealId: string) => {
    let mealLabel = "Comida";

    nutritionPlan?.days.forEach((day) => {
      const meal = day.meals.find((m) => m.id === mealId);

      if (meal) mealLabel = meal.label;
    });
    setDeleteConfirm({
      isOpen: true,
      type: "meal",
      id: mealId,
      name: mealLabel,
    });
  };

  // Ingredient handlers - Inline (scoped to option)
  const handleAddIngredientClick = (mealId: string, optionId: string) => {
    setAddingIngredientContext({ mealId, optionId });
    setNewIngredient({ name: "", quantity: "", unit: "" });
  };

  const handleSaveNewIngredient = async () => {
    if (!nutritionPlan || !addingIngredientContext) return;

    const { mealId, optionId: targetOptionId } = addingIngredientContext;

    const optimisticIngredient: NutritionIngredient = {
      id: `temp-ing-${Date.now()}`,
      nutrition_meal_id: mealId,
      option_id: targetOptionId,
      tenant_host: nutritionPlan.tenant_host,
      name: newIngredient.name,
      quantity: newIngredient.quantity,
      unit: newIngredient.unit,
      ingredient_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setNutritionPlan((prevPlan) => {
      if (!prevPlan) return prevPlan;

      return {
        ...prevPlan,
        days: prevPlan.days.map((day) => ({
          ...day,
          meals: day.meals.map((meal) =>
            meal.id === mealId
              ? addIngredientToMealNested(meal, optimisticIngredient)
              : meal
          ),
        })),
      };
    });

    setAddingIngredientContext(null);
    setNewIngredient({ name: "", quantity: "", unit: "" });

    try {
      const response = await fetch("/api/nutrition/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionId: targetOptionId,
          name: optimisticIngredient.name,
          quantity: optimisticIngredient.quantity,
          unit: optimisticIngredient.unit,
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        setNutritionPlan((prevPlan) => {
          if (!prevPlan) return prevPlan;

          return {
            ...prevPlan,
            days: prevPlan.days.map((day) => ({
              ...day,
              meals: day.meals.map((meal) =>
                meal.id === mealId
                  ? replaceIngredientInMealNested(
                      meal,
                      optimisticIngredient.id,
                      result.data as NutritionIngredient
                    )
                  : meal
              ),
            })),
          };
        });
      } else {
        console.error("Error creating ingredient:", result.error);
        // Fase 4: local rollback of the optimistic add (cheaper than
        // refreshPlan() which would re-fetch the whole plan tree).
        setNutritionPlan((prevPlan) => {
          if (!prevPlan) return prevPlan;

          return {
            ...prevPlan,
            days: prevPlan.days.map((day) => ({
              ...day,
              meals: day.meals.map((meal) =>
                meal.id === mealId
                  ? removeIngredientFromMealNested(
                      meal,
                      optimisticIngredient.id
                    )
                  : meal
              ),
            })),
          };
        });
        alert(
          `Error al guardar ingrediente: ${result.error || "Error desconocido"}`
        );
      }
    } catch (err) {
      console.error("Error saving ingredient:", err);
      // Fase 4: local rollback on network error.
      setNutritionPlan((prevPlan) => {
        if (!prevPlan) return prevPlan;

        return {
          ...prevPlan,
          days: prevPlan.days.map((day) => ({
            ...day,
            meals: day.meals.map((meal) =>
              meal.id === mealId
                ? removeIngredientFromMealNested(meal, optimisticIngredient.id)
                : meal
            ),
          })),
        };
      });
      alert("Error al guardar ingrediente. Por favor intenta de nuevo.");
    }
  };

  const handleCancelNewIngredient = () => {
    setAddingIngredientContext(null);
    setNewIngredient({ name: "", quantity: "", unit: "" });
  };

  const handleAddAlternative = async (mealId: string) => {
    const meal = nutritionPlan?.days
      .flatMap((d) => d.meals)
      .find((m) => m.id === mealId);

    if (!meal || meal.id.startsWith("temp-")) {
      alert("Guarda la comida antes de añadir alternativas.");

      return;
    }

    if (addingAlternativeForMealId === mealId) return;

    const name = nextAlternativeOptionName(meal);

    setAddingAlternativeForMealId(mealId);

    try {
      const response = await fetch("/api/nutrition/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId, name }),
      });
      const result = await response.json();

      if (result.success && result.data?.id) {
        const raw = result.data as Record<string, unknown>;

        setNutritionPlan((prev) =>
          prev ? mapPlanWithNewOption(prev, mealId, raw) : prev
        );
        setAllPlans((prev) =>
          prev.map((p, i) =>
            i === selectedPlanIndex ? mapPlanWithNewOption(p, mealId, raw) : p
          )
        );
        setMealActiveOptionTab((prev) => ({
          ...prev,
          [mealId]: result.data.id as string,
        }));
        // Fase 4: mapPlanWithNewOption above already updated both
        // `nutritionPlan` and `allPlans`; no refresh needed.
      } else {
        alert(
          result.error || "No se pudo crear la alternativa. Intenta de nuevo."
        );
      }
    } catch {
      alert("Error al crear alternativa.");
    } finally {
      setAddingAlternativeForMealId(null);
    }
  };

  const handleEditOptionMacrosClick = (
    opt: NutritionMealOptionWithIngredients
  ) => {
    setEditingOptionName(null);
    const m = optionDisplayMacros(opt);

    setOptionMacrosForm({
      protein: m.protein.toString(),
      carbs: m.carbs.toString(),
      fats: m.fats.toString(),
      calories: m.calories.toString(),
    });
    setEditingOptionMacrosId(opt.id);
  };

  const handleSaveOptionMacros = async (optionId: string) => {
    const payload = {
      protein: parseFloat(optionMacrosForm.protein) || 0,
      carbs: parseFloat(optionMacrosForm.carbs) || 0,
      fats: parseFloat(optionMacrosForm.fats) || 0,
      calories: parseFloat(optionMacrosForm.calories) || 0,
    };

    // Fase 4: optimistic update. Apply the macro change locally and close the
    // editor immediately; revert if the PATCH fails.
    const snapshot = nutritionPlan;

    setNutritionPlan((prevPlan) => {
      if (!prevPlan) return prevPlan;

      return {
        ...prevPlan,
        days: prevPlan.days.map((day) => ({
          ...day,
          meals: day.meals.map((meal) =>
            updateOptionInMealNested(meal, optionId, payload)
          ),
        })),
      };
    });
    setEditingOptionMacrosId(null);

    try {
      const response = await fetch(`/api/nutrition/options/${optionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!result.success) {
        if (snapshot) setNutritionPlan(snapshot);
        alert(result.error || "Error al guardar macros de la opción");
      }
    } catch {
      if (snapshot) setNutritionPlan(snapshot);
      alert("Error al guardar macros de la opción");
    }
  };

  const handleSaveOptionName = async (optionId: string) => {
    const trimmed = editingOptionNameValue.trim();

    if (!trimmed) return;

    // Fase 4: optimistic update. Apply the new name locally and close the
    // editor immediately; revert if the PATCH fails.
    const snapshot = nutritionPlan;

    setNutritionPlan((prevPlan) => {
      if (!prevPlan) return prevPlan;

      return {
        ...prevPlan,
        days: prevPlan.days.map((day) => ({
          ...day,
          meals: day.meals.map((meal) =>
            updateOptionInMealNested(meal, optionId, { name: trimmed })
          ),
        })),
      };
    });
    setEditingOptionName(null);

    try {
      const response = await fetch(`/api/nutrition/options/${optionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const result = await response.json();

      if (!result.success) {
        if (snapshot) setNutritionPlan(snapshot);
        alert(result.error || "Error al guardar el nombre");
      }
    } catch {
      if (snapshot) setNutritionPlan(snapshot);
      alert("Error al guardar el nombre");
    }
  };

  // Item 2.4: open the recipe editor for a given option, pre-filled with its
  // existing values (or empty strings for unset fields).
  const handleOpenOptionRecipe = (
    option: NutritionMealOptionWithIngredients
  ) => {
    setOptionRecipeForm({
      instructions: option.instructions ?? "",
      prep_time_minutes:
        option.prep_time_minutes === null ||
        option.prep_time_minutes === undefined
          ? ""
          : String(option.prep_time_minutes),
      cooking_time_minutes:
        option.cooking_time_minutes === null ||
        option.cooking_time_minutes === undefined
          ? ""
          : String(option.cooking_time_minutes),
      servings:
        option.servings === null || option.servings === undefined
          ? ""
          : String(option.servings),
      recipe_notes: option.recipe_notes ?? "",
    });
    setEditingOptionRecipeId(option.id);
  };

  const handleCloseOptionRecipe = () => {
    setEditingOptionRecipeId(null);
  };

  // Item 2.4: save the recipe fields for the given option, with an optimistic
  // update. Empty strings are coerced to nulls (same contract as the PATCH
  // endpoint's normaliser) so the UI reflects the cleared state immediately.
  const handleSaveOptionRecipe = async (optionId: string) => {
    const parsedPrep = optionRecipeForm.prep_time_minutes.trim();
    const parsedCook = optionRecipeForm.cooking_time_minutes.trim();
    const parsedServings = optionRecipeForm.servings.trim();

    const payload = {
      instructions: optionRecipeForm.instructions.trim() || null,
      prep_time_minutes: parsedPrep === "" ? null : parseInt(parsedPrep, 10),
      cooking_time_minutes: parsedCook === "" ? null : parseInt(parsedCook, 10),
      servings: parsedServings === "" ? null : parseInt(parsedServings, 10),
      recipe_notes: optionRecipeForm.recipe_notes.trim() || null,
    };

    // Guard against NaN from malformed numeric input.
    if (
      (payload.prep_time_minutes !== null &&
        !Number.isFinite(payload.prep_time_minutes)) ||
      (payload.cooking_time_minutes !== null &&
        !Number.isFinite(payload.cooking_time_minutes)) ||
      (payload.servings !== null && !Number.isFinite(payload.servings))
    ) {
      alert(
        "Los tiempos y las porciones deben ser números enteros (o quedar en blanco)."
      );

      return;
    }
    if (payload.servings !== null && payload.servings < 1) {
      alert("Las porciones deben ser al menos 1.");

      return;
    }

    const snapshot = nutritionPlan;

    setNutritionPlan((prevPlan) => {
      if (!prevPlan) return prevPlan;

      return {
        ...prevPlan,
        days: prevPlan.days.map((day) => ({
          ...day,
          meals: day.meals.map((meal) =>
            updateOptionInMealNested(meal, optionId, payload)
          ),
        })),
      };
    });
    setEditingOptionRecipeId(null);

    try {
      const response = await fetch(`/api/nutrition/options/${optionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!result.success) {
        if (snapshot) setNutritionPlan(snapshot);
        alert(result.error || "Error al guardar la receta");
      }
    } catch (err) {
      console.error("[Nutrition] Error saving recipe:", err);
      if (snapshot) setNutritionPlan(snapshot);
      alert("Error al guardar la receta");
    }
  };

  const handleConfirmDeleteOption = async () => {
    if (!optionDeleteConfirm) return;
    setOptionDeleteLoading(true);

    try {
      const response = await fetch(
        `/api/nutrition/options/${optionDeleteConfirm.optionId}`,
        { method: "DELETE" }
      );
      const result = await response.json();

      if (result.success) {
        setMealActiveOptionTab((prev) => {
          const next = { ...prev };
          const mid = optionDeleteConfirm.mealId;

          if (next[mid] === optionDeleteConfirm.optionId) {
            delete next[mid];
          }

          return next;
        });
        setOptionDeleteConfirm(null);
        await refreshPlan();
      } else {
        alert(result.error || "Error al eliminar la opción");
      }
    } catch {
      alert("Error al eliminar la opción");
    } finally {
      setOptionDeleteLoading(false);
    }
  };

  // Item 2.4: Collapsible "Receta" editor for a nutrition option. Renders one
  // of three states depending on whether the option is in edit mode and
  // whether it already has recipe content to show:
  //   - edit mode   → form with instructions / times / servings / notes.
  //   - has content → read-only summary + "Editar" button.
  //   - empty       → "Añadir receta" button only.
  // Used for both single-option meals (primaryOption) and multi-option meals
  // (activeOption) to keep behaviour identical.
  const renderRecipeEditor = (
    option: NutritionMealOptionWithIngredients | undefined
  ) => {
    if (!option) return null;

    if (option.id.startsWith("temp-")) {
      // Temp optimistic options don't exist on the server yet; don't let the
      // trainer write to them until refreshPlan promotes them to real rows.
      return null;
    }

    const isEditing = editingOptionRecipeId === option.id;
    const hasAnyContent = Boolean(
      (option.instructions && option.instructions.trim().length > 0) ||
        option.prep_time_minutes != null ||
        option.cooking_time_minutes != null ||
        option.servings != null ||
        (option.recipe_notes && option.recipe_notes.trim().length > 0)
    );

    return (
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon
              className="text-amber-600 flex-shrink-0"
              icon="solar:chef-hat-linear"
              width={16}
            />
            <span className="text-sm font-semibold text-gray-800 truncate">
              Receta (opcional)
            </span>
          </div>
          {!isEditing && (
            <Button
              className="flex-shrink-0"
              size="sm"
              startContent={
                <Icon
                  icon={
                    hasAnyContent
                      ? "solar:pen-linear"
                      : "solar:add-circle-linear"
                  }
                  width={14}
                />
              }
              variant="flat"
              onPress={() => handleOpenOptionRecipe(option)}
            >
              {hasAnyContent ? "Editar" : "Añadir receta"}
            </Button>
          )}
        </div>

        {isEditing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              label="Instrucciones"
              minRows={4}
              placeholder="Ej: 1) Pica la cebolla. 2) Sofríe a fuego medio..."
              value={optionRecipeForm.instructions}
              onValueChange={(value) =>
                setOptionRecipeForm((prev) => ({
                  ...prev,
                  instructions: value,
                }))
              }
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Input
                label="Preparación (min)"
                min={0}
                placeholder="0"
                size="sm"
                type="number"
                value={optionRecipeForm.prep_time_minutes}
                onValueChange={(value) =>
                  setOptionRecipeForm((prev) => ({
                    ...prev,
                    prep_time_minutes: value,
                  }))
                }
              />
              <Input
                label="Cocción (min)"
                min={0}
                placeholder="0"
                size="sm"
                type="number"
                value={optionRecipeForm.cooking_time_minutes}
                onValueChange={(value) =>
                  setOptionRecipeForm((prev) => ({
                    ...prev,
                    cooking_time_minutes: value,
                  }))
                }
              />
              <Input
                label="Porciones"
                min={1}
                placeholder="1"
                size="sm"
                type="number"
                value={optionRecipeForm.servings}
                onValueChange={(value) =>
                  setOptionRecipeForm((prev) => ({ ...prev, servings: value }))
                }
              />
            </div>
            <Textarea
              label="Nota (opcional)"
              minRows={2}
              placeholder="Ej: Sustituye la mantequilla por aceite de oliva si lo prefieres."
              value={optionRecipeForm.recipe_notes}
              onValueChange={(value) =>
                setOptionRecipeForm((prev) => ({
                  ...prev,
                  recipe_notes: value,
                }))
              }
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="flat"
                onPress={handleCloseOptionRecipe}
              >
                Cancelar
              </Button>
              <Button
                className="bg-black text-white hover:bg-slate-800"
                size="sm"
                onPress={() => handleSaveOptionRecipe(option.id)}
              >
                Guardar
              </Button>
            </div>
          </div>
        ) : hasAnyContent ? (
          <div className="space-y-2 text-sm">
            {(option.prep_time_minutes != null ||
              option.cooking_time_minutes != null ||
              option.servings != null) && (
              <div className="flex flex-wrap gap-3 text-xs text-gray-700">
                {option.prep_time_minutes != null && (
                  <span className="inline-flex items-center gap-1">
                    <Icon
                      className="text-amber-700"
                      icon="solar:clock-circle-linear"
                      width={14}
                    />
                    Preparación: {option.prep_time_minutes} min
                  </span>
                )}
                {option.cooking_time_minutes != null && (
                  <span className="inline-flex items-center gap-1">
                    <Icon
                      className="text-amber-700"
                      icon="solar:fire-linear"
                      width={14}
                    />
                    Cocción: {option.cooking_time_minutes} min
                  </span>
                )}
                {option.servings != null && (
                  <span className="inline-flex items-center gap-1">
                    <Icon
                      className="text-amber-700"
                      icon="solar:users-group-rounded-linear"
                      width={14}
                    />
                    {option.servings} porción
                    {option.servings !== 1 ? "es" : ""}
                  </span>
                )}
              </div>
            )}
            {option.instructions && option.instructions.trim().length > 0 && (
              <p className="whitespace-pre-wrap text-sm text-gray-800">
                {option.instructions}
              </p>
            )}
            {option.recipe_notes && option.recipe_notes.trim().length > 0 && (
              <p className="text-xs italic text-gray-600">
                {option.recipe_notes}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            Sin instrucciones. Puedes añadir pasos, tiempos y notas para esta
            opción.
          </p>
        )}
      </div>
    );
  };

  const renderIngredientRows = (
    meal: NutritionMealWithIngredients,
    option: NutritionMealOptionWithIngredients | undefined
  ) => {
    if (!option) {
      return (
        <div className="text-sm text-gray-500 py-2">
          No hay opción de comida. Actualiza la página.
        </div>
      );
    }

    const ingredients = option.ingredients;
    const isAdding =
      addingIngredientContext?.mealId === meal.id &&
      addingIngredientContext?.optionId === option.id;

    return (
      <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
        <div className="space-y-2">
          {ingredients.map((ingredient) => (
            <div key={ingredient.id}>
              {editingIngredient === ingredient.id ? (
                <div className="flex items-center gap-2 py-2 border-b border-gray-100">
                  <Input
                    className="flex-1"
                    data-field="name"
                    data-ingredient-id={ingredient.id}
                    defaultValue={ingredient.name}
                    placeholder="Ingrediente"
                    size="sm"
                  />
                  <Input
                    className="w-24"
                    data-field="quantity"
                    data-ingredient-id={ingredient.id}
                    defaultValue={ingredient.quantity}
                    placeholder="Cantidad"
                    size="sm"
                  />
                  <Input
                    className="w-24"
                    data-field="unit"
                    data-ingredient-id={ingredient.id}
                    defaultValue={ingredient.unit}
                    placeholder="Unidad"
                    size="sm"
                  />
                  <Button
                    isIconOnly
                    color="success"
                    size="sm"
                    variant="flat"
                    onPress={() =>
                      handleSaveEditIngredient(ingredient.id, ingredient)
                    }
                  >
                    <Icon icon="solar:check-circle-bold" width={18} />
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    onPress={handleCancelEditIngredient}
                  >
                    <Icon icon="solar:close-circle-bold" width={18} />
                  </Button>
                </div>
              ) : (
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                <div
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-white cursor-pointer rounded px-2"
                  onClick={() => handleEditIngredientClick(ingredient.id)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-sm text-gray-900">
                      {ingredient.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">
                        {ingredient.quantity}
                      </span>{" "}
                      {ingredient.unit}
                    </div>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      onPress={() => handleDeleteIngredient(ingredient.id)}
                    >
                      <Icon
                        className="text-gray-400 hover:text-red-600"
                        icon="solar:trash-bin-trash-linear"
                        width={16}
                      />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isAdding ? (
            <div className="flex items-center gap-2 py-2 border-b border-slate-200 bg-slate-50 rounded px-2">
              <Input
                autoFocus
                className="flex-1"
                placeholder="Nombre del ingrediente"
                size="sm"
                value={newIngredient.name}
                onValueChange={(value) =>
                  setNewIngredient({ ...newIngredient, name: value })
                }
              />
              <Input
                className="w-24"
                placeholder="Cantidad"
                size="sm"
                value={newIngredient.quantity}
                onValueChange={(value) =>
                  setNewIngredient({ ...newIngredient, quantity: value })
                }
              />
              <Input
                className="w-24"
                placeholder="Unidad"
                size="sm"
                value={newIngredient.unit}
                onValueChange={(value) =>
                  setNewIngredient({ ...newIngredient, unit: value })
                }
              />
              <Button
                isIconOnly
                color="success"
                size="sm"
                variant="flat"
                onPress={() => handleSaveNewIngredient()}
              >
                <Icon icon="solar:check-circle-bold" width={18} />
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                onPress={handleCancelNewIngredient}
              >
                <Icon icon="solar:close-circle-bold" width={18} />
              </Button>
            </div>
          ) : (
            <Button
              className="w-full mt-2"
              size="sm"
              startContent={<Icon icon="solar:add-circle-linear" width={16} />}
              variant="light"
              onPress={() => handleAddIngredientClick(meal.id, option.id)}
            >
              Añadir Ingrediente
            </Button>
          )}
        </div>
      </div>
    );
  };

  const handleEditIngredientClick = (ingredientId: string) => {
    setEditingIngredient(ingredientId);
  };

  const handleSaveEditIngredient = async (
    ingredientId: string,
    _ingredient: NutritionIngredient
  ) => {
    // Get the updated values from the form fields
    const nameInput = document.querySelector(
      `input[data-ingredient-id="${ingredientId}"][data-field="name"]`
    ) as HTMLInputElement;
    const quantityInput = document.querySelector(
      `input[data-ingredient-id="${ingredientId}"][data-field="quantity"]`
    ) as HTMLInputElement;
    const unitInput = document.querySelector(
      `input[data-ingredient-id="${ingredientId}"][data-field="unit"]`
    ) as HTMLInputElement;

    if (!nameInput || !quantityInput || !unitInput) {
      console.error("Could not find input fields");

      return;
    }

    const changes: Partial<NutritionIngredient> = {
      name: nameInput.value,
      quantity: quantityInput.value,
      unit: unitInput.value,
    };

    // Fase 4: optimistic update. Snapshot the plan before touching it so we
    // can revert if the PATCH fails. The input values are captured above so
    // subsequent renders don't have to read the DOM again.
    const snapshot = nutritionPlan;

    setNutritionPlan((prevPlan) => {
      if (!prevPlan) return prevPlan;

      return {
        ...prevPlan,
        days: prevPlan.days.map((day) => ({
          ...day,
          meals: day.meals.map((meal) =>
            updateIngredientInMealNested(meal, ingredientId, changes)
          ),
        })),
      };
    });

    // Close the editor immediately — the UI shows the updated values without
    // waiting for the network round-trip.
    setEditingIngredient(null);

    try {
      // Item 2.2 (defensive): re-send the current ingredient_order so the row
      // keeps its position on the server side. The PATCH backend only touches
      // fields that are explicitly sent; this is a no-op in the happy path
      // but protects against a future backend change that might reset it.
      const response = await fetch(
        `/api/nutrition/ingredients/${ingredientId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...changes,
            ingredient_order: _ingredient.ingredient_order,
          }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        console.error("Error updating ingredient:", result.error);
        if (snapshot) setNutritionPlan(snapshot);
        alert(
          `Error al guardar ingrediente: ${result.error || "Error desconocido"}`
        );
      }
      // On success the local state already matches the server — no refresh.
    } catch (err) {
      console.error("Error saving ingredient:", err);
      if (snapshot) setNutritionPlan(snapshot);
      alert("Error al guardar ingrediente. Por favor intenta de nuevo.");
    }
  };

  const handleCancelEditIngredient = () => {
    setEditingIngredient(null);
  };

  const handleDeleteIngredient = (ingredientId: string) => {
    let ingredientName = "Ingrediente";

    nutritionPlan?.days.forEach((day) => {
      day.meals.forEach((meal) => {
        const ing = meal.ingredients.find((i) => i.id === ingredientId);

        if (ing) ingredientName = ing.name;
      });
    });
    setDeleteConfirm({
      isOpen: true,
      type: "ingredient",
      id: ingredientId,
      name: ingredientName,
    });
  };

  // Generic delete confirmation handler
  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleteLoading(true);

    try {
      let endpoint = "";

      switch (deleteConfirm.type) {
        case "plan":
          endpoint = `/api/nutrition/plans/${deleteConfirm.id}`;
          break;
        case "day":
          endpoint = `/api/nutrition/days/${deleteConfirm.id}`;
          break;
        case "meal":
          endpoint = `/api/nutrition/meals/${deleteConfirm.id}`;
          break;
        case "ingredient":
          endpoint = `/api/nutrition/ingredients/${deleteConfirm.id}`;
          break;
      }

      // For ingredient, do optimistic removal
      const previousPlan = nutritionPlan ? { ...nutritionPlan } : null;

      if (deleteConfirm.type === "ingredient" && nutritionPlan) {
        setNutritionPlan((prevPlan) => {
          if (!prevPlan) return prevPlan;

          return {
            ...prevPlan,
            days: prevPlan.days.map((day) => ({
              ...day,
              meals: day.meals.map((meal) =>
                removeIngredientFromMealNested(meal, deleteConfirm.id)
              ),
            })),
          };
        });
      }

      const response = await fetch(endpoint, { method: "DELETE" });
      const result = await response.json();

      if (result.success) {
        // For ingredient deletes we already applied the optimistic removal
        // above; for everything else (plan, day, meal) re-fetch the list so
        // both `allPlans` and `nutritionPlan` stay in sync. Using only
        // `setNutritionPlan(null)` on plan-delete left `allPlans` stale and
        // made the UI look empty until the user reloaded the page.
        if (deleteConfirm.type !== "ingredient") {
          await refreshPlan();
        }
      } else {
        if (deleteConfirm.type === "ingredient" && previousPlan) {
          setNutritionPlan(previousPlan);
        }
        alert(`Error al eliminar: ${result.error || "Error desconocido"}`);
      }
    } catch (err) {
      console.error("Error deleting:", err);
      alert("Error al eliminar. Por favor intenta de nuevo.");
    } finally {
      setIsDeleteLoading(false);
      setDeleteConfirm(null);
    }
  };

  // Meal macros handlers
  const handleEditMealMacrosClick = (meal: NutritionMealWithIngredients) => {
    const primary = meal.options?.[0];

    if (primary && meal.options.length === 1) {
      const m = optionDisplayMacros(primary);

      setMacrosForm({
        protein: m.protein.toString(),
        carbs: m.carbs.toString(),
        fats: m.fats.toString(),
        calories: m.calories.toString(),
      });
    } else {
      setMacrosForm({
        protein: meal.protein?.toString() || "0",
        carbs: meal.carbs?.toString() || "0",
        fats: meal.fats?.toString() || "0",
        calories: meal.calories?.toString() || "0",
      });
    }

    setEditingMealMacros(meal.id);
  };

  const handleSaveMealMacros = async (mealId: string) => {
    try {
      const payload = {
        protein: parseFloat(macrosForm.protein) || 0,
        carbs: parseFloat(macrosForm.carbs) || 0,
        fats: parseFloat(macrosForm.fats) || 0,
        calories: parseFloat(macrosForm.calories) || 0,
      };

      console.log("[Nutrition] Saving meal macros:", { mealId, payload });

      const response = await fetch(`/api/nutrition/meals/${mealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      console.log("[Nutrition] Meal macros save response:", result);

      if (result.success) {
        const meal = nutritionPlan?.days
          .flatMap((d) => d.meals)
          .find((m) => m.id === mealId);

        if (meal?.options?.length === 1) {
          const optId = meal.options[0]?.id;

          if (optId) {
            try {
              const optRes = await fetch(`/api/nutrition/options/${optId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              const optJson = await optRes.json();

              if (!optJson.success) {
                console.warn(
                  "[Nutrition] Option macro sync failed:",
                  optJson.error
                );
              }
            } catch (syncErr) {
              console.warn("[Nutrition] Option macro sync error:", syncErr);
            }
          }
        }

        await refreshPlan();
        setEditingMealMacros(null);
      } else {
        console.error("[Nutrition] Error updating meal macros:", result.error);
        alert(
          `Error al guardar macros: ${result.error || "Error desconocido"}`
        );
      }
    } catch (err) {
      console.error("[Nutrition] Error saving meal macros:", err);
      alert("Error al guardar macros. Por favor intenta de nuevo.");
    }
  };

  // Item 2.3: cycle the per-meal calorie visibility through a tri-state:
  //   null (inherit) → true (force show) → false (force hide) → null.
  // Uses optimistic update (same pattern as Fase 4 handlers) so the UI reflects
  // the change immediately; rolls back on error.
  const handleCycleMealShowCalories = async (
    mealId: string,
    current: boolean | null | undefined
  ) => {
    const next: boolean | null =
      current === null || current === undefined
        ? true
        : current === true
          ? false
          : null;

    const snapshot = nutritionPlan;

    setNutritionPlan((prevPlan) => {
      if (!prevPlan) return prevPlan;

      return {
        ...prevPlan,
        days: prevPlan.days.map((day) => ({
          ...day,
          meals: day.meals.map((meal) =>
            meal.id === mealId ? { ...meal, show_calories: next } : meal
          ),
        })),
      };
    });

    try {
      const response = await fetch(`/api/nutrition/meals/${mealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ show_calories: next }),
      });
      const result = await response.json();

      if (!result.success) {
        if (snapshot) setNutritionPlan(snapshot);
        alert(
          `Error al actualizar visibilidad de calorías: ${result.error || "Error desconocido"}`
        );
      }
    } catch (err) {
      console.error("[Nutrition] Error toggling show_calories:", err);
      if (snapshot) setNutritionPlan(snapshot);
      alert("Error al actualizar visibilidad de calorías.");
    }
  };

  // Day macros handlers
  const handleEditDayMacrosClick = (day: any) => {
    setDayMacrosForm({
      protein: day.protein?.toString() || "0",
      carbs: day.carbs?.toString() || "0",
      fats: day.fats?.toString() || "0",
      calories: day.calories?.toString() || "0",
    });
    setEditingDayMacros(day.id);
  };

  const handleSaveDayMacros = async (dayId: string) => {
    const payload = {
      protein: parseFloat(dayMacrosForm.protein) || 0,
      carbs: parseFloat(dayMacrosForm.carbs) || 0,
      fats: parseFloat(dayMacrosForm.fats) || 0,
      calories: parseFloat(dayMacrosForm.calories) || 0,
    };

    // Optimistically update UI immediately
    setNutritionPlan((prevPlan) => {
      if (!prevPlan) return prevPlan;

      return {
        ...prevPlan,
        days: prevPlan.days.map((day) =>
          day.id === dayId ? { ...day, ...payload } : day
        ),
      };
    });

    // Close edit mode immediately
    setEditingDayMacros(null);

    // Make API call in background
    try {
      console.log("[Nutrition] Saving day macros:", { dayId, payload });

      const response = await fetch(`/api/nutrition/days/${dayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      console.log("[Nutrition] Day macros save response:", result);

      if (!result.success) {
        console.error("[Nutrition] Error updating day macros:", result.error);
        // Revert on error
        await refreshPlan();
        alert(
          `Error al guardar macros del día: ${result.error || "Error desconocido"}`
        );
      }
    } catch (err) {
      console.error("[Nutrition] Error saving day macros:", err);
      // Revert on error
      await refreshPlan();
      alert("Error al guardar macros del día. Por favor intenta de nuevo.");
    }
  };

  // Calculate total macros from meals for a day
  const calculateMealTotals = (meals: any[]) => {
    return meals.reduce(
      (totals, meal) => ({
        protein: totals.protein + (meal.protein || 0),
        carbs: totals.carbs + (meal.carbs || 0),
        fats: totals.fats + (meal.fats || 0),
        calories: totals.calories + (meal.calories || 0),
      }),
      { protein: 0, carbs: 0, fats: 0, calories: 0 }
    );
  };

  // Weekdays handlers
  const handleEditWeekdaysClick = (day: any) => {
    setWeekdaysForm(day.weekdays || []);
    setEditingDayWeekdays(day.id);
  };

  const handleToggleWeekday = (dayNum: number) => {
    setWeekdaysForm((prev) => {
      if (prev.includes(dayNum)) {
        return prev.filter((d) => d !== dayNum);
      } else {
        return [...prev, dayNum].sort((a, b) => a - b);
      }
    });
  };

  const handleToggleWeekdayInForm = (dayNum: number) => {
    setDayForm((prev) => {
      const currentWeekdays = prev.weekdays || [];

      if (currentWeekdays.includes(dayNum)) {
        return {
          ...prev,
          weekdays: currentWeekdays.filter((d) => d !== dayNum),
        };
      } else {
        return {
          ...prev,
          weekdays: [...currentWeekdays, dayNum].sort((a, b) => a - b),
        };
      }
    });
  };

  const handleSaveWeekdays = async (dayId: string) => {
    // Optimistically update UI
    setNutritionPlan((prevPlan) => {
      if (!prevPlan) return prevPlan;

      return {
        ...prevPlan,
        days: prevPlan.days.map((day) =>
          day.id === dayId ? { ...day, weekdays: weekdaysForm } : day
        ),
      };
    });

    setEditingDayWeekdays(null);

    // Make API call in background
    try {
      const response = await fetch(`/api/nutrition/days/${dayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekdays: weekdaysForm }),
      });

      const result = await response.json();

      if (!result.success) {
        console.error("[Nutrition] Error updating weekdays:", result.error);
        await refreshPlan();
        alert(
          `Error al guardar días de la semana: ${result.error || "Error desconocido"}`
        );
      }
    } catch (err) {
      console.error("[Nutrition] Error saving weekdays:", err);
      await refreshPlan();
      alert("Error al guardar días de la semana. Por favor intenta de nuevo.");
    }
  };

  const subTabSelector = (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
      <button
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          activeSubTab === "setup"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
        type="button"
        onClick={() => setActiveSubTab("setup")}
      >
        <span className="flex items-center gap-1.5">
          <Icon icon="solar:dish-bold" width={16} />
          Plan Nutricional
        </span>
      </button>
      <button
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          activeSubTab === "progress"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
        type="button"
        onClick={() => setActiveSubTab("progress")}
      >
        <span className="flex items-center gap-1.5">
          <Icon icon="solar:chart-line-duotone" width={16} />
          Progreso
        </span>
      </button>
    </div>
  );

  if (activeSubTab === "progress") {
    return (
      <div>
        {subTabSelector}
        <NutritionProgressView clientId={clientId} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        {subTabSelector}
        <div className="flex justify-center items-center py-20">
          <Spinner color="default" size="lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {subTabSelector}
        <div className="flex flex-col items-center justify-center py-20">
          <Icon
            className="text-red-500 mb-4"
            icon="solar:danger-circle-bold"
            width={48}
          />
          <p className="text-red-600 text-lg">{error}</p>
        </div>
      </div>
    );
  }

  if (!nutritionPlan) {
    return (
      <>
        {subTabSelector}
        <div className="flex flex-col items-center justify-center py-20">
          <Icon
            className="text-gray-300 mb-4"
            icon="solar:dish-linear"
            width={64}
          />
          <p className="text-gray-500 text-lg mb-4">
            No hay plan nutricional para este cliente
          </p>
          <Button
            className="bg-black text-white font-semibold hover:bg-slate-800"
            startContent={<Icon icon="solar:add-circle-bold" width={20} />}
            onPress={handleOpenCreatePlan}
          >
            Crear Plan Nutricional
          </Button>
        </div>

        {/* Plan Details Modal - must be rendered even when no plan exists */}
        <Modal
          classNames={{
            header: "border-b border-gray-200",
            footer: "border-t border-gray-200",
            body: "py-6",
          }}
          isOpen={isPlanModalOpen}
          size="lg"
          onClose={handleClosePlanModal}
        >
          <ModalContent>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="bg-slate-100 p-2 rounded-lg">
                  <Icon
                    className="text-slate-700 text-xl"
                    icon="solar:document-text-bold"
                  />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Crear Plan Nutricional
                  </h3>
                  <p className="text-sm text-gray-500 font-normal">
                    Define los detalles del plan nutricional
                  </p>
                </div>
              </div>
            </ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4">
                {/* Tabs for Blank/Template */}
                <Tabs
                  selectedKey={createPlanTab}
                  onSelectionChange={(key) =>
                    setCreatePlanTab(key as "blank" | "template")
                  }
                >
                  <Tab key="blank" title="Plan en Blanco" />
                  <Tab key="template" title="Desde Plantilla" />
                </Tabs>

                {createPlanTab === "template" && (
                  <div className="mb-4">
                    {isLoadingTemplates ? (
                      <div className="flex justify-center py-8">
                        <Spinner size="sm" />
                      </div>
                    ) : availableTemplates.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <Icon
                          className="mx-auto text-gray-300 mb-2"
                          icon="fluent:food-20-filled"
                          width={48}
                        />
                        <p className="text-sm text-gray-500">
                          No hay plantillas nutricionales disponibles
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {availableTemplates.map((template) => (
                          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                          <div
                            key={template.id}
                            className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                              selectedTemplateId === template.id
                                ? "border-slate-500 bg-slate-50"
                                : "border-gray-200 hover:border-slate-300"
                            }`}
                            onClick={() => {
                              setSelectedTemplateId(template.id);
                              if (!planForm.name) {
                                setPlanForm({
                                  ...planForm,
                                  name: template.name,
                                });
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">
                                  {template.name}
                                </h4>
                                {template.description && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {template.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                                  <span>
                                    <Icon
                                      className="inline mr-1"
                                      icon="solar:calendar-linear"
                                      width={14}
                                    />
                                    {template.dayCount || 0} días
                                  </span>
                                  <span>
                                    <Icon
                                      className="inline mr-1"
                                      icon="fluent:food-20-filled"
                                      width={14}
                                    />
                                    {template.mealCount || 0} comidas
                                  </span>
                                </div>
                              </div>
                              {selectedTemplateId === template.id && (
                                <Icon
                                  className="text-slate-700"
                                  icon="solar:check-circle-bold"
                                  width={24}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <Input
                  isRequired
                  label="Nombre del Plan"
                  placeholder='Ej: "Plan de Definición", "Nutrición Deportiva"'
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:document-text-linear"
                      width={18}
                    />
                  }
                  value={planForm.name}
                  onValueChange={(value) =>
                    setPlanForm({ ...planForm, name: value })
                  }
                />
                <Input
                  isRequired
                  label="Fecha de Inicio"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:calendar-linear"
                      width={18}
                    />
                  }
                  type="date"
                  value={planForm.start_date || ""}
                  onValueChange={(value) =>
                    setPlanForm({ ...planForm, start_date: value })
                  }
                />
                <Textarea
                  label="Notas del Plan (Opcional)"
                  minRows={3}
                  placeholder="Ej: Plan diseñado para aumentar masa muscular..."
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:notes-linear"
                      width={18}
                    />
                  }
                  value={planForm.notes}
                  onValueChange={(value) =>
                    setPlanForm({ ...planForm, notes: value })
                  }
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={handleClosePlanModal}>
                Cancelar
              </Button>
              <Button
                className="bg-black text-white font-semibold hover:bg-slate-800"
                isDisabled={!planForm.name}
                startContent={<Icon icon="solar:diskette-bold" width={18} />}
                onPress={handleSavePlan}
              >
                Crear Plan
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {subTabSelector}
      {/* Plan Selector and New Plan Button */}
      <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-3">
          {allPlans.length > 1 ? (
            <>
              <span className="text-sm font-semibold text-gray-900">
                Plan {selectedPlanIndex + 1} de {allPlans.length}
              </span>
              <div className="flex gap-2">
                <Button
                  isIconOnly
                  isDisabled={selectedPlanIndex === 0}
                  size="sm"
                  variant="flat"
                  onPress={() => handleSwitchPlan(selectedPlanIndex - 1)}
                >
                  <Icon icon="solar:alt-arrow-left-linear" width={20} />
                </Button>
                <Button
                  isIconOnly
                  isDisabled={selectedPlanIndex === allPlans.length - 1}
                  size="sm"
                  variant="flat"
                  onPress={() => handleSwitchPlan(selectedPlanIndex + 1)}
                >
                  <Icon icon="solar:alt-arrow-right-linear" width={20} />
                </Button>
              </div>
            </>
          ) : (
            <span className="text-sm font-semibold text-gray-900">
              Plan Nutricional
            </span>
          )}
        </div>
        <Button
          className="bg-black text-white font-semibold hover:bg-slate-800"
          size="sm"
          startContent={<Icon icon="solar:add-circle-bold" width={18} />}
          onPress={handleOpenCreatePlan}
        >
          Nuevo Plan
        </Button>
      </div>

      {/* Client meal-option selections (current week, America/Chicago) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Icon
              className="shrink-0 text-slate-600"
              icon="solar:checklist-minimalistic-bold"
              width={22}
            />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">
                Preferencias del cliente (esta semana)
              </h3>
              {weeklyOptionRange ? (
                <p className="text-xs text-gray-500">
                  {weeklyOptionRange.from} → {weeklyOptionRange.to}{" "}
                  <span className="text-gray-400">(Chicago)</span>
                </p>
              ) : null}
            </div>
          </div>
          {weeklyOptionSelections.length > 0 ? (
            <Button
              className="shrink-0 font-medium text-gray-700"
              size="sm"
              variant="light"
              onPress={() => setWeeklyPrefsDetailOpen((open) => !open)}
            >
              {weeklyPrefsDetailOpen ? "Ocultar detalle" : "Ver por día"}
            </Button>
          ) : null}
        </div>
        <div className="px-4 py-3">
          {weeklyOptionLoading ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : weeklyOptionSelections.length === 0 ? (
            <p className="text-sm text-gray-500">
              Sin selecciones registradas en este período. El cliente puede
              indicar qué alternativa tomará desde su app (opcional).
            </p>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
                Resumen
              </p>
              <ul className="space-y-1.5 text-sm text-gray-800">
                {weeklyOptionSummaryLines.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-slate-400">·</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              {weeklyPrefsDetailOpen ? (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
                    Por día
                  </p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-gray-600">
                    {weeklyOptionSelections.map((r) => (
                      <li key={r.id}>
                        <span className="font-medium text-gray-700">
                          {r.selected_date}
                        </span>
                        {" — "}
                        {r.meal_label || "Comida"}: {r.option_name || "Opción"}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Plan Container Card - Everything is inside */}
      <Card className="border-2 border-slate-300 shadow-lg">
        <CardBody className="p-0">
          {/* Plan Header */}
          <div className="p-6 bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-300">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Icon
                    className="text-slate-600"
                    icon="solar:document-text-bold"
                    width={28}
                  />
                  <h2 className="text-2xl font-bold text-gray-900">
                    {nutritionPlan.name}
                  </h2>
                </div>
                <div className="flex items-center gap-4 mb-2">
                  <span className="text-sm text-gray-600">
                    <Icon
                      className="inline mr-1"
                      icon="solar:calendar-bold"
                      width={16}
                    />
                    Inicio: {formatDate(nutritionPlan.start_date)}
                  </span>
                  <Badge
                    color={getStatusColor(nutritionPlan.status)}
                    variant="flat"
                  >
                    {getStatusLabel(nutritionPlan.status)}
                  </Badge>
                </div>
                {nutritionPlan.notes && (
                  <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                    <Icon
                      className="inline text-slate-600 mr-2"
                      icon="solar:notes-bold"
                      width={16}
                    />
                    <span className="text-sm text-gray-900">
                      {nutritionPlan.notes}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  startContent={<Icon icon="solar:pen-linear" width={18} />}
                  variant="flat"
                  onPress={handleOpenEditPlan}
                >
                  Editar Plan
                </Button>
                <Dropdown>
                  <DropdownTrigger>
                    <Button isIconOnly size="sm" variant="flat">
                      <Icon icon="solar:menu-dots-bold" width={20} />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="Plan Actions">
                    <DropdownItem
                      key="save-template"
                      startContent={
                        <Icon icon="solar:document-add-bold" width={18} />
                      }
                      onPress={() => setIsSaveTemplateModalOpen(true)}
                    >
                      Guardar como Plantilla
                    </DropdownItem>
                    <DropdownItem
                      key="delete"
                      className="text-danger"
                      color="danger"
                      startContent={
                        <Icon icon="solar:trash-bin-trash-linear" width={18} />
                      }
                      onPress={handleDeletePlan}
                    >
                      Eliminar Plan
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </div>
            </div>
          </div>

          {/* Plan mode + optional PDF */}
          {(() => {
            const effectiveMode: NutritionPlanMode =
              nutritionPlan.plan_mode || "structured";
            const showPdfSection =
              effectiveMode === "pdf" || effectiveMode === "hybrid";
            const showStructuredEditor =
              effectiveMode === "structured" || effectiveMode === "hybrid";

            return (
              <>
                <div className="px-6 py-5 border-b border-slate-200 bg-white">
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-slate-900 tracking-tight">
                      Formato del plan
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Selecciona cómo se mostrará este plan
                    </p>
                  </div>
                  <div
                    aria-label="Formato del plan"
                    className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                    role="radiogroup"
                  >
                    {(
                      [
                        {
                          value: "structured" as const,
                          icon: "solar:list-bold",
                          title: "Plan estructurado",
                          desc: "Días, comidas e ingredientes",
                        },
                        {
                          value: "pdf" as const,
                          icon: "solar:document-text-bold",
                          title: "Solo PDF",
                          desc: "Un documento descargable",
                        },
                        {
                          value: "hybrid" as const,
                          icon: "solar:documents-bold",
                          title: "Ambos",
                          desc: "PDF y plan detallado",
                        },
                      ] as const
                    ).map((opt) => {
                      const selected = effectiveMode === opt.value;

                      return (
                        <button
                          key={opt.value}
                          aria-checked={selected}
                          className={`
                            group relative flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-200
                            outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white
                            ${
                              selected
                                ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                            }
                            ${planModeSaving ? "opacity-55 pointer-events-none cursor-wait" : "cursor-pointer"}
                          `}
                          disabled={planModeSaving}
                          role="radio"
                          type="button"
                          onClick={() => void handlePlanModeChange(opt.value)}
                        >
                          <span
                            className={`
                              flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors
                              ${
                                selected
                                  ? "border-white/20 bg-white/10 text-white"
                                  : "border-slate-200 bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                              }
                            `}
                          >
                            <Icon icon={opt.icon} width={22} />
                          </span>
                          <span className="min-w-0 flex-1 pt-0.5">
                            <span className="block text-sm font-semibold leading-snug">
                              {opt.title}
                            </span>
                            <span
                              className={`mt-0.5 block text-xs leading-relaxed ${selected ? "text-white/75" : "text-slate-500"}`}
                            >
                              {opt.desc}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {planModeSaving && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <Spinner size="sm" />
                      Guardando…
                    </div>
                  )}

                  {showPdfSection && (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-gray-800 mb-3">
                        Documento PDF
                      </h4>
                      <NutritionPlanPdfBlock
                        pdfName={nutritionPlan.pdf_name}
                        pdfUrl={nutritionPlan.pdf_url}
                        planId={nutritionPlan.id}
                        onSuccess={refreshPlan}
                      />
                    </div>
                  )}
                </div>

                {showStructuredEditor && showPdfSection && (
                  <Divider className="my-0" />
                )}

                {/* Days Section - Inside Plan Card */}
                {showStructuredEditor ? (
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          Días del Plan
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {nutritionPlan.days.length} días configurados
                        </p>
                      </div>
                      <Button
                        className="bg-black text-white font-semibold hover:bg-slate-800"
                        startContent={
                          <Icon icon="solar:add-circle-bold" width={20} />
                        }
                        onPress={handleOpenAddDay}
                      >
                        Añadir Día
                      </Button>
                    </div>

                    {/* Days List */}
                    <div className="space-y-3">
                      {nutritionPlan.days.map((day) => (
                        <details key={day.id} className="group">
                          <summary className="flex items-center justify-between cursor-pointer list-none p-4 bg-white border border-gray-200 rounded-lg hover:border-slate-300 transition-colors">
                            <div className="flex items-center gap-4 flex-1">
                              <div className="bg-slate-50 p-2 rounded-lg">
                                <Icon
                                  className="text-slate-600"
                                  icon="solar:calendar-bold"
                                  width={24}
                                />
                              </div>
                              <div className="flex-1">
                                {editingDayName === day.id ? (
                                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                                  <div
                                    className="flex items-center gap-2"
                                    onClick={(e) => e.preventDefault()}
                                  >
                                    {}
                                    <Input
                                      autoFocus
                                      className="max-w-xs"
                                      size="sm"
                                      value={editingDayNameValue}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter")
                                          handleSaveDayName(day.id);
                                        if (e.key === "Escape")
                                          setEditingDayName(null);
                                      }}
                                      onValueChange={setEditingDayNameValue}
                                    />
                                    <Button
                                      isIconOnly
                                      color="success"
                                      size="sm"
                                      variant="flat"
                                      onPress={() => handleSaveDayName(day.id)}
                                    >
                                      <Icon
                                        icon="solar:check-circle-bold"
                                        width={18}
                                      />
                                    </Button>
                                    <Button
                                      isIconOnly
                                      size="sm"
                                      variant="flat"
                                      onPress={() => setEditingDayName(null)}
                                    >
                                      <Icon
                                        icon="solar:close-circle-bold"
                                        width={18}
                                      />
                                    </Button>
                                  </div>
                                ) : (
                                  <h3 className="text-xl font-bold text-gray-900">
                                    {day.day_label}
                                  </h3>
                                )}
                                <div className="flex items-center gap-3 mt-1">
                                  <p className="text-sm text-gray-600">
                                    {day.meals.length} comidas
                                  </p>
                                  {day.weekdays && day.weekdays.length > 0 && (
                                    <div className="flex items-center gap-1">
                                      <Icon
                                        className="text-slate-500"
                                        icon="solar:calendar-bold"
                                        width={14}
                                      />
                                      <span className="text-xs text-slate-600 font-medium">
                                        {formatWeekdays(day.weekdays)}
                                      </span>
                                    </div>
                                  )}
                                  {(!day.weekdays ||
                                    day.weekdays.length === 0) && (
                                    <span className="text-xs text-orange-600 font-medium">
                                      Sin días asignados
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  className="bg-black text-white font-semibold hover:bg-slate-800"
                                  size="sm"
                                  startContent={
                                    <Icon
                                      icon="solar:add-circle-bold"
                                      width={16}
                                    />
                                  }
                                  onPress={(e: any) => {
                                    e?.preventDefault?.();
                                    handleOpenAddMeal(day.id);
                                  }}
                                >
                                  Añadir Comida
                                </Button>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="flat"
                                  onPress={(e: any) => {
                                    e?.preventDefault?.();
                                    handleEditDay(day.id);
                                  }}
                                >
                                  <Icon
                                    className="text-gray-600"
                                    icon="solar:pen-linear"
                                    width={18}
                                  />
                                </Button>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="flat"
                                  onPress={(e: any) => {
                                    e?.preventDefault?.();
                                    handleDeleteDay(day.id);
                                  }}
                                >
                                  <Icon
                                    className="text-gray-600"
                                    icon="solar:trash-bin-trash-linear"
                                    width={18}
                                  />
                                </Button>
                                <Icon
                                  className="text-gray-400 group-open:rotate-180 transition-transform"
                                  icon="solar:alt-arrow-down-linear"
                                  width={20}
                                />
                              </div>
                            </div>
                          </summary>

                          {/* Weekdays Assignment Section */}
                          <div className="mt-2 p-4 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg border-2 border-slate-200">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Icon
                                  className="text-slate-600"
                                  icon="solar:calendar-bold"
                                  width={20}
                                />
                                <h4 className="font-bold text-gray-900">
                                  Días de la Semana
                                </h4>
                              </div>
                              <Button
                                size="sm"
                                startContent={
                                  <Icon icon="solar:pen-linear" width={16} />
                                }
                                variant="flat"
                                onPress={() => handleEditWeekdaysClick(day)}
                              >
                                Editar Días
                              </Button>
                            </div>

                            {editingDayWeekdays === day.id ? (
                              <div className="p-3 bg-white rounded-lg border border-slate-200">
                                <p className="text-xs text-gray-600 mb-3">
                                  Selecciona los días de la semana en que este
                                  plan nutricional aplica:
                                </p>
                                <div className="grid grid-cols-7 gap-2 mb-3">
                                  {[0, 1, 2, 3, 4, 5, 6].map((dayNum) => (
                                    <button
                                      key={dayNum}
                                      className={`p-3 rounded-lg border-2 transition-all ${
                                        weekdaysForm.includes(dayNum)
                                          ? "bg-black border-black text-white"
                                          : "bg-white border-gray-200 text-gray-700 hover:border-slate-300"
                                      }`}
                                      onClick={() =>
                                        handleToggleWeekday(dayNum)
                                      }
                                    >
                                      <div className="text-xs font-bold">
                                        {getWeekdayName(dayNum, true)}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    className="bg-black text-white hover:bg-slate-800"
                                    size="sm"
                                    onPress={() => handleSaveWeekdays(day.id)}
                                  >
                                    Guardar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="flat"
                                    onPress={() => setEditingDayWeekdays(null)}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                {day.weekdays && day.weekdays.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {day.weekdays
                                      .sort((a, b) => a - b)
                                      .map((dayNum) => (
                                        <div
                                          key={dayNum}
                                          className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg font-medium text-sm"
                                        >
                                          {getWeekdayName(dayNum)}
                                        </div>
                                      ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-4 bg-orange-50 rounded-lg border border-orange-200">
                                    <Icon
                                      className="text-orange-400 mx-auto mb-2"
                                      icon="solar:calendar-linear"
                                      width={32}
                                    />
                                    <p className="text-sm text-orange-600 font-medium">
                                      No hay días asignados. Haz clic en
                                      &quot;Editar Días&quot; para asignar.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Day-level Macros Section */}
                          <div className="mt-2 p-4 bg-gradient-to-r from-purple-50 to-slate-50 rounded-lg border-2 border-purple-200">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Icon
                                  className="text-purple-600"
                                  icon="solar:chart-2-bold"
                                  width={20}
                                />
                                <h4 className="font-bold text-gray-900">
                                  Macros del Día
                                </h4>
                              </div>
                              <Button
                                size="sm"
                                startContent={
                                  <Icon icon="solar:pen-linear" width={16} />
                                }
                                variant="flat"
                                onPress={() => handleEditDayMacrosClick(day)}
                              >
                                Editar Macros del Día
                              </Button>
                            </div>

                            {editingDayMacros === day.id ? (
                              <div className="p-3 bg-white rounded-lg border border-purple-200">
                                <div className="grid grid-cols-4 gap-2 mb-2">
                                  <Input
                                    label="Proteína (g)"
                                    size="sm"
                                    type="number"
                                    value={dayMacrosForm.protein}
                                    onValueChange={(value) =>
                                      setDayMacrosForm({
                                        ...dayMacrosForm,
                                        protein: value,
                                      })
                                    }
                                  />
                                  <Input
                                    label="Carbohidratos (g)"
                                    size="sm"
                                    type="number"
                                    value={dayMacrosForm.carbs}
                                    onValueChange={(value) =>
                                      setDayMacrosForm({
                                        ...dayMacrosForm,
                                        carbs: value,
                                      })
                                    }
                                  />
                                  <Input
                                    label="Grasas (g)"
                                    size="sm"
                                    type="number"
                                    value={dayMacrosForm.fats}
                                    onValueChange={(value) =>
                                      setDayMacrosForm({
                                        ...dayMacrosForm,
                                        fats: value,
                                      })
                                    }
                                  />
                                  <Input
                                    label="Calorías"
                                    size="sm"
                                    type="number"
                                    value={dayMacrosForm.calories}
                                    onValueChange={(value) =>
                                      setDayMacrosForm({
                                        ...dayMacrosForm,
                                        calories: value,
                                      })
                                    }
                                  />
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    className="bg-black text-white hover:bg-slate-800"
                                    size="sm"
                                    onPress={() => handleSaveDayMacros(day.id)}
                                  >
                                    Guardar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="flat"
                                    onPress={() => setEditingDayMacros(null)}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                {(() => {
                                  // Smart display: show manual values if set, otherwise calculate from meals
                                  const hasManualMacros =
                                    day.protein > 0 ||
                                    day.carbs > 0 ||
                                    day.fats > 0 ||
                                    day.calories > 0;
                                  const mealTotals = calculateMealTotals(
                                    day.meals
                                  );
                                  const displayValues = hasManualMacros
                                    ? {
                                        protein: day.protein || 0,
                                        carbs: day.carbs || 0,
                                        fats: day.fats || 0,
                                        calories: day.calories || 0,
                                      }
                                    : mealTotals;

                                  return (
                                    <div className="flex items-center gap-3">
                                      <div className="bg-purple-100 px-3 py-2 rounded-lg">
                                        <span className="text-xs text-purple-700 font-medium">
                                          Proteína:
                                        </span>
                                        <span className="text-base font-bold text-purple-900 ml-1">
                                          {displayValues.protein.toFixed(1)}g
                                        </span>
                                      </div>
                                      <div className="bg-green-100 px-3 py-2 rounded-lg">
                                        <span className="text-xs text-green-700 font-medium">
                                          Carbohidratos:
                                        </span>
                                        <span className="text-base font-bold text-green-900 ml-1">
                                          {displayValues.carbs.toFixed(1)}g
                                        </span>
                                      </div>
                                      <div className="bg-yellow-100 px-3 py-2 rounded-lg">
                                        <span className="text-xs text-yellow-700 font-medium">
                                          Grasas:
                                        </span>
                                        <span className="text-base font-bold text-yellow-900 ml-1">
                                          {displayValues.fats.toFixed(1)}g
                                        </span>
                                      </div>
                                      <div className="bg-red-100 px-3 py-2 rounded-lg">
                                        <span className="text-xs text-red-700 font-medium">
                                          Calorías:
                                        </span>
                                        <span className="text-base font-bold text-red-900 ml-1">
                                          {displayValues.calories.toFixed(0)}{" "}
                                          kcal
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>

                          {/* Meals - Collapsed Content */}
                          <div className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="space-y-3">
                              {day.meals.length === 0 ? (
                                <div className="text-center py-8">
                                  <Icon
                                    className="text-gray-300 mx-auto mb-2"
                                    icon="solar:dish-linear"
                                    width={48}
                                  />
                                  <p className="text-sm text-gray-500">
                                    No hay comidas en este día
                                  </p>
                                  <Button
                                    className="mt-3 bg-black text-white font-semibold hover:bg-slate-800"
                                    size="sm"
                                    startContent={
                                      <Icon
                                        icon="solar:add-circle-bold"
                                        width={16}
                                      />
                                    }
                                    onPress={() => handleOpenAddMeal(day.id)}
                                  >
                                    Añadir Primera Comida
                                  </Button>
                                </div>
                              ) : (
                                <DndContext
                                  collisionDetection={closestCenter}
                                  sensors={mealDndSensors}
                                  onDragEnd={(event) =>
                                    handleMealDragEnd(day.id, event)
                                  }
                                >
                                  <SortableContext
                                    items={day.meals.map((m) => m.id)}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    {day.meals.map((meal) => (
                                      <SortableMealItem
                                        key={meal.id}
                                        id={meal.id}
                                      >
                                        {({ attributes, listeners }) => {
                                          const multiMeal =
                                            isMultiOptionMeal(meal);
                                          const macroRanges = multiMeal
                                            ? mealOptionMacroRanges(meal)
                                            : null;
                                          const primaryOption = meal.options[0];
                                          const activeOptId =
                                            mealActiveOptionTab[meal.id] ??
                                            primaryOption?.id ??
                                            "";
                                          const activeOption =
                                            meal.options.find(
                                              (o) => o.id === activeOptId
                                            ) ?? primaryOption;
                                          const singleMacros =
                                            !multiMeal && primaryOption
                                              ? optionDisplayMacros(
                                                  primaryOption
                                                )
                                              : null;

                                          return (
                                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                              <div className="flex gap-3 items-start">
                                                {!multiMeal &&
                                                  (primaryOption ? (
                                                    <OptionImageTrainerField
                                                      key={primaryOption.id}
                                                      disabled={
                                                        meal.id.startsWith(
                                                          "temp-"
                                                        ) ||
                                                        primaryOption.id.startsWith(
                                                          "temp-"
                                                        )
                                                      }
                                                      imageUrl={
                                                        primaryOption.image_url
                                                      }
                                                      optionId={
                                                        primaryOption.id
                                                      }
                                                      onAfterChange={
                                                        refreshPlan
                                                      }
                                                    />
                                                  ) : (
                                                    <MealImageTrainerField
                                                      disabled={meal.id.startsWith(
                                                        "temp-"
                                                      )}
                                                      imageUrl={meal.image_url}
                                                      mealId={meal.id}
                                                      onAfterChange={
                                                        refreshPlan
                                                      }
                                                    />
                                                  ))}
                                                <div className="flex-1 min-w-0">
                                                  {/* Meal Header */}
                                                  <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                      <button
                                                        className="cursor-grab active:cursor-grabbing touch-none text-gray-400 hover:text-gray-600 p-0.5 -ml-1 flex-shrink-0"
                                                        type="button"
                                                        {...attributes}
                                                        {...listeners}
                                                      >
                                                        <Icon
                                                          icon="solar:hamburger-menu-linear"
                                                          width={18}
                                                        />
                                                      </button>
                                                      <button
                                                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                                        type="button"
                                                        onClick={() =>
                                                          toggleMealCollapse(
                                                            meal.id
                                                          )
                                                        }
                                                      >
                                                        <Icon
                                                          className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${expandedMeals.has(meal.id) ? "rotate-90" : ""}`}
                                                          icon="solar:alt-arrow-right-bold"
                                                          width={16}
                                                        />
                                                        <Icon
                                                          className="text-slate-600 flex-shrink-0"
                                                          icon="solar:dish-bold"
                                                          width={20}
                                                        />
                                                        {editingMealName ===
                                                        meal.id ? (
                                                          <div
                                                            className="flex items-center gap-2 flex-1"
                                                            onClick={(e) =>
                                                              e.stopPropagation()
                                                            }
                                                          >
                                                            {}
                                                            <Input
                                                              autoFocus
                                                              className="max-w-xs"
                                                              size="sm"
                                                              value={
                                                                editingMealNameValue
                                                              }
                                                              onKeyDown={(
                                                                e
                                                              ) => {
                                                                if (
                                                                  e.key ===
                                                                  "Enter"
                                                                )
                                                                  handleSaveMealName(
                                                                    meal.id
                                                                  );
                                                                if (
                                                                  e.key ===
                                                                  "Escape"
                                                                )
                                                                  setEditingMealName(
                                                                    null
                                                                  );
                                                              }}
                                                              onValueChange={
                                                                setEditingMealNameValue
                                                              }
                                                            />
                                                            <Button
                                                              isIconOnly
                                                              color="success"
                                                              size="sm"
                                                              variant="flat"
                                                              onPress={() =>
                                                                handleSaveMealName(
                                                                  meal.id
                                                                )
                                                              }
                                                            >
                                                              <Icon
                                                                icon="solar:check-circle-bold"
                                                                width={18}
                                                              />
                                                            </Button>
                                                            <Button
                                                              isIconOnly
                                                              size="sm"
                                                              variant="flat"
                                                              onPress={() =>
                                                                setEditingMealName(
                                                                  null
                                                                )
                                                              }
                                                            >
                                                              <Icon
                                                                icon="solar:close-circle-bold"
                                                                width={18}
                                                              />
                                                            </Button>
                                                          </div>
                                                        ) : (
                                                          <h4 className="font-bold text-gray-900 truncate">
                                                            {meal.label}
                                                          </h4>
                                                        )}
                                                      </button>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                      {!expandedMeals.has(
                                                        meal.id
                                                      ) && (
                                                        <span className="text-xs text-gray-400 hidden sm:inline">
                                                          {macroRanges ? (
                                                            <>
                                                              {formatMacroRange(
                                                                macroRanges.protein,
                                                                0,
                                                                "P"
                                                              )}{" "}
                                                              ·{" "}
                                                              {formatMacroRange(
                                                                macroRanges.carbs,
                                                                0,
                                                                "C"
                                                              )}{" "}
                                                              ·{" "}
                                                              {formatMacroRange(
                                                                macroRanges.fats,
                                                                0,
                                                                "G"
                                                              )}{" "}
                                                              ·{" "}
                                                              {formatMacroRange(
                                                                macroRanges.calories,
                                                                0,
                                                                " kcal"
                                                              )}
                                                            </>
                                                          ) : singleMacros ? (
                                                            <>
                                                              {Math.round(
                                                                singleMacros.protein
                                                              )}
                                                              P ·{" "}
                                                              {Math.round(
                                                                singleMacros.carbs
                                                              )}
                                                              C ·{" "}
                                                              {Math.round(
                                                                singleMacros.fats
                                                              )}
                                                              G ·{" "}
                                                              {Math.round(
                                                                singleMacros.calories
                                                              )}{" "}
                                                              kcal
                                                            </>
                                                          ) : (
                                                            <>
                                                              {meal.protein ||
                                                                0}
                                                              P ·{" "}
                                                              {meal.carbs || 0}C
                                                              · {meal.fats || 0}
                                                              G ·{" "}
                                                              {meal.calories ||
                                                                0}{" "}
                                                              kcal
                                                            </>
                                                          )}
                                                        </span>
                                                      )}
                                                      <Button
                                                        isIconOnly
                                                        size="sm"
                                                        variant="flat"
                                                        onPress={() =>
                                                          handleEditMeal(
                                                            meal.id
                                                          )
                                                        }
                                                      >
                                                        <Icon
                                                          className="text-gray-600"
                                                          icon="solar:pen-linear"
                                                          width={16}
                                                        />
                                                      </Button>
                                                      <Button
                                                        isIconOnly
                                                        size="sm"
                                                        variant="flat"
                                                        onPress={() =>
                                                          handleDeleteMeal(
                                                            meal.id
                                                          )
                                                        }
                                                      >
                                                        <Icon
                                                          className="text-gray-600"
                                                          icon="solar:trash-bin-trash-linear"
                                                          width={16}
                                                        />
                                                      </Button>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>

                                              {/* Collapsible meal body */}
                                              {expandedMeals.has(meal.id) && (
                                                <div className="mt-3">
                                                  {/* Item 2.3: per-meal calorie visibility tri-state toggle. */}
                                                  {(() => {
                                                    const planShowsCalories =
                                                      nutritionPlan?.show_calories !==
                                                      false;
                                                    const current =
                                                      meal.show_calories;
                                                    const effective =
                                                      current === null ||
                                                      current === undefined
                                                        ? planShowsCalories
                                                        : current;
                                                    const label =
                                                      current === null ||
                                                      current === undefined
                                                        ? `Heredar del plan (${planShowsCalories ? "mostrar" : "ocultar"})`
                                                        : current === true
                                                          ? "Forzar mostrar"
                                                          : "Forzar ocultar";
                                                    const iconName = effective
                                                      ? "solar:eye-linear"
                                                      : "solar:eye-closed-linear";

                                                    return (
                                                      <div className="flex items-center justify-between gap-2 mb-3 p-2 rounded-lg bg-gray-50 border border-gray-200">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                          <Icon
                                                            className="text-gray-500 flex-shrink-0"
                                                            icon={iconName}
                                                            width={16}
                                                          />
                                                          <span className="text-xs text-gray-700 truncate">
                                                            Calorías al cliente:{" "}
                                                            <span className="font-semibold">
                                                              {label}
                                                            </span>
                                                          </span>
                                                        </div>
                                                        <Button
                                                          className="flex-shrink-0"
                                                          size="sm"
                                                          variant="flat"
                                                          onPress={() =>
                                                            handleCycleMealShowCalories(
                                                              meal.id,
                                                              current
                                                            )
                                                          }
                                                        >
                                                          Cambiar
                                                        </Button>
                                                      </div>
                                                    );
                                                  })()}
                                                  {multiMeal && macroRanges && (
                                                    <p className="text-xs text-gray-500 mb-3">
                                                      Rango entre opciones:
                                                      Calorías{" "}
                                                      {formatMacroRange(
                                                        macroRanges.calories,
                                                        0,
                                                        " kcal"
                                                      )}{" "}
                                                      · P{" "}
                                                      {formatMacroRange(
                                                        macroRanges.protein,
                                                        1,
                                                        "g"
                                                      )}{" "}
                                                      · C{" "}
                                                      {formatMacroRange(
                                                        macroRanges.carbs,
                                                        1,
                                                        "g"
                                                      )}{" "}
                                                      · G{" "}
                                                      {formatMacroRange(
                                                        macroRanges.fats,
                                                        1,
                                                        "g"
                                                      )}
                                                    </p>
                                                  )}

                                                  {!multiMeal ? (
                                                    <>
                                                      {editingMealMacros ===
                                                      meal.id ? (
                                                        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                          <div className="grid grid-cols-4 gap-2 mb-2">
                                                            <Input
                                                              label="Proteína (g)"
                                                              size="sm"
                                                              type="number"
                                                              value={
                                                                macrosForm.protein
                                                              }
                                                              onValueChange={(
                                                                value
                                                              ) =>
                                                                setMacrosForm({
                                                                  ...macrosForm,
                                                                  protein:
                                                                    value,
                                                                })
                                                              }
                                                            />
                                                            <Input
                                                              label="Carbohidratos (g)"
                                                              size="sm"
                                                              type="number"
                                                              value={
                                                                macrosForm.carbs
                                                              }
                                                              onValueChange={(
                                                                value
                                                              ) =>
                                                                setMacrosForm({
                                                                  ...macrosForm,
                                                                  carbs: value,
                                                                })
                                                              }
                                                            />
                                                            <Input
                                                              label="Grasas (g)"
                                                              size="sm"
                                                              type="number"
                                                              value={
                                                                macrosForm.fats
                                                              }
                                                              onValueChange={(
                                                                value
                                                              ) =>
                                                                setMacrosForm({
                                                                  ...macrosForm,
                                                                  fats: value,
                                                                })
                                                              }
                                                            />
                                                            <Input
                                                              label="Calorías"
                                                              size="sm"
                                                              type="number"
                                                              value={
                                                                macrosForm.calories
                                                              }
                                                              onValueChange={(
                                                                value
                                                              ) =>
                                                                setMacrosForm({
                                                                  ...macrosForm,
                                                                  calories:
                                                                    value,
                                                                })
                                                              }
                                                            />
                                                          </div>
                                                          <div className="flex gap-2 justify-end">
                                                            <Button
                                                              className="bg-black text-white hover:bg-slate-800"
                                                              size="sm"
                                                              onPress={() =>
                                                                handleSaveMealMacros(
                                                                  meal.id
                                                                )
                                                              }
                                                            >
                                                              Guardar
                                                            </Button>
                                                            <Button
                                                              size="sm"
                                                              variant="flat"
                                                              onPress={() =>
                                                                setEditingMealMacros(
                                                                  null
                                                                )
                                                              }
                                                            >
                                                              Cancelar
                                                            </Button>
                                                          </div>
                                                        </div>
                                                      ) : (
                                                        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                                                        <div
                                                          className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                                                          onClick={() =>
                                                            handleEditMealMacrosClick(
                                                              meal
                                                            )
                                                          }
                                                        >
                                                          <div className="bg-slate-50 px-3 py-1.5 rounded-lg">
                                                            <span className="text-xs text-gray-600">
                                                              Proteína:
                                                            </span>
                                                            <span className="text-sm font-bold text-gray-900 ml-1">
                                                              {(singleMacros
                                                                ? singleMacros.protein
                                                                : meal.protein ||
                                                                  0
                                                              ).toFixed(1)}
                                                              g
                                                            </span>
                                                          </div>
                                                          <div className="bg-green-50 px-3 py-1.5 rounded-lg">
                                                            <span className="text-xs text-gray-600">
                                                              Carbohidratos:
                                                            </span>
                                                            <span className="text-sm font-bold text-gray-900 ml-1">
                                                              {(singleMacros
                                                                ? singleMacros.carbs
                                                                : meal.carbs ||
                                                                  0
                                                              ).toFixed(1)}
                                                              g
                                                            </span>
                                                          </div>
                                                          <div className="bg-yellow-50 px-3 py-1.5 rounded-lg">
                                                            <span className="text-xs text-gray-600">
                                                              Grasas:
                                                            </span>
                                                            <span className="text-sm font-bold text-gray-900 ml-1">
                                                              {(singleMacros
                                                                ? singleMacros.fats
                                                                : meal.fats || 0
                                                              ).toFixed(1)}
                                                              g
                                                            </span>
                                                          </div>
                                                          <div className="bg-red-50 px-3 py-1.5 rounded-lg">
                                                            <span className="text-xs text-gray-600">
                                                              Calorías:
                                                            </span>
                                                            <span className="text-sm font-bold text-gray-900 ml-1">
                                                              {Math.round(
                                                                singleMacros
                                                                  ? singleMacros.calories
                                                                  : meal.calories ||
                                                                      0
                                                              )}{" "}
                                                              kcal
                                                            </span>
                                                          </div>
                                                          <Icon
                                                            className="text-gray-400 ml-auto"
                                                            icon="solar:pen-linear"
                                                            width={16}
                                                          />
                                                        </div>
                                                      )}
                                                      {renderIngredientRows(
                                                        meal,
                                                        primaryOption
                                                      )}
                                                      {renderRecipeEditor(
                                                        primaryOption
                                                      )}
                                                      {!meal.id.startsWith(
                                                        "temp-"
                                                      ) && (
                                                        <div className="flex justify-end">
                                                          <Button
                                                            className="mt-1 border-gray-300 font-medium text-gray-800"
                                                            isDisabled={
                                                              addingAlternativeForMealId ===
                                                              meal.id
                                                            }
                                                            isLoading={
                                                              addingAlternativeForMealId ===
                                                              meal.id
                                                            }
                                                            size="sm"
                                                            startContent={
                                                              <Icon
                                                                icon="solar:add-circle-bold"
                                                                width={16}
                                                              />
                                                            }
                                                            variant="bordered"
                                                            onPress={() =>
                                                              handleAddAlternative(
                                                                meal.id
                                                              )
                                                            }
                                                          >
                                                            Agregar alternativa
                                                          </Button>
                                                        </div>
                                                      )}
                                                    </>
                                                  ) : (
                                                    <>
                                                      <div className="mb-4 rounded-xl border border-gray-200/90 bg-gradient-to-b from-slate-50/80 to-white p-4 shadow-sm ring-1 ring-black/[0.03]">
                                                        <div className="flex flex-col gap-5">
                                                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                                                            <div className="min-w-0 space-y-1">
                                                              <p className="text-sm font-semibold tracking-tight text-gray-900">
                                                                Alternativas
                                                              </p>
                                                              <p className="text-xs leading-relaxed text-gray-500">
                                                                Elige la
                                                                variante que
                                                                quieres editar.
                                                              </p>
                                                            </div>
                                                            {!meal.id.startsWith(
                                                              "temp-"
                                                            ) && (
                                                              <Button
                                                                className="w-full shrink-0 border-gray-300 font-medium text-gray-800 sm:w-auto"
                                                                isDisabled={
                                                                  addingAlternativeForMealId ===
                                                                  meal.id
                                                                }
                                                                isLoading={
                                                                  addingAlternativeForMealId ===
                                                                  meal.id
                                                                }
                                                                size="sm"
                                                                startContent={
                                                                  <Icon
                                                                    icon="solar:add-circle-bold"
                                                                    width={16}
                                                                  />
                                                                }
                                                                variant="bordered"
                                                                onPress={() =>
                                                                  handleAddAlternative(
                                                                    meal.id
                                                                  )
                                                                }
                                                              >
                                                                Agregar
                                                                alternativa
                                                              </Button>
                                                            )}
                                                          </div>
                                                          <div className="min-w-0">
                                                            <Dropdown
                                                              classNames={{
                                                                content:
                                                                  "min-w-[min(100vw-2rem,24rem)] overflow-hidden rounded-xl border border-gray-200 p-0 shadow-lg",
                                                              }}
                                                              placement="bottom-start"
                                                            >
                                                              <DropdownTrigger className="h-auto w-full min-w-0">
                                                                <Button
                                                                  className="h-12 w-full min-h-12 justify-between rounded-lg border-gray-200/90 bg-white px-4 font-medium text-gray-900 shadow-sm ring-1 ring-gray-900/[0.04] data-[hover=true]:border-gray-300 data-[hover=true]:bg-gray-50/80 data-[pressed=true]:bg-gray-50"
                                                                  endContent={
                                                                    <Icon
                                                                      className="shrink-0 text-gray-400"
                                                                      icon="solar:alt-arrow-down-linear"
                                                                      width={20}
                                                                    />
                                                                  }
                                                                  variant="bordered"
                                                                >
                                                                  <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                                                                    <span
                                                                      aria-hidden
                                                                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black text-xs font-bold text-white shadow-sm"
                                                                    >
                                                                      {String.fromCharCode(
                                                                        65 +
                                                                          Math.max(
                                                                            0,
                                                                            meal.options.findIndex(
                                                                              (
                                                                                o
                                                                              ) =>
                                                                                o.id ===
                                                                                activeOptId
                                                                            )
                                                                          )
                                                                      )}
                                                                    </span>
                                                                    <span className="truncate text-[15px]">
                                                                      {activeOption?.name ??
                                                                        "—"}
                                                                    </span>
                                                                  </div>
                                                                </Button>
                                                              </DropdownTrigger>
                                                              <DropdownMenu
                                                                aria-label="Elegir alternativa de la comida"
                                                                classNames={{
                                                                  base: "p-0",
                                                                  list: "gap-0.5 p-2",
                                                                }}
                                                                itemClasses={{
                                                                  base: "rounded-lg px-2 py-2 data-[hover=true]:bg-gray-100",
                                                                }}
                                                              >
                                                                {meal.options.map(
                                                                  (
                                                                    opt,
                                                                    idx
                                                                  ) => {
                                                                    const selected =
                                                                      opt.id ===
                                                                      activeOptId;
                                                                    const m =
                                                                      optionDisplayMacros(
                                                                        opt
                                                                      );

                                                                    return (
                                                                      <DropdownItem
                                                                        key={
                                                                          opt.id
                                                                        }
                                                                        className={
                                                                          selected
                                                                            ? "bg-gray-100"
                                                                            : ""
                                                                        }
                                                                        textValue={
                                                                          opt.name
                                                                        }
                                                                        onPress={() =>
                                                                          setMealActiveOptionTab(
                                                                            (
                                                                              p
                                                                            ) => ({
                                                                              ...p,
                                                                              [meal.id]:
                                                                                opt.id,
                                                                            })
                                                                          )
                                                                        }
                                                                      >
                                                                        <div className="flex w-full items-center gap-3 py-0.5">
                                                                          <span
                                                                            aria-hidden
                                                                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                                                                              selected
                                                                                ? "bg-black text-white"
                                                                                : "bg-gray-100 text-gray-700"
                                                                            }`}
                                                                          >
                                                                            {String.fromCharCode(
                                                                              65 +
                                                                                idx
                                                                            )}
                                                                          </span>
                                                                          <div className="min-w-0 flex-1">
                                                                            <p
                                                                              className={`truncate text-sm font-semibold ${
                                                                                selected
                                                                                  ? "text-black"
                                                                                  : "text-gray-800"
                                                                              }`}
                                                                            >
                                                                              {
                                                                                opt.name
                                                                              }
                                                                            </p>
                                                                            <p className="text-xs text-gray-500">
                                                                              {m.calories.toFixed(
                                                                                0
                                                                              )}{" "}
                                                                              kcal
                                                                              ·
                                                                              P{" "}
                                                                              {m.protein.toFixed(
                                                                                0
                                                                              )}
                                                                              g
                                                                            </p>
                                                                          </div>
                                                                          {selected ? (
                                                                            <Icon
                                                                              className="shrink-0 text-black"
                                                                              icon="solar:check-circle-bold"
                                                                              width={
                                                                                20
                                                                              }
                                                                            />
                                                                          ) : null}
                                                                        </div>
                                                                      </DropdownItem>
                                                                    );
                                                                  }
                                                                )}
                                                              </DropdownMenu>
                                                            </Dropdown>
                                                          </div>
                                                        </div>
                                                      </div>

                                                      {activeOption ? (
                                                        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                                          <div className="flex flex-wrap gap-3">
                                                            <OptionImageTrainerField
                                                              key={
                                                                activeOption.id
                                                              }
                                                              disabled={activeOption.id.startsWith(
                                                                "temp-"
                                                              )}
                                                              imageUrl={
                                                                activeOption.image_url
                                                              }
                                                              optionId={
                                                                activeOption.id
                                                              }
                                                              onAfterChange={
                                                                refreshPlan
                                                              }
                                                            />
                                                            <div className="min-w-[200px] flex-1 space-y-3">
                                                              {editingOptionName ===
                                                              activeOption.id ? (
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                  <Input
                                                                    className="max-w-xs"
                                                                    label="Nombre"
                                                                    size="sm"
                                                                    value={
                                                                      editingOptionNameValue
                                                                    }
                                                                    onKeyDown={(
                                                                      e
                                                                    ) => {
                                                                      if (
                                                                        e.key ===
                                                                        "Enter"
                                                                      )
                                                                        handleSaveOptionName(
                                                                          activeOption.id
                                                                        );
                                                                      if (
                                                                        e.key ===
                                                                        "Escape"
                                                                      )
                                                                        setEditingOptionName(
                                                                          null
                                                                        );
                                                                    }}
                                                                    onValueChange={
                                                                      setEditingOptionNameValue
                                                                    }
                                                                  />
                                                                  <Button
                                                                    color="success"
                                                                    size="sm"
                                                                    variant="flat"
                                                                    onPress={() =>
                                                                      handleSaveOptionName(
                                                                        activeOption.id
                                                                      )
                                                                    }
                                                                  >
                                                                    Guardar
                                                                  </Button>
                                                                  <Button
                                                                    size="sm"
                                                                    variant="flat"
                                                                    onPress={() =>
                                                                      setEditingOptionName(
                                                                        null
                                                                      )
                                                                    }
                                                                  >
                                                                    Cancelar
                                                                  </Button>
                                                                </div>
                                                              ) : (
                                                                <div className="flex items-center gap-2">
                                                                  <span className="font-semibold text-gray-900">
                                                                    {
                                                                      activeOption.name
                                                                    }
                                                                  </span>
                                                                  <Button
                                                                    isIconOnly
                                                                    size="sm"
                                                                    variant="light"
                                                                    onPress={() => {
                                                                      setEditingOptionMacrosId(
                                                                        null
                                                                      );
                                                                      setEditingOptionName(
                                                                        activeOption.id
                                                                      );
                                                                      setEditingOptionNameValue(
                                                                        activeOption.name
                                                                      );
                                                                    }}
                                                                  >
                                                                    <Icon
                                                                      icon="solar:pen-linear"
                                                                      width={16}
                                                                    />
                                                                  </Button>
                                                                </div>
                                                              )}
                                                              {editingOptionMacrosId ===
                                                              activeOption.id ? (
                                                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                                                  <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                                    <Input
                                                                      label="Proteína (g)"
                                                                      size="sm"
                                                                      type="number"
                                                                      value={
                                                                        optionMacrosForm.protein
                                                                      }
                                                                      onValueChange={(
                                                                        value
                                                                      ) =>
                                                                        setOptionMacrosForm(
                                                                          (
                                                                            f
                                                                          ) => ({
                                                                            ...f,
                                                                            protein:
                                                                              value,
                                                                          })
                                                                        )
                                                                      }
                                                                    />
                                                                    <Input
                                                                      label="Carbohidratos (g)"
                                                                      size="sm"
                                                                      type="number"
                                                                      value={
                                                                        optionMacrosForm.carbs
                                                                      }
                                                                      onValueChange={(
                                                                        value
                                                                      ) =>
                                                                        setOptionMacrosForm(
                                                                          (
                                                                            f
                                                                          ) => ({
                                                                            ...f,
                                                                            carbs:
                                                                              value,
                                                                          })
                                                                        )
                                                                      }
                                                                    />
                                                                    <Input
                                                                      label="Grasas (g)"
                                                                      size="sm"
                                                                      type="number"
                                                                      value={
                                                                        optionMacrosForm.fats
                                                                      }
                                                                      onValueChange={(
                                                                        value
                                                                      ) =>
                                                                        setOptionMacrosForm(
                                                                          (
                                                                            f
                                                                          ) => ({
                                                                            ...f,
                                                                            fats: value,
                                                                          })
                                                                        )
                                                                      }
                                                                    />
                                                                    <Input
                                                                      label="Calorías"
                                                                      size="sm"
                                                                      type="number"
                                                                      value={
                                                                        optionMacrosForm.calories
                                                                      }
                                                                      onValueChange={(
                                                                        value
                                                                      ) =>
                                                                        setOptionMacrosForm(
                                                                          (
                                                                            f
                                                                          ) => ({
                                                                            ...f,
                                                                            calories:
                                                                              value,
                                                                          })
                                                                        )
                                                                      }
                                                                    />
                                                                  </div>
                                                                  <div className="flex justify-end gap-2">
                                                                    <Button
                                                                      className="bg-black text-white hover:bg-slate-800"
                                                                      size="sm"
                                                                      onPress={() =>
                                                                        handleSaveOptionMacros(
                                                                          activeOption.id
                                                                        )
                                                                      }
                                                                    >
                                                                      Guardar
                                                                    </Button>
                                                                    <Button
                                                                      size="sm"
                                                                      variant="flat"
                                                                      onPress={() =>
                                                                        setEditingOptionMacrosId(
                                                                          null
                                                                        )
                                                                      }
                                                                    >
                                                                      Cancelar
                                                                    </Button>
                                                                  </div>
                                                                </div>
                                                              ) : (
                                                                <div
                                                                  className="flex cursor-pointer flex-wrap items-center gap-2 rounded-lg p-2 transition-colors hover:bg-gray-50"
                                                                  role="button"
                                                                  tabIndex={0}
                                                                  onClick={() =>
                                                                    handleEditOptionMacrosClick(
                                                                      activeOption
                                                                    )
                                                                  }
                                                                  onKeyDown={(
                                                                    e
                                                                  ) => {
                                                                    if (
                                                                      e.key ===
                                                                        "Enter" ||
                                                                      e.key ===
                                                                        " "
                                                                    ) {
                                                                      e.preventDefault();
                                                                      handleEditOptionMacrosClick(
                                                                        activeOption
                                                                      );
                                                                    }
                                                                  }}
                                                                >
                                                                  {(() => {
                                                                    const m =
                                                                      optionDisplayMacros(
                                                                        activeOption
                                                                      );

                                                                    return (
                                                                      <>
                                                                        <span className="rounded bg-slate-100 px-2 py-1 text-xs text-gray-700">
                                                                          P:{" "}
                                                                          {m.protein.toFixed(
                                                                            1
                                                                          )}
                                                                          g
                                                                        </span>
                                                                        <span className="rounded bg-slate-100 px-2 py-1 text-xs text-gray-700">
                                                                          C:{" "}
                                                                          {m.carbs.toFixed(
                                                                            1
                                                                          )}
                                                                          g
                                                                        </span>
                                                                        <span className="rounded bg-slate-100 px-2 py-1 text-xs text-gray-700">
                                                                          G:{" "}
                                                                          {m.fats.toFixed(
                                                                            1
                                                                          )}
                                                                          g
                                                                        </span>
                                                                        <span className="rounded bg-slate-100 px-2 py-1 text-xs text-gray-700">
                                                                          {m.calories.toFixed(
                                                                            0
                                                                          )}{" "}
                                                                          kcal
                                                                        </span>
                                                                        <Icon
                                                                          className="ml-auto text-gray-400"
                                                                          icon="solar:pen-linear"
                                                                          width={
                                                                            16
                                                                          }
                                                                        />
                                                                      </>
                                                                    );
                                                                  })()}
                                                                </div>
                                                              )}
                                                            </div>
                                                          </div>
                                                          {renderIngredientRows(
                                                            meal,
                                                            activeOption
                                                          )}
                                                          {renderRecipeEditor(
                                                            activeOption
                                                          )}
                                                          <Button
                                                            color="danger"
                                                            size="sm"
                                                            startContent={
                                                              <Icon
                                                                icon="solar:trash-bin-trash-linear"
                                                                width={16}
                                                              />
                                                            }
                                                            variant="flat"
                                                            onPress={() =>
                                                              setOptionDeleteConfirm(
                                                                {
                                                                  optionId:
                                                                    activeOption.id,
                                                                  mealId:
                                                                    meal.id,
                                                                  name: activeOption.name,
                                                                  ingredientCount:
                                                                    activeOption
                                                                      .ingredients
                                                                      .length,
                                                                }
                                                              )
                                                            }
                                                          >
                                                            Eliminar opción
                                                          </Button>
                                                        </div>
                                                      ) : null}
                                                    </>
                                                  )}

                                                  {/* Meal Notes */}
                                                  {meal.notes && (
                                                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                      <div className="flex items-start gap-2">
                                                        <Icon
                                                          className="text-slate-600 mt-0.5 flex-shrink-0"
                                                          icon="solar:notes-bold"
                                                          width={16}
                                                        />
                                                        <p className="text-sm text-slate-700">
                                                          {meal.notes}
                                                        </p>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        }}
                                      </SortableMealItem>
                                    ))}
                                  </SortableContext>
                                </DndContext>
                              )}
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            );
          })()}
        </CardBody>
      </Card>

      {/* Add Day Modal */}
      <Modal
        classNames={{
          header: "border-b border-gray-200",
          footer: "border-t border-gray-200",
          body: "py-6",
        }}
        isOpen={isAddDayModalOpen}
        size="lg"
        onClose={handleCloseAddDay}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="bg-slate-50 p-2 rounded-lg">
                <Icon
                  className="text-slate-600 text-xl"
                  icon="solar:calendar-add-bold"
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Añadir Día</h3>
                <p className="text-sm text-gray-500 font-normal">
                  Define el día para el plan nutricional
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input
                isRequired
                label="Nombre del Día"
                placeholder='Ej: "Día 1" o "Lunes"'
                startContent={
                  <Icon
                    className="text-gray-400"
                    icon="solar:calendar-linear"
                    width={18}
                  />
                }
                value={dayForm.dayLabel}
                onValueChange={(value) =>
                  setDayForm({ ...dayForm, dayLabel: value })
                }
              />
              <Textarea
                label="Notas del Día (Opcional)"
                minRows={3}
                placeholder="Ej: Día de alta intensidad, aumentar hidratación..."
                startContent={
                  <Icon
                    className="text-gray-400"
                    icon="solar:notes-linear"
                    width={18}
                  />
                }
                value={dayForm.notes}
                onValueChange={(value) =>
                  setDayForm({ ...dayForm, notes: value })
                }
              />

              {/* Weekdays Selection */}
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Días de la Semana (Opcional)
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  {dayForm.dayLabel &&
                  detectWeekdaysFromLabel(dayForm.dayLabel).length > 0
                    ? `Auto-detectado: ${formatWeekdays(detectWeekdaysFromLabel(dayForm.dayLabel))}. Puedes personalizar abajo.`
                    : "Selecciona los días de la semana en que este plan aplica"}
                </p>
                <div className="grid grid-cols-7 gap-2">
                  {[0, 1, 2, 3, 4, 5, 6].map((dayNum) => (
                    <button
                      key={dayNum}
                      className={`p-2 rounded-lg border-2 transition-all ${
                        dayForm.weekdays.includes(dayNum)
                          ? "bg-black border-black text-white"
                          : "bg-white border-gray-200 text-gray-700 hover:border-slate-300"
                      }`}
                      type="button"
                      onClick={() => handleToggleWeekdayInForm(dayNum)}
                    >
                      <div className="text-xs font-bold">
                        {getWeekdayName(dayNum, true)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Day Macro Fields */}
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Macronutrientes del Día (Opcional)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Proteína (g)"
                    placeholder="0"
                    size="sm"
                    type="number"
                    value={dayForm.protein}
                    onValueChange={(value) =>
                      setDayForm({ ...dayForm, protein: value })
                    }
                  />
                  <Input
                    label="Carbohidratos (g)"
                    placeholder="0"
                    size="sm"
                    type="number"
                    value={dayForm.carbs}
                    onValueChange={(value) =>
                      setDayForm({ ...dayForm, carbs: value })
                    }
                  />
                  <Input
                    label="Grasas (g)"
                    placeholder="0"
                    size="sm"
                    type="number"
                    value={dayForm.fats}
                    onValueChange={(value) =>
                      setDayForm({ ...dayForm, fats: value })
                    }
                  />
                  <Input
                    label="Calorías (kcal)"
                    placeholder="0"
                    size="sm"
                    type="number"
                    value={dayForm.calories}
                    onValueChange={(value) =>
                      setDayForm({ ...dayForm, calories: value })
                    }
                  />
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={handleCloseAddDay}>
              Cancelar
            </Button>
            <Button
              className="bg-black text-white font-semibold hover:bg-slate-800"
              startContent={<Icon icon="solar:add-circle-bold" width={18} />}
              onPress={handleSaveDay}
            >
              Crear Día
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Plan Details Modal */}
      <Modal
        classNames={{
          header: "border-b border-gray-200",
          footer: "border-t border-gray-200",
          body: "py-6",
        }}
        isOpen={isPlanModalOpen}
        size="lg"
        onClose={handleClosePlanModal}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="bg-slate-50 p-2 rounded-lg">
                <Icon
                  className="text-slate-600 text-xl"
                  icon="solar:document-text-bold"
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {planModalMode === "create"
                    ? "Crear Plan Nutricional"
                    : "Editar Plan Nutricional"}
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  {planModalMode === "create"
                    ? "Define los detalles del plan nutricional"
                    : "Actualiza los detalles del plan"}
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            {planModalMode === "create" ? (
              <div className="flex flex-col gap-4">
                {/* Tabs for Blank/Template */}
                <Tabs
                  selectedKey={createPlanTab}
                  onSelectionChange={(key) =>
                    setCreatePlanTab(key as "blank" | "template")
                  }
                >
                  <Tab key="blank" title="Plan en Blanco" />
                  <Tab key="template" title="Desde Plantilla" />
                </Tabs>

                {createPlanTab === "template" && (
                  <div className="mb-4">
                    {isLoadingTemplates ? (
                      <div className="flex justify-center py-8">
                        <Spinner size="sm" />
                      </div>
                    ) : availableTemplates.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <Icon
                          className="mx-auto text-gray-300 mb-2"
                          icon="fluent:food-20-filled"
                          width={48}
                        />
                        <p className="text-sm text-gray-500">
                          No hay plantillas nutricionales disponibles
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {availableTemplates.map((template) => (
                          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                          <div
                            key={template.id}
                            className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                              selectedTemplateId === template.id
                                ? "border-slate-500 bg-slate-50"
                                : "border-gray-200 hover:border-slate-300"
                            }`}
                            onClick={() => {
                              setSelectedTemplateId(template.id);
                              if (!planForm.name) {
                                setPlanForm({
                                  ...planForm,
                                  name: template.name,
                                });
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">
                                  {template.name}
                                </h4>
                                {template.description && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {template.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                                  <span>
                                    <Icon
                                      className="inline mr-1"
                                      icon="solar:calendar-linear"
                                      width={14}
                                    />
                                    {template.dayCount || 0} días
                                  </span>
                                  <span>
                                    <Icon
                                      className="inline mr-1"
                                      icon="fluent:food-20-filled"
                                      width={14}
                                    />
                                    {template.mealCount || 0} comidas
                                  </span>
                                </div>
                              </div>
                              {selectedTemplateId === template.id && (
                                <Icon
                                  className="text-slate-500"
                                  icon="solar:check-circle-bold"
                                  width={24}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <Input
                  isRequired
                  label="Nombre del Plan"
                  placeholder='Ej: "Plan de Definición", "Nutrición Deportiva"'
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:document-text-linear"
                      width={18}
                    />
                  }
                  value={planForm.name}
                  onValueChange={(value) =>
                    setPlanForm({ ...planForm, name: value })
                  }
                />
                <Input
                  isRequired
                  label="Fecha de Inicio"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:calendar-linear"
                      width={18}
                    />
                  }
                  type="date"
                  value={planForm.start_date || ""}
                  onValueChange={(value) =>
                    setPlanForm({ ...planForm, start_date: value })
                  }
                />
                <Select
                  label="Estado"
                  placeholder="Selecciona el estado"
                  selectedKeys={[planForm.status]}
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:check-circle-linear"
                      width={18}
                    />
                  }
                  onSelectionChange={(keys) => {
                    const status = Array.from(keys)[0] as
                      | "active"
                      | "completed"
                      | "paused"
                      | "cancelled";

                    setPlanForm({ ...planForm, status });
                  }}
                >
                  <SelectItem key="active">Activo</SelectItem>
                  <SelectItem key="completed">Completado</SelectItem>
                  <SelectItem key="paused">Pausado</SelectItem>
                  <SelectItem key="cancelled">Cancelado</SelectItem>
                </Select>
                <Textarea
                  label="Notas del Plan (Opcional)"
                  minRows={3}
                  placeholder="Ej: Plan diseñado para aumentar masa muscular, incluye 5 comidas al día..."
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:notes-linear"
                      width={18}
                    />
                  }
                  value={planForm.notes}
                  onValueChange={(value) =>
                    setPlanForm({ ...planForm, notes: value })
                  }
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <Input
                  isRequired
                  label="Nombre del Plan"
                  placeholder='Ej: "Plan de Definición", "Nutrición Deportiva"'
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:document-text-linear"
                      width={18}
                    />
                  }
                  value={planForm.name}
                  onValueChange={(value) =>
                    setPlanForm({ ...planForm, name: value })
                  }
                />
                <Input
                  isRequired
                  label="Fecha de Inicio"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:calendar-linear"
                      width={18}
                    />
                  }
                  type="date"
                  value={planForm.start_date || ""}
                  onValueChange={(value) =>
                    setPlanForm({ ...planForm, start_date: value })
                  }
                />
                <Select
                  label="Estado"
                  placeholder="Selecciona el estado"
                  selectedKeys={[planForm.status]}
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:check-circle-linear"
                      width={18}
                    />
                  }
                  onSelectionChange={(keys) => {
                    const status = Array.from(keys)[0] as
                      | "active"
                      | "completed"
                      | "paused"
                      | "cancelled";

                    setPlanForm({ ...planForm, status });
                  }}
                >
                  <SelectItem key="active">Activo</SelectItem>
                  <SelectItem key="completed">Completado</SelectItem>
                  <SelectItem key="paused">Pausado</SelectItem>
                  <SelectItem key="cancelled">Cancelado</SelectItem>
                </Select>
                <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50/80 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      Mostrar imágenes de comidas al cliente
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Si lo desactivas, el cliente no verá las fotos; tú puedes
                      seguir gestionándolas aquí.
                    </p>
                  </div>
                  <Switch
                    classNames={{ base: "flex-shrink-0" }}
                    isSelected={planForm.show_meal_images}
                    size="sm"
                    onValueChange={(val) =>
                      setPlanForm({ ...planForm, show_meal_images: val })
                    }
                  />
                </div>
                <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50/80 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      Mostrar calorías al cliente
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Si lo desactivas, el cliente no verá las kcal en ninguna
                      comida del plan. Puedes sobrescribirlo por comida.
                    </p>
                  </div>
                  <Switch
                    classNames={{ base: "flex-shrink-0" }}
                    isSelected={planForm.show_calories}
                    size="sm"
                    onValueChange={(val) =>
                      setPlanForm({ ...planForm, show_calories: val })
                    }
                  />
                </div>
                <Textarea
                  label="Notas del Plan (Opcional)"
                  minRows={3}
                  placeholder="Ej: Plan diseñado para aumentar masa muscular, incluye 5 comidas al día..."
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:notes-linear"
                      width={18}
                    />
                  }
                  value={planForm.notes}
                  onValueChange={(value) =>
                    setPlanForm({ ...planForm, notes: value })
                  }
                />
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={handleClosePlanModal}>
              Cancelar
            </Button>
            <Button
              className="bg-black text-white font-semibold hover:bg-slate-800"
              isDisabled={!planForm.name}
              startContent={<Icon icon="solar:diskette-bold" width={18} />}
              onPress={handleSavePlan}
            >
              {planModalMode === "create" ? "Crear Plan" : "Guardar Cambios"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Save as Template Modal */}
      {nutritionPlan && (
        <SaveNutritionTemplateModal
          isOpen={isSaveTemplateModalOpen}
          planId={nutritionPlan.id}
          planName={nutritionPlan.name}
          onClose={() => setIsSaveTemplateModalOpen(false)}
          onSuccess={() => {
            // Optionally refresh or show success message
            console.log("Template saved successfully");
          }}
        />
      )}

      {/* Add Meal Modal */}
      <Modal
        classNames={{
          header: "border-b border-gray-200",
          footer: "border-t border-gray-200",
          body: "py-6",
        }}
        isOpen={isAddMealModalOpen}
        size="lg"
        onClose={handleCloseAddMeal}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="bg-slate-50 p-2 rounded-lg">
                <Icon
                  className="text-slate-600 text-xl"
                  icon="solar:dish-bold"
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Añadir Comida
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  Define la etiqueta de la comida
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input
                isRequired
                label="Etiqueta de la Comida"
                placeholder='Ej: "Meal 1 - Breakfast" o "Desayuno"'
                startContent={
                  <Icon
                    className="text-gray-400"
                    icon="solar:document-text-linear"
                    width={18}
                  />
                }
                value={mealForm.label}
                onValueChange={(value) =>
                  setMealForm({ ...mealForm, label: value })
                }
              />
              <Textarea
                label="Notas de la Comida (Opcional)"
                minRows={3}
                placeholder="Ej: Scramble with Spinach and Whole Grain Toast..."
                startContent={
                  <Icon
                    className="text-gray-400"
                    icon="solar:notes-linear"
                    width={18}
                  />
                }
                value={mealForm.notes}
                onValueChange={(value) =>
                  setMealForm({ ...mealForm, notes: value })
                }
              />

              {/* Macro Fields */}
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Macronutrientes (Opcional)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Proteína (g)"
                    placeholder="0"
                    size="sm"
                    type="number"
                    value={mealForm.protein}
                    onValueChange={(value) =>
                      setMealForm({ ...mealForm, protein: value })
                    }
                  />
                  <Input
                    label="Carbohidratos (g)"
                    placeholder="0"
                    size="sm"
                    type="number"
                    value={mealForm.carbs}
                    onValueChange={(value) =>
                      setMealForm({ ...mealForm, carbs: value })
                    }
                  />
                  <Input
                    label="Grasas (g)"
                    placeholder="0"
                    size="sm"
                    type="number"
                    value={mealForm.fats}
                    onValueChange={(value) =>
                      setMealForm({ ...mealForm, fats: value })
                    }
                  />
                  <Input
                    label="Calorías (kcal)"
                    placeholder="0"
                    size="sm"
                    type="number"
                    value={mealForm.calories}
                    onValueChange={(value) =>
                      setMealForm({ ...mealForm, calories: value })
                    }
                  />
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={handleCloseAddMeal}>
              Cancelar
            </Button>
            <Button
              className="bg-black text-white font-semibold hover:bg-slate-800"
              startContent={<Icon icon="solar:add-circle-bold" width={18} />}
              onPress={handleSaveMeal}
            >
              Crear Comida
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete meal option */}
      <Modal
        isOpen={!!optionDeleteConfirm}
        size="md"
        onClose={() => {
          if (!optionDeleteLoading) setOptionDeleteConfirm(null);
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-100 rounded-full">
                <Icon
                  className="text-red-600"
                  icon="solar:trash-bin-trash-bold"
                  width={20}
                />
              </div>
              <span>Eliminar opción</span>
            </div>
          </ModalHeader>
          <ModalBody>
            <p className="text-gray-700">
              ¿Eliminar la opción{" "}
              <span className="font-semibold">
                &quot;{optionDeleteConfirm?.name}&quot;
              </span>
              ?
            </p>
            {optionDeleteConfirm && optionDeleteConfirm.ingredientCount > 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 mt-2">
                Esta opción tiene {optionDeleteConfirm.ingredientCount}{" "}
                ingrediente
                {optionDeleteConfirm.ingredientCount === 1 ? "" : "s"}. Se
                borrarán por completo.
              </p>
            ) : null}
            <p className="text-sm text-gray-500 mt-2">
              Si queda una sola opción, la vista volverá al modo simple. La API
              garantiza que siempre exista al menos una opción por comida.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setOptionDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              color="danger"
              isLoading={optionDeleteLoading}
              onPress={handleConfirmDeleteOption}
            >
              Eliminar opción
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        size="sm"
        onClose={() => setDeleteConfirm(null)}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-100 rounded-full">
                <Icon
                  className="text-red-600"
                  icon="solar:trash-bin-trash-bold"
                  width={20}
                />
              </div>
              <span>
                Eliminar{" "}
                {deleteConfirm?.type === "plan"
                  ? "Plan"
                  : deleteConfirm?.type === "day"
                    ? "Día"
                    : deleteConfirm?.type === "meal"
                      ? "Comida"
                      : "Ingrediente"}
              </span>
            </div>
          </ModalHeader>
          <ModalBody>
            <p className="text-gray-700">
              ¿Estás seguro de que quieres eliminar{" "}
              <span className="font-semibold">
                &quot;{deleteConfirm?.name}&quot;
              </span>
              ?
            </p>
            <p className="text-sm text-gray-500">
              {deleteConfirm?.type === "plan"
                ? "Se eliminarán todos los días, comidas e ingredientes asociados."
                : deleteConfirm?.type === "day"
                  ? "Se eliminarán todas las comidas e ingredientes de este día."
                  : deleteConfirm?.type === "meal"
                    ? "Se eliminarán todos los ingredientes de esta comida."
                    : "Esta acción no se puede deshacer."}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              color="danger"
              isLoading={isDeleteLoading}
              onPress={handleConfirmDelete}
            >
              Eliminar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

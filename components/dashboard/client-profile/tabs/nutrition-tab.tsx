/* eslint-disable no-console */
"use client";

import type {
  NutritionIngredient,
  NutritionMealWithIngredients,
  NutritionPlanWithDays,
} from "@/types/nutrition";

import {
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
  ModalHeader,
  Select,
  SelectItem,
  Spinner,
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
import { useEffect, useState } from "react";

import SaveNutritionTemplateModal from "@/components/dashboard/save-nutrition-template-modal";
import { NutritionProgressView } from "@/components/dashboard/client-profile/tabs/progress/nutrition-section";

interface NutritionTabProps {
  clientId: string;
}

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
  const [addingIngredientToMeal, setAddingIngredientToMeal] = useState<
    string | null
  >(null);
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

  const handleMealDragEnd = (dayId: string, event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !nutritionPlan) return;

    const day = nutritionPlan.days.find((d) => d.id === dayId);

    if (!day) return;

    const oldIndex = day.meals.findIndex((m) => m.id === active.id);
    const newIndex = day.meals.findIndex((m) => m.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

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

    fetch("/api/nutrition/meals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reorder: reorderPayload }),
    }).catch((err) =>
      console.error("[Nutrition] Failed to persist meal reorder:", err)
    );
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

    // Create optimistic meal
    const optimisticMeal = {
      id: `temp-${Date.now()}`,
      nutrition_day_id: selectedDayId,
      tenant_host: nutritionPlan.tenant_host,
      label: mealForm.label,
      meal_order: 0,
      notes: mealForm.notes,
      protein: parseFloat(mealForm.protein) || 0,
      carbs: parseFloat(mealForm.carbs) || 0,
      fats: parseFloat(mealForm.fats) || 0,
      calories: parseFloat(mealForm.calories) || 0,
      ingredients: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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

  // Ingredient handlers - Inline
  const handleAddIngredientClick = (mealId: string) => {
    setAddingIngredientToMeal(mealId);
    setNewIngredient({ name: "", quantity: "", unit: "" });
  };

  const handleSaveNewIngredient = async (mealId: string) => {
    if (!nutritionPlan) return;

    // Create optimistic ingredient with temporary ID
    const optimisticIngredient = {
      id: `temp-${Date.now()}`,
      nutrition_meal_id: mealId,
      tenant_host: nutritionPlan.tenant_host,
      name: newIngredient.name,
      quantity: newIngredient.quantity,
      unit: newIngredient.unit,
      ingredient_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistically update UI immediately
    setNutritionPlan((prevPlan) => {
      if (!prevPlan) return prevPlan;

      return {
        ...prevPlan,
        days: prevPlan.days.map((day) => ({
          ...day,
          meals: day.meals.map((meal) =>
            meal.id === mealId
              ? {
                  ...meal,
                  ingredients: [...meal.ingredients, optimisticIngredient],
                }
              : meal
          ),
        })),
      };
    });

    // Clear form and close add mode
    setAddingIngredientToMeal(null);
    setNewIngredient({ name: "", quantity: "", unit: "" });

    // Make API call in background
    try {
      const response = await fetch("/api/nutrition/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nutrition_meal_id: mealId,
          name: optimisticIngredient.name,
          quantity: optimisticIngredient.quantity,
          unit: optimisticIngredient.unit,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Replace optimistic ingredient with real one
        setNutritionPlan((prevPlan) => {
          if (!prevPlan) return prevPlan;

          return {
            ...prevPlan,
            days: prevPlan.days.map((day) => ({
              ...day,
              meals: day.meals.map((meal) =>
                meal.id === mealId
                  ? {
                      ...meal,
                      ingredients: meal.ingredients.map((ing) =>
                        ing.id === optimisticIngredient.id ? result.data : ing
                      ),
                    }
                  : meal
              ),
            })),
          };
        });
      } else {
        console.error("Error creating ingredient:", result.error);
        // Revert optimistic update on error
        await refreshPlan();
        alert(
          `Error al guardar ingrediente: ${result.error || "Error desconocido"}`
        );
      }
    } catch (err) {
      console.error("Error saving ingredient:", err);
      // Revert optimistic update on error
      await refreshPlan();
      alert("Error al guardar ingrediente. Por favor intenta de nuevo.");
    }
  };

  const handleCancelNewIngredient = () => {
    setAddingIngredientToMeal(null);
    setNewIngredient({ name: "", quantity: "", unit: "" });
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

    try {
      const response = await fetch(
        `/api/nutrition/ingredients/${ingredientId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: nameInput.value,
            quantity: quantityInput.value,
            unit: unitInput.value,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        await refreshPlan();
        setEditingIngredient(null);
      } else {
        console.error("Error updating ingredient:", result.error);
      }
    } catch (err) {
      console.error("Error saving ingredient:", err);
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
              meals: day.meals.map((meal) => ({
                ...meal,
                ingredients: meal.ingredients.filter(
                  (ing) => ing.id !== deleteConfirm.id
                ),
              })),
            })),
          };
        });
      }

      const response = await fetch(endpoint, { method: "DELETE" });
      const result = await response.json();

      if (result.success) {
        if (deleteConfirm.type === "plan") {
          setNutritionPlan(null);
        } else if (deleteConfirm.type !== "ingredient") {
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
    setMacrosForm({
      protein: meal.protein?.toString() || "0",
      carbs: meal.carbs?.toString() || "0",
      fats: meal.fats?.toString() || "0",
      calories: meal.calories?.toString() || "0",
    });
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

          {/* Days Section - Inside Plan Card */}
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
                startContent={<Icon icon="solar:add-circle-bold" width={20} />}
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
                                if (e.key === "Escape") setEditingDayName(null);
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
                              <Icon icon="solar:check-circle-bold" width={18} />
                            </Button>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="flat"
                              onPress={() => setEditingDayName(null)}
                            >
                              <Icon icon="solar:close-circle-bold" width={18} />
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
                          {(!day.weekdays || day.weekdays.length === 0) && (
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
                            <Icon icon="solar:add-circle-bold" width={16} />
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
                          Selecciona los días de la semana en que este plan
                          nutricional aplica:
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
                              onClick={() => handleToggleWeekday(dayNum)}
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
                              No hay días asignados. Haz clic en &quot;Editar
                              Días&quot; para asignar.
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
                          const mealTotals = calculateMealTotals(day.meals);
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
                                  {displayValues.calories.toFixed(0)} kcal
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
                              <Icon icon="solar:add-circle-bold" width={16} />
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
                              <SortableMealItem key={meal.id} id={meal.id}>
                                {({ attributes, listeners }) => (
                                  <div className="bg-white rounded-lg border border-gray-200 p-4">
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
                                            toggleMealCollapse(meal.id)
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
                                          {editingMealName === meal.id ? (
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
                                                value={editingMealNameValue}
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter")
                                                    handleSaveMealName(meal.id);
                                                  if (e.key === "Escape")
                                                    setEditingMealName(null);
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
                                                  handleSaveMealName(meal.id)
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
                                                  setEditingMealName(null)
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
                                        {!expandedMeals.has(meal.id) && (
                                          <span className="text-xs text-gray-400 hidden sm:inline">
                                            {meal.protein || 0}P ·{" "}
                                            {meal.carbs || 0}C ·{" "}
                                            {meal.fats || 0}G ·{" "}
                                            {meal.calories || 0} kcal
                                          </span>
                                        )}
                                        <Button
                                          isIconOnly
                                          size="sm"
                                          variant="flat"
                                          onPress={() =>
                                            handleEditMeal(meal.id)
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
                                            handleDeleteMeal(meal.id)
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

                                    {/* Collapsible meal body */}
                                    {expandedMeals.has(meal.id) && (
                                      <div className="mt-3">
                                        {/* Meal Macros - Prominent Display */}
                                        {editingMealMacros === meal.id ? (
                                          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                            <div className="grid grid-cols-4 gap-2 mb-2">
                                              <Input
                                                label="Proteína (g)"
                                                size="sm"
                                                type="number"
                                                value={macrosForm.protein}
                                                onValueChange={(value) =>
                                                  setMacrosForm({
                                                    ...macrosForm,
                                                    protein: value,
                                                  })
                                                }
                                              />
                                              <Input
                                                label="Carbohidratos (g)"
                                                size="sm"
                                                type="number"
                                                value={macrosForm.carbs}
                                                onValueChange={(value) =>
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
                                                value={macrosForm.fats}
                                                onValueChange={(value) =>
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
                                                value={macrosForm.calories}
                                                onValueChange={(value) =>
                                                  setMacrosForm({
                                                    ...macrosForm,
                                                    calories: value,
                                                  })
                                                }
                                              />
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                              <Button
                                                className="bg-black text-white hover:bg-slate-800"
                                                size="sm"
                                                onPress={() =>
                                                  handleSaveMealMacros(meal.id)
                                                }
                                              >
                                                Guardar
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="flat"
                                                onPress={() =>
                                                  setEditingMealMacros(null)
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
                                              handleEditMealMacrosClick(meal)
                                            }
                                          >
                                            <div className="bg-slate-50 px-3 py-1.5 rounded-lg">
                                              <span className="text-xs text-gray-600">
                                                Proteína:
                                              </span>
                                              <span className="text-sm font-bold text-gray-900 ml-1">
                                                {meal.protein || 0}g
                                              </span>
                                            </div>
                                            <div className="bg-green-50 px-3 py-1.5 rounded-lg">
                                              <span className="text-xs text-gray-600">
                                                Carbohidratos:
                                              </span>
                                              <span className="text-sm font-bold text-gray-900 ml-1">
                                                {meal.carbs || 0}g
                                              </span>
                                            </div>
                                            <div className="bg-yellow-50 px-3 py-1.5 rounded-lg">
                                              <span className="text-xs text-gray-600">
                                                Grasas:
                                              </span>
                                              <span className="text-sm font-bold text-gray-900 ml-1">
                                                {meal.fats || 0}g
                                              </span>
                                            </div>
                                            <div className="bg-red-50 px-3 py-1.5 rounded-lg">
                                              <span className="text-xs text-gray-600">
                                                Calorías:
                                              </span>
                                              <span className="text-sm font-bold text-gray-900 ml-1">
                                                {meal.calories || 0} kcal
                                              </span>
                                            </div>
                                            <Icon
                                              className="text-gray-400 ml-auto"
                                              icon="solar:pen-linear"
                                              width={16}
                                            />
                                          </div>
                                        )}

                                        {/* Ingredients Table */}
                                        <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
                                          <div className="space-y-2">
                                            {meal.ingredients.map(
                                              (ingredient) => (
                                                <div key={ingredient.id}>
                                                  {editingIngredient ===
                                                  ingredient.id ? (
                                                    // Edit mode
                                                    <div className="flex items-center gap-2 py-2 border-b border-gray-100">
                                                      <Input
                                                        className="flex-1"
                                                        data-field="name"
                                                        data-ingredient-id={
                                                          ingredient.id
                                                        }
                                                        defaultValue={
                                                          ingredient.name
                                                        }
                                                        placeholder="Ingrediente"
                                                        size="sm"
                                                      />
                                                      <Input
                                                        className="w-24"
                                                        data-field="quantity"
                                                        data-ingredient-id={
                                                          ingredient.id
                                                        }
                                                        defaultValue={
                                                          ingredient.quantity
                                                        }
                                                        placeholder="Cantidad"
                                                        size="sm"
                                                      />
                                                      <Input
                                                        className="w-24"
                                                        data-field="unit"
                                                        data-ingredient-id={
                                                          ingredient.id
                                                        }
                                                        defaultValue={
                                                          ingredient.unit
                                                        }
                                                        placeholder="Unidad"
                                                        size="sm"
                                                      />
                                                      <Button
                                                        isIconOnly
                                                        color="success"
                                                        size="sm"
                                                        variant="flat"
                                                        onPress={() =>
                                                          handleSaveEditIngredient(
                                                            ingredient.id,
                                                            ingredient
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
                                                        onPress={
                                                          handleCancelEditIngredient
                                                        }
                                                      >
                                                        <Icon
                                                          icon="solar:close-circle-bold"
                                                          width={18}
                                                        />
                                                      </Button>
                                                    </div>
                                                  ) : (
                                                    // View mode
                                                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                                                    <div
                                                      className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-white cursor-pointer rounded px-2"
                                                      onClick={() =>
                                                        handleEditIngredientClick(
                                                          ingredient.id
                                                        )
                                                      }
                                                    >
                                                      <div className="flex items-center gap-3 flex-1">
                                                        <span className="text-sm text-gray-900">
                                                          {ingredient.name}
                                                        </span>
                                                      </div>
                                                      <div className="flex items-center gap-3">
                                                        <div className="text-sm text-gray-600">
                                                          <span className="font-semibold text-gray-900">
                                                            {
                                                              ingredient.quantity
                                                            }
                                                          </span>{" "}
                                                          {ingredient.unit}
                                                        </div>
                                                        <Button
                                                          isIconOnly
                                                          size="sm"
                                                          variant="light"
                                                          onPress={(e: any) => {
                                                            e?.stopPropagation?.();
                                                            handleDeleteIngredient(
                                                              ingredient.id
                                                            );
                                                          }}
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
                                              )
                                            )}

                                            {/* Add new ingredient inline */}
                                            {addingIngredientToMeal ===
                                            meal.id ? (
                                              <div className="flex items-center gap-2 py-2 border-b border-slate-200 bg-slate-50 rounded px-2">
                                                {}
                                                <Input
                                                  autoFocus
                                                  className="flex-1"
                                                  placeholder="Nombre del ingrediente"
                                                  size="sm"
                                                  value={newIngredient.name}
                                                  onValueChange={(value) =>
                                                    setNewIngredient({
                                                      ...newIngredient,
                                                      name: value,
                                                    })
                                                  }
                                                />
                                                <Input
                                                  className="w-24"
                                                  placeholder="Cantidad"
                                                  size="sm"
                                                  value={newIngredient.quantity}
                                                  onValueChange={(value) =>
                                                    setNewIngredient({
                                                      ...newIngredient,
                                                      quantity: value,
                                                    })
                                                  }
                                                />
                                                <Input
                                                  className="w-24"
                                                  placeholder="Unidad"
                                                  size="sm"
                                                  value={newIngredient.unit}
                                                  onValueChange={(value) =>
                                                    setNewIngredient({
                                                      ...newIngredient,
                                                      unit: value,
                                                    })
                                                  }
                                                />
                                                <Button
                                                  isIconOnly
                                                  color="success"
                                                  size="sm"
                                                  variant="flat"
                                                  onPress={() =>
                                                    handleSaveNewIngredient(
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
                                                  onPress={
                                                    handleCancelNewIngredient
                                                  }
                                                >
                                                  <Icon
                                                    icon="solar:close-circle-bold"
                                                    width={18}
                                                  />
                                                </Button>
                                              </div>
                                            ) : (
                                              <Button
                                                className="w-full mt-2"
                                                size="sm"
                                                startContent={
                                                  <Icon
                                                    icon="solar:add-circle-linear"
                                                    width={16}
                                                  />
                                                }
                                                variant="light"
                                                onPress={() =>
                                                  handleAddIngredientClick(
                                                    meal.id
                                                  )
                                                }
                                              >
                                                Añadir Ingrediente
                                              </Button>
                                            )}
                                          </div>
                                        </div>

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
                                )}
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

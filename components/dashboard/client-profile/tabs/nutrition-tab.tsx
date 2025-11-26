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
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Spinner,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

interface NutritionTabProps {
  clientId: string;
}

export default function NutritionTab({ clientId }: NutritionTabProps) {
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

  const [dayForm, setDayForm] = useState({
    dayLabel: "",
    notes: "",
  });

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

  const [newIngredient, setNewIngredient] = useState({
    name: "",
    quantity: "",
    unit: "",
  });

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
  const handleOpenCreatePlan = () => {
    setPlanModalMode("create");
    setPlanForm({
      name: "",
      start_date: new Date().toISOString().split("T")[0],
      status: "active",
      notes: "",
    });
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
        const response = await fetch("/api/nutrition/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            name: planForm.name,
            start_date: planForm.start_date,
            status: planForm.status,
            notes: planForm.notes,
          }),
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

  const handleDeletePlan = async () => {
    if (!nutritionPlan) return;
    if (
      !confirm(
        "¿Estás seguro de eliminar este plan nutricional? Se eliminarán todos los días, comidas e ingredientes."
      )
    )
      return;

    try {
      const response = await fetch(`/api/nutrition/plans/${nutritionPlan.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (result.success) {
        setNutritionPlan(null);
      } else {
        alert(`Error al eliminar plan: ${result.error || "Error desconocido"}`);
      }
    } catch (err) {
      console.error("Error deleting plan:", err);
      alert("Error al eliminar plan. Por favor intenta de nuevo.");
    }
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
    setDayForm({ dayLabel: "", notes: "" });
  };

  const handleSaveDay = async () => {
    if (!nutritionPlan) return;

    // Create optimistic day
    const optimisticDay = {
      id: `temp-${Date.now()}`,
      nutrition_plan_id: nutritionPlan.id,
      tenant_host: nutritionPlan.tenant_host,
      day_label: dayForm.dayLabel,
      day_order: nutritionPlan.days.length,
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

  const handleEditDay = async (dayId: string) => {
    // For now, just log - can add edit modal later
    console.log("Editando día:", dayId);
  };

  const handleDeleteDay = async (dayId: string) => {
    if (!confirm("¿Estás seguro de eliminar este día?")) return;

    try {
      const response = await fetch(`/api/nutrition/days/${dayId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        await refreshPlan();
      } else {
        console.error("Error deleting day:", result.error);
      }
    } catch (err) {
      console.error("Error deleting day:", err);
    }
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

  const handleEditMeal = async (mealId: string) => {
    // For now, just log - can add edit modal later
    console.log("Editando comida:", mealId);
  };

  const handleDeleteMeal = async (mealId: string) => {
    if (!confirm("¿Estás seguro de eliminar esta comida?")) return;

    try {
      const response = await fetch(`/api/nutrition/meals/${mealId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        await refreshPlan();
      } else {
        console.error("Error deleting meal:", result.error);
      }
    } catch (err) {
      console.error("Error deleting meal:", err);
    }
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
    ingredient: NutritionIngredient
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

  const handleDeleteIngredient = async (ingredientId: string) => {
    if (!confirm("¿Estás seguro de eliminar este ingrediente?")) return;

    if (!nutritionPlan) return;

    // Store current state for potential rollback
    const previousPlan = { ...nutritionPlan };

    // Optimistically remove ingredient from UI
    setNutritionPlan((prevPlan) => {
      if (!prevPlan) return prevPlan;

      return {
        ...prevPlan,
        days: prevPlan.days.map((day) => ({
          ...day,
          meals: day.meals.map((meal) => ({
            ...meal,
            ingredients: meal.ingredients.filter(
              (ing) => ing.id !== ingredientId
            ),
          })),
        })),
      };
    });

    // Make API call in background
    try {
      const response = await fetch(
        `/api/nutrition/ingredients/${ingredientId}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!result.success) {
        console.error("Error deleting ingredient:", result.error);
        // Revert on error
        setNutritionPlan(previousPlan);
        alert(
          `Error al eliminar ingrediente: ${result.error || "Error desconocido"}`
        );
      }
    } catch (err) {
      console.error("Error deleting ingredient:", err);
      // Revert on error
      setNutritionPlan(previousPlan);
      alert("Error al eliminar ingrediente. Por favor intenta de nuevo.");
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Icon
          className="text-red-500 mb-4"
          icon="solar:danger-circle-bold"
          width={48}
        />
        <p className="text-red-600 text-lg">{error}</p>
      </div>
    );
  }

  if (!nutritionPlan) {
    return (
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
          className="text-white font-semibold"
          color="primary"
          startContent={<Icon icon="solar:add-circle-bold" width={20} />}
          onPress={handleOpenCreatePlan}
        >
          Crear Plan Nutricional
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Plan Selector and New Plan Button */}
      <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-200">
        <div className="flex items-center gap-3">
          {allPlans.length > 1 ? (
            <>
              <span className="text-sm font-semibold text-blue-900">
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
            <span className="text-sm font-semibold text-blue-900">
              Plan Nutricional
            </span>
          )}
        </div>
        <Button
          className="text-white font-semibold"
          color="primary"
          size="sm"
          startContent={<Icon icon="solar:add-circle-bold" width={18} />}
          onPress={handleOpenCreatePlan}
        >
          Nuevo Plan
        </Button>
      </div>

      {/* Plan Container Card - Everything is inside */}
      <Card className="border-2 border-blue-300 shadow-lg">
        <CardBody className="p-0">
          {/* Plan Header */}
          <div className="p-6 bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-300">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Icon
                    className="text-blue-600"
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
                  <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200">
                    <Icon
                      className="inline text-blue-600 mr-2"
                      icon="solar:notes-bold"
                      width={16}
                    />
                    <span className="text-sm text-blue-900">
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
                <Button
                  color="danger"
                  size="sm"
                  startContent={
                    <Icon icon="solar:trash-bin-trash-linear" width={18} />
                  }
                  variant="flat"
                  onPress={handleDeletePlan}
                >
                  Eliminar
                </Button>
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
                className="text-white font-semibold"
                color="primary"
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
                  <summary className="flex items-center justify-between cursor-pointer list-none p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="bg-blue-50 p-2 rounded-lg">
                        <Icon
                          className="text-blue-600"
                          icon="solar:calendar-bold"
                          width={24}
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900">
                          {day.day_label}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {day.meals.length} comidas
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          className="text-white font-semibold"
                          color="primary"
                          size="sm"
                          startContent={
                            <Icon icon="solar:add-circle-bold" width={16} />
                          }
                          variant="flat"
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
                            className="mt-3 text-white font-semibold"
                            color="primary"
                            size="sm"
                            startContent={
                              <Icon icon="solar:add-circle-bold" width={16} />
                            }
                            variant="flat"
                            onPress={() => handleOpenAddMeal(day.id)}
                          >
                            Añadir Primera Comida
                          </Button>
                        </div>
                      ) : (
                        day.meals.map((meal) => (
                          <div
                            key={meal.id}
                            className="bg-white rounded-lg border border-gray-200 p-4"
                          >
                            {/* Meal Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Icon
                                  className="text-blue-600"
                                  icon="solar:dish-bold"
                                  width={20}
                                />
                                <h4 className="font-bold text-gray-900">
                                  {meal.label}
                                </h4>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="flat"
                                  onPress={() => handleEditMeal(meal.id)}
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
                                  onPress={() => handleDeleteMeal(meal.id)}
                                >
                                  <Icon
                                    className="text-gray-600"
                                    icon="solar:trash-bin-trash-linear"
                                    width={16}
                                  />
                                </Button>
                              </div>
                            </div>

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
                                    className="text-white"
                                    color="primary"
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
                                    onPress={() => setEditingMealMacros(null)}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                                onClick={() => handleEditMealMacrosClick(meal)}
                              >
                                <div className="bg-blue-50 px-3 py-1.5 rounded-lg">
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
                                {meal.ingredients.map((ingredient) => (
                                  <div key={ingredient.id}>
                                    {editingIngredient === ingredient.id ? (
                                      // Edit mode
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
                                          onPress={handleCancelEditIngredient}
                                        >
                                          <Icon
                                            icon="solar:close-circle-bold"
                                            width={18}
                                          />
                                        </Button>
                                      </div>
                                    ) : (
                                      // View mode
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
                                              {ingredient.quantity}
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
                                ))}

                                {/* Add new ingredient inline */}
                                {addingIngredientToMeal === meal.id ? (
                                  <div className="flex items-center gap-2 py-2 border-b border-blue-200 bg-blue-50 rounded px-2">
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
                                      className="text-white"
                                      color="primary"
                                      size="sm"
                                      onPress={() =>
                                        handleSaveNewIngredient(meal.id)
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
                                      onPress={handleCancelNewIngredient}
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
                                      handleAddIngredientClick(meal.id)
                                    }
                                  >
                                    Añadir Ingrediente
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Meal Notes */}
                            {meal.notes && (
                              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <div className="flex items-start gap-2">
                                  <Icon
                                    className="text-blue-600 mt-0.5 flex-shrink-0"
                                    icon="solar:notes-bold"
                                    width={16}
                                  />
                                  <p className="text-sm text-blue-700">
                                    {meal.notes}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
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
              <div className="bg-blue-50 p-2 rounded-lg">
                <Icon
                  className="text-blue-600 text-xl"
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
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={handleCloseAddDay}>
              Cancelar
            </Button>
            <Button
              className="text-white font-semibold"
              color="primary"
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
              <div className="bg-blue-50 p-2 rounded-lg">
                <Icon
                  className="text-blue-600 text-xl"
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
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={handleClosePlanModal}>
              Cancelar
            </Button>
            <Button
              className="text-white font-semibold"
              color="primary"
              isDisabled={!planForm.name}
              startContent={<Icon icon="solar:diskette-bold" width={18} />}
              onPress={handleSavePlan}
            >
              {planModalMode === "create" ? "Crear Plan" : "Guardar Cambios"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

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
              <div className="bg-blue-50 p-2 rounded-lg">
                <Icon
                  className="text-blue-600 text-xl"
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
              className="text-white font-semibold"
              color="primary"
              startContent={<Icon icon="solar:add-circle-bold" width={18} />}
              onPress={handleSaveMeal}
            >
              Crear Comida
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

/* eslint-disable no-console */
"use client";

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
import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import AddExerciseLibraryModal from "./add-exercise-library-modal";

interface TemplateDetailModalProps {
  isOpen: boolean;
  template: {
    id: string;
    name: string;
    description?: string;
    templateType: "program" | "nutrition";
    type?: string;
    category: "cardio" | "strength" | "nutrition";
    division?: string;
    goal?: string;
    sessionsPerWeek?: number;
  };
  onClose: (updatedData?: {
    name: string;
    description?: string;
    type?: string;
    category: "cardio" | "strength" | "nutrition";
    division?: string;
    goal?: string;
    sessionsPerWeek?: number;
    sessionCount?: number;
    exerciseCount?: number;
    dayCount?: number;
    mealCount?: number;
  }) => void;
  onSuccess: () => void;
}

interface Session {
  id: string;
  name: string;
  session_order: number;
  metadata?: {
    day_of_week?: string;
  };
  exercises: Array<{
    id: string;
    exercise_id: string;
    exercise_order: number;
    custom_name?: string;
    sets?: number;
    reps?: string;
    duration_seconds?: number;
    distance_meters?: number;
    rest_seconds?: number;
    notes?: string;
    metadata?: any;
    exercises?: {
      name: string;
      video_url?: string;
      image_url?: string;
      category?: string;
    };
  }>;
}

// Sortable wrapper for session cards
function SortableSessionItem({
  id,
  children,
}: {
  id: string;
  children: (props: {
    dragHandleProps: Record<string, any>;
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
    <div
      ref={setNodeRef}
      className={`border rounded-xl p-4 transition-all bg-white ${
        isDragging
          ? "border-slate-400 shadow-lg"
          : "border-gray-200 shadow-sm hover:border-gray-300"
      }`}
      style={style}
    >
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
}

// Sortable wrapper for day cards
function SortableDayItem({
  id,
  children,
}: {
  id: string;
  children: (props: {
    dragHandleProps: Record<string, any>;
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
    <div
      ref={setNodeRef}
      className={`border rounded-xl p-4 transition-all bg-white ${
        isDragging
          ? "border-green-300 shadow-lg"
          : "border-gray-200 shadow-sm hover:border-gray-300"
      }`}
      style={style}
    >
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
}

// Sortable wrapper for exercise items
function SortableExerciseItem({
  id,
  children,
}: {
  id: string;
  children: (props: {
    dragHandleProps: Record<string, any>;
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
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
}

export default function TemplateDetailModal({
  isOpen,
  template,
  onClose,
  onSuccess,
}: TemplateDetailModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [days, setDays] = useState<any[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(
    new Set()
  );
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());

  // Inline editing states for basic info
  const [editingField, setEditingField] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);

  // Nutrition editing state
  const [isAddingDay, setIsAddingDay] = useState(false);
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(
    null
  );
  const [addingMealToDayId, setAddingMealToDayId] = useState<string | null>(
    null
  );
  const [addingIngredientToMealId, setAddingIngredientToMealId] = useState<
    string | null
  >(null);
  const [editingDayMacros, setEditingDayMacros] = useState<string | null>(null);
  const [editingMealMacros, setEditingMealMacros] = useState<string | null>(
    null
  );

  const [newDayForm, setNewDayForm] = useState({ label: "" });
  const [newMealForm, setNewMealForm] = useState({ label: "", notes: "" });
  const [newIngredientForm, setNewIngredientForm] = useState({
    name: "",
    quantity: "",
    unit: "",
  });
  const [dayMacrosForm, setDayMacrosForm] = useState({
    protein: "",
    carbs: "",
    fats: "",
    calories: "",
  });
  const [mealMacrosForm, setMealMacrosForm] = useState({
    protein: "",
    carbs: "",
    fats: "",
    calories: "",
  });

  // Program editing state
  const [isAddingSession, setIsAddingSession] = useState(false);
  const [addingExerciseToSessionId, setAddingExerciseToSessionId] = useState<
    string | null
  >(null);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(
    null
  );
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState("");

  const [newSessionForm, setNewSessionForm] = useState({
    name: "",
  });
  const [newExerciseForm, setNewExerciseForm] = useState({
    exercise_id: "",
    name: "",
    sets: "",
    reps: "",
    rest_seconds: "",
    notes: "",
  });
  const [exerciseLibrary, setExerciseLibrary] = useState<
    Array<{
      id: string;
      name: string;
      category: string;
      video_url?: string;
      image_url?: string;
      description?: string;
      default_sets?: number;
      default_reps?: string;
      default_rest_seconds?: number;
      default_tempo?: string;
      default_training_system?: string;
    }>
  >([]);
  const [exerciseCategoryFilter, setExerciseCategoryFilter] =
    useState<string>("all");
  const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: template.name,
    description: template.description || "",
    type: template.type || "Strength",
    category: template.category,
    division: template.division || "",
    goal: template.goal || "",
    sessionsPerWeek: template.sessionsPerWeek?.toString() || "3",
  });

  // Update formData when template changes
  useEffect(() => {
    setFormData({
      name: template.name,
      description: template.description || "",
      type: template.type || "Strength",
      category: template.category,
      division: template.division || "",
      goal: template.goal || "",
      sessionsPerWeek: template.sessionsPerWeek?.toString() || "3",
    });
  }, [template]);

  // Fetch template details with sessions/exercises or days/meals
  const fetchTemplateDetails = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/templates/${template.id}`);
      const result = await response.json();

      if (result.success) {
        if (result.template.templateType === "nutrition") {
          setDays(result.template.days || []);
        } else {
          setSessions(result.template.sessions || []);
        }
      } else {
        console.error("Error fetching template details:", result.error);
      }
    } catch (error) {
      console.error("Error fetching template details:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTemplateDetails();
      fetchExerciseLibrary();
    }
  }, [isOpen, template.id]);

  const fetchExerciseLibrary = async () => {
    try {
      const response = await fetch("/api/exercises?limit=1000");
      const data = await response.json();

      if (data.success) {
        setExerciseLibrary(data.exercises || []);
      }
    } catch (error) {
      console.error("Error fetching exercise library:", error);
    }
  };

  const filteredExercises = useMemo(() => {
    if (exerciseCategoryFilter === "all") {
      return exerciseLibrary;
    }

    return exerciseLibrary.filter(
      (ex) => ex.category === exerciseCategoryFilter
    );
  }, [exerciseLibrary, exerciseCategoryFilter]);

  const handleExerciseCreated = async (createdExercise?: any) => {
    // Refresh the exercise library
    await fetchExerciseLibrary();

    // If we received the created exercise, auto-select it and populate the form
    if (createdExercise) {
      setNewExerciseForm({
        exercise_id: createdExercise.id,
        name: createdExercise.name,
        sets: createdExercise.default_sets?.toString() || "",
        reps: createdExercise.default_reps || "",
        rest_seconds: createdExercise.default_rest_seconds?.toString() || "",
        notes: createdExercise.description || "",
      });
    }
  };

  // Handle inline field save
  const handleSaveField = async (field: string) => {
    setSavingField(field);

    try {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setEditingField(null);
        // Don't call onSuccess() to keep modal open and avoid full page refresh
        // Just update the local state - it's already updated in formData
      } else {
        console.error("Error updating template:", result.error);
        alert("Error al actualizar la plantilla");
      }
    } catch (error) {
      console.error("Error updating template:", error);
      alert("Error al actualizar la plantilla");
    } finally {
      setSavingField(null);
    }
  };

  const toggleSession = (sessionId: string) => {
    setExpandedSessions((prev) => {
      const newSet = new Set(prev);

      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }

      return newSet;
    });
  };

  const toggleDay = (dayId: string) => {
    setExpandedDays((prev) => {
      const newSet = new Set(prev);

      if (newSet.has(dayId)) {
        newSet.delete(dayId);
      } else {
        newSet.add(dayId);
      }

      return newSet;
    });
  };

  // Nutrition CRUD handlers
  const handleAddDay = async () => {
    if (!newDayForm.label.trim()) return;

    const optimisticDay = {
      id: `temp-${Date.now()}`,
      nutrition_plan_id: template.id,
      day_label: newDayForm.label,
      day_order: days.length,
      protein: 0,
      carbs: 0,
      fats: 0,
      calories: 0,
      meals: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistically add to UI
    setDays([...days, optimisticDay]);
    setIsAddingDay(false);
    setNewDayForm({ label: "" });

    // Expand the new day automatically
    setExpandedDays(new Set([...expandedDays, optimisticDay.id]));

    try {
      const response = await fetch("/api/nutrition/days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nutrition_plan_id: template.id,
          day_label: optimisticDay.day_label,
          day_order: optimisticDay.day_order,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Replace optimistic day with real one
        setDays((prevDays) =>
          prevDays.map((d) =>
            d.id === optimisticDay.id ? { ...result.data, meals: [] } : d
          )
        );
        // Update expanded set with real ID
        setExpandedDays((prev) => {
          const newSet = new Set(prev);

          newSet.delete(optimisticDay.id);
          newSet.add(result.data.id);

          return newSet;
        });
      } else {
        // Rollback on error
        setDays((prevDays) =>
          prevDays.filter((d) => d.id !== optimisticDay.id)
        );
        alert("Error al crear día");
      }
    } catch (error) {
      console.error("Error adding day:", error);
      setDays((prevDays) => prevDays.filter((d) => d.id !== optimisticDay.id));
      alert("Error al crear día");
    }
  };

  const handleDeleteDay = async (dayId: string) => {
    if (!confirm("¿Estás seguro de eliminar este día?")) return;

    // Optimistically remove from UI
    const dayToDelete = days.find((d) => d.id === dayId);

    setDays((prevDays) => prevDays.filter((d) => d.id !== dayId));

    try {
      const response = await fetch(`/api/nutrition/days/${dayId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        // Rollback on error
        if (dayToDelete) {
          setDays((prevDays) =>
            [...prevDays, dayToDelete].sort((a, b) => a.day_order - b.day_order)
          );
        }
        alert("Error al eliminar día");
      }
    } catch (error) {
      console.error("Error deleting day:", error);
      if (dayToDelete) {
        setDays((prevDays) =>
          [...prevDays, dayToDelete].sort((a, b) => a.day_order - b.day_order)
        );
      }
      alert("Error al eliminar día");
    }
  };

  const handleAddMeal = async (dayId: string) => {
    if (!newMealForm.label.trim()) return;

    const optimisticMeal = {
      id: `temp-${Date.now()}`,
      nutrition_day_id: dayId,
      label: newMealForm.label,
      notes: newMealForm.notes,
      meal_order: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
      calories: 0,
      ingredients: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistically add to UI
    setDays((prevDays) =>
      prevDays.map((day) =>
        day.id === dayId
          ? { ...day, meals: [...(day.meals || []), optimisticMeal] }
          : day
      )
    );
    // Auto-expand the new meal
    setExpandedMeals((prev) => new Set([...prev, optimisticMeal.id]));
    setAddingMealToDayId(null);
    setNewMealForm({ label: "", notes: "" });

    try {
      const response = await fetch("/api/nutrition/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nutrition_day_id: dayId,
          label: optimisticMeal.label,
          notes: optimisticMeal.notes,
          meal_order: optimisticMeal.meal_order,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Replace optimistic meal with real one
        setDays((prevDays) =>
          prevDays.map((day) =>
            day.id === dayId
              ? {
                  ...day,
                  meals:
                    day.meals?.map((m: any) =>
                      m.id === optimisticMeal.id
                        ? { ...result.data, ingredients: [] }
                        : m
                    ) || [],
                }
              : day
          )
        );
        // Update expandedMeals with the real meal id
        setExpandedMeals((prev) => {
          const next = new Set(prev);

          if (next.has(optimisticMeal.id)) {
            next.delete(optimisticMeal.id);
            next.add(result.data.id);
          }

          return next;
        });
      } else {
        // Rollback on error
        setDays((prevDays) =>
          prevDays.map((day) =>
            day.id === dayId
              ? {
                  ...day,
                  meals:
                    day.meals?.filter((m: any) => m.id !== optimisticMeal.id) ||
                    [],
                }
              : day
          )
        );
        alert("Error al crear comida");
      }
    } catch (error) {
      console.error("Error adding meal:", error);
      setDays((prevDays) =>
        prevDays.map((day) =>
          day.id === dayId
            ? {
                ...day,
                meals:
                  day.meals?.filter((m: any) => m.id !== optimisticMeal.id) ||
                  [],
              }
            : day
        )
      );
      alert("Error al crear comida");
    }
  };

  const handleDeleteMeal = async (mealId: string) => {
    if (!confirm("¿Estás seguro de eliminar esta comida?")) return;

    // Find and store the meal for potential rollback
    let deletedMeal: any = null;
    let parentDayId: string | null = null;

    setDays((prevDays) => {
      return prevDays.map((day) => {
        const meal = day.meals?.find((m: any) => m.id === mealId);

        if (meal) {
          deletedMeal = meal;
          parentDayId = day.id;

          return {
            ...day,
            meals: day.meals?.filter((m: any) => m.id !== mealId) || [],
          };
        }

        return day;
      });
    });

    try {
      const response = await fetch(`/api/nutrition/meals/${mealId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        // Rollback on error
        if (deletedMeal && parentDayId) {
          setDays((prevDays) =>
            prevDays.map((day) =>
              day.id === parentDayId
                ? { ...day, meals: [...(day.meals || []), deletedMeal] }
                : day
            )
          );
        }
        alert("Error al eliminar comida");
      }
    } catch (error) {
      console.error("Error deleting meal:", error);
      if (deletedMeal && parentDayId) {
        setDays((prevDays) =>
          prevDays.map((day) =>
            day.id === parentDayId
              ? { ...day, meals: [...(day.meals || []), deletedMeal] }
              : day
          )
        );
      }
      alert("Error al eliminar comida");
    }
  };

  const handleAddIngredient = async (mealId: string) => {
    if (!newIngredientForm.name.trim()) return;

    const optimisticIngredient = {
      id: `temp-${Date.now()}`,
      nutrition_meal_id: mealId,
      name: newIngredientForm.name,
      quantity: newIngredientForm.quantity,
      unit: newIngredientForm.unit,
      ingredient_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistically add to UI
    setDays((prevDays) =>
      prevDays.map((day) => ({
        ...day,
        meals:
          day.meals?.map((meal: any) =>
            meal.id === mealId
              ? {
                  ...meal,
                  ingredients: [
                    ...(meal.ingredients || []),
                    optimisticIngredient,
                  ],
                }
              : meal
          ) || [],
      }))
    );
    setAddingIngredientToMealId(null);
    setNewIngredientForm({ name: "", quantity: "", unit: "" });

    try {
      const response = await fetch("/api/nutrition/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nutrition_meal_id: mealId,
          name: optimisticIngredient.name,
          quantity: optimisticIngredient.quantity,
          unit: optimisticIngredient.unit,
          ingredient_order: optimisticIngredient.ingredient_order,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Replace optimistic ingredient with real one
        setDays((prevDays) =>
          prevDays.map((day) => ({
            ...day,
            meals:
              day.meals?.map((meal: any) =>
                meal.id === mealId
                  ? {
                      ...meal,
                      ingredients:
                        meal.ingredients?.map((i: any) =>
                          i.id === optimisticIngredient.id ? result.data : i
                        ) || [],
                    }
                  : meal
              ) || [],
          }))
        );
      } else {
        // Rollback on error
        setDays((prevDays) =>
          prevDays.map((day) => ({
            ...day,
            meals:
              day.meals?.map((meal: any) =>
                meal.id === mealId
                  ? {
                      ...meal,
                      ingredients:
                        meal.ingredients?.filter(
                          (i: any) => i.id !== optimisticIngredient.id
                        ) || [],
                    }
                  : meal
              ) || [],
          }))
        );
        alert("Error al agregar ingrediente");
      }
    } catch (error) {
      console.error("Error adding ingredient:", error);
      setDays((prevDays) =>
        prevDays.map((day) => ({
          ...day,
          meals:
            day.meals?.map((meal: any) =>
              meal.id === mealId
                ? {
                    ...meal,
                    ingredients:
                      meal.ingredients?.filter(
                        (i: any) => i.id !== optimisticIngredient.id
                      ) || [],
                  }
                : meal
            ) || [],
        }))
      );
      alert("Error al agregar ingrediente");
    }
  };

  const handleEditIngredient = async (ingredientId: string, data: any) => {
    // Store old ingredient for rollback
    let oldIngredient: any = null;

    // Optimistically update UI
    setDays((prevDays) =>
      prevDays.map((day) => ({
        ...day,
        meals:
          day.meals?.map((meal: any) => ({
            ...meal,
            ingredients:
              meal.ingredients?.map((i: any) => {
                if (i.id === ingredientId) {
                  oldIngredient = i;

                  return { ...i, ...data };
                }

                return i;
              }) || [],
          })) || [],
      }))
    );
    setEditingIngredientId(null);

    try {
      const response = await fetch(
        `/api/nutrition/ingredients/${ingredientId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        // Rollback on error
        if (oldIngredient) {
          setDays((prevDays) =>
            prevDays.map((day) => ({
              ...day,
              meals:
                day.meals?.map((meal: any) => ({
                  ...meal,
                  ingredients:
                    meal.ingredients?.map((i: any) =>
                      i.id === ingredientId ? oldIngredient : i
                    ) || [],
                })) || [],
            }))
          );
        }
        alert("Error al editar ingrediente");
      }
    } catch (error) {
      console.error("Error editing ingredient:", error);
      if (oldIngredient) {
        setDays((prevDays) =>
          prevDays.map((day) => ({
            ...day,
            meals:
              day.meals?.map((meal: any) => ({
                ...meal,
                ingredients:
                  meal.ingredients?.map((i: any) =>
                    i.id === ingredientId ? oldIngredient : i
                  ) || [],
              })) || [],
          }))
        );
      }
      alert("Error al editar ingrediente");
    }
  };

  const handleDeleteIngredient = async (ingredientId: string) => {
    if (!confirm("¿Estás seguro de eliminar este ingrediente?")) return;

    // Find and store the ingredient for potential rollback
    let deletedIngredient: any = null;
    let parentMealId: string | null = null;

    setDays((prevDays) =>
      prevDays.map((day) => ({
        ...day,
        meals:
          day.meals?.map((meal: any) => {
            const ingredient = meal.ingredients?.find(
              (i: any) => i.id === ingredientId
            );

            if (ingredient) {
              deletedIngredient = ingredient;
              parentMealId = meal.id;

              return {
                ...meal,
                ingredients:
                  meal.ingredients?.filter((i: any) => i.id !== ingredientId) ||
                  [],
              };
            }

            return meal;
          }) || [],
      }))
    );

    try {
      const response = await fetch(
        `/api/nutrition/ingredients/${ingredientId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        // Rollback on error
        if (deletedIngredient && parentMealId) {
          setDays((prevDays) =>
            prevDays.map((day) => ({
              ...day,
              meals:
                day.meals?.map((meal: any) =>
                  meal.id === parentMealId
                    ? {
                        ...meal,
                        ingredients: [
                          ...(meal.ingredients || []),
                          deletedIngredient,
                        ],
                      }
                    : meal
                ) || [],
            }))
          );
        }
        alert("Error al eliminar ingrediente");
      }
    } catch (error) {
      console.error("Error deleting ingredient:", error);
      if (deletedIngredient && parentMealId) {
        setDays((prevDays) =>
          prevDays.map((day) => ({
            ...day,
            meals:
              day.meals?.map((meal: any) =>
                meal.id === parentMealId
                  ? {
                      ...meal,
                      ingredients: [
                        ...(meal.ingredients || []),
                        deletedIngredient,
                      ],
                    }
                  : meal
              ) || [],
          }))
        );
      }
      alert("Error al eliminar ingrediente");
    }
  };

  // Compute daily macros as sum of all meal macros for a given day
  const computeDayMacros = (day: any) => {
    const meals = day.meals || [];
    let protein = 0;
    let carbs = 0;
    let fats = 0;
    let calories = 0;

    for (const meal of meals) {
      // If meal has explicit macros, use those
      if (meal.protein || meal.carbs || meal.fats || meal.calories) {
        protein += meal.protein || 0;
        carbs += meal.carbs || 0;
        fats += meal.fats || 0;
        calories += meal.calories || 0;
      } else {
        // Otherwise sum from ingredients
        for (const ing of meal.ingredients || []) {
          protein += ing.protein || 0;
          carbs += ing.carbs || 0;
          fats += ing.fats || 0;
          calories += ing.calories || 0;
        }
      }
    }

    return { protein, carbs, fats, calories };
  };

  // Get effective macros for a day: use stored values if they exist and are non-zero, otherwise compute from meals
  const getEffectiveDayMacros = (day: any) => {
    const hasManualMacros =
      (day.protein && day.protein > 0) ||
      (day.carbs && day.carbs > 0) ||
      (day.fats && day.fats > 0) ||
      (day.calories && day.calories > 0);

    if (hasManualMacros) {
      return {
        protein: day.protein || 0,
        carbs: day.carbs || 0,
        fats: day.fats || 0,
        calories: day.calories || 0,
        isComputed: false,
      };
    }

    const computed = computeDayMacros(day);

    return { ...computed, isComputed: true };
  };

  const handleEditDayMacrosClick = (day: any) => {
    setEditingDayMacros(day.id);
    const effective = getEffectiveDayMacros(day);

    setDayMacrosForm({
      protein: effective.protein.toString(),
      carbs: effective.carbs.toString(),
      fats: effective.fats.toString(),
      calories: effective.calories.toString(),
    });
  };

  const handleSaveDayMacros = async (dayId: string) => {
    const newMacros = {
      protein: parseFloat(dayMacrosForm.protein) || 0,
      carbs: parseFloat(dayMacrosForm.carbs) || 0,
      fats: parseFloat(dayMacrosForm.fats) || 0,
      calories: parseFloat(dayMacrosForm.calories) || 0,
    };

    // Store old macros for rollback
    const oldDay = days.find((d) => d.id === dayId);

    // Optimistically update UI
    setDays((prevDays) =>
      prevDays.map((day) => (day.id === dayId ? { ...day, ...newMacros } : day))
    );
    setEditingDayMacros(null);

    try {
      const response = await fetch(`/api/nutrition/days/${dayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMacros),
      });

      if (!response.ok) {
        // Rollback on error
        if (oldDay) {
          setDays((prevDays) =>
            prevDays.map((day) => (day.id === dayId ? oldDay : day))
          );
        }
        alert("Error al guardar macros del día");
      }
    } catch (error) {
      console.error("Error saving day macros:", error);
      if (oldDay) {
        setDays((prevDays) =>
          prevDays.map((day) => (day.id === dayId ? oldDay : day))
        );
      }
      alert("Error al guardar macros del día");
    }
  };

  const handleEditMealMacrosClick = (meal: any) => {
    setEditingMealMacros(meal.id);
    setMealMacrosForm({
      protein: (meal.protein || 0).toString(),
      carbs: (meal.carbs || 0).toString(),
      fats: (meal.fats || 0).toString(),
      calories: (meal.calories || 0).toString(),
    });
  };

  const handleSaveMealMacros = async (mealId: string) => {
    const newMacros = {
      protein: parseFloat(mealMacrosForm.protein) || 0,
      carbs: parseFloat(mealMacrosForm.carbs) || 0,
      fats: parseFloat(mealMacrosForm.fats) || 0,
      calories: parseFloat(mealMacrosForm.calories) || 0,
    };

    // Store old meal for rollback
    let oldMeal: any = null;

    days.forEach((day) => {
      const meal = day.meals?.find((m: any) => m.id === mealId);

      if (meal) oldMeal = meal;
    });

    // Optimistically update UI
    setDays((prevDays) =>
      prevDays.map((day) => ({
        ...day,
        meals:
          day.meals?.map((meal: any) =>
            meal.id === mealId ? { ...meal, ...newMacros } : meal
          ) || [],
      }))
    );
    setEditingMealMacros(null);

    try {
      const response = await fetch(`/api/nutrition/meals/${mealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMacros),
      });

      if (!response.ok) {
        // Rollback on error
        if (oldMeal) {
          setDays((prevDays) =>
            prevDays.map((day) => ({
              ...day,
              meals:
                day.meals?.map((meal: any) =>
                  meal.id === mealId ? oldMeal : meal
                ) || [],
            }))
          );
        }
        alert("Error al guardar macros de la comida");
      }
    } catch (error) {
      console.error("Error saving meal macros:", error);
      if (oldMeal) {
        setDays((prevDays) =>
          prevDays.map((day) => ({
            ...day,
            meals:
              day.meals?.map((meal: any) =>
                meal.id === mealId ? oldMeal : meal
              ) || [],
          }))
        );
      }
      alert("Error al guardar macros de la comida");
    }
  };

  // Program CRUD handlers
  const handleAddSession = async () => {
    if (!newSessionForm.name.trim()) return;

    const optimisticSession = {
      id: `temp-${Date.now()}`,
      program_id: template.id,
      name: newSessionForm.name,
      session_order: sessions.length,
      metadata: {},
      exercises: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistically add to UI
    setSessions([...sessions, optimisticSession]);
    setIsAddingSession(false);
    setNewSessionForm({ name: "" });

    // Expand the new session automatically
    setExpandedSessions(new Set([...expandedSessions, optimisticSession.id]));

    try {
      const response = await fetch(`/api/templates/${template.id}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: optimisticSession.name,
          sessionOrder: optimisticSession.session_order,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Replace optimistic session with real one
        setSessions((prevSessions) =>
          prevSessions.map((s) =>
            s.id === optimisticSession.id
              ? { ...result.session, exercises: [] }
              : s
          )
        );
        // Update expanded set with real ID
        setExpandedSessions((prev) => {
          const newSet = new Set(prev);

          newSet.delete(optimisticSession.id);
          newSet.add(result.session.id);

          return newSet;
        });
      } else {
        // Rollback on error
        setSessions((prevSessions) =>
          prevSessions.filter((s) => s.id !== optimisticSession.id)
        );
        alert("Error al crear sesión");
      }
    } catch (error) {
      console.error("Error adding session:", error);
      setSessions((prevSessions) =>
        prevSessions.filter((s) => s.id !== optimisticSession.id)
      );
      alert("Error al crear sesión");
    }
  };

  const handleEditSessionName = async (sessionId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingSessionId(null);

      return;
    }

    // Optimistically update
    const oldSessions = [...sessions];

    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, name: newName } : s))
    );
    setEditingSessionId(null);

    try {
      const response = await fetch(`/api/templates/${template.id}/sessions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          name: newName,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setSessions(oldSessions);
        console.error("Error updating session name:", result.error);
      }
    } catch (error) {
      setSessions(oldSessions);
      console.error("Error updating session name:", error);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("¿Estás seguro de eliminar esta sesión?")) return;

    // Optimistically remove from UI
    const sessionToDelete = sessions.find((s) => s.id === sessionId);

    setSessions((prevSessions) =>
      prevSessions.filter((s) => s.id !== sessionId)
    );

    try {
      const response = await fetch(
        `/api/templates/${template.id}/sessions/${sessionId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        // Rollback on error
        if (sessionToDelete) {
          setSessions((prevSessions) =>
            [...prevSessions, sessionToDelete].sort(
              (a, b) => a.session_order - b.session_order
            )
          );
        }
        alert("Error al eliminar sesión");
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      if (sessionToDelete) {
        setSessions((prevSessions) =>
          [...prevSessions, sessionToDelete].sort(
            (a, b) => a.session_order - b.session_order
          )
        );
      }
      alert("Error al eliminar sesión");
    }
  };

  const handleAddExercise = async (sessionId: string) => {
    if (!newExerciseForm.name.trim()) return;

    const optimisticExercise = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      exercise_id: newExerciseForm.exercise_id || `temp-exercise-${Date.now()}`,
      exercise_order: 0,
      sets: parseInt(newExerciseForm.sets) || 0,
      reps: newExerciseForm.reps,
      rest_seconds: parseInt(newExerciseForm.rest_seconds) || 0,
      metadata: {
        notes: newExerciseForm.notes,
      },
      exercises: {
        name: newExerciseForm.name,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistically add to UI
    setSessions((prevSessions) =>
      prevSessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              exercises: [...(session.exercises || []), optimisticExercise],
            }
          : session
      )
    );
    setAddingExerciseToSessionId(null);
    setNewExerciseForm({
      exercise_id: "",
      name: "",
      sets: "",
      reps: "",
      rest_seconds: "",
      notes: "",
    });

    try {
      const response = await fetch(
        `/api/templates/${template.id}/sessions/${sessionId}/exercises`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newExerciseForm.name,
            exerciseId: newExerciseForm.exercise_id || undefined,
            sets: optimisticExercise.sets,
            reps: optimisticExercise.reps,
            rest: optimisticExercise.rest_seconds,
            notes: newExerciseForm.notes,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        // Replace optimistic exercise with real one
        setSessions((prevSessions) =>
          prevSessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  exercises:
                    session.exercises?.map((e) =>
                      e.id === optimisticExercise.id
                        ? result.sessionExercise
                        : e
                    ) || [],
                }
              : session
          )
        );
      } else {
        // Rollback on error
        setSessions((prevSessions) =>
          prevSessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  exercises:
                    session.exercises?.filter(
                      (e) => e.id !== optimisticExercise.id
                    ) || [],
                }
              : session
          )
        );
        alert("Error al agregar ejercicio");
      }
    } catch (error) {
      console.error("Error adding exercise:", error);
      setSessions((prevSessions) =>
        prevSessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                exercises:
                  session.exercises?.filter(
                    (e) => e.id !== optimisticExercise.id
                  ) || [],
              }
            : session
        )
      );
      alert("Error al agregar ejercicio");
    }
  };

  const handleEditExercise = async (exerciseId: string, data: any) => {
    // Store old exercise for rollback and find the session it belongs to
    let oldExercise: any = null;
    let sessionId: string | null = null;

    // Find which session this exercise belongs to
    for (const session of sessions) {
      const found = session.exercises?.find((e) => e.id === exerciseId);

      if (found) {
        sessionId = session.id;
        break;
      }
    }

    if (!sessionId) {
      alert("Error: no se encontró la sesión del ejercicio");

      return;
    }

    // Optimistically update UI
    setSessions((prevSessions) =>
      prevSessions.map((session) => ({
        ...session,
        exercises:
          session.exercises?.map((e) => {
            if (e.id === exerciseId) {
              oldExercise = e;

              const updatedExercise = {
                ...e,
                ...(data.name !== undefined && {
                  custom_name: data.name || null,
                }),
                ...(data.sets !== undefined && { sets: parseInt(data.sets) }),
                ...(data.reps !== undefined && { reps: data.reps }),
                ...(data.rest_seconds !== undefined && {
                  rest_seconds: parseInt(data.rest_seconds),
                }),
                ...(data.notes !== undefined && { notes: data.notes }),
              };

              return updatedExercise;
            }

            return e;
          }) || [],
      }))
    );
    setEditingExerciseId(null);

    try {
      const response = await fetch(
        `/api/templates/${template.id}/sessions/${sessionId}/exercises`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionExerciseId: exerciseId,
            name: data.name,
            sets: data.sets,
            reps: data.reps,
            rest_seconds: data.rest_seconds,
            notes: data.notes,
          }),
        }
      );

      if (!response.ok) {
        // Rollback on error
        if (oldExercise) {
          setSessions((prevSessions) =>
            prevSessions.map((session) => ({
              ...session,
              exercises:
                session.exercises?.map((e) =>
                  e.id === exerciseId ? oldExercise : e
                ) || [],
            }))
          );
        }
        alert("Error al editar ejercicio");
      }
    } catch (error) {
      console.error("Error editing exercise:", error);
      if (oldExercise) {
        setSessions((prevSessions) =>
          prevSessions.map((session) => ({
            ...session,
            exercises:
              session.exercises?.map((e) =>
                e.id === exerciseId ? oldExercise : e
              ) || [],
          }))
        );
      }
      alert("Error al editar ejercicio");
    }
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    if (!confirm("¿Estás seguro de eliminar este ejercicio?")) return;

    // Find and store the exercise for potential rollback
    let deletedExercise: any = null;
    let parentSessionId: string | null = null;

    setSessions((prevSessions) =>
      prevSessions.map((session) => {
        const exercise = session.exercises?.find((e) => e.id === exerciseId);

        if (exercise) {
          deletedExercise = exercise;
          parentSessionId = session.id;

          return {
            ...session,
            exercises:
              session.exercises?.filter((e) => e.id !== exerciseId) || [],
          };
        }

        return session;
      })
    );

    try {
      const response = await fetch(
        `/api/templates/${template.id}/sessions/${parentSessionId}/exercises?sessionExerciseId=${exerciseId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        // Rollback on error
        if (deletedExercise && parentSessionId) {
          setSessions((prevSessions) =>
            prevSessions.map((session) =>
              session.id === parentSessionId
                ? {
                    ...session,
                    exercises: [...(session.exercises || []), deletedExercise],
                  }
                : session
            )
          );
        }
        alert("Error al eliminar ejercicio");
      }
    } catch (error) {
      console.error("Error deleting exercise:", error);
      if (deletedExercise && parentSessionId) {
        setSessions((prevSessions) =>
          prevSessions.map((session) =>
            session.id === parentSessionId
              ? {
                  ...session,
                  exercises: [...(session.exercises || []), deletedExercise],
                }
              : session
          )
        );
      }
      alert("Error al eliminar ejercicio");
    }
  };

  // Build updated template data to pass back on close
  const handleClose = useCallback(() => {
    const totalExercises = sessions.reduce(
      (sum, s) => sum + (s.exercises?.length || 0),
      0
    );
    const totalMeals = days.reduce((sum, d) => sum + (d.meals?.length || 0), 0);

    const payload: Parameters<typeof onClose>[0] = {
      name: formData.name,
      type: formData.type,
      category: formData.category as "cardio" | "strength" | "nutrition",
      sessionCount: sessions.length,
      exerciseCount: totalExercises,
      dayCount: days.length,
      mealCount: totalMeals,
    };

    if (formData.description != null && formData.description !== "")
      payload.description = formData.description;
    if (formData.division != null && formData.division !== "")
      payload.division = formData.division;
    if (formData.goal != null && formData.goal !== "")
      payload.goal = formData.goal;
    if (formData.sessionsPerWeek != null && formData.sessionsPerWeek !== "")
      payload.sessionsPerWeek = parseInt(formData.sessionsPerWeek);
    onClose(payload);
  }, [formData, sessions, days, onClose]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Reorder sessions handler
  const handleSessionDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      const oldIndex = sessions.findIndex((s) => s.id === active.id);
      const newIndex = sessions.findIndex((s) => s.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      // Capture previous state before optimistic update
      const previousSessions = [...sessions];
      const reordered = arrayMove(sessions, oldIndex, newIndex);

      setSessions(reordered);

      // Build reorder payload
      const reorderPayload = reordered.map((s, idx) => ({
        id: s.id,
        session_order: idx + 1,
      }));

      try {
        const response = await fetch(`/api/templates/${template.id}/sessions`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reorder: reorderPayload }),
        });
        const result = await response.json();

        if (!result.success) {
          // Rollback to captured previous state
          setSessions(previousSessions);
          console.error("Error reordering sessions:", result.error);
        }
      } catch (error) {
        setSessions(previousSessions);
        console.error("Error reordering sessions:", error);
      }
    },
    [sessions, template.id]
  );

  // Reorder days handler
  const handleDayDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      const oldIndex = days.findIndex((d) => d.id === active.id);
      const newIndex = days.findIndex((d) => d.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      // Capture previous state before optimistic update
      const previousDays = [...days];
      const reordered = arrayMove(days, oldIndex, newIndex);

      setDays(reordered);

      const reorderPayload = reordered.map((d, idx) => ({
        id: d.id,
        day_order: idx,
      }));

      try {
        const response = await fetch("/api/nutrition/days", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reorder: reorderPayload }),
        });
        const result = await response.json();

        if (!result.success) {
          setDays(previousDays);
          console.error("Error reordering days:", result.error);
        }
      } catch (error) {
        setDays(previousDays);
        console.error("Error reordering days:", error);
      }
    },
    [days]
  );

  // Reorder exercises within a session handler
  const handleExerciseDragEnd = useCallback(
    async (sessionId: string, event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      const session = sessions.find((s) => s.id === sessionId);

      if (!session || !session.exercises) return;

      const oldIndex = session.exercises.findIndex((e) => e.id === active.id);
      const newIndex = session.exercises.findIndex((e) => e.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      // Capture previous state before optimistic update
      const previousSessions = sessions.map((s) => ({
        ...s,
        exercises: s.exercises ? [...s.exercises] : [],
      }));

      const reorderedExercises = arrayMove(
        session.exercises,
        oldIndex,
        newIndex
      );

      // Optimistic update
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, exercises: reorderedExercises } : s
        )
      );

      // Build reorder payload
      const reorderPayload = reorderedExercises.map((e, idx) => ({
        id: e.id,
        exercise_order: idx + 1,
      }));

      try {
        const response = await fetch(
          `/api/templates/${template.id}/sessions/${sessionId}/exercises`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reorder: reorderPayload }),
          }
        );
        const result = await response.json();

        if (!result.success) {
          setSessions(previousSessions);
          console.error("Error reordering exercises:", result.error);
        }
      } catch (error) {
        setSessions(previousSessions);
        console.error("Error reordering exercises:", error);
      }
    },
    [sessions, template.id]
  );

  return (
    <>
      <Modal
        classNames={{
          base: "max-h-[90vh]",
          header: "border-b border-gray-200",
          footer: "border-t border-gray-200",
          body: "py-6",
        }}
        isOpen={isOpen}
        scrollBehavior="inside"
        size="5xl"
        onClose={handleClose}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="w-full space-y-4 py-1">
              {/* Icon + Title Row */}
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl ${
                    template.templateType === "nutrition"
                      ? "bg-green-50"
                      : formData.category === "cardio"
                        ? "bg-amber-50"
                        : "bg-slate-100"
                  }`}
                >
                  <Icon
                    className={
                      template.templateType === "nutrition"
                        ? "text-green-600"
                        : formData.category === "cardio"
                          ? "text-amber-600"
                          : "text-slate-700"
                    }
                    icon={
                      template.templateType === "nutrition"
                        ? "fluent:food-20-filled"
                        : formData.category === "cardio"
                          ? "solar:heart-pulse-bold"
                          : "solar:dumbbell-bold"
                    }
                    width={24}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  {editingField === "name" ? (
                    <div className="flex items-center gap-2">
                      {}
                      <Input
                        autoFocus
                        classNames={{ input: "text-lg font-bold" }}
                        size="sm"
                        value={formData.name}
                        onBlur={() => handleSaveField("name")}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveField("name");
                          if (e.key === "Escape") {
                            setEditingField(null);
                            setFormData({ ...formData, name: template.name });
                          }
                        }}
                      />
                      {savingField === "name" && <Spinner size="sm" />}
                    </div>
                  ) : (
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
                    <h3
                      className="text-xl font-bold text-gray-900 cursor-pointer hover:text-gray-600 transition-colors truncate"
                      title="Clic para editar"
                      onClick={() => setEditingField("name")}
                    >
                      {formData.name}
                    </h3>
                  )}
                  {/* Description */}
                  {editingField === "description" ? (
                    <div className="flex items-start gap-2 mt-1">
                      {}
                      <Textarea
                        autoFocus
                        minRows={1}
                        size="sm"
                        value={formData.description}
                        onBlur={() => handleSaveField("description")}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setEditingField(null);
                            setFormData({
                              ...formData,
                              description: template.description || "",
                            });
                          }
                        }}
                      />
                      {savingField === "description" && <Spinner size="sm" />}
                    </div>
                  ) : (
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
                    <p
                      className="text-sm text-gray-500 font-normal cursor-pointer hover:text-gray-400 transition-colors mt-0.5"
                      title="Clic para editar"
                      onClick={() => setEditingField("description")}
                    >
                      {formData.description || "Agregar descripción..."}
                    </p>
                  )}
                </div>
              </div>

              {/* Metadata Pills */}
              {template.templateType !== "nutrition" && (
                <div className="flex flex-wrap items-center gap-2">
                  {/* Tipo */}
                  {editingField === "type" ? (
                    <div className="flex items-center gap-1">
                      {}
                      <Input
                        autoFocus
                        className="w-40"
                        placeholder="Tipo de programa"
                        size="sm"
                        value={formData.type}
                        onBlur={() => handleSaveField("type")}
                        onChange={(e) =>
                          setFormData({ ...formData, type: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveField("type");
                          if (e.key === "Escape") {
                            setEditingField(null);
                            setFormData({
                              ...formData,
                              type: template.type || "Strength",
                            });
                          }
                        }}
                      />
                      {savingField === "type" && <Spinner size="sm" />}
                    </div>
                  ) : (
                    <button
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                      title="Clic para editar"
                      onClick={() => setEditingField("type")}
                    >
                      <Icon
                        className="text-gray-500"
                        icon="solar:tag-bold"
                        width={14}
                      />
                      {formData.type || "Sin tipo"}
                    </button>
                  )}

                  {/* División / Objetivo */}
                  {formData.category === "strength" ? (
                    editingField === "division" ? (
                      <div className="flex items-center gap-1">
                        {}
                        <Input
                          autoFocus
                          className="w-48"
                          placeholder="División"
                          size="sm"
                          value={formData.division}
                          onBlur={() => handleSaveField("division")}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              division: e.target.value,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveField("division");
                            if (e.key === "Escape") {
                              setEditingField(null);
                              setFormData({
                                ...formData,
                                division: template.division || "",
                              });
                            }
                          }}
                        />
                        {savingField === "division" && <Spinner size="sm" />}
                      </div>
                    ) : (
                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                        title="Clic para editar"
                        onClick={() => setEditingField("division")}
                      >
                        <Icon
                          className="text-gray-500"
                          icon="solar:layers-bold"
                          width={14}
                        />
                        {formData.division || "Sin división"}
                      </button>
                    )
                  ) : editingField === "goal" ? (
                    <div className="flex items-center gap-1">
                      {}
                      <Input
                        autoFocus
                        className="w-48"
                        placeholder="Objetivo"
                        size="sm"
                        value={formData.goal}
                        onBlur={() => handleSaveField("goal")}
                        onChange={(e) =>
                          setFormData({ ...formData, goal: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveField("goal");
                          if (e.key === "Escape") {
                            setEditingField(null);
                            setFormData({
                              ...formData,
                              goal: template.goal || "",
                            });
                          }
                        }}
                      />
                      {savingField === "goal" && <Spinner size="sm" />}
                    </div>
                  ) : (
                    <button
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                      title="Clic para editar"
                      onClick={() => setEditingField("goal")}
                    >
                      <Icon
                        className="text-gray-500"
                        icon="solar:target-bold"
                        width={14}
                      />
                      {formData.goal || "Sin objetivo"}
                    </button>
                  )}

                  {/* Sesiones por semana */}
                  {editingField === "sessionsPerWeek" ? (
                    <div className="flex items-center gap-1">
                      {}
                      <Input
                        autoFocus
                        className="w-20"
                        size="sm"
                        type="number"
                        value={formData.sessionsPerWeek}
                        onBlur={() => handleSaveField("sessionsPerWeek")}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            sessionsPerWeek: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            handleSaveField("sessionsPerWeek");
                          if (e.key === "Escape") {
                            setEditingField(null);
                            setFormData({
                              ...formData,
                              sessionsPerWeek:
                                template.sessionsPerWeek?.toString() || "3",
                            });
                          }
                        }}
                      />
                      {savingField === "sessionsPerWeek" && (
                        <Spinner size="sm" />
                      )}
                    </div>
                  ) : (
                    <button
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                      title="Clic para editar"
                      onClick={() => setEditingField("sessionsPerWeek")}
                    >
                      <Icon
                        className="text-gray-500"
                        icon="solar:calendar-bold"
                        width={14}
                      />
                      {formData.sessionsPerWeek} ses/sem
                    </button>
                  )}
                </div>
              )}
            </div>
          </ModalHeader>
          <ModalBody>
            <div>
              {template.templateType === "program" ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Icon
                        className="text-slate-700"
                        icon="solar:clipboard-list-bold"
                        width={18}
                      />
                      Sesiones ({sessions.length})
                    </h4>
                    <Button
                      className="bg-black text-white hover:bg-slate-800"
                      size="sm"
                      startContent={
                        <Icon icon="solar:add-circle-bold" width={18} />
                      }
                      onPress={() => setIsAddingSession(true)}
                    >
                      Agregar Sesión
                    </Button>
                  </div>

                  {isAddingSession && (
                    <Card className="mb-4 border border-slate-200 shadow-sm">
                      <CardBody className="p-4">
                        <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">
                          Nueva Sesión
                        </p>
                        <div className="flex gap-3 items-end">
                          {}
                          <Input
                            autoFocus
                            className="flex-1"
                            label="Nombre de la sesión"
                            placeholder="Ej: Día 1 - Push, Tren Superior, Piernas"
                            size="sm"
                            value={newSessionForm.name}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddSession();
                            }}
                            onValueChange={(value) =>
                              setNewSessionForm({
                                ...newSessionForm,
                                name: value,
                              })
                            }
                          />
                          <Button
                            className="bg-black text-white hover:bg-slate-800"
                            size="sm"
                            onPress={handleAddSession}
                          >
                            Guardar
                          </Button>
                          <Button
                            size="sm"
                            variant="light"
                            onPress={() => {
                              setIsAddingSession(false);
                              setNewSessionForm({ name: "" });
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  )}

                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <Spinner />
                    </div>
                  ) : sessions.length === 0 && !isAddingSession ? (
                    <div className="text-center py-8 text-gray-400">
                      <Icon
                        className="mx-auto mb-3"
                        icon="solar:dumbbell-linear"
                        width={48}
                      />
                      <p className="text-gray-600 font-medium">
                        No hay sesiones en esta plantilla
                      </p>
                      <p className="text-sm mt-1">
                        Haz clic en &quot;Agregar Sesión&quot; para comenzar
                      </p>
                    </div>
                  ) : (
                    <DndContext
                      collisionDetection={closestCenter}
                      sensors={sensors}
                      onDragEnd={handleSessionDragEnd}
                    >
                      <SortableContext
                        items={sessions.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {sessions.map((session) => (
                            <SortableSessionItem
                              key={session.id}
                              id={session.id}
                            >
                              {({ dragHandleProps }) => (
                                <>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <div
                                        className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 transition-colors drag-handle flex-shrink-0"
                                        {...dragHandleProps}
                                      >
                                        <Icon
                                          icon="solar:hamburger-menu-linear"
                                          width={18}
                                        />
                                      </div>
                                      {editingSessionId === session.id ? (
                                        <div className="flex items-center gap-2 flex-1">
                                          {}
                                          <Input
                                            autoFocus
                                            size="sm"
                                            value={editingSessionName}
                                            onBlur={() =>
                                              handleEditSessionName(
                                                session.id,
                                                editingSessionName
                                              )
                                            }
                                            onChange={(e) =>
                                              setEditingSessionName(
                                                e.target.value
                                              )
                                            }
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter")
                                                handleEditSessionName(
                                                  session.id,
                                                  editingSessionName
                                                );
                                              if (e.key === "Escape")
                                                setEditingSessionId(null);
                                            }}
                                          />
                                        </div>
                                      ) : (
                                        <button
                                          className="flex items-center gap-3 flex-1 min-w-0"
                                          onClick={() =>
                                            toggleSession(session.id)
                                          }
                                        >
                                          <span className="font-semibold text-gray-900 truncate">
                                            {session.name}
                                          </span>
                                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                            {session.exercises?.length || 0}{" "}
                                            ejercicios
                                          </span>
                                          <Icon
                                            className={`transition-transform text-gray-400 flex-shrink-0 ${
                                              expandedSessions.has(session.id)
                                                ? "rotate-180"
                                                : ""
                                            }`}
                                            icon="solar:alt-arrow-down-linear"
                                            width={18}
                                          />
                                        </button>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        onPress={() => {
                                          setEditingSessionId(session.id);
                                          setEditingSessionName(session.name);
                                        }}
                                      >
                                        <Icon
                                          className="text-gray-400"
                                          icon="solar:pen-bold"
                                          width={14}
                                        />
                                      </Button>
                                      <Button
                                        isIconOnly
                                        color="danger"
                                        size="sm"
                                        variant="light"
                                        onPress={() =>
                                          handleDeleteSession(session.id)
                                        }
                                      >
                                        <Icon
                                          icon="solar:trash-bin-trash-bold"
                                          width={16}
                                        />
                                      </Button>
                                    </div>
                                  </div>

                                  {expandedSessions.has(session.id) && (
                                    <div className="mt-4 space-y-2 pt-3 border-t border-gray-100">
                                      <div className="flex justify-end mb-2">
                                        <Button
                                          className="bg-black text-white hover:bg-slate-800"
                                          size="sm"
                                          startContent={
                                            <Icon
                                              icon="solar:add-circle-bold"
                                              width={16}
                                            />
                                          }
                                          onPress={() =>
                                            setAddingExerciseToSessionId(
                                              session.id
                                            )
                                          }
                                        >
                                          Agregar Ejercicio
                                        </Button>
                                      </div>

                                      {addingExerciseToSessionId ===
                                        session.id && (
                                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-3">
                                          <div className="space-y-2 mb-2">
                                            <div className="flex gap-2 mb-2">
                                              <Button
                                                className={
                                                  exerciseCategoryFilter ===
                                                  "all"
                                                    ? "bg-black text-white"
                                                    : "text-gray-600"
                                                }
                                                size="sm"
                                                startContent={
                                                  <Icon
                                                    icon="solar:list-bold"
                                                    width={16}
                                                  />
                                                }
                                                variant={
                                                  exerciseCategoryFilter ===
                                                  "all"
                                                    ? "solid"
                                                    : "bordered"
                                                }
                                                onPress={() =>
                                                  setExerciseCategoryFilter(
                                                    "all"
                                                  )
                                                }
                                              >
                                                Todos
                                              </Button>
                                              <Button
                                                className={
                                                  exerciseCategoryFilter ===
                                                  "strength"
                                                    ? "bg-black text-white"
                                                    : "text-gray-600"
                                                }
                                                size="sm"
                                                startContent={
                                                  <Icon
                                                    icon="solar:dumbbell-bold"
                                                    width={16}
                                                  />
                                                }
                                                variant={
                                                  exerciseCategoryFilter ===
                                                  "strength"
                                                    ? "solid"
                                                    : "bordered"
                                                }
                                                onPress={() =>
                                                  setExerciseCategoryFilter(
                                                    "strength"
                                                  )
                                                }
                                              >
                                                Fuerza
                                              </Button>
                                              <Button
                                                className={
                                                  exerciseCategoryFilter ===
                                                  "cardio"
                                                    ? "bg-black text-white"
                                                    : "text-gray-600"
                                                }
                                                size="sm"
                                                startContent={
                                                  <Icon
                                                    icon="solar:running-round-bold"
                                                    width={16}
                                                  />
                                                }
                                                variant={
                                                  exerciseCategoryFilter ===
                                                  "cardio"
                                                    ? "solid"
                                                    : "bordered"
                                                }
                                                onPress={() =>
                                                  setExerciseCategoryFilter(
                                                    "cardio"
                                                  )
                                                }
                                              >
                                                Cardio
                                              </Button>
                                            </div>
                                            <div className="flex gap-2 items-end">
                                              {}
                                              <Autocomplete
                                                key={`exercises-${filteredExercises.length}-${exerciseCategoryFilter}`}
                                                autoFocus
                                                className="flex-1"
                                                defaultItems={filteredExercises}
                                                label="Buscar ejercicio"
                                                listboxProps={{
                                                  className:
                                                    "shadow-lg border border-gray-200 rounded-xl",
                                                }}
                                                placeholder="Escribe para buscar..."
                                                popoverProps={{
                                                  className: "shadow-xl",
                                                  placement: "bottom",
                                                }}
                                                selectedKey={
                                                  newExerciseForm.exercise_id ||
                                                  null
                                                }
                                                size="sm"
                                                startContent={
                                                  newExerciseForm.exercise_id &&
                                                  (() => {
                                                    const selected =
                                                      exerciseLibrary.find(
                                                        (ex) =>
                                                          ex.id ===
                                                          newExerciseForm.exercise_id
                                                      );

                                                    return selected?.image_url ? (
                                                      // eslint-disable-next-line @next/next/no-img-element
                                                      <img
                                                        alt={selected.name}
                                                        className="w-6 h-6 rounded object-cover"
                                                        src={selected.image_url}
                                                      />
                                                    ) : null;
                                                  })()
                                                }
                                                onSelectionChange={(key) => {
                                                  if (key) {
                                                    const selectedExercise =
                                                      exerciseLibrary.find(
                                                        (ex) => ex.id === key
                                                      );

                                                    if (selectedExercise) {
                                                      setNewExerciseForm({
                                                        exercise_id:
                                                          selectedExercise.id,
                                                        name: selectedExercise.name,
                                                        sets:
                                                          selectedExercise.default_sets?.toString() ||
                                                          "",
                                                        reps:
                                                          selectedExercise.default_reps ||
                                                          "",
                                                        rest_seconds:
                                                          selectedExercise.default_rest_seconds?.toString() ||
                                                          "",
                                                        notes:
                                                          selectedExercise.description ||
                                                          "",
                                                      });
                                                    }
                                                  }
                                                }}
                                              >
                                                {(exercise) => (
                                                  <AutocompleteItem
                                                    key={exercise.id}
                                                    className="py-2 data-[hover=true]:bg-slate-100"
                                                    startContent={
                                                      exercise.image_url ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                          alt={exercise.name}
                                                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                                                          src={
                                                            exercise.image_url
                                                          }
                                                        />
                                                      ) : (
                                                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                                          <Icon
                                                            className="text-slate-500"
                                                            icon={
                                                              exercise.category ===
                                                              "cardio"
                                                                ? "solar:running-bold"
                                                                : "solar:dumbbell-bold"
                                                            }
                                                            width={24}
                                                          />
                                                        </div>
                                                      )
                                                    }
                                                    textValue={exercise.name}
                                                  >
                                                    <span className="font-medium text-gray-900">
                                                      {exercise.name}
                                                    </span>
                                                  </AutocompleteItem>
                                                )}
                                              </Autocomplete>
                                              <Button
                                                className="bg-black text-white hover:bg-slate-800"
                                                size="sm"
                                                startContent={
                                                  <Icon
                                                    icon="solar:add-circle-bold"
                                                    width={18}
                                                  />
                                                }
                                                onPress={() =>
                                                  setIsAddExerciseModalOpen(
                                                    true
                                                  )
                                                }
                                              >
                                                Crear Nuevo
                                              </Button>
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-2 gap-2 mb-2">
                                            <Input
                                              label="Series"
                                              placeholder=""
                                              size="sm"
                                              type="number"
                                              value={newExerciseForm.sets}
                                              onValueChange={(value) =>
                                                setNewExerciseForm({
                                                  ...newExerciseForm,
                                                  sets: value,
                                                })
                                              }
                                            />
                                            <Input
                                              label="Repeticiones"
                                              placeholder=""
                                              size="sm"
                                              value={newExerciseForm.reps}
                                              onValueChange={(value) =>
                                                setNewExerciseForm({
                                                  ...newExerciseForm,
                                                  reps: value,
                                                })
                                              }
                                            />
                                            <Input
                                              label="Descanso (seg)"
                                              placeholder=""
                                              size="sm"
                                              type="number"
                                              value={
                                                newExerciseForm.rest_seconds
                                              }
                                              onValueChange={(value) =>
                                                setNewExerciseForm({
                                                  ...newExerciseForm,
                                                  rest_seconds: value,
                                                })
                                              }
                                            />
                                            <Input
                                              label="Notas"
                                              placeholder=""
                                              size="sm"
                                              value={newExerciseForm.notes}
                                              onValueChange={(value) =>
                                                setNewExerciseForm({
                                                  ...newExerciseForm,
                                                  notes: value,
                                                })
                                              }
                                            />
                                          </div>
                                          <div className="flex gap-2 justify-end">
                                            <Button
                                              className="bg-black text-white hover:bg-slate-800"
                                              size="sm"
                                              onPress={() =>
                                                handleAddExercise(session.id)
                                              }
                                            >
                                              Guardar
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="flat"
                                              onPress={() => {
                                                setAddingExerciseToSessionId(
                                                  null
                                                );
                                                setNewExerciseForm({
                                                  exercise_id: "",
                                                  name: "",
                                                  sets: "",
                                                  reps: "",
                                                  rest_seconds: "",
                                                  notes: "",
                                                });
                                              }}
                                            >
                                              Cancelar
                                            </Button>
                                          </div>
                                        </div>
                                      )}

                                      <DndContext
                                        collisionDetection={closestCenter}
                                        sensors={sensors}
                                        onDragEnd={(event) =>
                                          handleExerciseDragEnd(
                                            session.id,
                                            event
                                          )
                                        }
                                      >
                                        <SortableContext
                                          items={
                                            session.exercises?.map(
                                              (e) => e.id
                                            ) || []
                                          }
                                          strategy={verticalListSortingStrategy}
                                        >
                                          {session.exercises?.map(
                                            (exercise, idx) => (
                                              <SortableExerciseItem
                                                key={exercise.id}
                                                id={exercise.id}
                                              >
                                                {({ dragHandleProps }) => (
                                                  <div>
                                                    {editingExerciseId ===
                                                    exercise.id ? (
                                                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                                          <Input
                                                            className="col-span-2"
                                                            defaultValue={
                                                              exercise.custom_name ||
                                                              exercise.exercises
                                                                ?.name ||
                                                              ""
                                                            }
                                                            id={`name-${exercise.id}`}
                                                            label="Nombre"
                                                            size="sm"
                                                          />
                                                          <Input
                                                            defaultValue={
                                                              exercise.sets?.toString() ||
                                                              ""
                                                            }
                                                            id={`sets-${exercise.id}`}
                                                            label="Series"
                                                            size="sm"
                                                            type="number"
                                                          />
                                                          <Input
                                                            defaultValue={
                                                              exercise.reps ||
                                                              ""
                                                            }
                                                            id={`reps-${exercise.id}`}
                                                            label="Repeticiones"
                                                            size="sm"
                                                          />
                                                          <Input
                                                            defaultValue={
                                                              exercise.rest_seconds?.toString() ||
                                                              ""
                                                            }
                                                            id={`rest-${exercise.id}`}
                                                            label="Descanso (seg)"
                                                            size="sm"
                                                            type="number"
                                                          />
                                                          <Input
                                                            defaultValue={
                                                              exercise.notes ||
                                                              exercise.metadata
                                                                ?.notes ||
                                                              ""
                                                            }
                                                            id={`notes-${exercise.id}`}
                                                            label="Notas"
                                                            size="sm"
                                                          />
                                                        </div>
                                                        <div className="flex gap-2 justify-end">
                                                          <Button
                                                            isIconOnly
                                                            color="success"
                                                            size="sm"
                                                            variant="flat"
                                                            onPress={() => {
                                                              const name = (
                                                                document.getElementById(
                                                                  `name-${exercise.id}`
                                                                ) as HTMLInputElement
                                                              )?.value;
                                                              const sets = (
                                                                document.getElementById(
                                                                  `sets-${exercise.id}`
                                                                ) as HTMLInputElement
                                                              )?.value;
                                                              const reps = (
                                                                document.getElementById(
                                                                  `reps-${exercise.id}`
                                                                ) as HTMLInputElement
                                                              )?.value;
                                                              const rest_seconds =
                                                                (
                                                                  document.getElementById(
                                                                    `rest-${exercise.id}`
                                                                  ) as HTMLInputElement
                                                                )?.value;
                                                              const notes = (
                                                                document.getElementById(
                                                                  `notes-${exercise.id}`
                                                                ) as HTMLInputElement
                                                              )?.value;

                                                              handleEditExercise(
                                                                exercise.id,
                                                                {
                                                                  name,
                                                                  sets,
                                                                  reps,
                                                                  rest_seconds,
                                                                  notes,
                                                                }
                                                              );
                                                            }}
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
                                                              setEditingExerciseId(
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
                                                      </div>
                                                    ) : (
                                                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                                                        {/* Drag handle */}
                                                        <div
                                                          className="flex items-center justify-center mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                                                          {...dragHandleProps}
                                                        >
                                                          <Icon
                                                            icon="solar:hamburger-menu-linear"
                                                            width={16}
                                                          />
                                                        </div>
                                                        <span className="text-sm font-semibold text-gray-500 min-w-[24px] mt-1">
                                                          {idx + 1}.
                                                        </span>
                                                        {/* Exercise Image */}
                                                        {exercise.exercises
                                                          ?.image_url ? (
                                                          // eslint-disable-next-line @next/next/no-img-element
                                                          <img
                                                            alt={
                                                              exercise.custom_name ||
                                                              exercise.exercises
                                                                .name ||
                                                              "Exercise"
                                                            }
                                                            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                                                            src={
                                                              exercise.exercises
                                                                .image_url
                                                            }
                                                          />
                                                        ) : (
                                                          <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                                            <Icon
                                                              className="text-gray-400"
                                                              icon={
                                                                exercise
                                                                  .exercises
                                                                  ?.category ===
                                                                "cardio"
                                                                  ? "solar:running-bold"
                                                                  : "solar:dumbbell-bold"
                                                              }
                                                              width={28}
                                                            />
                                                          </div>
                                                        )}
                                                        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                                                        <div
                                                          className="flex-1"
                                                          onClick={() =>
                                                            setEditingExerciseId(
                                                              exercise.id
                                                            )
                                                          }
                                                        >
                                                          <p className="font-medium">
                                                            {exercise.custom_name ||
                                                              exercise.exercises
                                                                ?.name ||
                                                              "Ejercicio"}
                                                          </p>
                                                          <div className="text-sm text-gray-600 mt-1">
                                                            {exercise.sets &&
                                                              exercise.reps && (
                                                                <span>
                                                                  {
                                                                    exercise.sets
                                                                  }{" "}
                                                                  series ×{" "}
                                                                  {
                                                                    exercise.reps
                                                                  }{" "}
                                                                  reps
                                                                </span>
                                                              )}
                                                            {exercise.rest_seconds && (
                                                              <span className="ml-2">
                                                                •{" "}
                                                                {
                                                                  exercise.rest_seconds
                                                                }
                                                                s descanso
                                                              </span>
                                                            )}
                                                            {(exercise.notes ||
                                                              exercise.metadata
                                                                ?.notes) && (
                                                              <p className="text-gray-500 mt-1 text-xs italic">
                                                                Notas:{" "}
                                                                {exercise.notes ||
                                                                  exercise
                                                                    .metadata
                                                                    ?.notes}
                                                              </p>
                                                            )}
                                                          </div>
                                                        </div>
                                                        <Button
                                                          isIconOnly
                                                          size="sm"
                                                          variant="light"
                                                          onPress={(e: any) => {
                                                            e?.stopPropagation?.();
                                                            handleDeleteExercise(
                                                              exercise.id
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
                                                    )}
                                                  </div>
                                                )}
                                              </SortableExerciseItem>
                                            )
                                          )}
                                        </SortableContext>
                                      </DndContext>
                                    </div>
                                  )}
                                </>
                              )}
                            </SortableSessionItem>
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Icon
                        className="text-green-600"
                        icon="solar:calendar-bold"
                        width={18}
                      />
                      Días ({days.length})
                    </h4>
                    <Button
                      className="bg-black text-white hover:bg-slate-800"
                      size="sm"
                      startContent={
                        <Icon icon="solar:add-circle-bold" width={18} />
                      }
                      onPress={() => setIsAddingDay(true)}
                    >
                      Agregar Día
                    </Button>
                  </div>

                  {isAddingDay && (
                    <Card className="mb-4 border border-slate-200 shadow-sm">
                      <CardBody className="p-4">
                        <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">
                          Nuevo Día
                        </p>
                        <div className="flex gap-3 items-end">
                          {}
                          <Input
                            autoFocus
                            label="Nombre del día"
                            placeholder="Ej: Lunes, Día 1"
                            size="sm"
                            value={newDayForm.label}
                            onValueChange={(value) =>
                              setNewDayForm({ label: value })
                            }
                          />
                          <Button
                            className="bg-black text-white hover:bg-slate-800"
                            size="sm"
                            onPress={handleAddDay}
                          >
                            Guardar
                          </Button>
                          <Button
                            size="sm"
                            variant="light"
                            onPress={() => {
                              setIsAddingDay(false);
                              setNewDayForm({ label: "" });
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  )}

                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <Spinner />
                    </div>
                  ) : days.length === 0 && !isAddingDay ? (
                    <div className="text-center py-8 text-gray-400">
                      <Icon
                        className="mx-auto mb-3"
                        icon="solar:salad-linear"
                        width={48}
                      />
                      <p className="text-gray-600 font-medium">
                        No hay días en esta plantilla
                      </p>
                      <p className="text-sm mt-1">
                        Haz clic en &quot;Agregar Día&quot; para comenzar
                      </p>
                    </div>
                  ) : (
                    <DndContext
                      collisionDetection={closestCenter}
                      sensors={sensors}
                      onDragEnd={handleDayDragEnd}
                    >
                      <SortableContext
                        items={days.map((d) => d.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {days.map((day) => (
                            <SortableDayItem key={day.id} id={day.id}>
                              {({ dragHandleProps }) => (
                                <>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-1">
                                      <div
                                        className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 transition-colors drag-handle"
                                        {...dragHandleProps}
                                      >
                                        <Icon
                                          icon="solar:hamburger-menu-linear"
                                          width={18}
                                        />
                                      </div>
                                      <button
                                        className="flex items-center gap-3 flex-1"
                                        onClick={() => toggleDay(day.id)}
                                      >
                                        <Chip
                                          className="text-white"
                                          color="success"
                                          size="sm"
                                        >
                                          {day.day_label}
                                        </Chip>
                                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                          {day.meals?.length || 0} comidas
                                        </span>
                                        <Icon
                                          className={`transition-transform text-gray-400 ${
                                            expandedDays.has(day.id)
                                              ? "rotate-180"
                                              : ""
                                          }`}
                                          icon="solar:alt-arrow-down-linear"
                                          width={18}
                                        />
                                      </button>
                                    </div>
                                    <Button
                                      isIconOnly
                                      color="danger"
                                      size="sm"
                                      variant="light"
                                      onPress={() => handleDeleteDay(day.id)}
                                    >
                                      <Icon
                                        icon="solar:trash-bin-trash-bold"
                                        width={16}
                                      />
                                    </Button>
                                  </div>

                                  {expandedDays.has(day.id) && (
                                    <div className="mt-4 space-y-4">
                                      {/* Day-level Macros */}
                                      <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200">
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
                                              <Icon
                                                icon="solar:pen-linear"
                                                width={16}
                                              />
                                            }
                                            variant="flat"
                                            onPress={() =>
                                              handleEditDayMacrosClick(day)
                                            }
                                          >
                                            Editar
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
                                                onPress={() =>
                                                  handleSaveDayMacros(day.id)
                                                }
                                              >
                                                Guardar
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="flat"
                                                onPress={() =>
                                                  setEditingDayMacros(null)
                                                }
                                              >
                                                Cancelar
                                              </Button>
                                            </div>
                                          </div>
                                        ) : (
                                          (() => {
                                            const macros =
                                              getEffectiveDayMacros(day);

                                            return (
                                              <div>
                                                <div className="flex items-center gap-3">
                                                  <div className="bg-purple-100 px-3 py-2 rounded-lg">
                                                    <span className="text-xs text-purple-700 font-medium">
                                                      Proteína:
                                                    </span>
                                                    <span className="text-base font-bold text-purple-900 ml-1">
                                                      {macros.protein.toFixed(
                                                        1
                                                      )}
                                                      g
                                                    </span>
                                                  </div>
                                                  <div className="bg-green-100 px-3 py-2 rounded-lg">
                                                    <span className="text-xs text-green-700 font-medium">
                                                      Carbohidratos:
                                                    </span>
                                                    <span className="text-base font-bold text-green-900 ml-1">
                                                      {macros.carbs.toFixed(1)}g
                                                    </span>
                                                  </div>
                                                  <div className="bg-yellow-100 px-3 py-2 rounded-lg">
                                                    <span className="text-xs text-yellow-700 font-medium">
                                                      Grasas:
                                                    </span>
                                                    <span className="text-base font-bold text-yellow-900 ml-1">
                                                      {macros.fats.toFixed(1)}g
                                                    </span>
                                                  </div>
                                                  <div className="bg-red-100 px-3 py-2 rounded-lg">
                                                    <span className="text-xs text-red-700 font-medium">
                                                      Calorías:
                                                    </span>
                                                    <span className="text-base font-bold text-red-900 ml-1">
                                                      {macros.calories.toFixed(
                                                        0
                                                      )}{" "}
                                                      kcal
                                                    </span>
                                                  </div>
                                                </div>
                                                {macros.isComputed &&
                                                  macros.protein === 0 &&
                                                  macros.carbs === 0 &&
                                                  macros.fats === 0 &&
                                                  macros.calories === 0 && (
                                                    <p className="text-xs text-gray-400 mt-2 italic">
                                                      Los macros se calculan
                                                      automáticamente de las
                                                      comidas. Usa
                                                      &quot;Editar&quot; para
                                                      establecer valores
                                                      manualmente.
                                                    </p>
                                                  )}
                                                {!macros.isComputed && (
                                                  <p className="text-xs text-gray-400 mt-2 italic">
                                                    Valores manuales. Elimínalos
                                                    para usar el cálculo
                                                    automático de comidas.
                                                  </p>
                                                )}
                                              </div>
                                            );
                                          })()
                                        )}
                                      </div>

                                      {/* Meals */}
                                      <div className="space-y-3">
                                        <div className="flex justify-end mb-2">
                                          <Button
                                            className="bg-black text-white hover:bg-slate-800"
                                            size="sm"
                                            startContent={
                                              <Icon
                                                icon="solar:add-circle-bold"
                                                width={16}
                                              />
                                            }
                                            onPress={() =>
                                              setAddingMealToDayId(day.id)
                                            }
                                          >
                                            Agregar Comida
                                          </Button>
                                        </div>

                                        {addingMealToDayId === day.id && (
                                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                            <div className="space-y-2">
                                              {}
                                              <Input
                                                autoFocus
                                                label="Nombre de la comida"
                                                placeholder="Ej: Desayuno, Almuerzo"
                                                size="sm"
                                                value={newMealForm.label}
                                                onValueChange={(value) =>
                                                  setNewMealForm({
                                                    ...newMealForm,
                                                    label: value,
                                                  })
                                                }
                                              />
                                              <div className="flex gap-2 justify-end">
                                                <Button
                                                  className="bg-black text-white hover:bg-slate-800"
                                                  size="sm"
                                                  onPress={() =>
                                                    handleAddMeal(day.id)
                                                  }
                                                >
                                                  Guardar
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="flat"
                                                  onPress={() => {
                                                    setAddingMealToDayId(null);
                                                    setNewMealForm({
                                                      label: "",
                                                      notes: "",
                                                    });
                                                  }}
                                                >
                                                  Cancelar
                                                </Button>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {day.meals?.map((meal: any) => (
                                          <div
                                            key={meal.id}
                                            className="p-4 bg-white rounded-lg border border-gray-200"
                                          >
                                            <div className="flex items-center justify-between mb-3">
                                              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                                              <div
                                                className="flex items-center gap-2 cursor-pointer flex-1"
                                                onClick={() => {
                                                  setExpandedMeals((prev) => {
                                                    const next = new Set(prev);

                                                    if (next.has(meal.id)) {
                                                      next.delete(meal.id);
                                                    } else {
                                                      next.add(meal.id);
                                                    }

                                                    return next;
                                                  });
                                                }}
                                              >
                                                <Icon
                                                  className={`transition-transform text-gray-400 ${expandedMeals.has(meal.id) ? "rotate-180" : ""}`}
                                                  icon="solar:alt-arrow-down-linear"
                                                  width={16}
                                                />
                                                <h5 className="font-semibold text-gray-900">
                                                  {meal.label}
                                                </h5>
                                                <span className="text-xs text-gray-400 ml-1">
                                                  (
                                                  {meal.ingredients?.length ||
                                                    0}{" "}
                                                  ingredientes)
                                                </span>
                                              </div>
                                              <Button
                                                isIconOnly
                                                color="danger"
                                                size="sm"
                                                variant="light"
                                                onPress={() =>
                                                  handleDeleteMeal(meal.id)
                                                }
                                              >
                                                <Icon
                                                  icon="solar:trash-bin-trash-bold"
                                                  width={18}
                                                />
                                              </Button>
                                            </div>

                                            {/* Meal-level Macros */}
                                            {editingMealMacros === meal.id ? (
                                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4">
                                                <div className="grid grid-cols-4 gap-2 mb-2">
                                                  <Input
                                                    label="Proteína (g)"
                                                    size="sm"
                                                    type="number"
                                                    value={
                                                      mealMacrosForm.protein
                                                    }
                                                    onValueChange={(value) =>
                                                      setMealMacrosForm({
                                                        ...mealMacrosForm,
                                                        protein: value,
                                                      })
                                                    }
                                                  />
                                                  <Input
                                                    label="Carbohidratos (g)"
                                                    size="sm"
                                                    type="number"
                                                    value={mealMacrosForm.carbs}
                                                    onValueChange={(value) =>
                                                      setMealMacrosForm({
                                                        ...mealMacrosForm,
                                                        carbs: value,
                                                      })
                                                    }
                                                  />
                                                  <Input
                                                    label="Grasas (g)"
                                                    size="sm"
                                                    type="number"
                                                    value={mealMacrosForm.fats}
                                                    onValueChange={(value) =>
                                                      setMealMacrosForm({
                                                        ...mealMacrosForm,
                                                        fats: value,
                                                      })
                                                    }
                                                  />
                                                  <Input
                                                    label="Calorías"
                                                    size="sm"
                                                    type="number"
                                                    value={
                                                      mealMacrosForm.calories
                                                    }
                                                    onValueChange={(value) =>
                                                      setMealMacrosForm({
                                                        ...mealMacrosForm,
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
                                                  handleEditMealMacrosClick(
                                                    meal
                                                  )
                                                }
                                              >
                                                <div className="bg-slate-100 px-3 py-1.5 rounded-lg">
                                                  <span className="text-xs text-gray-600">
                                                    Proteína:
                                                  </span>
                                                  <span className="text-sm font-bold text-gray-900 ml-1">
                                                    {(
                                                      meal.protein || 0
                                                    ).toFixed(1)}
                                                    g
                                                  </span>
                                                </div>
                                                <div className="bg-green-50 px-3 py-1.5 rounded-lg">
                                                  <span className="text-xs text-gray-600">
                                                    Carbohidratos:
                                                  </span>
                                                  <span className="text-sm font-bold text-gray-900 ml-1">
                                                    {(meal.carbs || 0).toFixed(
                                                      1
                                                    )}
                                                    g
                                                  </span>
                                                </div>
                                                <div className="bg-yellow-50 px-3 py-1.5 rounded-lg">
                                                  <span className="text-xs text-gray-600">
                                                    Grasas:
                                                  </span>
                                                  <span className="text-sm font-bold text-gray-900 ml-1">
                                                    {(meal.fats || 0).toFixed(
                                                      1
                                                    )}
                                                    g
                                                  </span>
                                                </div>
                                                <div className="bg-red-50 px-3 py-1.5 rounded-lg">
                                                  <span className="text-xs text-gray-600">
                                                    Calorías:
                                                  </span>
                                                  <span className="text-sm font-bold text-gray-900 ml-1">
                                                    {(
                                                      meal.calories || 0
                                                    ).toFixed(0)}{" "}
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

                                            {/* Ingredients - collapsible */}
                                            {expandedMeals.has(meal.id) && (
                                              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                                <div className="space-y-2">
                                                  {meal.ingredients?.map(
                                                    (ingredient: any) => (
                                                      <div key={ingredient.id}>
                                                        {editingIngredientId ===
                                                        ingredient.id ? (
                                                          <div className="flex items-center gap-2 py-2 border-b border-gray-100">
                                                            <Input
                                                              className="flex-1"
                                                              defaultValue={
                                                                ingredient.name
                                                              }
                                                              id={`name-${ingredient.id}`}
                                                              placeholder="Ingrediente"
                                                              size="sm"
                                                            />
                                                            <Input
                                                              className="w-24"
                                                              defaultValue={
                                                                ingredient.quantity
                                                              }
                                                              id={`quantity-${ingredient.id}`}
                                                              placeholder="Cantidad"
                                                              size="sm"
                                                            />
                                                            <Input
                                                              className="w-24"
                                                              defaultValue={
                                                                ingredient.unit
                                                              }
                                                              id={`unit-${ingredient.id}`}
                                                              placeholder="Unidad"
                                                              size="sm"
                                                            />
                                                            <Button
                                                              isIconOnly
                                                              color="success"
                                                              size="sm"
                                                              variant="flat"
                                                              onPress={() => {
                                                                const name = (
                                                                  document.getElementById(
                                                                    `name-${ingredient.id}`
                                                                  ) as HTMLInputElement
                                                                )?.value;
                                                                const quantity =
                                                                  (
                                                                    document.getElementById(
                                                                      `quantity-${ingredient.id}`
                                                                    ) as HTMLInputElement
                                                                  )?.value;
                                                                const unit = (
                                                                  document.getElementById(
                                                                    `unit-${ingredient.id}`
                                                                  ) as HTMLInputElement
                                                                )?.value;

                                                                handleEditIngredient(
                                                                  ingredient.id,
                                                                  {
                                                                    name,
                                                                    quantity,
                                                                    unit,
                                                                  }
                                                                );
                                                              }}
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
                                                                setEditingIngredientId(
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
                                                          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                                                          <div
                                                            className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-white cursor-pointer rounded px-2"
                                                            onClick={() =>
                                                              setEditingIngredientId(
                                                                ingredient.id
                                                              )
                                                            }
                                                          >
                                                            <div className="flex items-center gap-3 flex-1">
                                                              <span className="text-sm text-gray-900">
                                                                {
                                                                  ingredient.name
                                                                }
                                                              </span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                              <div className="text-sm text-gray-600">
                                                                <span className="font-semibold text-gray-900">
                                                                  {
                                                                    ingredient.quantity
                                                                  }
                                                                </span>{" "}
                                                                {
                                                                  ingredient.unit
                                                                }
                                                              </div>
                                                              <Button
                                                                isIconOnly
                                                                size="sm"
                                                                variant="light"
                                                                onPress={(
                                                                  e: any
                                                                ) => {
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

                                                  {addingIngredientToMealId ===
                                                  meal.id ? (
                                                    <div className="flex items-center gap-2 py-2 border-b border-slate-200 bg-slate-50 rounded px-2">
                                                      {}
                                                      <Input
                                                        autoFocus
                                                        className="flex-1"
                                                        placeholder="Nombre del ingrediente"
                                                        size="sm"
                                                        value={
                                                          newIngredientForm.name
                                                        }
                                                        onValueChange={(
                                                          value
                                                        ) =>
                                                          setNewIngredientForm({
                                                            ...newIngredientForm,
                                                            name: value,
                                                          })
                                                        }
                                                      />
                                                      <Input
                                                        className="w-24"
                                                        placeholder="Cantidad"
                                                        size="sm"
                                                        value={
                                                          newIngredientForm.quantity
                                                        }
                                                        onValueChange={(
                                                          value
                                                        ) =>
                                                          setNewIngredientForm({
                                                            ...newIngredientForm,
                                                            quantity: value,
                                                          })
                                                        }
                                                      />
                                                      <Input
                                                        className="w-24"
                                                        placeholder="Unidad"
                                                        size="sm"
                                                        value={
                                                          newIngredientForm.unit
                                                        }
                                                        onValueChange={(
                                                          value
                                                        ) =>
                                                          setNewIngredientForm({
                                                            ...newIngredientForm,
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
                                                          handleAddIngredient(
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
                                                        onPress={() => {
                                                          setAddingIngredientToMealId(
                                                            null
                                                          );
                                                          setNewIngredientForm({
                                                            name: "",
                                                            quantity: "",
                                                            unit: "",
                                                          });
                                                        }}
                                                      >
                                                        <Icon
                                                          icon="solar:close-circle-bold"
                                                          width={18}
                                                        />
                                                      </Button>
                                                    </div>
                                                  ) : (
                                                    <div className="flex justify-center pt-2">
                                                      <Button
                                                        size="sm"
                                                        startContent={
                                                          <Icon
                                                            icon="solar:add-circle-linear"
                                                            width={16}
                                                          />
                                                        }
                                                        variant="light"
                                                        onPress={() =>
                                                          setAddingIngredientToMealId(
                                                            meal.id
                                                          )
                                                        }
                                                      >
                                                        Agregar Ingrediente
                                                      </Button>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </SortableDayItem>
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={handleClose}>
              Cerrar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Exercise Library Modal */}
      <AddExerciseLibraryModal
        isOpen={isAddExerciseModalOpen}
        onClose={() => setIsAddExerciseModalOpen(false)}
        onSuccess={handleExerciseCreated}
      />
    </>
  );
}

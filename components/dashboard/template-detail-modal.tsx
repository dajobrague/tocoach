"use client";

import {
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
  Select,
  SelectItem,
  Spinner,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

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
  onClose: () => void;
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
    };
  }>;
}

export default function TemplateDetailModal({
  isOpen,
  template,
  onClose,
  onSuccess,
}: TemplateDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [days, setDays] = useState<any[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(
    new Set()
  );
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Nutrition editing state
  const [isAddingDay, setIsAddingDay] = useState(false);
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
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

  const [newSessionForm, setNewSessionForm] = useState({
    name: "",
    dayOfWeek: "",
  });
  const [newExerciseForm, setNewExerciseForm] = useState({
    exercise_id: "",
    name: "",
    sets: "",
    reps: "",
    rest_seconds: "",
    notes: "",
  });

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
    }
  }, [isOpen, template.id]);

  const handleSave = async () => {
    if (!formData.name || !formData.type || !formData.category) {
      alert("Por favor completa todos los campos requeridos");

      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setIsEditing(false);
        onSuccess();
      } else {
        console.error("Error updating template:", result.error);
        alert("Error al actualizar la plantilla");
      }
    } catch (error) {
      console.error("Error updating template:", error);
      alert("Error al actualizar la plantilla");
    } finally {
      setIsSaving(false);
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

  const handleEditDayMacrosClick = (day: any) => {
    setEditingDayMacros(day.id);
    setDayMacrosForm({
      protein: (day.protein || 0).toString(),
      carbs: (day.carbs || 0).toString(),
      fats: (day.fats || 0).toString(),
      calories: (day.calories || 0).toString(),
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
      metadata: { day_of_week: newSessionForm.dayOfWeek },
      exercises: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistically add to UI
    setSessions([...sessions, optimisticSession]);
    setIsAddingSession(false);
    setNewSessionForm({ name: "", dayOfWeek: "" });

    // Expand the new session automatically
    setExpandedSessions(new Set([...expandedSessions, optimisticSession.id]));

    try {
      const response = await fetch(`/api/programs/${template.id}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: optimisticSession.name,
          dayOfWeek: newSessionForm.dayOfWeek,
          sessionOrder: optimisticSession.session_order,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Replace optimistic session with real one
        setSessions((prevSessions) =>
          prevSessions.map((s) =>
            s.id === optimisticSession.id
              ? { ...result.data, exercises: [] }
              : s
          )
        );
        // Update expanded set with real ID
        setExpandedSessions((prev) => {
          const newSet = new Set(prev);

          newSet.delete(optimisticSession.id);
          newSet.add(result.data.id);

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

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("¿Estás seguro de eliminar esta sesión?")) return;

    // Optimistically remove from UI
    const sessionToDelete = sessions.find((s) => s.id === sessionId);

    setSessions((prevSessions) =>
      prevSessions.filter((s) => s.id !== sessionId)
    );

    try {
      const response = await fetch(
        `/api/programs/${template.id}/sessions/${sessionId}`,
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
      notes: newExerciseForm.notes,
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
        `/api/programs/${template.id}/sessions/${sessionId}/exercises`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exerciseName: newExerciseForm.name,
            sets: optimisticExercise.sets,
            reps: optimisticExercise.reps,
            restSeconds: optimisticExercise.rest_seconds,
            notes: optimisticExercise.notes,
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
                      e.id === optimisticExercise.id ? result.data : e
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
    // Store old exercise for rollback
    let oldExercise: any = null;

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
                ...(data.sets !== undefined && { sets: parseInt(data.sets) }),
                ...(data.reps !== undefined && { reps: data.reps }),
                ...(data.rest_seconds !== undefined && {
                  rest_seconds: parseInt(data.rest_seconds),
                }),
                ...(data.notes !== undefined && { notes: data.notes }),
                ...(e.exercises && {
                  exercises: {
                    ...e.exercises,
                    name: data.name || e.exercises?.name || "",
                  },
                }),
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
        `/api/programs/${template.id}/sessions/exercises/${exerciseId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exerciseName: data.name,
            sets: parseInt(data.sets),
            reps: data.reps,
            restSeconds: parseInt(data.rest_seconds),
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
        `/api/programs/${template.id}/sessions/exercises/${exerciseId}`,
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

  const getCategoryColor = (category: "cardio" | "strength") => {
    return category === "cardio" ? "secondary" : "primary";
  };

  return (
    <Modal isOpen={isOpen} scrollBehavior="inside" size="5xl" onClose={onClose}>
      <ModalContent>
        <ModalHeader className="flex items-center justify-between pr-12">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold">
              {isEditing ? `Editar: ${template.name}` : template.name}
            </span>
            <Chip
              className="text-white"
              color={
                template.category === "nutrition"
                  ? "success"
                  : template.category === "cardio"
                    ? "warning"
                    : "primary"
              }
              size="sm"
              style={
                template.category === "nutrition"
                  ? { backgroundColor: "#16a34a" }
                  : undefined
              }
            >
              {template.category === "nutrition"
                ? "Nutrición"
                : template.category === "cardio"
                  ? "Cardio"
                  : "Fuerza"}
            </Chip>
          </div>
        </ModalHeader>
        <ModalBody>
          {isEditing ? (
            <div className="space-y-4 mb-6">
              <Input
                isRequired
                label="Nombre de la Plantilla"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />

              <Textarea
                label="Descripción"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />

              <Select
                isRequired
                label="Categoría"
                selectedKeys={formData.category ? [formData.category] : []}
                onSelectionChange={(keys) => {
                  const category = Array.from(keys)[0] as
                    | "cardio"
                    | "strength"
                    | "nutrition";

                  setFormData({ ...formData, category });
                }}
              >
                <SelectItem key="strength">Fuerza</SelectItem>
                <SelectItem key="cardio">Cardio</SelectItem>
              </Select>

              {formData.category === "strength" && (
                <>
                  <Select
                    isRequired
                    label="Tipo de Programa"
                    selectedKeys={formData.type ? [formData.type] : []}
                    onSelectionChange={(keys) => {
                      const type = Array.from(keys)[0] as string;

                      setFormData({ ...formData, type });
                    }}
                  >
                    <SelectItem key="Strength">Strength</SelectItem>
                    <SelectItem key="Hypertrophy">Hypertrophy</SelectItem>
                    <SelectItem key="HIIT">HIIT</SelectItem>
                    <SelectItem key="Functional">Functional</SelectItem>
                    <SelectItem key="Endurance">Endurance</SelectItem>
                    <SelectItem key="Fat Loss">Fat Loss</SelectItem>
                    <SelectItem key="Mixed">Mixed</SelectItem>
                  </Select>

                  <Input
                    label="División"
                    placeholder="Ej: Full Body, Upper/Lower"
                    value={formData.division}
                    onChange={(e) =>
                      setFormData({ ...formData, division: e.target.value })
                    }
                  />
                </>
              )}

              {formData.category === "cardio" && (
                <>
                  <Select
                    isRequired
                    label="Tipo de Programa"
                    selectedKeys={formData.type ? [formData.type] : []}
                    onSelectionChange={(keys) => {
                      const type = Array.from(keys)[0] as string;

                      setFormData({ ...formData, type });
                    }}
                  >
                    <SelectItem key="HIIT">HIIT</SelectItem>
                    <SelectItem key="Endurance">Endurance</SelectItem>
                    <SelectItem key="Fat Loss">Fat Loss</SelectItem>
                    <SelectItem key="Mixed">Mixed</SelectItem>
                  </Select>

                  <Input
                    label="Objetivo"
                    placeholder="Ej: Mejorar resistencia cardiovascular"
                    value={formData.goal}
                    onChange={(e) =>
                      setFormData({ ...formData, goal: e.target.value })
                    }
                  />
                </>
              )}

              <Input
                label="Sesiones por Semana"
                type="number"
                value={formData.sessionsPerWeek}
                onChange={(e) =>
                  setFormData({ ...formData, sessionsPerWeek: e.target.value })
                }
              />
            </div>
          ) : null}

          <div>
            {template.templateType === "program" ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-md font-semibold">
                    Sesiones ({sessions.length})
                  </h4>
                  <Button
                    className="text-white"
                    color="primary"
                    size="sm"
                    startContent={
                      <Icon icon="solar:add-circle-bold" width={20} />
                    }
                    onPress={() => setIsAddingSession(true)}
                  >
                    Agregar Sesión
                  </Button>
                </div>

                {isAddingSession && (
                  <Card className="mb-3 border-2 border-primary">
                    <CardBody className="p-4">
                      <div className="flex gap-2">
                        <Input
                          autoFocus
                          label="Nombre de la sesión"
                          placeholder="Ej: Día 1 - Push"
                          size="sm"
                          value={newSessionForm.name}
                          onValueChange={(value) =>
                            setNewSessionForm({
                              ...newSessionForm,
                              name: value,
                            })
                          }
                        />
                        <Input
                          label="Día de la semana"
                          placeholder="Ej: Lunes"
                          size="sm"
                          value={newSessionForm.dayOfWeek}
                          onValueChange={(value) =>
                            setNewSessionForm({
                              ...newSessionForm,
                              dayOfWeek: value,
                            })
                          }
                        />
                        <Button
                          className="text-white"
                          color="primary"
                          size="sm"
                          onPress={handleAddSession}
                        >
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() => {
                            setIsAddingSession(false);
                            setNewSessionForm({ name: "", dayOfWeek: "" });
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
                  <div className="text-center py-8 text-gray-500">
                    <Icon
                      className="mx-auto mb-2"
                      icon="solar:dumbbell-linear"
                      width={40}
                    />
                    <p>No hay sesiones en esta plantilla</p>
                    <p className="text-sm">
                      Haz clic en "Agregar Sesión" para comenzar
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((session) => (
                      <Card key={session.id} className="shadow-sm">
                        <CardBody className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <button
                              className="flex items-center gap-3 flex-1"
                              onClick={() => toggleSession(session.id)}
                            >
                              <Chip
                                className="text-white"
                                color="primary"
                                size="sm"
                                variant="flat"
                              >
                                {session.metadata?.day_of_week || "Día"}
                              </Chip>
                              <span className="font-semibold">
                                {session.name}
                              </span>
                              <span className="text-sm text-gray-500">
                                ({session.exercises?.length || 0} ejercicios)
                              </span>
                              <Icon
                                className={`transition-transform ${
                                  expandedSessions.has(session.id)
                                    ? "rotate-180"
                                    : ""
                                }`}
                                icon="solar:alt-arrow-down-linear"
                                width={20}
                              />
                            </button>
                            <Button
                              isIconOnly
                              color="danger"
                              size="sm"
                              variant="light"
                              onPress={() => handleDeleteSession(session.id)}
                            >
                              <Icon
                                icon="solar:trash-bin-trash-bold"
                                width={18}
                              />
                            </Button>
                          </div>

                          {expandedSessions.has(session.id) && (
                            <div className="mt-4 space-y-2">
                              <div className="flex justify-end mb-2">
                                <Button
                                  className="text-white"
                                  color="primary"
                                  size="sm"
                                  startContent={
                                    <Icon
                                      icon="solar:add-circle-bold"
                                      width={18}
                                    />
                                  }
                                  onPress={() =>
                                    setAddingExerciseToSessionId(session.id)
                                  }
                                >
                                  Agregar Ejercicio
                                </Button>
                              </div>

                              {addingExerciseToSessionId === session.id && (
                                <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-300 mb-3">
                                  <div className="grid grid-cols-2 gap-2 mb-2">
                                    <Input
                                      autoFocus
                                      className="col-span-2"
                                      label="Nombre del ejercicio"
                                      placeholder="Ej: Press Banca"
                                      size="sm"
                                      value={newExerciseForm.name}
                                      onValueChange={(value) =>
                                        setNewExerciseForm({
                                          ...newExerciseForm,
                                          name: value,
                                        })
                                      }
                                    />
                                    <Input
                                      label="Series"
                                      placeholder="4"
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
                                      placeholder="8-12"
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
                                      placeholder="90"
                                      size="sm"
                                      type="number"
                                      value={newExerciseForm.rest_seconds}
                                      onValueChange={(value) =>
                                        setNewExerciseForm({
                                          ...newExerciseForm,
                                          rest_seconds: value,
                                        })
                                      }
                                    />
                                    <Input
                                      label="Notas"
                                      placeholder="Opcional"
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
                                      className="text-white"
                                      color="primary"
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
                                        setAddingExerciseToSessionId(null);
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

                              {session.exercises?.map((exercise, idx) => (
                                <div key={exercise.id}>
                                  {editingExerciseId === exercise.id ? (
                                    <div className="p-3 bg-gray-50 rounded-lg border-2 border-blue-300">
                                      <div className="grid grid-cols-2 gap-2 mb-2">
                                        <Input
                                          className="col-span-2"
                                          defaultValue={
                                            exercise.exercises?.name || ""
                                          }
                                          id={`name-${exercise.id}`}
                                          label="Nombre"
                                          size="sm"
                                        />
                                        <Input
                                          defaultValue={
                                            exercise.sets?.toString() || ""
                                          }
                                          id={`sets-${exercise.id}`}
                                          label="Series"
                                          size="sm"
                                          type="number"
                                        />
                                        <Input
                                          defaultValue={exercise.reps || ""}
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
                                          defaultValue={exercise.notes || ""}
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
                                            const rest_seconds = (
                                              document.getElementById(
                                                `rest-${exercise.id}`
                                              ) as HTMLInputElement
                                            )?.value;
                                            const notes = (
                                              document.getElementById(
                                                `notes-${exercise.id}`
                                              ) as HTMLInputElement
                                            )?.value;

                                            handleEditExercise(exercise.id, {
                                              name,
                                              sets,
                                              reps,
                                              rest_seconds,
                                              notes,
                                            });
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
                                            setEditingExerciseId(null)
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
                                    <div
                                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                                      onClick={() =>
                                        setEditingExerciseId(exercise.id)
                                      }
                                    >
                                      <span className="text-sm font-semibold text-gray-500 min-w-[30px]">
                                        {idx + 1}.
                                      </span>
                                      <div className="flex-1">
                                        <p className="font-medium">
                                          {exercise.exercises?.name ||
                                            "Ejercicio"}
                                        </p>
                                        <div className="text-sm text-gray-600 mt-1">
                                          {exercise.sets && exercise.reps && (
                                            <span>
                                              {exercise.sets} series ×{" "}
                                              {exercise.reps} reps
                                            </span>
                                          )}
                                          {exercise.rest_seconds && (
                                            <span className="ml-2">
                                              • {exercise.rest_seconds}s
                                              descanso
                                            </span>
                                          )}
                                          {exercise.notes && (
                                            <p className="text-gray-500 mt-1">
                                              {exercise.notes}
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
                                          handleDeleteExercise(exercise.id);
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
                              ))}
                            </div>
                          )}
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-md font-semibold">
                    Días ({days.length})
                  </h4>
                  <Button
                    className="text-white"
                    color="success"
                    size="sm"
                    startContent={
                      <Icon icon="solar:add-circle-bold" width={20} />
                    }
                    onPress={() => setIsAddingDay(true)}
                  >
                    Agregar Día
                  </Button>
                </div>

                {isAddingDay && (
                  <Card className="mb-3 border-2 border-success">
                    <CardBody className="p-4">
                      <div className="flex gap-2">
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
                          className="text-white"
                          color="success"
                          size="sm"
                          onPress={handleAddDay}
                        >
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
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
                  <div className="text-center py-8 text-gray-500">
                    <Icon
                      className="mx-auto mb-2"
                      icon="solar:salad-linear"
                      width={40}
                    />
                    <p>No hay días en esta plantilla</p>
                    <p className="text-sm">
                      Haz clic en "Agregar Día" para comenzar
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {days.map((day) => (
                      <Card key={day.id} className="shadow-sm">
                        <CardBody className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <button
                              className="flex items-center gap-3 flex-1"
                              onClick={() => toggleDay(day.id)}
                            >
                              <Chip
                                className="text-white"
                                color="primary"
                                size="sm"
                                variant="flat"
                              >
                                {day.day_label}
                              </Chip>
                              <span className="text-sm text-gray-500">
                                ({day.meals?.length || 0} comidas)
                              </span>
                              <Icon
                                className={`transition-transform ${
                                  expandedDays.has(day.id) ? "rotate-180" : ""
                                }`}
                                icon="solar:alt-arrow-down-linear"
                                width={20}
                              />
                            </button>
                            <Button
                              isIconOnly
                              color="danger"
                              size="sm"
                              variant="light"
                              onPress={() => handleDeleteDay(day.id)}
                            >
                              <Icon
                                icon="solar:trash-bin-trash-bold"
                                width={18}
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
                                        className="text-white"
                                        color="primary"
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
                                  <div className="flex items-center gap-3">
                                    <div className="bg-purple-100 px-3 py-2 rounded-lg">
                                      <span className="text-xs text-purple-700 font-medium">
                                        Proteína:
                                      </span>
                                      <span className="text-base font-bold text-purple-900 ml-1">
                                        {(day.protein || 0).toFixed(1)}g
                                      </span>
                                    </div>
                                    <div className="bg-green-100 px-3 py-2 rounded-lg">
                                      <span className="text-xs text-green-700 font-medium">
                                        Carbohidratos:
                                      </span>
                                      <span className="text-base font-bold text-green-900 ml-1">
                                        {(day.carbs || 0).toFixed(1)}g
                                      </span>
                                    </div>
                                    <div className="bg-yellow-100 px-3 py-2 rounded-lg">
                                      <span className="text-xs text-yellow-700 font-medium">
                                        Grasas:
                                      </span>
                                      <span className="text-base font-bold text-yellow-900 ml-1">
                                        {(day.fats || 0).toFixed(1)}g
                                      </span>
                                    </div>
                                    <div className="bg-red-100 px-3 py-2 rounded-lg">
                                      <span className="text-xs text-red-700 font-medium">
                                        Calorías:
                                      </span>
                                      <span className="text-base font-bold text-red-900 ml-1">
                                        {(day.calories || 0).toFixed(0)} kcal
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Meals */}
                              <div className="space-y-3">
                                <div className="flex justify-end mb-2">
                                  <Button
                                    className="text-white"
                                    color="primary"
                                    size="sm"
                                    startContent={
                                      <Icon
                                        icon="solar:add-circle-bold"
                                        width={18}
                                      />
                                    }
                                    onPress={() => setAddingMealToDayId(day.id)}
                                  >
                                    Agregar Comida
                                  </Button>
                                </div>

                                {addingMealToDayId === day.id && (
                                  <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
                                    <div className="space-y-2">
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
                                          className="text-white"
                                          color="primary"
                                          size="sm"
                                          onPress={() => handleAddMeal(day.id)}
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
                                      <h5 className="font-semibold text-gray-900">
                                        {meal.label}
                                      </h5>
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
                                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-4">
                                        <div className="grid grid-cols-4 gap-2 mb-2">
                                          <Input
                                            label="Proteína (g)"
                                            size="sm"
                                            type="number"
                                            value={mealMacrosForm.protein}
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
                                            value={mealMacrosForm.calories}
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
                                            onPress={() =>
                                              setEditingMealMacros(null)
                                            }
                                          >
                                            Cancelar
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div
                                        className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                                        onClick={() =>
                                          handleEditMealMacrosClick(meal)
                                        }
                                      >
                                        <div className="bg-blue-50 px-3 py-1.5 rounded-lg">
                                          <span className="text-xs text-gray-600">
                                            Proteína:
                                          </span>
                                          <span className="text-sm font-bold text-gray-900 ml-1">
                                            {(meal.protein || 0).toFixed(1)}g
                                          </span>
                                        </div>
                                        <div className="bg-green-50 px-3 py-1.5 rounded-lg">
                                          <span className="text-xs text-gray-600">
                                            Carbohidratos:
                                          </span>
                                          <span className="text-sm font-bold text-gray-900 ml-1">
                                            {(meal.carbs || 0).toFixed(1)}g
                                          </span>
                                        </div>
                                        <div className="bg-yellow-50 px-3 py-1.5 rounded-lg">
                                          <span className="text-xs text-gray-600">
                                            Grasas:
                                          </span>
                                          <span className="text-sm font-bold text-gray-900 ml-1">
                                            {(meal.fats || 0).toFixed(1)}g
                                          </span>
                                        </div>
                                        <div className="bg-red-50 px-3 py-1.5 rounded-lg">
                                          <span className="text-xs text-gray-600">
                                            Calorías:
                                          </span>
                                          <span className="text-sm font-bold text-gray-900 ml-1">
                                            {(meal.calories || 0).toFixed(0)}{" "}
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

                                    {/* Ingredients */}
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
                                                      const quantity = (
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
                                                        { name, quantity, unit }
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
                                          )
                                        )}

                                        {addingIngredientToMealId ===
                                        meal.id ? (
                                          <div className="flex items-center gap-2 py-2 border-b border-blue-200 bg-blue-50 rounded px-2">
                                            <Input
                                              autoFocus
                                              className="flex-1"
                                              placeholder="Nombre del ingrediente"
                                              size="sm"
                                              value={newIngredientForm.name}
                                              onValueChange={(value) =>
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
                                              value={newIngredientForm.quantity}
                                              onValueChange={(value) =>
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
                                              value={newIngredientForm.unit}
                                              onValueChange={(value) =>
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
                                                handleAddIngredient(meal.id)
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
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="danger" variant="light" onPress={onClose}>
            Cerrar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

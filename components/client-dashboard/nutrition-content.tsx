"use client";

import type {
  NutritionDayWithMeals,
  NutritionPlanWithDays,
} from "@/types/nutrition";

import { Card, CardBody, Chip, Spinner, Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import { useContrastColor } from "@/lib/utils/use-contrast-color";

interface NutritionContentProps {
  clientId: string;
  firstName: string;
  logoUrl?: string;
  trainerName: string;
  clientProfilePicture?: string;
  tenantSlug: string;
}

export function NutritionContent({
  clientId,
  firstName,
  logoUrl,
  trainerName,
  clientProfilePicture,
  tenantSlug,
}: NutritionContentProps) {
  const [nutritionPlan, setNutritionPlan] =
    useState<NutritionPlanWithDays | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<NutritionDayWithMeals | null>(
    null
  );
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());

  // ========================================================================
  // DYNAMIC TEXT CONTRAST SYSTEM
  // ========================================================================
  // This ensures text is always readable on colored backgrounds, regardless of theme.
  //
  // PATTERN FOR OTHER COMPONENTS:
  // 1. Import: import { useContrastColor } from "@/lib/utils/use-contrast-color";
  // 2. Call hook with color name and opacity (e.g., "primary", 0.1 for bg-primary/10)
  // 3. Use returned style object: style={colorText.style} for primary text
  //    or style={colorText.secondaryStyle} for less prominent text
  // 4. Set useThemeColor: true to prefer theme-color variants over black/white
  //
  // Example for bg-success/20 background:
  //   const successText = useContrastColor("success", 0.2, { useThemeColor: true });
  //   <div className="bg-success/20">
  //     <p style={successText.style}>This text will be readable!</p>
  //   </div>
  // ========================================================================
  const dangerText = useContrastColor("danger", 0.1, { useThemeColor: true });
  const primaryText = useContrastColor("primary", 0.1, { useThemeColor: true });
  const warningText = useContrastColor("warning", 0.1, { useThemeColor: true });
  const secondaryText = useContrastColor("secondary", 0.1, {
    useThemeColor: true,
  });

  // Fetch nutrition plan
  useEffect(() => {
    const fetchNutritionPlan = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/nutrition/plans/${clientId}`);
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
          // Get the active plan or the first plan
          const activePlan =
            result.data.find(
              (p: NutritionPlanWithDays) => p.status === "active"
            ) || result.data[0];

          setNutritionPlan(activePlan);

          // Set initial selected day
          if (activePlan.days && activePlan.days.length > 0) {
            const todayLabel = getTodayDayLabel();
            const todayDay =
              activePlan.days.find(
                (d: NutritionDayWithMeals) => d.day_label === todayLabel
              ) || activePlan.days[0];

            setSelectedDay(todayDay);
          }
        }
      } catch (err) {
        console.error("Error fetching nutrition plan:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNutritionPlan();
  }, [clientId]);

  // Get today's day of the week in Spanish (Chicago timezone)
  const getTodayDayLabel = (): string => {
    const daysOfWeek = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];
    const now = new Date();
    const chicagoTime = new Date(
      now.toLocaleString("en-US", { timeZone: "America/Chicago" })
    );

    return daysOfWeek[chicagoTime.getDay()] || "Lunes";
  };

  const daysOfWeek = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
  ];

  const toggleMeal = (mealId: string) => {
    setExpandedMeals((prev) => {
      const newSet = new Set(prev);

      if (newSet.has(mealId)) {
        newSet.delete(mealId);
      } else {
        newSet.add(mealId);
      }

      return newSet;
    });
  };

  // Calculate daily totals from meal macros
  const dayTotals = useMemo(() => {
    if (!selectedDay || !selectedDay.meals) {
      return { calories: 0, protein: 0, carbs: 0, fats: 0 };
    }

    return selectedDay.meals.reduce(
      (totals, meal) => ({
        calories: totals.calories + (meal.calories || 0),
        protein: totals.protein + (meal.protein || 0),
        carbs: totals.carbs + (meal.carbs || 0),
        fats: totals.fats + (meal.fats || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
  }, [selectedDay]);

  // Show loading state
  if (isLoading) {
    return (
      <>
        <div className="min-h-screen bg-background pb-20">
          <div className="max-w-lg mx-auto">
            <ClientHeader
              clientId={clientId}
              clientProfilePicture={clientProfilePicture}
              firstName={firstName}
              logoUrl={logoUrl}
              tagline="¡A alimentarte bien!"
              tenantSlug={tenantSlug}
              trainerName={trainerName}
            />
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          </div>
        </div>
        <ClientBottomNav />
      </>
    );
  }

  // Show empty state
  if (!nutritionPlan || !selectedDay) {
    return (
      <>
        <div className="min-h-screen bg-background pb-20">
          <div className="max-w-lg mx-auto">
            <ClientHeader
              clientId={clientId}
              clientProfilePicture={clientProfilePicture}
              firstName={firstName}
              logoUrl={logoUrl}
              tagline="¡A alimentarte bien!"
              tenantSlug={tenantSlug}
              trainerName={trainerName}
            />
            <div className="px-4 py-20 text-center">
              <Icon
                className="text-6xl text-gray-300 mx-auto mb-4"
                icon="solar:document-text-linear"
              />
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                No hay plan nutricional
              </h3>
              <p className="text-sm text-gray-600">
                Tu entrenador aún no ha creado un plan nutricional para ti.
              </p>
            </div>
          </div>
        </div>
        <ClientBottomNav />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-lg mx-auto">
          {/* Top Header - Same as Dashboard and Workouts */}
          <ClientHeader
            clientId={clientId}
            clientProfilePicture={clientProfilePicture}
            firstName={firstName}
            logoUrl={logoUrl}
            tagline="¡A alimentarte bien!"
            tenantSlug={tenantSlug}
            trainerName={trainerName}
          />

          {/* Day Navigation - Tab Selector */}
          <div className="px-4 mb-4">
            <Tabs
              fullWidth
              classNames={{
                tabList: "gap-2",
                cursor: "w-full",
                tab: "px-2 h-9",
              }}
              color="primary"
              selectedKey={selectedDay.day_label}
              size="sm"
              variant="bordered"
              onSelectionChange={(key) => {
                const dayData = nutritionPlan.days.find(
                  (d) => d.day_label === key
                );

                if (dayData) setSelectedDay(dayData);
              }}
            >
              {daysOfWeek.map((day) => {
                const dayData = nutritionPlan.days.find(
                  (d) => d.day_label === day
                );

                if (!dayData) return null;

                return <Tab key={day} title={day.slice(0, 3)} />;
              })}
            </Tabs>
          </div>

          <div className="px-4 space-y-4">
            {/* Daily Summary Card */}
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon
                    className="text-primary text-xl"
                    icon="solar:chart-2-bold"
                  />
                  <h2 className="text-lg font-semibold font-heading text-foreground">
                    Totales del Día
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Calories - Dynamic contrast text color */}
                  <div className="bg-danger/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon
                        className="text-lg"
                        icon="solar:fire-bold"
                        style={dangerText.style}
                      />
                      <p
                        className="text-xs font-medium"
                        style={dangerText.secondaryStyle}
                      >
                        Calorías
                      </p>
                    </div>
                    <p className="text-2xl font-bold" style={dangerText.style}>
                      {Math.round(dayTotals.calories)}
                    </p>
                    <p className="text-xs" style={dangerText.secondaryStyle}>
                      kcal
                    </p>
                  </div>

                  {/* Protein - Dynamic contrast text color */}
                  <div className="bg-primary/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon
                        className="text-lg"
                        icon="fluent:food-chicken-leg-16-filled"
                        style={primaryText.style}
                      />
                      <p
                        className="text-xs font-medium"
                        style={primaryText.secondaryStyle}
                      >
                        Proteína
                      </p>
                    </div>
                    <p className="text-2xl font-bold" style={primaryText.style}>
                      {Math.round(dayTotals.protein)}
                    </p>
                    <p className="text-xs" style={primaryText.secondaryStyle}>
                      gramos
                    </p>
                  </div>

                  {/* Carbs - Dynamic contrast text color */}
                  <div className="bg-warning/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon
                        className="text-lg"
                        icon="fluent:food-toast-24-filled"
                        style={warningText.style}
                      />
                      <p
                        className="text-xs font-medium"
                        style={warningText.secondaryStyle}
                      >
                        Carbohidratos
                      </p>
                    </div>
                    <p className="text-2xl font-bold" style={warningText.style}>
                      {Math.round(dayTotals.carbs)}
                    </p>
                    <p className="text-xs" style={warningText.secondaryStyle}>
                      gramos
                    </p>
                  </div>

                  {/* Fats - Dynamic contrast text color */}
                  <div className="bg-secondary/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon
                        className="text-lg"
                        icon="fluent:drop-12-filled"
                        style={secondaryText.style}
                      />
                      <p
                        className="text-xs font-medium"
                        style={secondaryText.secondaryStyle}
                      >
                        Grasas
                      </p>
                    </div>
                    <p
                      className="text-2xl font-bold"
                      style={secondaryText.style}
                    >
                      {Math.round(dayTotals.fats)}
                    </p>
                    <p className="text-xs" style={secondaryText.secondaryStyle}>
                      gramos
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Meals List */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold font-heading text-foreground">
                Comidas del Día
              </h2>
              {selectedDay.meals.map((meal) => {
                const isExpanded = expandedMeals.has(meal.id);
                const mealTotals = {
                  calories: meal.calories || 0,
                  protein: meal.protein || 0,
                  carbs: meal.carbs || 0,
                  fats: meal.fats || 0,
                };

                return (
                  <Card key={meal.id}>
                    <CardBody className="p-4">
                      {/* Meal Header - Clickable */}
                      <div
                        aria-expanded={isExpanded}
                        className="cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleMeal(meal.id)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && toggleMeal(meal.id)
                        }
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="bg-primary/10 p-2 rounded-lg flex-shrink-0">
                              <Icon
                                className="text-primary text-xl"
                                icon="solar:dish-bold"
                              />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-base font-bold text-foreground font-heading">
                                {meal.label}
                              </h3>
                              <p className="text-xs text-foreground/60">
                                {meal.ingredients.length} ingredientes
                              </p>
                            </div>
                          </div>
                          <Icon
                            className="text-foreground/60 text-xl flex-shrink-0"
                            icon={
                              isExpanded
                                ? "solar:alt-arrow-up-linear"
                                : "solar:alt-arrow-down-linear"
                            }
                          />
                        </div>

                        {/* Meal Description - Between name and macros */}
                        {meal.notes && (
                          <p className="text-sm text-foreground/70 mb-3 px-1">
                            {meal.notes}
                          </p>
                        )}

                        {/* Meal Macros Summary - Dynamic contrast text colors */}
                        <div className="flex gap-2 flex-wrap">
                          <Chip
                            className="bg-danger/10"
                            size="sm"
                            variant="flat"
                          >
                            <div
                              className="flex items-center gap-1"
                              style={dangerText.style}
                            >
                              <Icon
                                className="text-xs"
                                icon="solar:fire-bold"
                              />
                              <span className="text-xs font-semibold">
                                {Math.round(mealTotals.calories)} kcal
                              </span>
                            </div>
                          </Chip>
                          <Chip
                            className="bg-primary/10"
                            size="sm"
                            variant="flat"
                          >
                            <div
                              className="flex items-center gap-1"
                              style={primaryText.style}
                            >
                              <Icon
                                className="text-xs"
                                icon="fluent:food-chicken-leg-16-filled"
                              />
                              <span className="text-xs font-semibold">
                                {Math.round(mealTotals.protein)}g
                              </span>
                            </div>
                          </Chip>
                          <Chip
                            className="bg-warning/10"
                            size="sm"
                            variant="flat"
                          >
                            <div
                              className="flex items-center gap-1"
                              style={warningText.style}
                            >
                              <Icon
                                className="text-xs"
                                icon="fluent:food-toast-24-filled"
                              />
                              <span className="text-xs font-semibold">
                                {Math.round(mealTotals.carbs)}g
                              </span>
                            </div>
                          </Chip>
                          <Chip
                            className="bg-secondary/10"
                            size="sm"
                            variant="flat"
                          >
                            <div
                              className="flex items-center gap-1"
                              style={secondaryText.style}
                            >
                              <Icon
                                className="text-xs"
                                icon="fluent:drop-12-filled"
                              />
                              <span className="text-xs font-semibold">
                                {Math.round(mealTotals.fats)}g
                              </span>
                            </div>
                          </Chip>
                        </div>
                      </div>

                      {/* Expanded Content - Ingredients */}
                      {isExpanded && (
                        <div className="mt-4 space-y-3">
                          <div className="border-t border-default-200 pt-3">
                            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                              <Icon
                                className="text-primary"
                                icon="solar:list-check-bold"
                              />
                              Ingredientes
                            </h4>
                            <div className="space-y-2">
                              {meal.ingredients &&
                              meal.ingredients.length > 0 ? (
                                meal.ingredients.map((ingredient) => (
                                  <div
                                    key={ingredient.id}
                                    className="flex items-start justify-between bg-default-50 rounded-lg p-3"
                                  >
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-foreground">
                                        {ingredient.name}
                                      </p>
                                      <p className="text-xs text-foreground/60">
                                        {ingredient.quantity} {ingredient.unit}
                                      </p>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-foreground/60 text-center py-2">
                                  No hay ingredientes especificados
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <ClientBottomNav />
    </>
  );
}

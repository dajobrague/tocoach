"use client";

import { Card, CardBody, Chip, Tabs, Tab } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState, useMemo } from "react";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import {
  getMockNutritionPlan,
  calculateDayTotals,
  calculateMealTotals,
  type MockNutritionDay,
} from "@/lib/mock-data/client-profile-mock";

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
  const nutritionPlan = getMockNutritionPlan(clientId);

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

  const todayLabel = getTodayDayLabel();

  // Find today's day or default to first day
  const todayDay =
    nutritionPlan.days.find((d) => d.dayLabel === todayLabel) ||
    nutritionPlan.days[0]!;

  const [selectedDay, setSelectedDay] = useState<MockNutritionDay>(todayDay);
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());

  const currentStreak = 12; // Mock streak data

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

  // Calculate daily totals
  const dayTotals = useMemo(
    () => calculateDayTotals(selectedDay),
    [selectedDay]
  );

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-lg mx-auto">
          {/* Top Header - Same as Dashboard and Workouts */}
          <ClientHeader
            clientId={clientId}
            clientProfilePicture={clientProfilePicture}
            currentStreak={currentStreak}
            firstName={firstName}
            logoUrl={logoUrl}
            showStreak={true}
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
              selectedKey={selectedDay.dayLabel}
              size="sm"
              variant="bordered"
              onSelectionChange={(key) => {
                const dayData = nutritionPlan.days.find(
                  (d) => d.dayLabel === key
                );

                if (dayData) setSelectedDay(dayData);
              }}
            >
              {daysOfWeek.map((day) => {
                const dayData = nutritionPlan.days.find(
                  (d) => d.dayLabel === day
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
                  {/* Calories */}
                  <div className="bg-danger/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon
                        className="text-danger text-lg"
                        icon="solar:fire-bold"
                      />
                      <p className="text-xs font-medium text-foreground/70">
                        Calorías
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {Math.round(dayTotals.calories)}
                    </p>
                    <p className="text-xs text-foreground/60">kcal</p>
                  </div>

                  {/* Protein */}
                  <div className="bg-primary/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon
                        className="text-primary text-lg"
                        icon="solar:bone-bold"
                      />
                      <p className="text-xs font-medium text-foreground/70">
                        Proteína
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {Math.round(dayTotals.protein)}
                    </p>
                    <p className="text-xs text-foreground/60">gramos</p>
                  </div>

                  {/* Carbs */}
                  <div className="bg-warning/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon
                        className="text-warning text-lg"
                        icon="solar:widget-2-bold"
                      />
                      <p className="text-xs font-medium text-foreground/70">
                        Carbohidratos
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {Math.round(dayTotals.carbs)}
                    </p>
                    <p className="text-xs text-foreground/60">gramos</p>
                  </div>

                  {/* Fats */}
                  <div className="bg-secondary/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon
                        className="text-secondary text-lg"
                        icon="solar:drop-bold"
                      />
                      <p className="text-xs font-medium text-foreground/70">
                        Grasas
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {Math.round(dayTotals.fats)}
                    </p>
                    <p className="text-xs text-foreground/60">gramos</p>
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
                const mealTotals = calculateMealTotals(meal);

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

                        {/* Meal Macros Summary */}
                        <div className="flex gap-2 flex-wrap">
                          <Chip
                            className="bg-danger/10 text-danger"
                            size="sm"
                            variant="flat"
                          >
                            <div className="flex items-center gap-1">
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
                            className="bg-primary/10 text-primary"
                            size="sm"
                            variant="flat"
                          >
                            <span className="text-xs font-semibold">
                              P: {Math.round(mealTotals.protein)}g
                            </span>
                          </Chip>
                          <Chip
                            className="bg-warning/10 text-warning"
                            size="sm"
                            variant="flat"
                          >
                            <span className="text-xs font-semibold">
                              C: {Math.round(mealTotals.carbs)}g
                            </span>
                          </Chip>
                          <Chip
                            className="bg-secondary/10 text-secondary"
                            size="sm"
                            variant="flat"
                          >
                            <span className="text-xs font-semibold">
                              G: {Math.round(mealTotals.fats)}g
                            </span>
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
                              {meal.ingredients.map((ingredient) => (
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
                                  <div className="text-right flex-shrink-0 ml-3">
                                    <p className="text-xs text-foreground/60">
                                      P: {ingredient.protein}g · C:{" "}
                                      {ingredient.carbs}g · G: {ingredient.fats}
                                      g
                                    </p>
                                    <p className="text-xs font-semibold text-danger">
                                      {ingredient.calories} kcal
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Meal Notes */}
                          {meal.notes && (
                            <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                              <div className="flex items-start gap-2">
                                <Icon
                                  className="text-primary text-lg flex-shrink-0 mt-0.5"
                                  icon="solar:notes-bold"
                                />
                                <div>
                                  <p className="text-xs font-semibold text-primary mb-1">
                                    Notas
                                  </p>
                                  <p className="text-sm text-foreground/80">
                                    {meal.notes}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
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

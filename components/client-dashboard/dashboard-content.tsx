"use client";

import { Card, CardBody, Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import { DynamicFormModal } from "@/components/client-dashboard/dynamic-form-modal";
import { NeatChartCard } from "@/components/client-dashboard/neat-chart-card";
import {
  CaloriesChart,
  MacrosRing,
  ProteinChart,
  SleepChart,
  TrainingActivityChart,
  WeightChart,
} from "@/components/client-dashboard/progress-charts";
import {
  isDailyHabitsSubmittedToday,
  shouldShowWeeklyCheckIn,
} from "@/lib/forms/client-helpers";
import { FormResponse } from "@/lib/forms/types";
import {
  useExerciseLogs,
  useFormResponses,
  useNeatCards,
} from "@/lib/hooks/use-client-queries";
import { ClientNeatCard } from "@/types";

export function DashboardContent() {
  const {
    clientId,
    firstName,
    logoUrl,
    trainerName,
    clientProfilePicture,
    tenantSlug,
  } = useClientData();

  const queryClient = useQueryClient();

  // State
  const [showDailyFormModal, setShowDailyFormModal] = useState(false);
  const [showWeeklyFormModal, setShowWeeklyFormModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("7d");

  // Helper to get days needed for a period
  const getDaysForPeriod = (period: string): number => {
    const daysMap: Record<string, number> = {
      "7d": 7,
      "30d": 30,
      "3m": 90,
      "6m": 180,
      "12m": 365,
    };

    return daysMap[period] ?? 7;
  };

  // ─── TanStack Query: cached data fetching ─────────────────────────────
  const daysToFetch = getDaysForPeriod(selectedPeriod);

  const {
    data: weeklyResponses = [] as FormResponse[],
    isLoading: isLoadingWeekly,
  } = useFormResponses(clientId, "checkins", Math.max(daysToFetch, 14));

  const {
    data: dailyResponses = [] as FormResponse[],
    isLoading: isLoadingDaily,
  } = useFormResponses(clientId, "habits", Math.max(daysToFetch, 7));

  const { data: exerciseLogs = [] } = useExerciseLogs(clientId);

  const { data: neatCards = [] as ClientNeatCard[] } = useNeatCards();
  const hasNeatCards = neatCards.length > 0;

  const isLoadingForms = isLoadingWeekly || isLoadingDaily;

  // Calculate form display states
  const showWeeklyBanner =
    !isLoadingForms && shouldShowWeeklyCheckIn(weeklyResponses);
  const showDailyButton =
    !isLoadingForms && !isDailyHabitsSubmittedToday(dailyResponses);

  // Helper functions for data generation
  const getDataPointsCount = (period: string): number => {
    const counts: Record<string, number> = {
      "7d": 7,
      "30d": 30,
      "3m": 12, // 12 weeks (approx 3 months)
      "6m": 6, // 6 months - one point per month
      "12m": 12, // 12 months - one point per month
    };

    return counts[period] || 7;
  };

  const formatDateForPeriod = (
    index: number,
    totalPoints: number,
    period: string
  ): string => {
    const now = new Date();
    let date = new Date(now);

    if (period === "7d") {
      // Last 7 days
      date.setDate(date.getDate() - (6 - index));

      return date.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
      });
    } else if (period === "30d") {
      // Last 30 days
      date.setDate(date.getDate() - (29 - index));

      return date.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
      });
    } else if (period === "3m") {
      // Last 12 weeks
      const weeksBack = (11 - index) * 7;

      date.setDate(date.getDate() - weeksBack);

      return date.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
      });
    } else if (period === "6m") {
      // Last 6 months - show month name
      date.setMonth(date.getMonth() - (5 - index));
      const monthFormat = date.toLocaleDateString("es-ES", { month: "short" });
      const year = date.getFullYear();
      const currentYear = now.getFullYear();

      if (year !== currentYear) {
        return `${monthFormat} '${year.toString().slice(-2)}`;
      }

      return monthFormat;
    } else if (period === "12m") {
      // Last 12 months - show month name
      date.setMonth(date.getMonth() - (11 - index));
      const monthFormat = date.toLocaleDateString("es-ES", { month: "short" });
      const year = date.getFullYear();
      const currentYear = now.getFullYear();

      if (year !== currentYear) {
        return `${monthFormat} '${year.toString().slice(-2)}`;
      }

      return monthFormat;
    } else {
      date.setDate(date.getDate() - (totalPoints - 1 - index));

      return date.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
      });
    }
  };

  const generateWeightData = (points: number, period: string) => {
    // Create date range for the period
    const data: { date: string; weight: number }[] = [];

    for (let i = 0; i < points; i++) {
      const dateLabel = formatDateForPeriod(i, points, period);
      const daysAgo = points - 1 - i;
      const targetDate = new Date();

      targetDate.setDate(targetDate.getDate() - daysAgo);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      // Check daily habits first, fall back to weekly check-ins
      const dailyWeightResponse = dailyResponses.find((r: FormResponse) => {
        return (
          new Date(r.response_date).toISOString().split("T")[0] ===
          targetDateStr
        );
      });
      const response =
        dailyWeightResponse ||
        weeklyResponses.find((r: FormResponse) => {
          return (
            new Date(r.response_date).toISOString().split("T")[0] ===
            targetDateStr
          );
        });

      // Extract weight from response
      let weight = 0;

      if (response && response.answers) {
        weight = Number(
          response.answers.body_weight ||
            response.answers.weight ||
            response.answers.peso ||
            0
        );
      }

      data.push({ date: dateLabel, weight });
    }

    // Fill missing values with last known value or 0
    let lastKnownWeight = 0;

    for (let i = data.length - 1; i >= 0; i--) {
      const item = data[i];

      if (item && item.weight > 0) {
        lastKnownWeight = item.weight;
      } else if (item) {
        item.weight = lastKnownWeight;
      }
    }

    return data;
  };

  const generateSleepData = (points: number, period: string) => {
    const data: { date: string; hours: number }[] = [];

    for (let i = 0; i < points; i++) {
      const dateLabel = formatDateForPeriod(i, points, period);
      const daysAgo = points - 1 - i;
      const targetDate = new Date();

      targetDate.setDate(targetDate.getDate() - daysAgo);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      // Find daily response for this date
      const response = dailyResponses.find((r: FormResponse) => {
        return r.response_date === targetDateStr;
      });

      // Extract sleep hours
      let hours = 0;

      if (response && response.answers) {
        hours = Number(
          response.answers.sleep_hours ||
            response.answers.sleep ||
            response.answers.sueno ||
            response.answers.horas_sueno ||
            0
        );
      }

      data.push({ date: dateLabel, hours });
    }

    return data;
  };

  const generateCalorieData = (points: number, period: string) => {
    const data: { date: string; calories: number }[] = [];

    for (let i = 0; i < points; i++) {
      const dateLabel = formatDateForPeriod(i, points, period);
      const daysAgo = points - 1 - i;
      const targetDate = new Date();

      targetDate.setDate(targetDate.getDate() - daysAgo);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      // Find daily response for this date
      const response = dailyResponses.find((r: FormResponse) => {
        return r.response_date === targetDateStr;
      });

      // Extract calories (assuming question id is 'calories' or 'calorias')
      let calories = 0;

      if (response && response.answers) {
        calories = Number(
          response.answers.calories || response.answers.calorias || 0
        );
      }

      data.push({ date: dateLabel, calories });
    }

    return data;
  };

  const generateStepsData = (points: number, period: string) => {
    const data: { date: string; steps: number }[] = [];

    for (let i = 0; i < points; i++) {
      const dateLabel = formatDateForPeriod(i, points, period);
      const daysAgo = points - 1 - i;
      const targetDate = new Date();

      targetDate.setDate(targetDate.getDate() - daysAgo);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      // Find daily response for this date
      const response = dailyResponses.find((r: FormResponse) => {
        return r.response_date === targetDateStr;
      });

      // Extract steps (assuming question id is 'steps' or 'pasos')
      let steps = 0; // default to 0 if no data

      if (response && response.answers) {
        steps = response.answers.steps || response.answers.pasos || 0;
      }

      data.push({ date: dateLabel, steps });
    }

    return data;
  };

  // Dynamic data based on selected period
  const weightHistory = useMemo(() => {
    const points = getDataPointsCount(selectedPeriod);

    return generateWeightData(points, selectedPeriod);
  }, [selectedPeriod, weeklyResponses]);

  const sleepHistory = useMemo(() => {
    const points = getDataPointsCount(selectedPeriod);

    return generateSleepData(points, selectedPeriod);
  }, [selectedPeriod, dailyResponses]);

  const calorieHistory = useMemo(() => {
    const points = getDataPointsCount(selectedPeriod);

    return generateCalorieData(points, selectedPeriod);
  }, [selectedPeriod, dailyResponses]);

  const stepsHistory = useMemo(() => {
    const points = getDataPointsCount(selectedPeriod);

    return generateStepsData(points, selectedPeriod);
  }, [selectedPeriod, dailyResponses]);

  const todaySteps = stepsHistory[stepsHistory.length - 1]?.steps || 0;

  // Protein data from daily habits
  const proteinHistory = useMemo(() => {
    const points = getDataPointsCount(selectedPeriod);
    const data: { date: string; protein: number }[] = [];

    for (let i = 0; i < points; i++) {
      const dateLabel = formatDateForPeriod(i, points, selectedPeriod);
      const daysAgo = points - 1 - i;
      const targetDate = new Date();

      targetDate.setDate(targetDate.getDate() - daysAgo);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      const response = dailyResponses.find(
        (r: FormResponse) => r.response_date === targetDateStr
      );

      let protein = 0;

      if (response && response.answers) {
        protein = Number(
          response.answers.protein || response.answers.proteina || 0
        );
      }
      data.push({ date: dateLabel, protein });
    }

    return data;
  }, [selectedPeriod, dailyResponses]);

  // Average macros for the donut ring
  const avgMacros = useMemo(() => {
    const withData = dailyResponses.filter((r: FormResponse) => {
      if (!r.answers) return false;
      const p = Number(r.answers.protein || r.answers.proteina || 0);
      const c = Number(r.answers.carbs || r.answers.carbohidratos || 0);
      const f = Number(r.answers.fats || r.answers.grasas || 0);

      return p > 0 || c > 0 || f > 0;
    });

    if (withData.length === 0) return { protein: 0, carbs: 0, fats: 0 };

    const totals = withData.reduce(
      (
        acc: { protein: number; carbs: number; fats: number },
        r: FormResponse
      ) => {
        acc.protein += Number(r.answers.protein || r.answers.proteina || 0);
        acc.carbs += Number(r.answers.carbs || r.answers.carbohidratos || 0);
        acc.fats += Number(r.answers.fats || r.answers.grasas || 0);

        return acc;
      },
      { protein: 0, carbs: 0, fats: 0 }
    );

    return {
      protein: Math.round(totals.protein / withData.length),
      carbs: Math.round(totals.carbs / withData.length),
      fats: Math.round(totals.fats / withData.length),
    };
  }, [dailyResponses]);

  // Training activity from exercise logs
  const trainingActivity = useMemo(() => {
    const points = getDataPointsCount(selectedPeriod);
    const data: { date: string; strength: number; cardio: number }[] = [];

    for (let i = 0; i < points; i++) {
      const dateLabel = formatDateForPeriod(i, points, selectedPeriod);
      const daysAgo = points - 1 - i;
      const targetDate = new Date();

      targetDate.setDate(targetDate.getDate() - daysAgo);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      let strength = 0;
      let cardio = 0;

      exerciseLogs.forEach((log: any) => {
        if (log.scheduled_date === targetDateStr) {
          const cat = log.exercises?.category;

          if (cat === "cardio") cardio++;
          else strength++;
        }
      });
      data.push({ date: dateLabel, strength, cardio });
    }

    return data;
  }, [selectedPeriod, exerciseLogs]);

  const trainingWeekTotal = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date();

    weekAgo.setDate(now.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0]!;

    return exerciseLogs.filter(
      (log: any) => log.scheduled_date && log.scheduled_date >= weekAgoStr
    ).length;
  }, [exerciseLogs]);

  // Check if we should show NEAT chart (has cards and applicable today)
  const shouldShowNeatChart = useMemo(() => {
    if (!hasNeatCards || neatCards.length === 0) return false;

    const today = new Date().getDay();
    const applicableCards = neatCards.filter(
      (card: ClientNeatCard) =>
        !card.weekdays ||
        card.weekdays.length === 0 ||
        card.weekdays.includes(today)
    );
    const totalGoal = applicableCards.reduce(
      (sum: number, card: ClientNeatCard) => sum + (card.steps_goal || 0),
      0
    );

    return applicableCards.length > 0 && totalGoal > 0;
  }, [hasNeatCards, neatCards]);

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-lg mx-auto">
          {/* Top Header */}
          <ClientHeader
            clientId={clientId}
            clientProfilePicture={clientProfilePicture}
            firstName={firstName}
            logoUrl={logoUrl}
            tenantSlug={tenantSlug}
            trainerName={trainerName}
            onOpenDailyForm={() => setShowDailyFormModal(true)}
            onOpenWeeklyForm={() => setShowWeeklyFormModal(true)}
          />

          {/* Weekly Check-in Banner - Shows on Mondays or when pending */}
          {showWeeklyBanner && (
            <div className="mb-4">
              <h2 className="text-lg font-semibold font-heading mb-3 px-4 text-foreground">
                Seguimiento Semanal
              </h2>
              <button
                className="bg-warning cursor-pointer hover:opacity-90 transition-all active:scale-[0.98] py-8 px-6 w-full border-0"
                onClick={() => setShowWeeklyFormModal(true)}
              >
                <div className="max-w-lg mx-auto flex items-center justify-between">
                  <span className="text-white text-xl font-medium">
                    Completa tu check-in semanal
                  </span>
                  <Icon
                    className="text-white text-3xl"
                    icon="solar:alt-arrow-right-bold"
                  />
                </div>
              </button>
            </div>
          )}

          {/* Daily Habits Section - Only shows if not completed today */}
          {showDailyButton && (
            <div className="mb-4">
              <h2 className="text-lg font-semibold font-heading mb-3 px-4 text-foreground">
                Registro Diario
              </h2>
              <button
                className="bg-primary cursor-pointer hover:opacity-90 transition-all active:scale-[0.98] py-8 px-6 w-full border-0"
                onClick={() => setShowDailyFormModal(true)}
              >
                <div className="max-w-lg mx-auto flex items-center justify-between">
                  <span className="text-white text-xl font-medium">
                    Registra tu día de hoy
                  </span>
                  <Icon
                    className="text-white text-3xl"
                    icon="solar:alt-arrow-right-bold"
                  />
                </div>
              </button>
            </div>
          )}

          {/* Weekly Check-in Modal */}
          <DynamicFormModal
            clientId={clientId}
            formType="checkins"
            isOpen={showWeeklyFormModal}
            onClose={() => setShowWeeklyFormModal(false)}
            onSuccess={() => {
              // Invalidate weekly form responses — TanStack Query refetches
              // in the background while keeping current data visible.
              queryClient.invalidateQueries({
                queryKey: ["client", "formResponses", clientId, "checkins"],
              });
            }}
          />

          {/* Daily Habits Modal */}
          <DynamicFormModal
            clientId={clientId}
            formType="habits"
            isOpen={showDailyFormModal}
            onClose={() => setShowDailyFormModal(false)}
            onSuccess={() => {
              queryClient.invalidateQueries({
                queryKey: ["client", "formResponses", clientId, "habits"],
              });
            }}
          />

          {/* OLD Check-in Modal - removed, now using DynamicFormModal */}

          {/* Progress Section */}
          <div className="px-4 space-y-4">
            <h2 className="text-lg font-semibold font-heading text-foreground">
              Progreso
            </h2>

            {/* Time Period Selector */}
            <Tabs
              fullWidth
              classNames={{
                tabList: "gap-2",
                cursor: "w-full",
                tab: "px-3 h-9",
              }}
              color="primary"
              selectedKey={selectedPeriod}
              size="sm"
              variant="bordered"
              onSelectionChange={(key) => setSelectedPeriod(key as string)}
            >
              <Tab key="7d" title="7 Días" />
              <Tab key="30d" title="30 Días" />
              <Tab key="3m" title="3 Meses" />
              <Tab key="6m" title="6 Meses" />
              <Tab key="12m" title="12 Meses" />
            </Tabs>

            {/* Weight Tracker */}
            {weightHistory.some((d) => d.weight > 0) && (
              <Card>
                <CardBody className="p-4">
                  <WeightChart
                    currentValue={
                      weightHistory[weightHistory.length - 1]?.weight || 0
                    }
                    data={weightHistory}
                  />
                </CardBody>
              </Card>
            )}

            {/* Sleep Tracker */}
            {sleepHistory.some((d) => d.hours > 0) && (
              <Card>
                <CardBody className="p-4">
                  <SleepChart
                    currentValue={
                      sleepHistory[sleepHistory.length - 1]?.hours || 0
                    }
                    data={sleepHistory}
                  />
                </CardBody>
              </Card>
            )}

            {/* Calories Tracker */}
            {calorieHistory.some((d) => d.calories > 0) && (
              <Card>
                <CardBody className="p-4">
                  <CaloriesChart
                    currentValue={
                      calorieHistory[calorieHistory.length - 1]?.calories || 0
                    }
                    data={calorieHistory}
                  />
                </CardBody>
              </Card>
            )}

            {/* Protein Tracker */}
            {proteinHistory.some((d) => d.protein > 0) && (
              <Card>
                <CardBody className="p-4">
                  <ProteinChart
                    currentValue={
                      proteinHistory[proteinHistory.length - 1]?.protein || 0
                    }
                    data={proteinHistory}
                  />
                </CardBody>
              </Card>
            )}

            {/* Macros Distribution */}
            {(avgMacros.protein > 0 ||
              avgMacros.carbs > 0 ||
              avgMacros.fats > 0) && (
              <Card>
                <CardBody className="p-4">
                  <MacrosRing
                    carbs={avgMacros.carbs}
                    fats={avgMacros.fats}
                    protein={avgMacros.protein}
                  />
                </CardBody>
              </Card>
            )}

            {/* Training Activity */}
            {trainingActivity.some((d) => d.strength > 0 || d.cardio > 0) && (
              <Card>
                <CardBody className="p-4">
                  <TrainingActivityChart
                    data={trainingActivity}
                    weekTotal={trainingWeekTotal}
                  />
                </CardBody>
              </Card>
            )}

            {/* NEAT Tracker - Only show if NEAT cards configured and applicable today */}
            {shouldShowNeatChart && (
              <Card>
                <CardBody className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-foreground/70 tracking-wide">
                      NEAT - ACTIVIDAD DIARIA
                    </p>
                    <div className="bg-success/10 p-1.5 rounded-full">
                      <Icon
                        className="text-success text-base"
                        icon="solar:walking-bold"
                      />
                    </div>
                  </div>

                  {/* Radial Chart showing goal vs actual */}
                  <NeatChartCard
                    neatCards={neatCards}
                    selectedPeriod={selectedPeriod}
                    todaySteps={todaySteps}
                  />
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      </div>
      <ClientBottomNav />
    </>
  );
}

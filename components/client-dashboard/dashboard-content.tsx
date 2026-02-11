"use client";

import { Button, Card, CardBody, Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import { DynamicFormModal } from "@/components/client-dashboard/dynamic-form-modal";
import { NeatChartCard } from "@/components/client-dashboard/neat-chart-card";
import {
  isDailyHabitsSubmittedToday,
  shouldShowWeeklyCheckIn,
} from "@/lib/forms/client-helpers";
import { FormResponse } from "@/lib/forms/types";
import { useFormResponses, useNeatCards } from "@/lib/hooks/use-client-queries";
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
  const [waterIntake, setWaterIntake] = useState(0);
  const [showDailyFormModal, setShowDailyFormModal] = useState(false);
  const [showWeeklyFormModal, setShowWeeklyFormModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("7d");

  // Helper to get date X days ago
  const getDateDaysAgo = (days: number): string => {
    const date = new Date();

    date.setDate(date.getDate() - days);

    return date.toISOString().split("T")[0] || "";
  };

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

  const { data: neatCards = [] as ClientNeatCard[] } = useNeatCards();
  const hasNeatCards = neatCards.length > 0;

  const isLoadingForms = isLoadingWeekly || isLoadingDaily;
  const isLoadingMetrics = isLoadingWeekly || isLoadingDaily;

  // Calculate form display states
  const showWeeklyBanner =
    !isLoadingForms && shouldShowWeeklyCheckIn(weeklyResponses);
  const showDailyButton =
    !isLoadingForms && !isDailyHabitsSubmittedToday(dailyResponses);

  const waterGoal = 3;

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

      // Find response for this date or closest earlier date
      const response = weeklyResponses.find((r: FormResponse) => {
        const responseDate = new Date(r.response_date);

        return responseDate.toISOString().split("T")[0] === targetDateStr;
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

  const handleWaterIncrement = () => {
    if (waterIntake < waterGoal) {
      setWaterIntake((prev) => Math.round((prev + 0.25) * 100) / 100);
    }
  };

  const handleWaterDecrement = () => {
    if (waterIntake > 0) {
      setWaterIntake((prev) => Math.round((prev - 0.25) * 100) / 100);
    }
  };

  const waterPercentage = Math.min((waterIntake / waterGoal) * 100, 100);

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

            {/* Weight Tracker - Full Width */}
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground/70 tracking-wide">
                    PESO
                  </p>
                  <div className="bg-warning/10 p-1.5 rounded-full">
                    <Icon
                      className="text-warning text-base"
                      icon="solar:body-bold"
                    />
                  </div>
                </div>
                <p className="text-5xl font-bold mb-1 text-foreground">
                  {weightHistory[weightHistory.length - 1]?.weight || 0}
                </p>
                <p className="text-sm text-foreground/70 mb-4">kg hoy</p>
                <div className="flex items-end justify-between gap-2 h-24">
                  {weightHistory.map((day, index) => {
                    const minWeight =
                      Math.min(
                        ...weightHistory
                          .map((d) => d.weight)
                          .filter((w) => w > 0)
                      ) || 0;
                    const maxWeight = Math.max(
                      ...weightHistory.map((d) => d.weight)
                    );
                    const range = maxWeight - minWeight || 1;
                    const height =
                      day.weight > 0
                        ? ((day.weight - minWeight) / range) * 70 + 30
                        : 0;
                    const isToday = index === weightHistory.length - 1;

                    return (
                      <div
                        key={`weight-${index}`}
                        className="flex-1 flex flex-col items-center gap-2"
                      >
                        <div
                          className="w-full relative"
                          style={{ height: "80px" }}
                        >
                          <div
                            className={`absolute bottom-0 left-0 right-0 ${isToday ? "bg-warning" : "bg-default-200"} rounded-t-lg transition-all`}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span className="text-xs text-foreground/60">
                          {day.date}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>

            {/* Water Tracker - Hidden for now */}
            {false && (
              <Card>
                <CardBody className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-foreground/70 tracking-wide">
                      CONTADOR DE AGUA
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        isIconOnly
                        className="rounded-full"
                        size="sm"
                        variant="flat"
                        onPress={handleWaterDecrement}
                      >
                        <Icon
                          className="text-base"
                          icon="solar:minus-circle-bold"
                        />
                      </Button>
                      <Button
                        isIconOnly
                        className="rounded-full"
                        size="sm"
                        variant="flat"
                        onPress={handleWaterIncrement}
                      >
                        <Icon
                          className="text-base"
                          icon="solar:add-circle-bold"
                        />
                      </Button>
                      <div className="bg-primary p-1.5 rounded-full">
                        <Icon
                          className="text-white text-base"
                          icon="solar:bottle-bold"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-5xl font-bold mb-1 text-foreground">
                    <span className="tabular-nums">
                      {waterIntake.toFixed(2)}
                    </span>
                  </p>
                  <p className="text-sm text-foreground/70 mb-4">
                    L de {waterGoal} L
                  </p>
                  <div className="relative h-3 bg-default-100 rounded-full overflow-hidden">
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-primary to-primary-400 rounded-full transition-all duration-500"
                      style={{ width: `${waterPercentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-xs text-foreground/50">0%</span>
                    <span className="text-xs text-foreground/70 font-semibold">
                      {waterPercentage.toFixed(0)}%
                    </span>
                    <span className="text-xs text-foreground/50">100%</span>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Sleep Tracker - Full Width */}
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground/70 tracking-wide">
                    SUEÑO
                  </p>
                  <div className="bg-green-100 p-1.5 rounded-full">
                    <Icon
                      className="text-green-600 text-base"
                      icon="solar:moon-sleep-bold"
                    />
                  </div>
                </div>
                <p className="text-5xl font-bold mb-1 text-foreground">
                  {sleepHistory[sleepHistory.length - 1]?.hours || 0}
                </p>
                <p className="text-sm text-foreground/70 mb-4">Horas anoche</p>
                <div className="flex items-end justify-between gap-2 h-24">
                  {sleepHistory.map((day, index) => {
                    const maxHours = 10;
                    const height = (day.hours / maxHours) * 100;
                    const isToday = index === sleepHistory.length - 1;

                    return (
                      <div
                        key={`sleep-${index}`}
                        className="flex-1 flex flex-col items-center gap-2"
                      >
                        <div
                          className="w-full relative"
                          style={{ height: "80px" }}
                        >
                          <div
                            className={`absolute bottom-0 left-0 right-0 ${isToday ? "bg-secondary" : "bg-default-200"} rounded-t-lg transition-all`}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span className="text-xs text-foreground/60">
                          {day.date}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>

            {/* Calories Tracker - Full Width */}
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground/70 tracking-wide">
                    CALORÍAS
                  </p>
                  <div className="bg-danger/10 p-1.5 rounded-full">
                    <Icon
                      className="text-danger text-base"
                      icon="solar:fire-bold"
                    />
                  </div>
                </div>
                <p className="text-5xl font-bold mb-1 text-foreground">
                  {calorieHistory[calorieHistory.length - 1]?.calories || 0}
                </p>
                <p className="text-sm text-foreground/70 mb-4">Hoy</p>
                <div className="flex items-end justify-between gap-2 h-24">
                  {calorieHistory.map((day, index) => {
                    const maxCals =
                      Math.max(...calorieHistory.map((d) => d.calories)) || 1;
                    const height = (day.calories / maxCals) * 100;
                    const isToday = index === calorieHistory.length - 1;

                    return (
                      <div
                        key={`calorie-${index}`}
                        className="flex-1 flex flex-col items-center gap-2"
                      >
                        <div
                          className="w-full relative"
                          style={{ height: "80px" }}
                        >
                          <div
                            className={`absolute bottom-0 left-0 right-0 ${isToday ? "bg-danger" : "bg-default-200"} rounded-t-lg transition-all`}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span className="text-xs text-foreground/60">
                          {day.date}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>

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

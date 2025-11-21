"use client";

import { Button, Card, CardBody, Tabs, Tab } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState, useMemo } from "react";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import { CheckinModal } from "@/components/client-dashboard/checkin-modal";

interface DashboardContentProps {
  firstName: string;
  logoUrl?: string;
  trainerName: string;
  clientProfilePicture?: string;
  clientId: string;
  tenantSlug: string;
}

export function DashboardContent({
  firstName,
  logoUrl,
  trainerName,
  clientProfilePicture,
  clientId,
  tenantSlug,
}: DashboardContentProps) {
  // State
  const [waterIntake, setWaterIntake] = useState(0);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("7d");

  const waterGoal = 3;
  const currentStreak = 12;

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
    const baseWeight = 78.5;
    const targetWeight = 77.0;
    const decrement = (baseWeight - targetWeight) / points;

    return Array.from({ length: points }, (_, i) => ({
      date: formatDateForPeriod(i, points, period),
      weight: +(baseWeight - decrement * i).toFixed(1),
    }));
  };

  // Seeded random function for consistent SSR/Client rendering
  const seededRandom = (seed: number): number => {
    const x = Math.sin(seed) * 10000;

    return x - Math.floor(x);
  };

  const generateSleepData = (points: number, period: string) => {
    return Array.from({ length: points }, (_, i) => ({
      date: formatDateForPeriod(i, points, period),
      hours: +(5.5 + seededRandom(i + 100) * 2.5).toFixed(1), // Deterministic between 5.5 and 8 hours
    }));
  };

  const generateCalorieData = (points: number, period: string) => {
    return Array.from({ length: points }, (_, i) => ({
      date: formatDateForPeriod(i, points, period),
      calories: Math.floor(1800 + seededRandom(i + 200) * 600), // Deterministic between 1800 and 2400
    }));
  };

  const generateStepsData = (points: number, period: string) => {
    return Array.from({ length: points }, (_, i) => ({
      date: formatDateForPeriod(i, points, period),
      steps: Math.floor(50 + seededRandom(i + 300) * 200), // Deterministic between 50 and 250
    }));
  };

  // Dynamic data based on selected period
  const weightHistory = useMemo(() => {
    const points = getDataPointsCount(selectedPeriod);

    return generateWeightData(points, selectedPeriod);
  }, [selectedPeriod]);

  const sleepHistory = useMemo(() => {
    const points = getDataPointsCount(selectedPeriod);

    return generateSleepData(points, selectedPeriod);
  }, [selectedPeriod]);

  const calorieHistory = useMemo(() => {
    const points = getDataPointsCount(selectedPeriod);

    return generateCalorieData(points, selectedPeriod);
  }, [selectedPeriod]);

  const stepsHistory = useMemo(() => {
    const points = getDataPointsCount(selectedPeriod);

    return generateStepsData(points, selectedPeriod);
  }, [selectedPeriod]);

  const todaySteps = stepsHistory[stepsHistory.length - 1]?.steps || 65;

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
            currentStreak={currentStreak}
            firstName={firstName}
            logoUrl={logoUrl}
            showStreak={true}
            tenantSlug={tenantSlug}
            trainerName={trainerName}
          />

          {/* Daily Habits Section - Full Width */}
          <div className="mb-4">
            <h2 className="text-lg font-semibold font-heading mb-3 px-4 text-foreground">
              Registro Diario
            </h2>
            <button
              className="bg-primary cursor-pointer hover:opacity-90 transition-all active:scale-[0.98] py-8 px-6 w-full border-0"
              onClick={() => setShowCheckInModal(true)}
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

          {/* Check-in Modal */}
          <CheckinModal
            isOpen={showCheckInModal}
            onClose={() => setShowCheckInModal(false)}
          />

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
                  {weightHistory[weightHistory.length - 1]?.weight}
                </p>
                <p className="text-sm text-foreground/70 mb-4">kg hoy</p>
                <div className="flex items-end justify-between gap-2 h-24">
                  {weightHistory.map((day, index) => {
                    const minWeight = Math.min(
                      ...weightHistory.map((d) => d.weight)
                    );
                    const maxWeight = Math.max(
                      ...weightHistory.map((d) => d.weight)
                    );
                    const range = maxWeight - minWeight || 1;
                    const height = ((day.weight - minWeight) / range) * 70 + 30;
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

            {/* Water Tracker - Full Width */}
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
                  <span className="tabular-nums">{waterIntake.toFixed(2)}</span>
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

            {/* Sleep Tracker - Full Width */}
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground/70 tracking-wide">
                    SUEÑO
                  </p>
                  <div className="bg-secondary/10 p-1.5 rounded-full">
                    <Icon
                      className="text-secondary text-base"
                      icon="solar:moon-sleep-bold"
                    />
                  </div>
                </div>
                <p className="text-5xl font-bold mb-1 text-foreground">
                  {sleepHistory[sleepHistory.length - 1]?.hours}
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
                  {calorieHistory[calorieHistory.length - 1]?.calories}
                </p>
                <p className="text-sm text-foreground/70 mb-4">Hoy</p>
                <div className="flex items-end justify-between gap-2 h-24">
                  {calorieHistory.map((day, index) => {
                    const maxCals = Math.max(
                      ...calorieHistory.map((d) => d.calories)
                    );
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

            {/* Steps Tracker */}
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground/70 tracking-wide">
                    PASOS
                  </p>
                  <div className="bg-success/10 p-1.5 rounded-full">
                    <Icon
                      className="text-success text-base"
                      icon="solar:walking-bold"
                    />
                  </div>
                </div>
                <p className="text-5xl font-bold mb-1 text-foreground">
                  {todaySteps}
                </p>
                <p className="text-sm text-foreground/70 mb-4">Hoy</p>
                <div className="flex items-end justify-between gap-2 h-24">
                  {stepsHistory.map((day, index) => {
                    const maxSteps = Math.max(
                      ...stepsHistory.map((d) => d.steps)
                    );
                    const height = (day.steps / maxSteps) * 100;
                    const isToday = index === stepsHistory.length - 1;

                    return (
                      <div
                        key={`steps-${index}`}
                        className="flex-1 flex flex-col items-center gap-2"
                      >
                        <div
                          className="w-full relative"
                          style={{ height: "80px" }}
                        >
                          <div
                            className={`absolute bottom-0 left-0 right-0 ${isToday ? "bg-success" : "bg-default-200"} rounded-t-lg transition-all`}
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
          </div>
        </div>
      </div>
      <ClientBottomNav />
    </>
  );
}

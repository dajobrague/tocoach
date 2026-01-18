"use client";

import { Badge, Button, Card, CardBody, Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

import { PreviewThemeProvider } from "./preview-theme-provider";

import { useSetupWizard } from "@/lib/setup-wizard/context";

// Sample data for Peter Parker
const SAMPLE_DATA = {
  client: {
    firstName: "Peter",
    fullName: "Peter Parker",
  },
  // Weight data for charts (7 days)
  weightHistory: [
    { date: "15 ene", weight: 75 },
    { date: "16 ene", weight: 74.8 },
    { date: "17 ene", weight: 74.5 },
    { date: "18 ene", weight: 74.7 },
    { date: "19 ene", weight: 74.3 },
    { date: "20 ene", weight: 74.1 },
    { date: "21 ene", weight: 74 },
  ],
  // Sleep data for charts (7 days)
  sleepHistory: [
    { date: "15 ene", hours: 7 },
    { date: "16 ene", hours: 8 },
    { date: "17 ene", hours: 6.5 },
    { date: "18 ene", hours: 7.5 },
    { date: "19 ene", hours: 8 },
    { date: "20 ene", hours: 7 },
    { date: "21 ene", hours: 7.5 },
  ],
  // Calorie data for charts (7 days)
  calorieHistory: [
    { date: "15 ene", calories: 1800 },
    { date: "16 ene", calories: 1950 },
    { date: "17 ene", calories: 1750 },
    { date: "18 ene", calories: 2100 },
    { date: "19 ene", calories: 1850 },
    { date: "20 ene", calories: 1900 },
    { date: "21 ene", calories: 2000 },
  ],
};

interface DashboardPreviewProps {
  viewMode: "mobile" | "desktop";
}

export function DashboardPreview({ viewMode }: DashboardPreviewProps) {
  const { state } = useSetupWizard();
  const [selectedPeriod, setSelectedPeriod] = React.useState("7d");

  // Get current data (last item in each array)
  const currentWeight =
    SAMPLE_DATA.weightHistory[SAMPLE_DATA.weightHistory.length - 1]?.weight ||
    0;
  const currentSleep =
    SAMPLE_DATA.sleepHistory[SAMPLE_DATA.sleepHistory.length - 1]?.hours || 0;
  const currentCalories =
    SAMPLE_DATA.calorieHistory[SAMPLE_DATA.calorieHistory.length - 1]
      ?.calories || 0;

  return (
    <PreviewThemeProvider state={state}>
      <div className="bg-background">
        <div
          className={
            viewMode === "mobile" ? "max-w-lg mx-auto" : "max-w-lg mx-auto"
          }
        >
          {/* Header - Exact match to ClientHeader */}
          <div className="px-4 pt-4 pb-3 bg-content1 sticky top-0 z-30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {state.logo?.url ? (
                  <img
                    alt={state.logo.text || "Logo"}
                    className="h-10 w-auto object-contain"
                    src={state.logo.url}
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon
                      className="text-primary text-xl"
                      icon="solar:dumbbell-bold"
                    />
                  </div>
                )}
                <div>
                  <h1 className="text-lg font-bold font-heading text-foreground">
                    Hola, {SAMPLE_DATA.client.firstName}
                  </h1>
                  <p className="text-xs text-foreground/60 font-body">
                    ¡Listo para entrenar!
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge color="danger" content={2} shape="circle" size="sm">
                  <Button
                    isIconOnly
                    className="text-foreground/70"
                    size="sm"
                    variant="light"
                  >
                    <Icon
                      className="text-2xl"
                      icon="solar:chat-round-dots-linear"
                    />
                  </Button>
                </Badge>
                <Button
                  isIconOnly
                  className="text-foreground/70"
                  size="sm"
                  variant="light"
                >
                  <Icon className="text-2xl" icon="solar:bell-linear" />
                </Button>
              </div>
            </div>
          </div>

          {/* Daily Habits Banner - Exact match to real dashboard */}
          <div className="mb-4">
            <h2 className="text-lg font-semibold font-heading mb-3 px-4 text-foreground">
              Registro Diario
            </h2>
            <button className="bg-primary cursor-pointer hover:opacity-90 transition-all active:scale-[0.98] py-8 px-6 w-full border-0">
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

          {/* Progress Section - Exact match to real dashboard */}
          <div className="px-4 space-y-4">
            <h2 className="text-lg font-semibold font-heading text-foreground">
              Progreso
            </h2>

            {/* Time Period Selector - Exact match */}
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

            {/* Weight Card - Exact match to real dashboard */}
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
                  {currentWeight}
                </p>
                <p className="text-sm text-foreground/70 mb-4">kg hoy</p>
                <div className="flex items-end justify-between gap-2 h-24">
                  {SAMPLE_DATA.weightHistory.map((day, index) => {
                    const minWeight = Math.min(
                      ...SAMPLE_DATA.weightHistory.map((d) => d.weight)
                    );
                    const maxWeight = Math.max(
                      ...SAMPLE_DATA.weightHistory.map((d) => d.weight)
                    );
                    const range = maxWeight - minWeight || 1;
                    const height = ((day.weight - minWeight) / range) * 70 + 30;
                    const isToday =
                      index === SAMPLE_DATA.weightHistory.length - 1;

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

            {/* Sleep Card - Exact match to real dashboard */}
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
                  {currentSleep}
                </p>
                <p className="text-sm text-foreground/70 mb-4">Horas anoche</p>
                <div className="flex items-end justify-between gap-2 h-24">
                  {SAMPLE_DATA.sleepHistory.map((day, index) => {
                    const maxHours = 10;
                    const height = (day.hours / maxHours) * 100;
                    const isToday =
                      index === SAMPLE_DATA.sleepHistory.length - 1;

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

            {/* Calories Card - Exact match to real dashboard */}
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
                  {currentCalories}
                </p>
                <p className="text-sm text-foreground/70 mb-4">Hoy</p>
                <div className="flex items-end justify-between gap-2 h-24">
                  {SAMPLE_DATA.calorieHistory.map((day, index) => {
                    const maxCals = Math.max(
                      ...SAMPLE_DATA.calorieHistory.map((d) => d.calories)
                    );
                    const height = (day.calories / maxCals) * 100;
                    const isToday =
                      index === SAMPLE_DATA.calorieHistory.length - 1;

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
          </div>
        </div>
      </div>
    </PreviewThemeProvider>
  );
}

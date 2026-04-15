"use client";

import { Card, CardBody, Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { formResponsesToSubmittedAtPayload } from "@/lib/forms/client-helpers";
import { aggregateWeightByCheckInPeriods } from "@/lib/forms/checkin-chart-periods";
import {
  chartPeriodCountForRange,
  daysToFetchForChartRange,
  formatPeriodTooltipSpan,
  generatePeriodLabels,
  getChartDateRange,
  groupResponsesByPeriod,
  responseTimestampMs,
  toYmdInTimezone,
} from "@/lib/forms/chart-helpers";
import { getScheduleOrDefault, isCheckInDue } from "@/lib/forms/schedule";
import {
  DEFAULT_CHECKIN_SCHEDULE,
  FormResponse,
  type CheckInSchedule,
} from "@/lib/forms/types";

/** Weekly default schedule if parsing or chart math fails (Monday 12:00 Europe/Madrid). */
const FALLBACK_CHECKIN_SCHEDULE: CheckInSchedule = {
  ...DEFAULT_CHECKIN_SCHEDULE,
};

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

  const { data: checkinsConfigJson, isPending: isCheckinConfigLoading } =
    useQuery({
      queryKey: ["client", "formConfig", clientId, "checkins"],
      queryFn: async () => {
        try {
          const res = await fetch(
            `/api/forms/configs/${clientId}?form_type=checkins`,
            { cache: "no-store" }
          );

          return (await res.json()) as {
            success?: boolean;
            schedule?: unknown;
          };
        } catch {
          return { success: false as const };
        }
      },
      enabled: Boolean(clientId),
    });

  const checkinSchedule = useMemo((): CheckInSchedule => {
    try {
      return getScheduleOrDefault(
        (checkinsConfigJson?.schedule ?? null) as CheckInSchedule | null
      );
    } catch {
      return { ...FALLBACK_CHECKIN_SCHEDULE };
    }
  }, [checkinsConfigJson?.schedule]);

  // State
  const [selectedDayForForm, setSelectedDayForForm] = useState<string | null>(
    null
  );
  const [showWeeklyFormModal, setShowWeeklyFormModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("7d");

  const chartPeriodCount = useMemo(() => {
    try {
      return chartPeriodCountForRange(
        selectedPeriod,
        checkinSchedule.frequency
      );
    } catch {
      return chartPeriodCountForRange(
        selectedPeriod,
        FALLBACK_CHECKIN_SCHEDULE.frequency
      );
    }
  }, [selectedPeriod, checkinSchedule.frequency]);

  const fetchDays = useMemo(() => {
    try {
      const { from } = getChartDateRange(checkinSchedule, chartPeriodCount);

      return Math.max(14, daysToFetchForChartRange(from), 7);
    } catch {
      const { from } = getChartDateRange(
        FALLBACK_CHECKIN_SCHEDULE,
        chartPeriodCount
      );

      return Math.max(14, daysToFetchForChartRange(from), 7);
    }
  }, [checkinSchedule, chartPeriodCount]);

  // ─── TanStack Query: cached data fetching (range from schedule periods) ─
  const {
    data: weeklyResponses = [] as FormResponse[],
    isLoading: isLoadingWeekly,
  } = useFormResponses(clientId, "checkins", fetchDays);

  const {
    data: dailyResponses = [] as FormResponse[],
    isLoading: isLoadingDaily,
  } = useFormResponses(clientId, "habits", fetchDays);

  const { data: exerciseLogs = [] } = useExerciseLogs(clientId);

  const { data: neatCards = [] as ClientNeatCard[] } = useNeatCards();
  const hasNeatCards = neatCards.length > 0;

  const isLoadingForms = isLoadingWeekly || isLoadingDaily;

  const showWeeklyBanner = useMemo(() => {
    if (isLoadingForms || isCheckinConfigLoading || !checkinSchedule.enabled) {
      return false;
    }

    try {
      return isCheckInDue(
        checkinSchedule,
        formResponsesToSubmittedAtPayload(weeklyResponses)
      );
    } catch {
      return false;
    }
  }, [
    isLoadingForms,
    isCheckinConfigLoading,
    checkinSchedule,
    weeklyResponses,
  ]);
  const dailyFormDays = useMemo(() => {
    const days: {
      date: string;
      label: string;
      dayName: string;
      isToday: boolean;
      isSubmitted: boolean;
    }[] = [];

    for (let i = 0; i < 3; i++) {
      const d = new Date();

      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0]!;

      days.push({
        date: dateStr,
        label: d.toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
        }),
        dayName: d.toLocaleDateString("es-ES", { weekday: "long" }),
        isToday: i === 0,
        isSubmitted: dailyResponses.some(
          (r: FormResponse) => r.response_date === dateStr
        ),
      });
    }

    return days;
  }, [dailyResponses]);

  const periodLabels = useMemo(() => {
    try {
      return generatePeriodLabels(checkinSchedule, chartPeriodCount);
    } catch {
      return generatePeriodLabels(FALLBACK_CHECKIN_SCHEDULE, chartPeriodCount);
    }
  }, [checkinSchedule, chartPeriodCount]);

  const habitGroups = useMemo(() => {
    try {
      return groupResponsesByPeriod(dailyResponses, checkinSchedule);
    } catch {
      return groupResponsesByPeriod(dailyResponses, FALLBACK_CHECKIN_SCHEDULE);
    }
  }, [dailyResponses, checkinSchedule]);

  const weightLookbackDays = useMemo(() => {
    try {
      const { from } = getChartDateRange(checkinSchedule, chartPeriodCount);

      return Math.max(
        1,
        Math.ceil((Date.now() - from.getTime()) / 86400000) + 1
      );
    } catch {
      const { from } = getChartDateRange(
        FALLBACK_CHECKIN_SCHEDULE,
        chartPeriodCount
      );

      return Math.max(
        1,
        Math.ceil((Date.now() - from.getTime()) / 86400000) + 1
      );
    }
  }, [checkinSchedule, chartPeriodCount]);

  const weightHistory = useMemo(() => {
    try {
      return aggregateWeightByCheckInPeriods(
        checkinSchedule,
        weeklyResponses,
        dailyResponses,
        selectedPeriod,
        weightLookbackDays
      );
    } catch {
      return aggregateWeightByCheckInPeriods(
        FALLBACK_CHECKIN_SCHEDULE,
        weeklyResponses,
        dailyResponses,
        selectedPeriod,
        weightLookbackDays
      );
    }
  }, [
    checkinSchedule,
    weeklyResponses,
    dailyResponses,
    selectedPeriod,
    weightLookbackDays,
  ]);

  const sleepHistory = useMemo(() => {
    try {
      const tz = checkinSchedule.timezone;

      return periodLabels.map((p) => {
        const match = habitGroups.find(
          (g) =>
            g.periodStart.getTime() === p.start.getTime() &&
            g.periodEnd.getTime() === p.end.getTime()
        );
        const list = match?.responses ?? [];
        const hours =
          list.length === 0
            ? 0
            : list.reduce((s, r) => {
                const h = Number(
                  r.answers?.sleep_hours ||
                    r.answers?.sleep ||
                    r.answers?.sueno ||
                    r.answers?.horas_sueno ||
                    0
                );

                return s + h;
              }, 0) / list.length;

        return {
          date: p.label,
          hours,
          periodTooltip: formatPeriodTooltipSpan(p.start, p.end, tz),
        };
      });
    } catch {
      return [] as { date: string; hours: number; periodTooltip: string }[];
    }
  }, [periodLabels, habitGroups, checkinSchedule.timezone]);

  const calorieHistory = useMemo(() => {
    try {
      const tz = checkinSchedule.timezone;

      return periodLabels.map((p) => {
        const match = habitGroups.find(
          (g) =>
            g.periodStart.getTime() === p.start.getTime() &&
            g.periodEnd.getTime() === p.end.getTime()
        );
        const list = match?.responses ?? [];
        const calories =
          list.length === 0
            ? 0
            : list.reduce((s, r) => {
                const c = Number(
                  r.answers?.calories || r.answers?.calorias || 0
                );

                return s + c;
              }, 0) / list.length;

        return {
          date: p.label,
          calories,
          periodTooltip: formatPeriodTooltipSpan(p.start, p.end, tz),
        };
      });
    } catch {
      return [] as {
        date: string;
        calories: number;
        periodTooltip: string;
      }[];
    }
  }, [periodLabels, habitGroups, checkinSchedule.timezone]);

  const proteinHistory = useMemo(() => {
    try {
      const tz = checkinSchedule.timezone;

      return periodLabels.map((p) => {
        const match = habitGroups.find(
          (g) =>
            g.periodStart.getTime() === p.start.getTime() &&
            g.periodEnd.getTime() === p.end.getTime()
        );
        const list = match?.responses ?? [];
        const protein =
          list.length === 0
            ? 0
            : list.reduce((s, r) => {
                const v = Number(
                  r.answers?.protein || r.answers?.proteina || 0
                );

                return s + v;
              }, 0) / list.length;

        return {
          date: p.label,
          protein,
          periodTooltip: formatPeriodTooltipSpan(p.start, p.end, tz),
        };
      });
    } catch {
      return [] as {
        date: string;
        protein: number;
        periodTooltip: string;
      }[];
    }
  }, [periodLabels, habitGroups, checkinSchedule.timezone]);

  const todaySteps = useMemo(() => {
    const t = new Date().toISOString().split("T")[0] ?? "";
    const row = dailyResponses.find((r: FormResponse) => r.response_date === t);

    return Number(row?.answers?.steps ?? row?.answers?.pasos ?? 0) || 0;
  }, [dailyResponses]);

  const avgMacros = useMemo(() => {
    try {
      const { from } = getChartDateRange(checkinSchedule, chartPeriodCount);
      const fromMs = from.getTime();
      const scoped = dailyResponses.filter(
        (r: FormResponse) => responseTimestampMs(r) >= fromMs
      );
      const withData = scoped.filter((r: FormResponse) => {
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
    } catch {
      return { protein: 0, carbs: 0, fats: 0 };
    }
  }, [dailyResponses, checkinSchedule, chartPeriodCount]);

  const trainingActivity = useMemo(() => {
    try {
      const tz = checkinSchedule.timezone;

      return periodLabels.map((p) => {
        const ymdStart = toYmdInTimezone(p.start, tz);
        const ymdEnd = toYmdInTimezone(p.end, tz);
        let strength = 0;
        let cardio = 0;

        exerciseLogs.forEach(
          (log: {
            scheduled_date?: string;
            exercises?: { category?: string };
          }) => {
            const d = log.scheduled_date;

            if (!d || d < ymdStart || d > ymdEnd) return;
            if (log.exercises?.category === "cardio") cardio++;
            else strength++;
          }
        );

        return {
          date: p.label,
          strength,
          cardio,
          periodTooltip: formatPeriodTooltipSpan(p.start, p.end, tz),
        };
      });
    } catch {
      return [] as {
        date: string;
        strength: number;
        cardio: number;
        periodTooltip: string;
      }[];
    }
  }, [periodLabels, exerciseLogs, checkinSchedule.timezone]);

  const trainingPeriodTotal = useMemo(() => {
    if (trainingActivity.length === 0) return 0;
    const last = trainingActivity[trainingActivity.length - 1];

    return (last?.strength ?? 0) + (last?.cardio ?? 0);
  }, [trainingActivity]);

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
            onOpenDailyForm={() =>
              setSelectedDayForForm(new Date().toISOString().split("T")[0]!)
            }
            onOpenWeeklyForm={() => setShowWeeklyFormModal(true)}
          />

          {/* Check-in banner when schedule is enabled and current window is due */}
          {showWeeklyBanner && (
            <div className="mb-4">
              <h2 className="text-lg font-semibold font-heading mb-3 px-4 text-foreground">
                {checkinSchedule.custom_name}
              </h2>
              <button
                className="bg-warning cursor-pointer hover:opacity-90 transition-all active:scale-[0.98] py-8 px-6 w-full border-0"
                onClick={() => setShowWeeklyFormModal(true)}
              >
                <div className="max-w-lg mx-auto flex items-center justify-between">
                  <span className="text-white text-xl font-medium">
                    {`Completa tu ${checkinSchedule.custom_name}`}
                  </span>
                  <Icon
                    className="text-white text-3xl"
                    icon="solar:alt-arrow-right-bold"
                  />
                </div>
              </button>
            </div>
          )}

          {/* Daily Habits Section - 3-day cards */}
          {!isLoadingForms && (
            <div className="mb-4 px-4">
              <h2 className="text-lg font-semibold font-heading mb-3 text-foreground">
                Registro Diario
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {dailyFormDays.map((day) => (
                  <button
                    key={day.date}
                    className={`relative flex flex-col items-center rounded-xl p-3 transition-all active:scale-[0.97] cursor-pointer border ${
                      day.isSubmitted && day.isToday
                        ? "border-primary bg-primary shadow-sm"
                        : day.isSubmitted
                          ? "border-default-200 bg-default-50"
                          : day.isToday
                            ? "border-primary bg-primary shadow-sm"
                            : "border-default-200 bg-default-50"
                    }`}
                    onClick={() => setSelectedDayForForm(day.date)}
                  >
                    {day.isToday && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Hoy
                      </span>
                    )}
                    <span
                      className={`text-sm font-bold capitalize mt-1 ${day.isToday ? "text-white" : "text-foreground"}`}
                    >
                      {day.label}
                    </span>
                    <span
                      className={`text-xs capitalize mb-2 ${day.isToday ? "text-white/70" : "text-foreground/50"}`}
                    >
                      {day.dayName}
                    </span>
                    {day.isSubmitted ? (
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${day.isToday ? "bg-white/20" : "bg-success/10"}`}
                      >
                        <Icon
                          className={
                            day.isToday ? "text-white" : "text-success"
                          }
                          icon="solar:check-circle-bold"
                          width={14}
                        />
                        <span
                          className={`text-[11px] font-semibold ${day.isToday ? "text-white" : "text-success"}`}
                        >
                          Enviado
                        </span>
                      </div>
                    ) : (
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${day.isToday ? "bg-white/20" : "bg-warning/10"}`}
                      >
                        <Icon
                          className={
                            day.isToday ? "text-white" : "text-warning-600"
                          }
                          icon="solar:clock-circle-bold"
                          width={14}
                        />
                        <span
                          className={`text-[11px] font-semibold ${day.isToday ? "text-white" : "text-warning-600"}`}
                        >
                          Pendiente
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Check-in modal */}
          <DynamicFormModal
            clientId={clientId}
            formType="checkins"
            isOpen={showWeeklyFormModal}
            schedule={checkinSchedule}
            onClose={() => setShowWeeklyFormModal(false)}
            onSuccess={() => {
              // Invalidate weekly form responses — TanStack Query refetches
              // in the background while keeping current data visible.
              queryClient.invalidateQueries({
                queryKey: ["client", "formResponses", clientId, "checkins"],
              });
              queryClient.invalidateQueries({
                queryKey: ["client", "formConfig", clientId, "checkins"],
              });
            }}
          />

          {/* Daily Habits Modal */}
          <DynamicFormModal
            clientId={clientId}
            formType="habits"
            isOpen={selectedDayForForm !== null}
            targetDate={selectedDayForForm ?? undefined}
            onClose={() => setSelectedDayForForm(null)}
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
                  {checkinSchedule.enabled && (
                    <p className="text-xs font-semibold text-foreground/70 tracking-wide mb-2">
                      {checkinSchedule.custom_name}
                    </p>
                  )}
                  <WeightChart
                    currentValue={
                      weightHistory[weightHistory.length - 1]?.weight || 0
                    }
                    data={weightHistory}
                    schedule={checkinSchedule}
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
                    schedule={checkinSchedule}
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
                    schedule={checkinSchedule}
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
                    schedule={checkinSchedule}
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
                    periodTotal={trainingPeriodTotal}
                    schedule={checkinSchedule}
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

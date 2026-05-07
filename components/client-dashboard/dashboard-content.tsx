"use client";

import { Card, CardBody, Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { ChartsSection } from "@/components/client-dashboard/charts-section";
import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import { DynamicFormModal } from "@/components/client-dashboard/dynamic-form-modal";
import { NeatChartCard } from "@/components/client-dashboard/neat-chart-card";
import { clientFetch } from "@/lib/auth/client-token-storage";
import { resolveStepsAnswer } from "@/lib/forms/analytics-keys";
import {
  chartPeriodCountForRange,
  daysToFetchForChartRange,
  getChartDateRange,
} from "@/lib/forms/chart-helpers";
import {
  formResponsesToSubmittedAtPayload,
  getLocalTodayYmd,
  getLocalYmd,
} from "@/lib/forms/client-helpers";
import { getScheduleOrDefault, isCheckInDue } from "@/lib/forms/schedule";
import {
  DEFAULT_CHECKIN_SCHEDULE,
  FormResponse,
  type CheckInSchedule,
} from "@/lib/forms/types";
import { useFormResponses, useNeatCards } from "@/lib/hooks/use-client-queries";
import { ClientNeatCard } from "@/types";

/** Weekly default schedule if parsing or chart math fails (Monday 12:00 Europe/Madrid). */
const FALLBACK_CHECKIN_SCHEDULE: CheckInSchedule = {
  ...DEFAULT_CHECKIN_SCHEDULE,
};

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
          const res = await clientFetch(
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
      return chartPeriodCountForRange(selectedPeriod, checkinSchedule);
    } catch {
      return chartPeriodCountForRange(
        selectedPeriod,
        FALLBACK_CHECKIN_SCHEDULE
      );
    }
  }, [selectedPeriod, checkinSchedule]);

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
      // Use the LOCAL Y-M-D so it matches the user's clock and the `label`
      // / `dayName` we render below (both of those use `toLocaleDateString`,
      // which is also local). Previously this used `toISOString()` which
      // returns UTC — for users in CEST around 00:00–02:00 local, or LATAM
      // before midnight, the saved `date` could end up on a different
      // calendar day than the visible label. That mismatch was the root
      // cause of "el botón dice un día y al entrar al modal aparece otro"
      // (Alexis Inca's ticket).
      const dateStr = getLocalYmd(d);

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

  const todaySteps = useMemo(() => {
    // `response_date` is saved with the user's local Y-M-D (see comment on
    // `getLocalTodayYmd`). Comparing against a UTC-derived "today" silently
    // missed the user's own row when their local day differed from UTC.
    const t = getLocalTodayYmd();
    const row = dailyResponses.find((r: FormResponse) => r.response_date === t);

    return resolveStepsAnswer(row?.answers) ?? 0;
  }, [dailyResponses]);

  // Últimos 7 días en orden cronológico (más antiguo → hoy) para la tira
  // semanal del NeatChartCard. Reusamos `dailyResponses` que ya viene
  // cacheado por TanStack Query — no hay fetch adicional.
  const weekSteps = useMemo(() => {
    const now = new Date();
    const todayYmd = getLocalTodayYmd();
    const days: {
      date: string;
      weekday: number;
      steps: number;
      isToday: boolean;
    }[] = [];

    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);

      d.setDate(now.getDate() - i);
      const ymd = getLocalYmd(d);
      const row = dailyResponses.find(
        (r: FormResponse) => r.response_date === ymd
      );

      days.push({
        date: ymd,
        weekday: d.getDay(),
        steps: resolveStepsAnswer(row?.answers) ?? 0,
        isToday: ymd === todayYmd,
      });
    }

    return days;
  }, [dailyResponses]);

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
            onOpenDailyForm={() => setSelectedDayForForm(getLocalTodayYmd())}
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

            <ChartsSection
              clientId={clientId}
              selectedPeriod={selectedPeriod}
            />

            {/* Actividad diaria — antes "NEAT - ACTIVIDAD DIARIA". Se
                muestra solo si el entrenador configuró tarjetas NEAT y al
                menos una aplica hoy (ver `shouldShowNeatChart`). El
                header ahora sigue el patrón de <ChartCard> (icono-left)
                para que visualmente case con el resto de la sección. */}
            {shouldShowNeatChart && (
              <Card radius="lg" shadow="sm">
                <CardBody>
                  <div className="flex items-center mb-3 gap-2 min-h-[28px]">
                    <div className="bg-success/10 p-1.5 rounded-full flex-shrink-0">
                      <Icon
                        aria-hidden
                        className="text-success"
                        icon="solar:walking-bold"
                        width={16}
                      />
                    </div>
                    <p className="text-xs font-semibold text-foreground/70 tracking-wide truncate">
                      Actividad diaria
                    </p>
                  </div>

                  <NeatChartCard
                    neatCards={neatCards}
                    todaySteps={todaySteps}
                    weekSteps={weekSteps}
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

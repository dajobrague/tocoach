"use client";

import type { MealSlotOptionRow } from "@/lib/nutrition/cycles/meal-slot-option-service";

import { Card, CardBody, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo, useState, type ReactNode } from "react";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import { DaySummaryCard } from "@/components/client-dashboard/meal-cycle/day-summary-card";
import {
  GoalCard,
  GoalsOnlyView,
} from "@/components/client-dashboard/meal-cycle/goals-only-view";
import { PdfDietView } from "@/components/client-dashboard/meal-cycle/pdf-diet-view";
import { dayPlannedTotals } from "@/components/client-dashboard/meal-cycle/slot-grouping";
import { MealCycleDayPanel } from "@/components/client-dashboard/meal-cycle/meal-cycle-day-panel";
import {
  MenuBar,
  MenuChooser,
} from "@/components/client-dashboard/meal-cycle/menu-picker";
import {
  loggedDates,
  mondayOf,
} from "@/components/client-dashboard/meal-cycle/meal-cycle-week-helpers";
import { RecipeOptionDetail } from "@/components/client-dashboard/meal-cycle/recipe-option-detail";
import { ShoppingListSection } from "@/components/client-dashboard/shopping-list/shopping-list-section";
import { WeekDateSelector } from "@/components/client-dashboard/workouts/week-date-selector";
import { getLocalYmd } from "@/lib/forms/client-helpers";
import {
  useClientMealCycleWeek,
  useSetMealCycleSelection,
  useSetMenuChoice,
} from "@/lib/hooks/use-client-queries";
import { shouldShowMacrosToClient } from "@/lib/nutrition/cycles/macro-visibility";

const MAX_BACK_DAYS = 30;

/** Page chrome shared by every branch (header + bottom nav). */
function MealCycleShell({ children }: { children: ReactNode }) {
  const {
    firstName,
    logoUrl,
    trainerName,
    clientProfilePicture,
    clientId,
    tenantSlug,
  } = useClientData();

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <ClientHeader
          clientId={clientId}
          clientProfilePicture={clientProfilePicture}
          firstName={firstName}
          logoUrl={logoUrl}
          tagline="Tu plan de comidas"
          tenantSlug={tenantSlug}
          trainerName={trainerName}
        />
        <main className="mx-auto w-full max-w-2xl px-4 py-4">{children}</main>
      </div>
      <ClientBottomNav />
    </>
  );
}

function CenteredState({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <Card className="mt-6">
      <CardBody className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <Icon className="text-default-400" icon={icon} width={44} />
        <p className="text-lg font-semibold text-foreground">{title}</p>
        {subtitle !== undefined ? (
          <p className="max-w-sm text-sm text-default-500">{subtitle}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Client meal-plan view (nutrition-v2). A week-based layout that reuses the
 * training {@link WeekDateSelector}: picking a day drives the plan via
 * `GET /api/client/meal-cycle/week`. The selected day shows its resolved plan
 * (swaps already applied from the frozen snapshot), the notes banner, and its
 * logs — and logging is gated by the day's `canLog` (today + past-within-30d),
 * so future days are view-only, matching the server log-window lock.
 */
export function MealCycleContent() {
  // Capture "today"/tz once per mount so the visible week is stable.
  const [todayYmd] = useState(() => getLocalYmd(new Date()));
  const [timeZone] = useState(browserTimeZone);
  const [selectedDate, setSelectedDate] = useState(todayYmd);
  const [detailOption, setDetailOption] = useState<MealSlotOptionRow | null>(
    null
  );
  // Date whose chooser was reopened via "Cambiar" (cleared on save/navigate).
  const [chooserFor, setChooserFor] = useState<string | null>(null);

  const weekStart = mondayOf(selectedDate);
  const { data, isPending, isError } = useClientMealCycleWeek(
    weekStart,
    timeZone
  );
  const selectMutation = useSetMealCycleSelection();
  const menuChoiceMutation = useSetMenuChoice();

  const datesWithActivity = useMemo(
    () => (data ? loggedDates(data.days) : new Set<string>()),
    [data]
  );

  if (isPending) {
    return (
      <MealCycleShell>
        <div className="flex justify-center p-12">
          <Spinner color="primary" />
        </div>
      </MealCycleShell>
    );
  }

  if (isError) {
    return (
      <MealCycleShell>
        <CenteredState
          icon="solar:danger-triangle-linear"
          subtitle="Vuelve a intentarlo en un momento."
          title="No pudimos cargar tu plan"
        />
      </MealCycleShell>
    );
  }

  // No plan section → show what the trainer chose (sections stack: goals
  // first — "los objetivos son lo importante" — then the PDF). Responses
  // without `sections` (older server) walk the automatic ladder as before:
  // PDF, else goals-only, else empty.
  if (data === undefined || data === null || data.cycle === null) {
    const pdf = data?.fallback?.pdf ?? null;
    const presets = data?.fallback?.presets ?? [];
    const goals = data?.goals ?? null;
    const sections = data?.sections;
    const hasGoalsData = goals !== null || presets.length > 0;
    const showGoals =
      sections !== undefined
        ? sections.includes("goals") && hasGoalsData
        : pdf === null && hasGoalsData;
    const showPdf =
      pdf !== null && (sections === undefined || sections.includes("pdf"));

    return (
      <MealCycleShell>
        {showGoals || showPdf ? (
          <div className="flex flex-col gap-6">
            {showGoals ? (
              <GoalsOnlyView goals={goals} presets={presets} />
            ) : null}
            {showPdf && pdf !== null ? (
              <PdfDietView name={pdf.name} url={pdf.url} />
            ) : null}
          </div>
        ) : (
          <CenteredState
            icon="solar:plate-linear"
            subtitle="Tu entrenador aún no te ha asignado un plan de comidas."
            title="Sin plan activo"
          />
        )}
      </MealCycleShell>
    );
  }

  const showMacros = shouldShowMacrosToClient();
  const selectedDay =
    data.days.find((day) => day.date === selectedDate) ?? data.days[0] ?? null;

  const hasPlannedDay =
    selectedDay !== null &&
    selectedDay.started === true &&
    selectedDay.slots.length > 0;

  // The chooser gates the day until the client confirms a menu — only on
  // today/future dates of a multi-menu plan, and never once something was
  // logged that day (the plan is already in motion there).
  const menus = data.menus ?? [];
  const canChoose = selectedDate >= todayYmd;
  const needsChoice =
    selectedDay !== null &&
    selectedDay.started === true &&
    menus.length > 1 &&
    canChoose &&
    selectedDay.hasMenuChoice !== true &&
    Object.keys(selectedDay.logs).length === 0;
  const chooserVisible =
    selectedDay !== null &&
    selectedDay.started === true &&
    menus.length > 1 &&
    (needsChoice || chooserFor === selectedDate);

  // Sección Objetivos (visibilidad "goals") en el TOP de la página y ligada
  // al día: attachDayGoals ya resolvió selectedDay.targets al preset asignado
  // a ese día del ciclo (o al objetivo general si el día no tiene uno). Se
  // muestra SOLO ese objetivo — no la lista completa (petición 18-ago).
  const dayGoal =
    data.sections?.includes("goals") === true &&
    selectedDay !== null &&
    selectedDay.targets !== null &&
    selectedDay.targets !== undefined
      ? {
          name: selectedDay.targetName ?? "Objetivo diario",
          values: selectedDay.targets,
        }
      : null;

  return (
    <MealCycleShell>
      <div className="flex flex-col gap-4">
        {dayGoal !== null ? (
          <GoalCard
            highlight
            icon="solar:target-bold"
            name={dayGoal.name}
            values={dayGoal.values}
          />
        ) : null}

        <WeekDateSelector
          datesWithActivity={datesWithActivity}
          maxBackDays={MAX_BACK_DAYS}
          selectedDate={selectedDate}
          todayYmd={todayYmd}
          onSelect={setSelectedDate}
        />

        {chooserVisible && selectedDay !== null ? (
          <MenuChooser
            key={selectedDay.date}
            day={selectedDay}
            menus={menus}
            pending={menuChoiceMutation.isPending}
            showMacros={showMacros}
            onChoose={(dayIndex) =>
              menuChoiceMutation.mutate(
                { date: selectedDay.date, dayIndex },
                { onSuccess: () => setChooserFor(null) }
              )
            }
          />
        ) : (
          <>
            {selectedDay !== null ? (
              <MenuBar
                day={selectedDay}
                menus={menus}
                {...(canChoose
                  ? { onChange: () => setChooserFor(selectedDate) }
                  : {})}
              />
            ) : null}

            {showMacros && hasPlannedDay ? (
              <DaySummaryCard
                goalName={selectedDay?.targetName ?? null}
                goals={selectedDay?.targets ?? data.goals ?? null}
                totals={dayPlannedTotals(selectedDay.slots, data.selections)}
              />
            ) : null}

            {selectedDay === null ? (
              <CenteredState
                icon="solar:plate-linear"
                title="No hay comidas para este día"
              />
            ) : (
              <MealCycleDayPanel
                day={selectedDay}
                selections={data.selections}
                showMacros={showMacros}
                onOpenOption={setDetailOption}
                onSelectOption={(option) =>
                  selectMutation.mutate({
                    slotId: option.slot_id,
                    optionId: option.id,
                  })
                }
              />
            )}
          </>
        )}

        {/* Trainer chose plan + PDF → the document rides along under the plan. */}
        {data.sections?.includes("pdf") === true &&
        data.fallback?.pdf !== null &&
        data.fallback?.pdf !== undefined ? (
          <PdfDietView
            name={data.fallback.pdf.name}
            url={data.fallback.pdf.url}
          />
        ) : null}

        {/* Products-only shopping list for the active plan (Jul 28 call). */}
        <ShoppingListSection />
      </div>

      <RecipeOptionDetail
        option={detailOption}
        onClose={() => setDetailOption(null)}
      />
    </MealCycleShell>
  );
}

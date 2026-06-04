"use client";

import type { MealSlotOptionRow } from "@/lib/nutrition/cycles/meal-slot-option-service";

import { Button, Card, CardBody, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo, useState, type ReactNode } from "react";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import { MealCycleDayPanel } from "@/components/client-dashboard/meal-cycle/meal-cycle-day-panel";
import {
  loggedDates,
  mondayOf,
} from "@/components/client-dashboard/meal-cycle/meal-cycle-week-helpers";
import { RecipeOptionDetail } from "@/components/client-dashboard/meal-cycle/recipe-option-detail";
import { ShoppingWizard } from "@/components/client-dashboard/shopping-list/shopping-wizard";
import { WeekDateSelector } from "@/components/client-dashboard/workouts/week-date-selector";
import { getLocalYmd } from "@/lib/forms/client-helpers";
import {
  useClientMealCycleWeek,
  useSetMealCycleSelection,
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
  const [wizardOpen, setWizardOpen] = useState(false);

  const weekStart = mondayOf(selectedDate);
  const { data, isPending, isError } = useClientMealCycleWeek(
    weekStart,
    timeZone
  );
  const selectMutation = useSetMealCycleSelection();

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

  // `null` (flag off) or no active cycle (cycle === null) → empty state.
  if (data === undefined || data === null || data.cycle === null) {
    return (
      <MealCycleShell>
        <CenteredState
          icon="solar:plate-linear"
          subtitle="Tu entrenador aún no te ha asignado un plan de comidas."
          title="Sin plan activo"
        />
      </MealCycleShell>
    );
  }

  const showMacros = shouldShowMacrosToClient();
  const selectedDay =
    data.days.find((day) => day.date === selectedDate) ?? data.days[0] ?? null;

  return (
    <MealCycleShell>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {data.cycle.name}
          </h1>
          {selectedDay?.started === true && selectedDay.dayIndex !== null ? (
            <p className="text-sm text-default-500">
              Día {selectedDay.dayIndex + 1} de {data.cycle.durationDays}
            </p>
          ) : null}
        </div>

        <WeekDateSelector
          datesWithActivity={datesWithActivity}
          maxBackDays={MAX_BACK_DAYS}
          selectedDate={selectedDate}
          todayYmd={todayYmd}
          onSelect={setSelectedDate}
        />

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

        {/* The shopping list is now an explicit week wizard (the client picks
            which meals they'll make), replacing the old auto-derived list. */}
        <Button
          className="self-start"
          data-testid="open-shopping-wizard"
          startContent={<Icon icon="solar:cart-large-2-bold" width={18} />}
          variant="flat"
          onPress={() => setWizardOpen(true)}
        >
          Lista de compras
        </Button>
      </div>

      <ShoppingWizard
        days={data.days}
        isOpen={wizardOpen}
        selections={data.selections}
        weekStart={data.weekStart}
        onClose={() => setWizardOpen(false)}
      />

      <RecipeOptionDetail
        option={detailOption}
        onClose={() => setDetailOption(null)}
      />
    </MealCycleShell>
  );
}

// Pantalla del calendario del cliente. Reescritura del antiguo
// calendar-content.tsx (553 líneas con datos mock) — ahora consume
// /api/client/calendar para mostrar SOLO entrenamientos completados
// (decisión j) y soporta tres vistas: Mes / Quincena / Semana
// (decisión i). Sin sugerencias futuras, sin edición retroactiva
// (decisión extra-2).

"use client";

import { Card, CardBody, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo, useState } from "react";

import { CalendarDayDetail } from "./calendar-day-detail";
import { CalendarFortnightGrid } from "./calendar-fortnight-grid";
import { CalendarHeader, type CalendarView } from "./calendar-header";
import { CalendarMonthGrid } from "./calendar-month-grid";
import { CalendarWeekGrid } from "./calendar-week-grid";
import { useCalendarEntries } from "./hooks/use-calendar-entries";

import { getLocalTodayYmd, getLocalYmd } from "@/lib/forms/client-helpers";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";

export function CalendarContent() {
  const {
    clientId,
    firstName,
    logoUrl,
    trainerName,
    clientProfilePicture,
    tenantSlug,
  } = useClientData();

  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const todayYmd = getLocalTodayYmd();
  const range = useMemo(() => computeRange(view, anchor), [view, anchor]);

  const { data, isLoading, error } = useCalendarEntries({
    from: range.from,
    to: range.to,
  });

  const selectedSessions = selectedDate
    ? (data?.byDate.get(selectedDate) ?? [])
    : [];

  const handlePrev = () => setAnchor(stepAnchor(view, anchor, -1));
  const handleNext = () => setAnchor(stepAnchor(view, anchor, 1));
  const handleToday = () => {
    setAnchor(new Date());
    setSelectedDate(null);
  };
  const handleChangeView = (next: CalendarView) => {
    setView(next);
    setSelectedDate(null);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto">
        <ClientHeader
          clientId={clientId}
          clientProfilePicture={clientProfilePicture}
          firstName={firstName}
          logoUrl={logoUrl}
          tenantSlug={tenantSlug}
          trainerName={trainerName}
        />

        <div className="px-4 pb-2 pt-2">
          <h1 className="text-3xl font-heading font-bold text-foreground mb-1">
            Calendario
          </h1>
          <p className="text-default-500 font-body text-sm">
            Tus entrenamientos completados
          </p>
        </div>

        <div className="px-4 space-y-4">
          <Card>
            <CardBody className="p-3 space-y-4">
              <CalendarHeader
                title={formatTitle(view, range)}
                view={view}
                onChangeView={handleChangeView}
                onNext={handleNext}
                onPrev={handlePrev}
                onToday={handleToday}
              />

              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner size="md" />
                </div>
              ) : error ? (
                <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
                  {error instanceof Error
                    ? error.message
                    : "Error al cargar el calendario"}
                </div>
              ) : view === "month" ? (
                <CalendarMonthGrid
                  byDate={data?.byDate ?? new Map()}
                  monthDate={anchor}
                  selectedDate={selectedDate}
                  todayYmd={todayYmd}
                  onSelectDate={setSelectedDate}
                />
              ) : view === "fortnight" ? (
                <CalendarFortnightGrid
                  byDate={data?.byDate ?? new Map()}
                  selectedDate={selectedDate}
                  startDate={anchor}
                  todayYmd={todayYmd}
                  onSelectDate={setSelectedDate}
                />
              ) : (
                <CalendarWeekGrid
                  byDate={data?.byDate ?? new Map()}
                  selectedDate={selectedDate}
                  startDate={startOfWeek(anchor)}
                  todayYmd={todayYmd}
                  onSelectDate={setSelectedDate}
                />
              )}
            </CardBody>
          </Card>

          {selectedDate ? (
            <CalendarDayDetail
              date={selectedDate}
              sessions={selectedSessions}
              onClose={() => setSelectedDate(null)}
            />
          ) : (
            <EmptyHint hasAny={(data?.totalSessions ?? 0) > 0} />
          )}
        </div>
      </div>
      <ClientBottomNav />
    </div>
  );
}

function EmptyHint({ hasAny }: { hasAny: boolean }) {
  return (
    <Card className="bg-content1 border border-default-200" shadow="none">
      <CardBody className="p-4 flex flex-row items-center gap-3">
        <Icon
          className="text-default-400 shrink-0"
          icon={
            hasAny
              ? "solar:hand-tap-line-duotone"
              : "solar:calendar-line-duotone"
          }
          width={28}
        />
        <p className="text-sm text-default-500 font-body">
          {hasAny
            ? "Toca un día con entrenamiento para ver el detalle."
            : "Todavía no hay entrenamientos completados en este rango."}
        </p>
      </CardBody>
    </Card>
  );
}

interface RangeYmd {
  from: string;
  to: string;
}

function computeRange(view: CalendarView, anchor: Date): RangeYmd {
  if (view === "month") {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();

    return {
      from: getLocalYmd(new Date(y, m - 1, 25)),
      to: getLocalYmd(new Date(y, m + 1, 7)),
    };
  }
  if (view === "fortnight") {
    const start = anchor;
    const end = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + 13
    );

    return { from: getLocalYmd(start), to: getLocalYmd(end) };
  }
  // week
  const start = startOfWeek(anchor);
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 6
  );

  return { from: getLocalYmd(start), to: getLocalYmd(end) };
}

function startOfWeek(d: Date): Date {
  const dow = d.getDay(); // 0 = Sun
  // Lunes-first: si dow=0 (dom), retroceder 6; si dow=1 (lun), 0; ...
  const back = (dow + 6) % 7;

  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
}

function stepAnchor(view: CalendarView, anchor: Date, dir: -1 | 1): Date {
  if (view === "month") {
    return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  }
  if (view === "fortnight") {
    return new Date(
      anchor.getFullYear(),
      anchor.getMonth(),
      anchor.getDate() + dir * 14
    );
  }

  return new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate() + dir * 7
  );
}

function formatTitle(view: CalendarView, range: RangeYmd): string {
  if (view === "fortnight") {
    return `${formatShort(range.from)} – ${formatShort(range.to)}`;
  }
  if (view === "week") {
    return `Sem. ${formatShort(range.from)}`;
  }

  // month: usa el 15 del mes para evitar deriva de TZ.
  const fromYmd = range.from;
  const startDay = parseInt(fromYmd.slice(8, 10), 10);
  // range.from apunta al 25 del mes anterior; el mes "actual" es el siguiente.
  const targetDate = new Date(`${fromYmd}T12:00:00Z`);

  if (startDay >= 15) targetDate.setUTCMonth(targetDate.getUTCMonth() + 1);

  return new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(targetDate);
}

function formatShort(isoYmd: string): string {
  try {
    const d = new Date(`${isoYmd}T12:00:00Z`);

    return new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
    })
      .format(d)
      .replace(".", "");
  } catch {
    return isoYmd;
  }
}

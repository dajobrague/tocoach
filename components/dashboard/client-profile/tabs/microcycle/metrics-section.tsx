"use client";

// Seguimiento (rediseño, rebanada 1): semana ⇄ mes.
// La semana conserva toda la mecánica existente (LRU + prefetch, teclado,
// popovers de métricas, videos); el mes es la vista nueva pedida por José.
// Ambas comparten selección de día, el detalle de abajo y la MISMA
// clasificación (day-label.ts + buildDayMetricsRange).

import { Button, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useClientExerciseLogs } from "../workouts/use-client-exercise-logs";
import { useUrlEnum } from "../../use-url-state";

import { DayDetail } from "./day-detail";
import { MonthGrid } from "./month-grid";
import { useMonthMetrics } from "./use-month-metrics";
import { useWeekMetrics } from "./use-week-metrics";
import { WeekNavigator } from "./week-navigator";
import { WeekStrip } from "./week-strip";

import {
  firstOfMonth,
  shiftMonth,
} from "@/features/trainer/cycles/calendar-helpers";
import { getLocalYmd } from "@/lib/forms/client-helpers";
import {
  TrainerExerciseVideoModal,
  type TrainerExerciseVideoHandle,
} from "@/components/trainer/trainer-exercise-video-modal";

const VIEW_KEYS = ["semana", "mes"] as const;

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;

  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);

  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);

  d.setDate(d.getDate() + n);

  return d;
}

interface Props {
  clientId: string;
  /** Called when the trainer asks to open Configuración (from empty state). */
  onSwitchToConfig?: () => void;
}

export function MetricsSection({ clientId, onSwitchToConfig }: Props) {
  const [view, setView] = useUrlEnum("v", VIEW_KEYS, "semana");
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date())
  );
  const [monthYmd, setMonthYmd] = useState<string>(() =>
    firstOfMonth(getLocalYmd(new Date()))
  );
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    getLocalYmd(new Date())
  );
  const todayYmd = getLocalYmd(new Date());

  const week = useWeekMetrics(clientId, weekStart);
  // El hook del mes solo trabaja cuando la vista es "mes" (monta condicional
  // sería más limpio, pero el hook es barato con cache y así la vuelta
  // semana→mes es instantánea).
  const month = useMonthMetrics(clientId, monthYmd);

  // Historial all-time de logs por ejercicio — un solo fetch a nivel de
  // sección compartido por todos los popovers de métricas del detalle.
  const { getLogsForExercise } = useClientExerciseLogs(clientId);

  const videoModalRef = useRef<TrainerExerciseVideoHandle>(null);
  const openVideo = useCallback(
    (url: string, name: string) => videoModalRef.current?.open(url, name),
    []
  );

  // Reset selección al cambiar de cliente.
  useEffect(() => {
    const now = new Date();

    setSelectedDate(getLocalYmd(now));
    setWeekStart(startOfWeek(now));
    setMonthYmd(firstOfMonth(getLocalYmd(now)));
  }, [clientId]);

  const handlePrev = useCallback(() => setWeekStart((w) => addDays(w, -7)), []);
  const handleNext = useCallback(() => setWeekStart((w) => addDays(w, 7)), []);
  const handleToday = useCallback(() => {
    const today = new Date();

    setWeekStart(startOfWeek(today));
    setMonthYmd(firstOfMonth(getLocalYmd(today)));
    setSelectedDate(getLocalYmd(today));
  }, []);
  const handlePickDate = useCallback((ymd: string) => {
    const d = new Date(ymd + "T00:00:00");

    setWeekStart(startOfWeek(d));
    setMonthYmd(firstOfMonth(ymd));
    setSelectedDate(ymd);
  }, []);

  // Al seleccionar un día del mes, la semana lo sigue — volver a "Semana"
  // cae en la semana del día elegido, no donde quedó antes.
  const handleSelectFromMonth = useCallback((ymd: string) => {
    setSelectedDate(ymd);
    setWeekStart(startOfWeek(new Date(ymd + "T00:00:00")));
  }, []);

  // Arrow-key navigation forwarded from WeekStrip's focused day button.
  const handleArrowNav = useCallback(
    (direction: "left" | "right") => {
      if (!week.data) return;
      const idx = week.data.days.findIndex((d) => d.date === selectedDate);

      if (idx === -1) return;
      const next =
        direction === "left"
          ? week.data.days[idx - 1]
          : week.data.days[idx + 1];

      if (next) setSelectedDate(next.date);
    },
    [week.data, selectedDate]
  );

  // El detalle del día sale de la vista activa; el mes cubre semanas
  // completas así que un día seleccionado fuera del mes visible igual
  // resuelve.
  const selectedDay = useMemo(() => {
    if (view === "mes") {
      return month.byDate?.get(selectedDate) ?? null;
    }

    return week.data?.days.find((d) => d.date === selectedDate) ?? null;
  }, [view, month.byDate, week.data, selectedDate]);

  const weekIsCompletelyEmpty =
    !!week.data && week.data.days.every((d) => d.sessions.length === 0);

  const activeError = view === "mes" ? month.error : week.error;
  const activeRefetch = view === "mes" ? month.refetch : week.refetch;

  return (
    <section className="flex flex-col gap-4">
      {/* Header: navegación de la vista activa + toggle Semana/Mes. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {view === "semana" ? (
          <WeekNavigator
            weekStartYmd={getLocalYmd(weekStart)}
            onPickDate={handlePickDate}
            onToday={handleToday}
          />
        ) : (
          <div />
        )}

        <div
          aria-label="Vista de seguimiento"
          className="flex self-start rounded-large bg-gray-100 p-1"
          role="tablist"
        >
          {(
            [
              { key: "semana", label: "Semana", icon: "solar:list-linear" },
              { key: "mes", label: "Mes", icon: "solar:calendar-linear" },
            ] as const
          ).map((t) => {
            const isActive = view === t.key;

            return (
              <button
                key={t.key}
                aria-selected={isActive}
                className={`flex items-center gap-1.5 rounded-medium px-3 py-1.5 text-sm transition ${
                  isActive
                    ? "bg-white font-medium text-gray-900 shadow-sm"
                    : "font-normal text-default-500 hover:text-default-700"
                }`}
                role="tab"
                type="button"
                onClick={() => setView(t.key)}
              >
                <Icon icon={t.icon} width={15} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeError ? (
        <div className="flex items-center justify-between gap-3 rounded-large border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <span>{activeError}</span>
          <Button size="sm" variant="flat" onPress={activeRefetch}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {view === "semana" ? (
        week.loading && !week.data ? (
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-[4.5rem] rounded-large" />
            ))}
          </div>
        ) : week.data && !weekIsCompletelyEmpty ? (
          <div
            className={
              week.loading
                ? "opacity-50 transition-opacity"
                : "transition-opacity"
            }
          >
            <WeekStrip
              days={week.data.days}
              selectedDate={selectedDate}
              onArrowNav={handleArrowNav}
              onNextWeek={handleNext}
              onPrevWeek={handlePrev}
              onSelect={setSelectedDate}
            />
          </div>
        ) : null
      ) : month.loading && !month.byDate ? (
        <Skeleton className="h-[26rem] rounded-large" />
      ) : month.byDate ? (
        <div
          className={
            month.loading
              ? "opacity-50 transition-opacity"
              : "transition-opacity"
          }
        >
          <MonthGrid
            byDate={month.byDate}
            monthYmd={monthYmd}
            selectedDate={selectedDate}
            todayYmd={todayYmd}
            onNextMonth={() => setMonthYmd((m) => shiftMonth(m, 1))}
            onPrevMonth={() => setMonthYmd((m) => shiftMonth(m, -1))}
            onSelect={handleSelectFromMonth}
            onToday={handleToday}
          />
        </div>
      ) : null}

      {selectedDay ? (
        <DayDetail
          clientId={clientId}
          day={selectedDay}
          getLogsForExercise={getLogsForExercise}
          orphanLogs={[]}
          onPlayVideo={openVideo}
        />
      ) : null}

      <TrainerExerciseVideoModal ref={videoModalRef} />

      {view === "semana" && week.data && weekIsCompletelyEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-large border border-dashed border-gray-200 bg-gray-50/60 py-10 text-center">
          <Icon
            className="text-default-300"
            icon="solar:calendar-linear"
            width={28}
          />
          <p className="text-sm font-semibold text-gray-900">
            Semana sin sesiones programadas
          </p>
          <p className="max-w-md text-sm text-default-500">
            Esta semana no tiene actividad programada ni registrada.
          </p>
          {onSwitchToConfig ? (
            <Button
              className="mt-1"
              size="sm"
              variant="bordered"
              onPress={onSwitchToConfig}
            >
              Configurar microciclo
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

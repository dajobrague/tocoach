"use client";

import { Button, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DayDetail } from "./day-detail";
import { useWeekMetrics } from "./use-week-metrics";
import { WeekNavigator } from "./week-navigator";
import { WeekStrip } from "./week-strip";

import { getLocalYmd } from "@/lib/forms/client-helpers";
import {
  TrainerExerciseVideoModal,
  type TrainerExerciseVideoHandle,
} from "@/components/trainer/trainer-exercise-video-modal";

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
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date())
  );
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    getLocalYmd(new Date())
  );
  const { data, loading, error, refetch, invalidate } = useWeekMetrics(
    clientId,
    weekStart
  );

  const videoModalRef = useRef<TrainerExerciseVideoHandle>(null);
  const openVideo = useCallback(
    (url: string, name: string) => videoModalRef.current?.open(url, name),
    []
  );

  // Reset selected date when client changes.
  useEffect(() => {
    setSelectedDate(getLocalYmd(new Date()));
    setWeekStart(startOfWeek(new Date()));
  }, [clientId]);

  const handlePrev = useCallback(() => setWeekStart((w) => addDays(w, -7)), []);
  const handleNext = useCallback(() => setWeekStart((w) => addDays(w, 7)), []);
  const handleToday = useCallback(() => {
    const today = new Date();

    setWeekStart(startOfWeek(today));
    setSelectedDate(getLocalYmd(today));
  }, []);
  const handlePickDate = useCallback((ymd: string) => {
    const d = new Date(ymd + "T00:00:00");

    setWeekStart(startOfWeek(d));
    setSelectedDate(ymd);
  }, []);

  // Arrow-key navigation forwarded from WeekStrip's focused day button.
  const handleArrowNav = useCallback(
    (direction: "left" | "right") => {
      if (!data) return;
      const idx = data.days.findIndex((d) => d.date === selectedDate);

      if (idx === -1) return;
      if (direction === "left" && idx > 0) {
        setSelectedDate(data.days[idx - 1]!.date);
      } else if (direction === "right" && idx < data.days.length - 1) {
        setSelectedDate(data.days[idx + 1]!.date);
      }
    },
    [data, selectedDate]
  );

  const selectedDay = useMemo(
    () => data?.days.find((d) => d.date === selectedDate) ?? null,
    [data, selectedDate]
  );

  const todayYmd = useMemo(() => getLocalYmd(new Date()), []);
  const editable =
    !!selectedDay &&
    (selectedDay.date >= todayYmd || selectedDay.logs.length === 0);

  const handleCommitted = useCallback(() => {
    invalidate(getLocalYmd(weekStart));
  }, [invalidate, weekStart]);

  // "No prescription anywhere this week" is the trigger for the empty-state
  // banner. We don't try to detect a missing client_program globally — if the
  // week has no scheduled sessions and no orphans either, we surface the
  // empty state instead of an empty strip of dashes.
  const weekIsCompletelyEmpty =
    !!data &&
    data.days.every((d) => d.prescribed.length === 0) &&
    data.orphansByDate.size === 0;

  return (
    <section className="flex flex-col gap-4">
      <WeekNavigator
        weekStartYmd={getLocalYmd(weekStart)}
        onPickDate={handlePickDate}
        onToday={handleToday}
      />

      {error ? (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 flex items-center justify-between gap-3">
          <span>{error}</span>
          <Button size="sm" variant="flat" onPress={refetch}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : data && !weekIsCompletelyEmpty ? (
        <>
          <div
            className={
              loading ? "opacity-50 transition-opacity" : "transition-opacity"
            }
          >
            <WeekStrip
              days={data.days}
              selectedDate={selectedDate}
              onArrowNav={handleArrowNav}
              onNextWeek={handleNext}
              onPrevWeek={handlePrev}
              onSelect={setSelectedDate}
            />
          </div>

          {selectedDay ? (
            <DayDetail
              clientId={clientId}
              day={selectedDay}
              editable={editable}
              orphanLogs={data.orphansByDate.get(selectedDate) ?? []}
              onCommitted={handleCommitted}
              onPlayVideo={openVideo}
            />
          ) : null}
        </>
      ) : null}

      <TrainerExerciseVideoModal ref={videoModalRef} />

      {data && weekIsCompletelyEmpty ? (
        <div className="rounded-lg border border-warning-200 bg-warning-50 p-4 text-sm text-warning-800 flex items-start gap-3">
          <Icon
            className="mt-0.5 text-warning-600"
            icon="solar:info-circle-bold"
            width={18}
          />
          <div className="flex-1">
            <p className="font-medium mb-1">Semana sin sesiones programadas</p>
            <p className="text-warning-700">
              Esta semana no tiene actividad programada ni registrada.
            </p>
            {onSwitchToConfig ? (
              <button
                className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-800 underline"
                type="button"
                onClick={onSwitchToConfig}
              >
                Ir a Configuración →
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

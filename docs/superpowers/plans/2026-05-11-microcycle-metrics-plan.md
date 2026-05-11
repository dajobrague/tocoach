# Microciclo Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-date metrics view inside the Microciclo tab — sub-tab Métricas (default) with weekly calendar navigation, adherence indicators, and an inline day-detail panel — without modifying the existing slot-based microcycle editor.

**Architecture:** Two sub-tabs inside `microcycle-tab.tsx` (Métricas default, Configuración secondary). `MetricsSection` owns week + selected-day state, delegates the parallel fetch to a `useWeekMetrics` hook, and renders three presentational pieces (`WeekNavigator`, `WeekStrip`, `DayDetail`). A pure `adherence.ts` module computes the three percentages (ejercicios, series, carga). A new trainer-scoped API endpoint mirrors the existing `/exercise-logs/trainer` auth pattern.

**Tech Stack:** Next.js 15 App Router · React 19 · HeroUI v2 · Tailwind v4 · `@iconify/react` · Supabase (via `createSupabaseClient`) · existing `HistoryDateFilter` calendar popover (extended) · no new dependencies.

**Reference:** Spec at `docs/superpowers/specs/2026-05-11-microcycle-metrics-design.md`.

---

## File Structure

**Create:**

- `app/api/clients/[clientId]/scheduled-sessions/trainer/route.ts` — Trainer-scoped GET returning scheduled sessions with nested prescribed exercises for a date range. Auth mirrors `/exercise-logs/trainer`.
- `components/dashboard/client-profile/tabs/microcycle/adherence.ts` — Pure compute: `computeDayAdherence`, `classifyDay`, `formatPercent`. No React imports.
- `components/dashboard/client-profile/tabs/microcycle/use-week-metrics.ts` — Hook: parallel fetch of scheduled sessions + exercise logs, indexed by date, with `AbortController` cancellation.
- `components/dashboard/client-profile/tabs/microcycle/week-strip.tsx` — 7-day grid presentational.
- `components/dashboard/client-profile/tabs/microcycle/week-navigator.tsx` — Prev/Next/Today buttons + clickable week label that opens the calendar popover.
- `components/dashboard/client-profile/tabs/microcycle/day-detail.tsx` — Drill-down panel rendered below the strip when a day is selected.
- `components/dashboard/client-profile/tabs/microcycle/metrics-section.tsx` — Orchestrator that mounts the four above and threads state.
- `components/dashboard/client-profile/tabs/microcycle/types.ts` — Shared types (`PrescribedExercise`, `DayMetrics`, `WeekMetrics`, `ScheduledSessionRow`).

**Modify:**

- `components/dashboard/client-profile/tabs/microcycle-tab.tsx` — Replace the thin wrapper with a two-sub-tab layout (Métricas default, Configuración).
- `components/dashboard/client-profile/tabs/workouts/history-date-filter.tsx` — Add an `allowAnyDate?: boolean` prop so the calendar inside the navigator can pick any week, not just dates with data.

**Do not touch:**

- `components/trainer/microcycle/microcycle-config.tsx` and its `hooks/` — rendered inside Configuración sub-tab unchanged.
- Any existing `/api/clients/[clientId]/exercise-logs/*` route.

All new files target <250 lines.

---

## Task 1: Trainer-scoped scheduled-sessions endpoint

**Files:**

- Create: `app/api/clients/[clientId]/scheduled-sessions/trainer/route.ts`

The existing `/scheduled-sessions/route.ts` is client-authenticated. We need a parallel trainer route that verifies `client.tenant === session.trainer_id` and returns scheduled sessions joined to their prescribed exercises.

- [ ] **Step 1: Create the route**

```ts
// app/api/clients/[clientId]/scheduled-sessions/trainer/route.ts
import { NextRequest, NextResponse } from "next/server";

import { getTrainerSession } from "@/lib/auth/session";
import { createSupabaseClient } from "@/lib/clients/supabase-api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const supabase = createSupabaseClient();

  try {
    const session = await getTrainerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const { clientId } = await params;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, tenant")
      .eq("id", clientId)
      .single();

    if (clientError || !client || client.tenant !== session.trainer_id) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    let query = supabase
      .from("scheduled_sessions")
      .select(
        `id, scheduled_date, status, completion_date,
         session:sessions(
           id, name,
           session_exercises(
             id, exercise_order, sets, reps, weight_kg,
             exercise:exercises(id, name, category)
           )
         )`
      )
      .eq("client_id", clientId)
      .order("scheduled_date", { ascending: true });

    if (startDate) query = query.gte("scheduled_date", startDate);
    if (endDate) query = query.lte("scheduled_date", endDate);

    const { data, error } = await query;

    if (error) {
      console.error("[Trainer Scheduled Sessions API] Error:", error);

      return NextResponse.json(
        { success: false, error: "Error al obtener sesiones programadas" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      scheduledSessions: data ?? [],
    });
  } catch (error) {
    console.error("[Trainer Scheduled Sessions API] Unexpected:", error);

    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

In another terminal, with a valid trainer session cookie:

```bash
curl --cookie "trainer-session=<JWT>" \
  "http://localhost:3000/api/clients/<known-client-id>/scheduled-sessions/trainer?startDate=2026-05-04&endDate=2026-05-11" \
  | jq .
```

Expected: `{ "success": true, "scheduledSessions": [...] }` with each row having `session.session_exercises[]` and each exercise carrying `exercise.id`, `exercise.name`, `exercise.category`.

If the join shape comes back different from the SELECT (Supabase column naming variations), adjust the SELECT path before committing.

- [ ] **Step 4: Commit**

```bash
git add "app/api/clients/[clientId]/scheduled-sessions/trainer/route.ts"
git commit -m "feat(api): trainer-scoped scheduled-sessions endpoint for microcycle metrics"
```

---

## Task 2: Types module

**Files:**

- Create: `components/dashboard/client-profile/tabs/microcycle/types.ts`

Shared types consumed by adherence.ts, the hook, and the visual components.

- [ ] **Step 1: Write the file**

```ts
// components/dashboard/client-profile/tabs/microcycle/types.ts
import type { ExerciseLog } from "../progress/types";

/** A single exercise prescribed inside a scheduled session. */
export interface PrescribedExercise {
  exerciseId: string;
  name: string;
  category: string;
  prescribedSets: number;
  /** Reps come back as TEXT from session_exercises (can be "10-12", "AMRAP", etc.). */
  prescribedReps: string | null;
  prescribedWeightKg: number | null;
}

/** Result of the API: a scheduled_sessions row with its session + exercises. */
export interface ScheduledSessionRow {
  id: string;
  scheduled_date: string;
  status: "scheduled" | "completed" | "missed" | "cancelled" | "rescheduled";
  completion_date: string | null;
  session: {
    id: string;
    name: string;
    session_exercises: Array<{
      id: string;
      exercise_order: number;
      sets: number | null;
      reps: string | null;
      weight_kg: number | null;
      exercise: { id: string; name: string; category: string };
    }>;
  } | null;
}

export type DayClassification =
  | "complete"
  | "partial"
  | "pending"
  | "rest"
  | "future";

export interface DayAdherence {
  totalPrescribed: number;
  completedExercises: number;
  prescribedSetsTotal: number;
  loggedSetsTotal: number;
  prescribedLoadTotal: number;
  loggedLoadTotal: number;
  /** 0..1 — proportion of exercises with at least one logged set. */
  ejercicios: number;
  /** 0..1 — proportion of prescribed sets that were logged. */
  series: number;
  /** 0..1 — proportion of prescribed load lifted. 1 when no prescribed load. */
  carga: number;
}

export interface DayMetrics {
  date: string;
  scheduledSession: ScheduledSessionRow | null;
  prescribed: PrescribedExercise[];
  logs: ExerciseLog[];
  adherence: DayAdherence;
  classification: DayClassification;
  isToday: boolean;
  isFuture: boolean;
}

export interface WeekMetrics {
  /** 7 entries, Monday first. */
  days: DayMetrics[];
  /** Logs whose scheduled_date sits inside the week but with no scheduled session. */
  orphansByDate: Map<string, ExerciseLog[]>;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/client-profile/tabs/microcycle/types.ts
git commit -m "feat(trainer): microcycle metrics types"
```

---

## Task 3: Adherence utilities

**Files:**

- Create: `components/dashboard/client-profile/tabs/microcycle/adherence.ts`

Pure compute. No React, no fetch. Tested via type-check + manual UI walkthrough in Task 10.

- [ ] **Step 1: Write the file**

```ts
// components/dashboard/client-profile/tabs/microcycle/adherence.ts
//
// Pure utilities for per-day adherence calculation. No React, no IO.

import type { ExerciseLog } from "../progress/types";

import type {
  DayAdherence,
  DayClassification,
  PrescribedExercise,
} from "./types";

const EMPTY_ADHERENCE: DayAdherence = {
  totalPrescribed: 0,
  completedExercises: 0,
  prescribedSetsTotal: 0,
  loggedSetsTotal: 0,
  prescribedLoadTotal: 0,
  loggedLoadTotal: 0,
  ejercicios: 0,
  series: 0,
  carga: 1,
};

function parseReps(reps: string | null | undefined): number {
  if (reps == null) return 0;
  const match = String(reps).match(/\d+/);

  return match ? parseInt(match[0]) : 0;
}

export function computeDayAdherence(
  prescribed: PrescribedExercise[],
  logs: ExerciseLog[]
): DayAdherence {
  if (prescribed.length === 0) return EMPTY_ADHERENCE;

  let completedExercises = 0;
  let prescribedSetsTotal = 0;
  let loggedSetsTotal = 0;
  let prescribedLoadTotal = 0;
  let loggedLoadTotal = 0;

  for (const p of prescribed) {
    const exerciseLogs = logs.filter((l) => l.exercise_id === p.exerciseId);
    const loggedSetsForExercise = exerciseLogs.flatMap((l) => l.sets ?? []);

    if (loggedSetsForExercise.length > 0) completedExercises += 1;
    loggedSetsTotal += loggedSetsForExercise.length;

    const prescribedSets = p.prescribedSets ?? 0;
    const prescribedReps = parseReps(p.prescribedReps);
    const prescribedWeight = p.prescribedWeightKg ?? 0;

    prescribedSetsTotal += prescribedSets;

    // Only count load when prescription has weight > 0 (skip bodyweight cases).
    if (prescribedWeight > 0) {
      prescribedLoadTotal += prescribedSets * prescribedReps * prescribedWeight;

      for (const s of loggedSetsForExercise) {
        loggedLoadTotal += (s.reps ?? 0) * (s.weight_kg ?? 0);
      }
    }
  }

  const ejercicios = completedExercises / prescribed.length;
  const series =
    prescribedSetsTotal === 0
      ? 0
      : Math.min(loggedSetsTotal / prescribedSetsTotal, 1);
  const carga =
    prescribedLoadTotal === 0
      ? 1
      : Math.min(loggedLoadTotal / prescribedLoadTotal, 1);

  return {
    totalPrescribed: prescribed.length,
    completedExercises,
    prescribedSetsTotal,
    loggedSetsTotal,
    prescribedLoadTotal,
    loggedLoadTotal,
    ejercicios,
    series,
    carga,
  };
}

export function classifyDay(
  hasPrescribed: boolean,
  adherence: DayAdherence,
  isFuture: boolean
): DayClassification {
  if (!hasPrescribed) return "rest";
  if (isFuture) return "future";
  if (adherence.completedExercises === 0) return "pending";
  if (adherence.completedExercises === adherence.totalPrescribed)
    return "complete";

  return "partial";
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/client-profile/tabs/microcycle/adherence.ts
git commit -m "feat(trainer): adherence compute utilities for microcycle metrics"
```

---

## Task 4: useWeekMetrics hook

**Files:**

- Create: `components/dashboard/client-profile/tabs/microcycle/use-week-metrics.ts`

Parallel fetch of scheduled sessions + exercise logs for a week. Indexes by date. Cancels stale fetches on input change.

- [ ] **Step 1: Write the hook**

```ts
// components/dashboard/client-profile/tabs/microcycle/use-week-metrics.ts
"use client";

import { useCallback, useEffect, useState } from "react";

import { getLocalYmd } from "@/lib/forms/client-helpers";

import type { ExerciseLog } from "../progress/types";

import { classifyDay, computeDayAdherence } from "./adherence";
import type {
  DayMetrics,
  PrescribedExercise,
  ScheduledSessionRow,
  WeekMetrics,
} from "./types";

interface UseWeekMetrics {
  data: WeekMetrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);

  d.setDate(d.getDate() + n);

  return d;
}

function toPrescribed(row: ScheduledSessionRow): PrescribedExercise[] {
  if (!row.session) return [];

  return [...row.session.session_exercises]
    .sort((a, b) => a.exercise_order - b.exercise_order)
    .map((se) => ({
      exerciseId: se.exercise.id,
      name: se.exercise.name,
      category: se.exercise.category,
      prescribedSets: se.sets ?? 0,
      prescribedReps: se.reps,
      prescribedWeightKg: se.weight_kg,
    }));
}

export function useWeekMetrics(
  clientId: string,
  weekStart: Date
): UseWeekMetrics {
  const [data, setData] = useState<WeekMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekStartYmd = getLocalYmd(weekStart);
  const weekEndYmd = getLocalYmd(addDays(weekStart, 6));

  const fetchWeek = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const [schedRes, logsRes] = await Promise.all([
          fetch(
            `/api/clients/${clientId}/scheduled-sessions/trainer?startDate=${weekStartYmd}&endDate=${weekEndYmd}`,
            { signal }
          ),
          fetch(
            `/api/clients/${clientId}/exercise-logs/trainer?startDate=${weekStartYmd}&endDate=${weekEndYmd}`,
            { signal }
          ),
        ]);

        const [schedJson, logsJson] = await Promise.all([
          schedRes.json(),
          logsRes.json(),
        ]);

        if (!schedJson.success || !logsJson.success) {
          setError("No se pudieron cargar las métricas.");
          setLoading(false);

          return;
        }

        const scheduled: ScheduledSessionRow[] =
          schedJson.scheduledSessions ?? [];
        const logs: ExerciseLog[] = logsJson.exerciseLogs ?? [];

        // Index scheduled rows by date for O(1) per-day lookup.
        const scheduledByDate = new Map<string, ScheduledSessionRow>();

        for (const row of scheduled) {
          scheduledByDate.set(row.scheduled_date, row);
        }

        // Index logs by date too. Logs that map to a scheduled date contribute
        // to adherence; logs whose date has no scheduled session become orphans.
        const logsByDate = new Map<string, ExerciseLog[]>();

        for (const log of logs) {
          const arr = logsByDate.get(log.scheduled_date) ?? [];

          arr.push(log);
          logsByDate.set(log.scheduled_date, arr);
        }

        const todayYmd = getLocalYmd(new Date());
        const days: DayMetrics[] = [];

        for (let i = 0; i < 7; i++) {
          const date = addDays(weekStart, i);
          const ymd = getLocalYmd(date);
          const scheduledSession = scheduledByDate.get(ymd) ?? null;
          const prescribed = scheduledSession
            ? toPrescribed(scheduledSession)
            : [];
          const dayLogs = logsByDate.get(ymd) ?? [];
          const adherence = computeDayAdherence(prescribed, dayLogs);
          const isFuture = ymd > todayYmd;
          const classification = classifyDay(
            prescribed.length > 0,
            adherence,
            isFuture
          );

          days.push({
            date: ymd,
            scheduledSession,
            prescribed,
            logs: dayLogs,
            adherence,
            classification,
            isToday: ymd === todayYmd,
            isFuture,
          });
        }

        // Orphans: logs on a date that has no scheduled session.
        const orphansByDate = new Map<string, ExerciseLog[]>();

        for (const [date, dayLogs] of logsByDate.entries()) {
          if (!scheduledByDate.has(date)) {
            orphansByDate.set(date, dayLogs);
          }
        }

        if (!signal.aborted) {
          setData({ days, orphansByDate });
          setLoading(false);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError("Error de conexión.");
        setLoading(false);
      }
    },
    [clientId, weekStartYmd, weekEndYmd]
  );

  const refetch = useCallback(() => {
    const controller = new AbortController();

    fetchWeek(controller.signal);
  }, [fetchWeek]);

  useEffect(() => {
    const controller = new AbortController();

    fetchWeek(controller.signal);

    return () => controller.abort();
  }, [fetchWeek]);

  return { data, loading, error, refetch };
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/client-profile/tabs/microcycle/use-week-metrics.ts
git commit -m "feat(trainer): useWeekMetrics hook with parallel fetch + abort"
```

---

## Task 5: WeekStrip component

**Files:**

- Create: `components/dashboard/client-profile/tabs/microcycle/week-strip.tsx`

Presentational: receives `days: DayMetrics[]` plus selection state. No fetching here.

- [ ] **Step 1: Write the component**

```tsx
// components/dashboard/client-profile/tabs/microcycle/week-strip.tsx
"use client";

import type { DayClassification, DayMetrics } from "./types";

import { formatPercent } from "./adherence";

const DAY_LABELS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

function symbolFor(classification: DayClassification): string {
  if (classification === "complete") return "●";
  if (classification === "partial") return "◐";
  if (classification === "pending") return "○";

  return "—";
}

function colorClassFor(classification: DayClassification): string {
  if (classification === "complete") return "text-green-600";
  if (classification === "partial") return "text-amber-500";
  if (classification === "pending") return "text-gray-400";

  return "text-gray-300";
}

interface Props {
  days: DayMetrics[];
  selectedDate: string;
  onSelect: (date: string) => void;
}

export function WeekStrip({ days, selectedDate, onSelect }: Props) {
  return (
    <div
      aria-label="Días de la semana con adherencia"
      className="grid grid-cols-7 gap-1.5"
      role="grid"
    >
      {days.map((day, idx) => {
        const isSelected = day.date === selectedDate;
        const dayNumber = parseInt(day.date.split("-")[2] ?? "0");
        const sessionName = day.scheduledSession?.session?.name ?? "Descanso";
        const showPercent =
          day.classification !== "rest" && day.classification !== "future";
        const ariaLabel = day.scheduledSession
          ? `${DAY_LABELS[idx]} ${dayNumber}, ${sessionName}, ${
              showPercent
                ? `${day.adherence.completedExercises} de ${day.adherence.totalPrescribed} ejercicios completados`
                : "sin actividad aún"
            }`
          : `${DAY_LABELS[idx]} ${dayNumber}, día de descanso`;

        return (
          <button
            key={day.date}
            aria-current={day.isToday ? "date" : undefined}
            aria-label={ariaLabel}
            aria-selected={isSelected}
            className={[
              "flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors text-left",
              isSelected
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:bg-gray-50",
              day.isFuture ? "opacity-70" : "",
            ].join(" ")}
            role="gridcell"
            type="button"
            onClick={() => onSelect(day.date)}
          >
            <span className="text-[10px] font-semibold text-gray-500 tracking-wider">
              {DAY_LABELS[idx]}
            </span>
            <span
              className={[
                "text-base font-semibold tabular-nums",
                day.isToday
                  ? "text-blue-600 ring-1 ring-blue-300 rounded-full w-7 h-7 flex items-center justify-center"
                  : "text-gray-900",
              ].join(" ")}
            >
              {dayNumber}
            </span>
            <span className="text-[10px] text-gray-500 leading-tight text-center min-h-[1rem] line-clamp-1">
              {sessionName}
            </span>
            <span
              aria-hidden="true"
              className={`text-lg leading-none ${colorClassFor(day.classification)}`}
            >
              {symbolFor(day.classification)}
            </span>
            <span className="text-[10px] tabular-nums text-gray-500 min-h-[1rem]">
              {showPercent ? formatPercent(day.adherence.ejercicios) : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/client-profile/tabs/microcycle/week-strip.tsx
git commit -m "feat(trainer): WeekStrip with adherence symbols + aria"
```

---

## Task 6: Extend HistoryDateFilter with any-date mode

**Files:**

- Modify: `components/dashboard/client-profile/tabs/workouts/history-date-filter.tsx`

The component currently disables days without sessions and auto-hides when there's ≤1 date. The week navigator needs to pick any week, even one without data, so we add an `allowAnyDate?: boolean` prop.

- [ ] **Step 1: Update the Props interface and behaviour**

Open `components/dashboard/client-profile/tabs/workouts/history-date-filter.tsx`. Add the new prop and adjust the gates.

Update the `Props` interface:

```ts
interface Props {
  /** All dates with at least one session, ISO YYYY-MM-DD. Order irrelevant. */
  datesWithSessions: string[];
  /** Currently selected YYYY-MM-DD, or "" for no filter. */
  value: string;
  onChange: (next: string) => void;
  /**
   * When true, every date is clickable (not just those in datesWithSessions),
   * the component renders even when datesWithSessions is empty/length<=1, and
   * the "Limpiar" footer + leyenda are hidden because there's nothing to clear
   * back to. Used by the microcycle week navigator.
   */
  allowAnyDate?: boolean;
}
```

Update the destructure of `HistoryDateFilter` to include `allowAnyDate`:

```tsx
export function HistoryDateFilter({
  datesWithSessions,
  value,
  onChange,
  allowAnyDate = false,
}: Props) {
```

Change the auto-hide guard:

```tsx
// Replace:  if (datesWithSessions.length <= 1) return null;
if (!allowAnyDate && datesWithSessions.length <= 1) return null;
```

Change the cell click guard in `handleSelect`:

```tsx
const handleSelect = (ymd: string, hasData: boolean) => {
  if (!allowAnyDate && !hasData) return;
  onChange(ymd);
  setOpen(false);
};
```

Change the cell `className` selection and `disabled` attribute. Find the existing cell button (`<button key={ymd} ...>` inside the grid) and replace the class array and disabled prop:

```tsx
className={[
  "relative h-8 rounded text-[11px] tabular-nums transition-colors",
  !inMonth ? "text-gray-300" : "",
  inMonth && !hasData && !isSelected
    ? allowAnyDate
      ? "text-gray-700 hover:bg-blue-50 cursor-pointer"
      : "text-gray-400 cursor-not-allowed"
    : "",
  hasData && !isSelected
    ? "text-gray-900 font-medium hover:bg-blue-50 cursor-pointer"
    : "",
  isSelected
    ? "bg-blue-600 text-white font-semibold cursor-pointer"
    : "",
  isToday && !isSelected ? "ring-1 ring-inset ring-blue-300" : "",
].join(" ")}
disabled={!allowAnyDate && !hasData}
```

Change the footer to hide the legend + Limpiar when `allowAnyDate` is set (the navigator uses its own "Hoy" affordance):

```tsx
{
  allowAnyDate ? null : (
    <div className="flex items-center justify-between px-2 py-1.5 border-t border-gray-100 bg-gray-50">
      <span className="text-[10px] text-gray-500 inline-flex items-center gap-1">
        <span className="inline-block w-1 h-1 rounded-full bg-blue-500" />
        Días con registros
      </span>
      {value ? (
        <button
          className="text-[11px] text-blue-600 hover:text-blue-800 font-medium px-1"
          type="button"
          onClick={handleClear}
        >
          Limpiar
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify the existing history filter still works**

Run: `npm run type-check && npm run lint:check 2>&1 | grep "history-date-filter"`
Expected: clean. The default `allowAnyDate=false` preserves existing behaviour.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/client-profile/tabs/workouts/history-date-filter.tsx
git commit -m "feat(trainer): allowAnyDate mode on HistoryDateFilter calendar"
```

---

## Task 7: WeekNavigator component

**Files:**

- Create: `components/dashboard/client-profile/tabs/microcycle/week-navigator.tsx`

Prev/Next/Today buttons plus a clickable week-range label that opens the extended `HistoryDateFilter` for jumping to any week.

- [ ] **Step 1: Write the component**

```tsx
// components/dashboard/client-profile/tabs/microcycle/week-navigator.tsx
"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { HistoryDateFilter } from "../workouts/history-date-filter";

interface Props {
  /** Local Y-M-D of the Monday of the displayed week. */
  weekStartYmd: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Called with a Y-M-D string when the trainer picks any day in the popover. */
  onPickDate: (ymd: string) => void;
}

function formatRange(weekStartYmd: string): string {
  const start = new Date(weekStartYmd + "T00:00:00");
  const end = new Date(start);

  end.setDate(start.getDate() + 6);

  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = start.toLocaleDateString("es-ES", {
    day: "numeric",
    ...(sameMonth ? {} : { month: "short" }),
  });
  const endStr = end.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return `Semana del ${startStr} – ${endStr}`;
}

export function WeekNavigator({
  weekStartYmd,
  onPrev,
  onNext,
  onToday,
  onPickDate,
}: Props) {
  const [pickerValue, setPickerValue] = useState("");

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        isIconOnly
        aria-label="Semana anterior"
        size="sm"
        variant="flat"
        onPress={onPrev}
      >
        <Icon icon="solar:alt-arrow-left-linear" width={18} />
      </Button>

      <div className="flex-1 min-w-[14rem] flex items-center justify-center">
        <HistoryDateFilter
          allowAnyDate
          datesWithSessions={[]}
          value={pickerValue}
          onChange={(ymd) => {
            setPickerValue(ymd);
            onPickDate(ymd);
          }}
        />
      </div>

      <Button size="sm" variant="flat" onPress={onToday}>
        Hoy
      </Button>
      <Button
        isIconOnly
        aria-label="Semana siguiente"
        size="sm"
        variant="flat"
        onPress={onNext}
      >
        <Icon icon="solar:alt-arrow-right-linear" width={18} />
      </Button>

      <p className="text-xs font-medium text-gray-600 tabular-nums w-full text-center sm:w-auto sm:ml-2">
        {formatRange(weekStartYmd)}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/client-profile/tabs/microcycle/week-navigator.tsx
git commit -m "feat(trainer): WeekNavigator with calendar popover for week jumps"
```

---

## Task 8: DayDetail component

**Files:**

- Create: `components/dashboard/client-profile/tabs/microcycle/day-detail.tsx`

Drill-down rendered inline below the strip when a day is selected. Shows date + session name + the three percentages, then a list of prescribed exercises each with their prescribed/executed breakdown, then orphan logs for that date.

- [ ] **Step 1: Write the component**

```tsx
// components/dashboard/client-profile/tabs/microcycle/day-detail.tsx
"use client";

import type { ExerciseLog } from "../progress/types";

import { Icon } from "@iconify/react";

import { formatPercent } from "./adherence";
import type { DayMetrics, PrescribedExercise } from "./types";

function formatDateLong(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function exerciseAdherence(
  p: PrescribedExercise,
  logs: ExerciseLog[]
): {
  ejercicios: number;
  series: number;
  carga: number;
  loggedSets: number;
  loggedLoad: number;
} {
  const sets = logs
    .filter((l) => l.exercise_id === p.exerciseId)
    .flatMap((l) => l.sets ?? []);
  const loggedSets = sets.length;
  const loggedLoad = sets.reduce(
    (acc, s) => acc + (s.reps ?? 0) * (s.weight_kg ?? 0),
    0
  );

  const ejercicios = loggedSets > 0 ? 1 : 0;
  const prescribedSets = p.prescribedSets ?? 0;
  const series =
    prescribedSets === 0 ? 0 : Math.min(loggedSets / prescribedSets, 1);

  const prescribedReps = (() => {
    if (p.prescribedReps == null) return 0;
    const m = String(p.prescribedReps).match(/\d+/);

    return m ? parseInt(m[0]) : 0;
  })();
  const prescribedLoad =
    prescribedSets * prescribedReps * (p.prescribedWeightKg ?? 0);
  const carga =
    prescribedLoad === 0 ? 1 : Math.min(loggedLoad / prescribedLoad, 1);

  return { ejercicios, series, carga, loggedSets, loggedLoad };
}

interface Props {
  day: DayMetrics;
  orphanLogs: ExerciseLog[];
}

export function DayDetail({ day, orphanLogs }: Props) {
  if (day.classification === "rest") {
    return (
      <section className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 capitalize">
        {formatDateLong(day.date)} — día de descanso o sin sesión programada.
        {orphanLogs.length > 0 ? <OrphanSection logs={orphanLogs} /> : null}
      </section>
    );
  }

  return (
    <section className="rounded-lg bg-white border border-gray-200 overflow-hidden">
      <header className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900 capitalize">
          {formatDateLong(day.date)}
          {day.scheduledSession?.session
            ? ` · ${day.scheduledSession.session.name}`
            : ""}
        </p>
        {day.classification === "future" ? (
          <p className="text-xs text-gray-500 mt-0.5">
            Día programado — aún por entrenarse.
          </p>
        ) : (
          <p className="text-xs text-gray-500 mt-0.5">
            Ejercicios {formatPercent(day.adherence.ejercicios)}
            {" · "}
            Series {formatPercent(day.adherence.series)}
            {" · "}
            Carga {formatPercent(day.adherence.carga)}
          </p>
        )}
      </header>

      {day.prescribed.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {day.prescribed.map((p) => (
            <PrescribedRow
              key={p.exerciseId}
              isFuture={day.classification === "future"}
              logs={day.logs}
              prescribed={p}
            />
          ))}
        </ul>
      ) : null}

      {orphanLogs.length > 0 ? <OrphanSection logs={orphanLogs} /> : null}
    </section>
  );
}

function PrescribedRow({
  prescribed,
  logs,
  isFuture,
}: {
  prescribed: PrescribedExercise;
  logs: ExerciseLog[];
  isFuture: boolean;
}) {
  const exerciseLogs = logs.filter(
    (l) => l.exercise_id === prescribed.exerciseId
  );
  const stats = exerciseAdherence(prescribed, exerciseLogs);
  const totalSets = stats.loggedSets;
  const status = isFuture
    ? "future"
    : totalSets === 0
      ? "pending"
      : totalSets >= (prescribed.prescribedSets ?? 0)
        ? "complete"
        : "partial";
  const statusSymbol =
    status === "complete"
      ? "●"
      : status === "partial"
        ? "◐"
        : status === "pending"
          ? "○"
          : "·";
  const statusColor =
    status === "complete"
      ? "text-green-600"
      : status === "partial"
        ? "text-amber-500"
        : status === "pending"
          ? "text-gray-400"
          : "text-gray-300";

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`text-lg leading-none mt-0.5 ${statusColor}`}
        >
          {statusSymbol}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">
            {prescribed.name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
            Prescrito · {prescribed.prescribedSets ?? "—"} ×{" "}
            {prescribed.prescribedReps ?? "—"}
            {prescribed.prescribedWeightKg
              ? ` @ ${prescribed.prescribedWeightKg}kg`
              : ""}
          </p>
          {isFuture ? null : (
            <p className="text-xs text-gray-700 mt-0.5 tabular-nums">
              Ejecutado · {totalSets} series · {Math.round(stats.loggedLoad)}{" "}
              kg·reps
              {" — "}E {formatPercent(stats.ejercicios)} · S{" "}
              {formatPercent(stats.series)} · C {formatPercent(stats.carga)}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function OrphanSection({ logs }: { logs: ExerciseLog[] }) {
  // Group by exercise name for a tidy listing.
  const byExercise = new Map<string, number>();

  for (const log of logs) {
    if (!log.exercises) continue;
    byExercise.set(
      log.exercises.name,
      (byExercise.get(log.exercises.name) ?? 0) + 1
    );
  }

  return (
    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
      <p className="text-[11px] font-semibold text-gray-600 mb-1 inline-flex items-center gap-1">
        <Icon icon="solar:list-bold" width={12} />
        También registró
      </p>
      <ul className="text-xs text-gray-700 space-y-0.5">
        {Array.from(byExercise.entries()).map(([name, count]) => (
          <li key={name} className="tabular-nums">
            · {name}{" "}
            <span className="text-gray-400">
              ({count} {count === 1 ? "registro" : "registros"})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/client-profile/tabs/microcycle/day-detail.tsx
git commit -m "feat(trainer): DayDetail with prescribed vs executed + orphans"
```

---

## Task 9: MetricsSection orchestrator

**Files:**

- Create: `components/dashboard/client-profile/tabs/microcycle/metrics-section.tsx`

Owns `weekStart` and `selectedDate`. Calls `useWeekMetrics`. Renders navigator + strip + detail. Handles loading skeleton, error banner, "no program" empty state. Supports keyboard navigation on the strip (left/right arrows).

- [ ] **Step 1: Write the orchestrator**

```tsx
// components/dashboard/client-profile/tabs/microcycle/metrics-section.tsx
"use client";

import { Button, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getLocalYmd } from "@/lib/forms/client-helpers";

import { DayDetail } from "./day-detail";
import { useWeekMetrics } from "./use-week-metrics";
import { WeekNavigator } from "./week-navigator";
import { WeekStrip } from "./week-strip";

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
  const stripRef = useRef<HTMLDivElement>(null);

  const { data, loading, error, refetch } = useWeekMetrics(clientId, weekStart);

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

  // Keyboard navigation: arrow keys move selection within the visible week.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!data) return;
      const idx = data.days.findIndex((d) => d.date === selectedDate);

      if (idx === -1) return;
      if (e.key === "ArrowLeft" && idx > 0) {
        e.preventDefault();
        setSelectedDate(data.days[idx - 1]!.date);
      } else if (e.key === "ArrowRight" && idx < data.days.length - 1) {
        e.preventDefault();
        setSelectedDate(data.days[idx + 1]!.date);
      }
    },
    [data, selectedDate]
  );

  const selectedDay = useMemo(
    () => data?.days.find((d) => d.date === selectedDate) ?? null,
    [data, selectedDate]
  );

  return (
    <section className="flex flex-col gap-4">
      <WeekNavigator
        weekStartYmd={getLocalYmd(weekStart)}
        onNext={handleNext}
        onPickDate={handlePickDate}
        onPrev={handlePrev}
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
      ) : data ? (
        <>
          <div
            ref={stripRef}
            className={
              loading ? "opacity-50 transition-opacity" : "transition-opacity"
            }
            tabIndex={0}
            onKeyDown={onKeyDown}
          >
            <WeekStrip
              days={data.days}
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
            />
          </div>

          {selectedDay ? (
            <DayDetail
              day={selectedDay}
              orphanLogs={data.orphansByDate.get(selectedDate) ?? []}
            />
          ) : null}
        </>
      ) : null}

      {!loading && !data && !error ? (
        <div className="rounded-lg border border-warning-200 bg-warning-50 p-4 text-sm text-warning-800 flex items-start gap-3">
          <Icon
            className="mt-0.5 text-warning-600"
            icon="solar:info-circle-bold"
            width={18}
          />
          <div className="flex-1">
            <p className="font-medium mb-1">Sin sesiones programadas</p>
            <p className="text-warning-700">
              Este cliente no tiene sesiones programadas todavía.
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
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/client-profile/tabs/microcycle/metrics-section.tsx
git commit -m "feat(trainer): MetricsSection orchestrator with loading + error + keyboard"
```

---

## Task 10: Two sub-tabs inside microcycle-tab

**Files:**

- Modify: `components/dashboard/client-profile/tabs/microcycle-tab.tsx`

Replace the thin `MicrocycleConfig` wrapper with a two-sub-tab layout. Métricas is the default; Configuración shows the unchanged config editor.

- [ ] **Step 1: Rewrite the file**

```tsx
// components/dashboard/client-profile/tabs/microcycle-tab.tsx
"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";

import MicrocycleConfig from "@/components/trainer/microcycle/microcycle-config";

import { MetricsSection } from "./microcycle/metrics-section";

type SubTab = "metrics" | "config";

const SUB_TABS: { key: SubTab; label: string; icon: string }[] = [
  { key: "metrics", label: "Métricas", icon: "solar:chart-2-bold" },
  { key: "config", label: "Configuración", icon: "solar:settings-bold" },
];

interface Props {
  clientId: string;
}

export default function MicrocycleTab({ clientId }: Props) {
  const [active, setActive] = useState<SubTab>("metrics");

  return (
    <div className="flex flex-col gap-4 mt-2">
      <div
        aria-label="Sub-pestañas de Microciclo"
        className="flex rounded-lg bg-default-100 p-1 self-start"
        role="tablist"
      >
        {SUB_TABS.map((t) => {
          const isActive = active === t.key;

          return (
            <button
              key={t.key}
              aria-selected={isActive}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
                isActive
                  ? "bg-content1 text-foreground shadow-sm font-medium"
                  : "text-default-500 hover:text-default-700 font-normal"
              }`}
              role="tab"
              type="button"
              onClick={() => setActive(t.key)}
            >
              <Icon icon={t.icon} width={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {active === "metrics" ? (
        <MetricsSection
          clientId={clientId}
          onSwitchToConfig={() => setActive("config")}
        />
      ) : null}
      {active === "config" ? <MicrocycleConfig clientId={clientId} /> : null}
    </div>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npm run type-check && npm run lint:check 2>&1 | grep "microcycle"`
Expected: clean.

- [ ] **Step 3: Browser verification — happy path**

```bash
npm run dev
```

Open a trainer session → client profile → Entrenamientos → Microciclo. Verify:

1. Default sub-tab is **Métricas** with a segmented control showing Métricas / Configuración.
2. Week strip shows 7 cells for the current week.
3. Today's date has a blue ring on the number.
4. Clicking a day with prescribed sessions highlights the cell (blue border) and shows the day detail below.
5. Prev/Next arrows move the week.
6. "Hoy" returns to the current week and selects today.
7. Clicking the date label/picker opens the calendar popover; selecting any date jumps to that week and selects that day.
8. Adherence symbols + percentages reflect the data (cross-check one day against the exercise cards in Entrenamientos).
9. Day detail header shows the three percentages (Ejercicios / Series / Carga).
10. Each prescribed exercise row inside the detail shows Prescrito vs Ejecutado with E/S/C numbers.
11. Switching to Configuración shows the existing MicrocycleConfig unchanged.
12. Switching back to Métricas preserves the week + selection.

- [ ] **Step 4: Browser verification — edge cases**

13. Navigate to a future week. Strip cells render muted, no symbol/%; day detail says "Día programado — aún por entrenarse" with no E/S/C numbers.
14. Navigate to a past week with no scheduled sessions. All cells render `—`; clicking shows the rest-day message.
15. If the client has logs on a date with no scheduled session, the day detail shows "También registró:" with the orphan exercises.
16. Test arrow keys: with focus on the strip, ← moves selection left, → moves selection right (within the visible week only).
17. Verify "Sin sesiones programadas" empty state when a client has no scheduled sessions at all (use a fresh client or pick a far-past week).
18. Force a network error (offline DevTools) → red retry banner appears, Reintentar refetches.

If any step fails, fix it inline before committing.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/client-profile/tabs/microcycle-tab.tsx
git commit -m "feat(trainer): mount Metricas + Configuracion sub-tabs in Microciclo"
```

---

## Final manual QA

- [ ] **Cross-verify adherence against ground truth**

Pick a client with at least one week of mixed data. For one specific date:

1. Note the prescribed session and its exercises (Microciclo → Configuración shows the slot for that day; cross-check the prescribed `sets × reps @ kg` in Entrenamientos).
2. Note the logs for that date (visible inside each exercise card's history table in Entrenamientos).
3. Compute by hand:
   - **Ejercicios** = exercises with ≥1 logged set ÷ total prescribed
   - **Series** = total logged sets ÷ total prescribed sets
   - **Carga** = sum of logged `reps × weight` ÷ sum of prescribed `sets × reps × weight` (skipping exercises with prescribed weight = 0)
4. Compare against the strip cell + day detail header in Microciclo → Métricas.

If they don't match, fix `adherence.ts` (or `useWeekMetrics`) — not the display.

---

## Self-Review Notes

**Spec coverage:**

- Sub-tabs Métricas (default) / Configuración → Task 10.
- Weekly Mon-Sun navigation → Tasks 5 + 7 + 9.
- Three adherence metrics (ejercicios / series / carga) computed client-side → Task 3.
- "% ejercicios" on the strip; all three in the day detail → Tasks 5 + 8.
- Day classification (complete / partial / pending / rest / future) symbol + color → Tasks 3 + 5.
- Inline day detail below the strip → Tasks 8 + 9.
- Trainer-scoped scheduled-sessions endpoint → Task 1.
- Reuse of `HistoryDateFilter` calendar popover for week jumping → Tasks 6 + 7.
- Loading skeleton → Task 9.
- Error banner with retry → Task 9.
- Empty "no client_program" state with link → Task 9 + Task 10 (`onSwitchToConfig`).
- Keyboard arrow navigation on the strip → Task 9.
- AbortController on stale fetches → Task 4.
- `MicrocycleConfig` untouched → Task 10 mounts it as-is.

**No placeholders.** All code blocks are complete; no "TBD"/"implement later". The one prop adjustment to `HistoryDateFilter` (Task 6) is fully spelled out.

**Type consistency check:**

- `DayMetrics`, `WeekMetrics`, `PrescribedExercise`, `ScheduledSessionRow`, `DayAdherence`, `DayClassification` defined in Task 2 and used identically in Tasks 3–9.
- `computeDayAdherence(prescribed, logs)` returns `DayAdherence` consistently; `classifyDay(hasPrescribed, adherence, isFuture)` signature matches across Task 3 and Task 4 usage.
- `HistoryDateFilter` prop `allowAnyDate` added in Task 6 and consumed in Task 7.
- `getLocalYmd` from `@/lib/forms/client-helpers` used consistently across Tasks 4 and 9.

**Out of scope (per spec, documented for next phase):**

- Cross-tab "Ver →" navigation from a day-detail exercise into Entrenamientos with auto-expand.
- Dated prescriptions (per-day overrides of the template).
- Week-over-week comparison views.
- CSV / PDF export of adherence.
- Filters inside the metrics view.
- Any modification to `MicrocycleConfig`.

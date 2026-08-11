# Trainer Progress Merge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the standalone Progress tab in the trainer's client profile and centralize per-exercise progress (volume chart, KPIs, set-by-set log, video playback) inside the existing Entrenamientos and Cardio tabs. As a follow-up, add a date-based metrics + adherence section inside Microciclo.

**Architecture:** Today, the trainer views the same exercise data in two disconnected places: `progress-tab.tsx` (logs grouped by exercise with charts) and `workouts-tab.tsx` / `cardio-tab.tsx` (prescribed exercise definitions only). After this work, each exercise card inside the workout plan owns both sides: prescription (existing) + history (new). The Progress tab is removed; NEAT/steps moves into the existing NEAT tab. Microciclo grows a second section ("Métricas por fecha") that shows per-day prescribed-vs-executed adherence without touching the existing config editor.

**Tech Stack:** Next.js 15 App Router · React 19 · HeroUI v2 · Tailwind v4 · Recharts (already used in `exercise-chart.tsx`) · `@iconify/react` · `@dnd-kit` (existing in workouts-tab) · Supabase via `createSupabaseClient` (existing pattern). No new dependencies.

**UX principles applied** (validated in wireframe iteration with user):

- One exercise = one card = one full story. Trainer never cross-references between tabs to understand a single exercise.
- Volume metric = `kg × reps × series` summed per session (explicitly requested — trainers want stimulus, not just peak load).
- Default expanded state: first exercise of each session expanded, rest collapsed. Multiple cards can be open simultaneously (not single-accordion).
- "Otros ejercicios registrados" section at the bottom of each tab for exercises the client logged but that aren't in the current plan (orphans).
- Microciclo's existing config view stays untouched; metrics section is added below as a peer.
- Symbols + color + numeric % for adherence (accessibility — daltonism-safe).

---

## File Structure

### Phase 1 — Per-exercise progress in Entrenamientos/Cardio + Progress tab removal

**Create:**

- `components/dashboard/client-profile/tabs/workouts/use-client-exercise-logs.ts` — Hook that fetches ALL logs for a client (no date range), memoizes them, and exposes `getLogsForExercise(exerciseId)` and `getOrphanGroups(prescribedExerciseIds)`.
- `components/dashboard/client-profile/tabs/workouts/exercise-progress-card.tsx` — The unified card. Receives the prescribed `WorkoutExercise` + the logs filtered for that exercise, renders the existing prescription row and the new progress block (KPIs + volume chart + history table + video modal access). Supports `isExpanded` and `onToggle`.
- `components/dashboard/client-profile/tabs/workouts/exercise-progress-stats.tsx` — KPI grid (4 cells: Máx · Último · Media · Sesiones — strength) or (Mejor · Último · Total · Sesiones — cardio).
- `components/dashboard/client-profile/tabs/workouts/exercise-volume-chart.tsx` — Volume chart wrapper around the existing `ExerciseLineChart` from `progress/exercise-chart.tsx`. For strength: `volume = sum(set.reps * set.weight_kg)` per session. For cardio: `distance_km` if available, otherwise `duration_minutes`.
- `components/dashboard/client-profile/tabs/workouts/exercise-history-table.tsx` — Wrapper around the existing `LogTable` configured for the unified card. Handles both strength rows (sets) and cardio rows (distance/duration/intensity).
- `components/dashboard/client-profile/tabs/workouts/orphan-exercises-section.tsx` — Renders the orphan exercises as expandable cards using the same `ExerciseProgressCard` (with `prescribed={null}` to hide the prescription row).
- `components/dashboard/client-profile/tabs/workouts/helpers.ts` — Pure functions: `computeSessionVolume(log)`, `computeStrengthStats(logs)`, `computeCardioStats(logs)`, `buildVolumeChartData(logs)`.

**Modify:**

- `components/dashboard/client-profile/client-profile-tabs.tsx:11, 15-24, 35, 89` — remove Progress import, remove tab item, change `useState("progress")` default to `"training"`, remove the `selectedTab === "progress"` block.
- `components/dashboard/client-profile/tabs/workouts-tab.tsx:1338-1487` — Replace the inline exercise card JSX with `<ExerciseProgressCard …/>`. Lift logs fetching into the tab via the new hook so all exercises in a session share one fetch. Append `<OrphanExercisesSection …/>` after the program list.
- `components/dashboard/client-profile/tabs/cardio-tab.tsx` — Same shape of change as workouts-tab (cardio variant of the card; same component, branch on `category`).
- `components/dashboard/client-profile/tabs/neat-tab.tsx` — Render `<NeatSection clientId={…} />` inline; move the steps data fetching from progress-tab into neat-tab (or expose `NeatSection` as a self-fetching component).

**Delete (after Phase 1 is verified):**

- `components/dashboard/client-profile/tabs/progress-tab.tsx`
- `components/dashboard/client-profile/tabs/progress/summary-strip.tsx`
- `components/dashboard/client-profile/tabs/progress/activity-heatmap.tsx`
- `components/dashboard/client-profile/tabs/progress/strength-card.tsx`
- `components/dashboard/client-profile/tabs/progress/cardio-card.tsx`

**Keep (consumed by new components):**

- `components/dashboard/client-profile/tabs/progress/types.ts` — `ExerciseLog`, `ExerciseLogSet`, `ExerciseGroup`.
- `components/dashboard/client-profile/tabs/progress/helpers.ts` — `groupLogsByExercise`, `isCardio`, `formatDate`.
- `components/dashboard/client-profile/tabs/progress/exercise-chart.tsx` — `ExerciseLineChart`, `LogTable`.
- `components/dashboard/client-profile/tabs/progress/ui-atoms.tsx` — `StatCard`, `Sparkline`.
- `components/dashboard/client-profile/tabs/progress/neat-section.tsx` — Moved (logically) into NEAT tab.
- `components/trainer/trainer-exercise-video-modal.tsx` — Still the playback surface, just used from the new card.

### Phase 2 — Microciclo metrics by date

**Create:**

- `components/dashboard/client-profile/tabs/microcycle/metrics-section.tsx` — Container that orchestrates week state + fetches + renders week strip + day detail.
- `components/dashboard/client-profile/tabs/microcycle/week-navigator.tsx` — Header with `[←] Semana del 19 – 25 may 2026 [Hoy] [→]`.
- `components/dashboard/client-profile/tabs/microcycle/week-strip.tsx` — 7 day cells with adherence indicators (`●` complete / `◐` partial / `○` pending / `—` rest).
- `components/dashboard/client-profile/tabs/microcycle/day-detail.tsx` — Drill-down for the selected date: list of prescribed exercises with prescribed vs executed line, two adherence numbers (carga %, series %), "Ver →" link to the exercise card.
- `components/dashboard/client-profile/tabs/microcycle/adherence.ts` — Pure utilities: `computeDayAdherence({prescribed, logs})`, `classifyDay(adherence)`, `formatPercent`.
- `app/api/clients/[clientId]/scheduled-sessions/trainer/route.ts` — Trainer-scoped variant of the existing client-only `scheduled-sessions` endpoint. Returns scheduled sessions (with nested `session.exercises[]`) for a date range, verified against `client.tenant === session.trainer_id`.

**Modify:**

- `components/dashboard/client-profile/tabs/microcycle-tab.tsx` — Add `<MetricsSection clientId={clientId} />` below `<MicrocycleConfig clientId={clientId} />`.

---

## Phase 1

### Task 1: Create `helpers.ts` — pure compute functions

**Files:**

- Create: `components/dashboard/client-profile/tabs/workouts/helpers.ts`

- [ ] **Step 1: Create the file with all four utilities**

```ts
// components/dashboard/client-profile/tabs/workouts/helpers.ts
//
// Pure helpers consumed by the new ExerciseProgressCard family.
// Kept dependency-free so they can be tested in isolation if a test
// runner is added later and so behavior is obvious from inspection.

import type { ExerciseLog, ExerciseLogSet } from "../progress/types";

/**
 * Session volume = sum across sets of (reps * weight_kg).
 * Missing weight or reps contribute zero — partial sets don't poison the metric.
 */
export function computeSessionVolume(log: ExerciseLog): number {
  if (!log.sets || log.sets.length === 0) return 0;
  return log.sets.reduce((acc, s: ExerciseLogSet) => {
    const reps = s.reps ?? 0;
    const weight = s.weight_kg ?? 0;
    return acc + reps * weight;
  }, 0);
}

export interface StrengthStats {
  maxWeight: number;
  lastWeight: number;
  avgWeight: number;
  sessionsCount: number;
}

export function computeStrengthStats(logs: ExerciseLog[]): StrengthStats {
  if (logs.length === 0) {
    return { maxWeight: 0, lastWeight: 0, avgWeight: 0, sessionsCount: 0 };
  }
  const allWeights: number[] = [];
  for (const log of logs) {
    const setWeights = (log.sets ?? [])
      .map((s) => s.weight_kg ?? 0)
      .filter((w) => w > 0);
    if (setWeights.length > 0) {
      allWeights.push(Math.max(...setWeights));
    }
  }
  if (allWeights.length === 0) {
    return {
      maxWeight: 0,
      lastWeight: 0,
      avgWeight: 0,
      sessionsCount: logs.length,
    };
  }
  const sum = allWeights.reduce((a, b) => a + b, 0);
  return {
    maxWeight: Math.max(...allWeights),
    lastWeight: allWeights[allWeights.length - 1],
    avgWeight: Math.round((sum / allWeights.length) * 10) / 10,
    sessionsCount: logs.length,
  };
}

export interface CardioStats {
  bestDistanceKm: number;
  lastDistanceKm: number;
  totalDistanceKm: number;
  sessionsCount: number;
}

export function computeCardioStats(logs: ExerciseLog[]): CardioStats {
  if (logs.length === 0) {
    return {
      bestDistanceKm: 0,
      lastDistanceKm: 0,
      totalDistanceKm: 0,
      sessionsCount: 0,
    };
  }
  const distances = logs.map((l) => l.distance_km ?? 0);
  return {
    bestDistanceKm: Math.max(...distances),
    lastDistanceKm: distances[distances.length - 1] ?? 0,
    totalDistanceKm: Math.round(distances.reduce((a, b) => a + b, 0) * 10) / 10,
    sessionsCount: logs.length,
  };
}

export interface VolumeChartPoint {
  date: string;
  volume: number;
}

export function buildVolumeChartData(logs: ExerciseLog[]): VolumeChartPoint[] {
  return logs.map((l) => ({
    date: l.scheduled_date,
    volume: computeSessionVolume(l),
  }));
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run type-check`
Expected: no errors involving `workouts/helpers.ts`.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/client-profile/tabs/workouts/helpers.ts
git commit -m "feat(trainer): add volume + stats helpers for exercise progress card"
```

---

### Task 2: Create `use-client-exercise-logs.ts` — single fetch hook

**Files:**

- Create: `components/dashboard/client-profile/tabs/workouts/use-client-exercise-logs.ts`

This fetches ALL logs once at the tab level (no date range) and provides selectors so every exercise card reads from the same memo'd dataset. Previous design fetched a windowed range from progress-tab; for the new view we want the full history because each card's chart shows the full evolution.

- [ ] **Step 1: Write the hook**

```ts
// components/dashboard/client-profile/tabs/workouts/use-client-exercise-logs.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ExerciseLog, ExerciseGroup } from "../progress/types";
import { groupLogsByExercise } from "../progress/helpers";

interface State {
  logs: ExerciseLog[];
  loading: boolean;
  error: string | null;
}

export interface UseClientExerciseLogs {
  loading: boolean;
  error: string | null;
  getLogsForExercise: (exerciseId: string) => ExerciseLog[];
  getOrphanGroups: (prescribedExerciseIds: Set<string>) => ExerciseGroup[];
  refetch: () => void;
}

export function useClientExerciseLogs(clientId: string): UseClientExerciseLogs {
  const [{ logs, loading, error }, setState] = useState<State>({
    logs: [],
    loading: true,
    error: null,
  });

  const fetchAll = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      // No startDate/endDate => API returns all-time logs for the client.
      const res = await fetch(`/api/clients/${clientId}/exercise-logs/trainer`);
      const json = await res.json();
      if (!json.success) {
        setState({
          logs: [],
          loading: false,
          error: "No se pudieron cargar los registros.",
        });
        return;
      }
      setState({ logs: json.exerciseLogs ?? [], loading: false, error: null });
    } catch {
      setState({ logs: [], loading: false, error: "Error de conexión." });
    }
  }, [clientId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const byExercise = useMemo(() => {
    const map = new Map<string, ExerciseLog[]>();
    for (const log of logs) {
      if (!log.exercise_id) continue;
      const arr = map.get(log.exercise_id) ?? [];
      arr.push(log);
      map.set(log.exercise_id, arr);
    }
    return map;
  }, [logs]);

  const getLogsForExercise = useCallback(
    (exerciseId: string) => byExercise.get(exerciseId) ?? [],
    [byExercise]
  );

  const getOrphanGroups = useCallback(
    (prescribedExerciseIds: Set<string>) => {
      const orphanLogs = logs.filter(
        (l) => l.exercise_id && !prescribedExerciseIds.has(l.exercise_id)
      );
      return groupLogsByExercise(orphanLogs);
    },
    [logs]
  );

  return {
    loading,
    error,
    getLogsForExercise,
    getOrphanGroups,
    refetch: fetchAll,
  };
}
```

- [ ] **Step 2: Verify trainer endpoint accepts the no-range call**

Read `app/api/clients/[clientId]/exercise-logs/trainer/route.ts` lines 75-80. Confirm that when `startDate`/`endDate` are not passed, the query simply omits the `gte`/`lte` filters and returns all logs.

If it doesn't, modify it to make `startDate`/`endDate` optional (they already appear to be — `if (startDate)` / `if (endDate)`). No change needed if so.

- [ ] **Step 3: Verify type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/client-profile/tabs/workouts/use-client-exercise-logs.ts
git commit -m "feat(trainer): add useClientExerciseLogs hook for tab-level log fetching"
```

---

### Task 3: Create `exercise-progress-stats.tsx` — KPI grid

**Files:**

- Create: `components/dashboard/client-profile/tabs/workouts/exercise-progress-stats.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/dashboard/client-profile/tabs/workouts/exercise-progress-stats.tsx
"use client";

import { StatCard } from "../progress/ui-atoms";
import type { StrengthStats, CardioStats } from "./helpers";

export function StrengthStatsGrid({ stats }: { stats: StrengthStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard
        accent="blue"
        label="Máx."
        value={stats.maxWeight > 0 ? `${stats.maxWeight} kg` : "—"}
      />
      <StatCard
        accent="green"
        label="Último"
        value={stats.lastWeight > 0 ? `${stats.lastWeight} kg` : "—"}
      />
      <StatCard
        label="Media"
        value={stats.avgWeight > 0 ? `${stats.avgWeight} kg` : "—"}
      />
      <StatCard label="Sesiones" value={String(stats.sessionsCount)} />
    </div>
  );
}

export function CardioStatsGrid({ stats }: { stats: CardioStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard
        accent="blue"
        label="Mejor"
        value={stats.bestDistanceKm > 0 ? `${stats.bestDistanceKm} km` : "—"}
      />
      <StatCard
        accent="green"
        label="Último"
        value={stats.lastDistanceKm > 0 ? `${stats.lastDistanceKm} km` : "—"}
      />
      <StatCard
        label="Total"
        value={stats.totalDistanceKm > 0 ? `${stats.totalDistanceKm} km` : "—"}
      />
      <StatCard label="Sesiones" value={String(stats.sessionsCount)} />
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/client-profile/tabs/workouts/exercise-progress-stats.tsx
git commit -m "feat(trainer): add stats grid components for exercise progress card"
```

---

### Task 4: Create `exercise-volume-chart.tsx` — volume curve

**Files:**

- Create: `components/dashboard/client-profile/tabs/workouts/exercise-volume-chart.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/dashboard/client-profile/tabs/workouts/exercise-volume-chart.tsx
"use client";

import { ExerciseLineChart } from "../progress/exercise-chart";
import { formatDate } from "../progress/helpers";
import type { ExerciseLog } from "../progress/types";
import { buildVolumeChartData } from "./helpers";

interface Props {
  logs: ExerciseLog[];
  variant: "strength" | "cardio";
}

export function ExerciseVolumeChart({ logs, variant }: Props) {
  if (logs.length === 0) return null;

  if (variant === "strength") {
    const data = buildVolumeChartData(logs).map((p) => ({
      date: formatDate(p.date),
      volume: p.volume,
    }));
    return (
      <ExerciseLineChart
        data={data}
        lines={[
          {
            key: "volume",
            label: "Volumen (kg·reps)",
            color: "#2563eb",
            formatter: (v) => `${v} kg·reps`,
          },
        ]}
        title="Volumen por sesión"
        yFormatter={(v) => `${v}`}
      />
    );
  }

  // Cardio: prefer distance_km, fall back to duration_minutes when distance is missing.
  const hasDistance = logs.some((l) => (l.distance_km ?? 0) > 0);
  const data = logs.map((l) => ({
    date: formatDate(l.scheduled_date),
    distance: l.distance_km ?? 0,
    duration: l.duration_minutes ?? 0,
  }));

  return (
    <ExerciseLineChart
      data={data}
      lines={
        hasDistance
          ? [
              {
                key: "distance",
                label: "Distancia (km)",
                color: "#16a34a",
                formatter: (v) => `${v} km`,
              },
            ]
          : [
              {
                key: "duration",
                label: "Duración (min)",
                color: "#16a34a",
                formatter: (v) => `${v} min`,
              },
            ]
      }
      title={hasDistance ? "Distancia por sesión" : "Duración por sesión"}
      yFormatter={(v) => `${v}`}
    />
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/client-profile/tabs/workouts/exercise-volume-chart.tsx
git commit -m "feat(trainer): add volume chart for strength and cardio progress cards"
```

---

### Task 5: Create `exercise-history-table.tsx` — set-by-set log

**Files:**

- Create: `components/dashboard/client-profile/tabs/workouts/exercise-history-table.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/dashboard/client-profile/tabs/workouts/exercise-history-table.tsx
"use client";

import { Icon } from "@iconify/react";

import { LogTable } from "../progress/exercise-chart";
import { formatDate } from "../progress/helpers";
import type { ExerciseLog } from "../progress/types";

interface Props {
  logs: ExerciseLog[];
  variant: "strength" | "cardio";
  exerciseName: string;
  onPlayVideo: (url: string, name: string) => void;
}

function formatSetsCell(log: ExerciseLog) {
  if (log.sets && log.sets.length > 0) {
    return (
      <div className="flex flex-col gap-0.5">
        {log.sets.map((s) => (
          <div key={s.set_number} className="flex items-center gap-1.5 text-xs">
            <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">
              {s.set_number}
            </span>
            <span>{s.reps ?? "—"} reps</span>
            <span className="text-gray-400">·</span>
            <span className="font-medium">
              {s.weight_kg != null ? `${s.weight_kg}kg` : "—"}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return "—";
}

export function ExerciseHistoryTable({
  logs,
  variant,
  exerciseName,
  onPlayVideo,
}: Props) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">
        Sin registros aún. Aparecerán aquí cuando tu cliente complete sesiones.
      </p>
    );
  }

  // Reverse so most recent is at the top.
  const orderedLogs = [...logs].reverse();

  if (variant === "strength") {
    return (
      <LogTable
        columns={[
          { label: "Fecha", render: (l) => formatDate(l.scheduled_date) },
          { label: "Series", render: (l) => formatSetsCell(l) },
          {
            label: "",
            render: (l) =>
              l.video_url ? (
                <button
                  className="text-blue-600 hover:text-blue-800 p-1 rounded-lg hover:bg-blue-50 transition-colors"
                  onClick={() => onPlayVideo(l.video_url!, exerciseName)}
                >
                  <Icon icon="solar:play-circle-bold" width={20} />
                </button>
              ) : null,
          },
          { label: "Notas", render: (l) => l.notes ?? "—", wrap: true },
        ]}
        logs={orderedLogs}
      />
    );
  }

  return (
    <LogTable
      columns={[
        { label: "Fecha", render: (l) => formatDate(l.scheduled_date) },
        {
          label: "Duración",
          render: (l) =>
            l.duration_minutes != null ? `${l.duration_minutes} min` : "—",
        },
        {
          label: "Distancia",
          render: (l) => (l.distance_km != null ? `${l.distance_km} km` : "—"),
        },
        {
          label: "Intensidad",
          render: (l) => l.intensity ?? "—",
        },
        {
          label: "",
          render: (l) =>
            l.video_url ? (
              <button
                className="text-blue-600 hover:text-blue-800 p-1 rounded-lg hover:bg-blue-50 transition-colors"
                onClick={() => onPlayVideo(l.video_url!, exerciseName)}
              >
                <Icon icon="solar:play-circle-bold" width={20} />
              </button>
            ) : null,
        },
      ]}
      logs={orderedLogs}
    />
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/client-profile/tabs/workouts/exercise-history-table.tsx
git commit -m "feat(trainer): add per-exercise history table for progress card"
```

---

### Task 6: Create `exercise-progress-card.tsx` — the unified card

**Files:**

- Create: `components/dashboard/client-profile/tabs/workouts/exercise-progress-card.tsx`

This card has two modes: with a `prescribed` exercise (the in-plan case) or `prescribed={null}` (orphan case). Header is always shown; the prescription row is conditional. Expanded body always shows stats + chart + history.

- [ ] **Step 1: Write the component**

```tsx
// components/dashboard/client-profile/tabs/workouts/exercise-progress-card.tsx
"use client";

import { Icon } from "@iconify/react";

import type { WorkoutExercise } from "@/types/training";
import type { ExerciseLog } from "../progress/types";
import { isCardio } from "../progress/helpers";

import { StrengthStatsGrid, CardioStatsGrid } from "./exercise-progress-stats";
import { ExerciseVolumeChart } from "./exercise-volume-chart";
import { ExerciseHistoryTable } from "./exercise-history-table";
import { computeStrengthStats, computeCardioStats } from "./helpers";

interface Props {
  /** When null, the card renders as an orphan (no prescription row, no edit/delete). */
  prescribed: WorkoutExercise | null;
  /** Used when prescribed is null. The display name comes from the first log. */
  exerciseName?: string;
  /** Used when prescribed is null. Category drives strength vs cardio variant. */
  exerciseCategory?: string;
  logs: ExerciseLog[];
  isExpanded: boolean;
  onToggle: () => void;
  onPlayVideo: (url: string, name: string) => void;
  /** Hooks for in-plan actions. Omitted for orphan cards. */
  actions?: React.ReactNode;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function ExerciseProgressCard({
  prescribed,
  exerciseName,
  exerciseCategory,
  logs,
  isExpanded,
  onToggle,
  onPlayVideo,
  actions,
  dragHandleProps,
}: Props) {
  const name = prescribed?.name ?? exerciseName ?? "Ejercicio";
  const category = prescribed
    ? ((prescribed as unknown as { category?: string }).category ?? "strength")
    : (exerciseCategory ?? "strength");
  const variant: "strength" | "cardio" = isCardio(category)
    ? "cardio"
    : "strength";

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden transition-all">
      <div className="flex items-start gap-3 p-3">
        {dragHandleProps ? (
          <div
            className="flex items-center justify-center mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
            {...dragHandleProps}
          >
            <Icon icon="solar:hamburger-menu-linear" width={16} />
          </div>
        ) : null}

        {prescribed?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={name}
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
            src={prescribed.imageUrl}
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
            <Icon
              className="text-gray-400"
              icon={
                variant === "cardio"
                  ? "solar:heart-pulse-bold"
                  : "solar:dumbbell-bold"
              }
              width={28}
            />
          </div>
        )}

        <button
          aria-expanded={isExpanded}
          className="flex-1 text-left"
          type="button"
          onClick={onToggle}
        >
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900">{name}</p>
          </div>
          {prescribed ? (
            <div className="text-sm text-gray-600 mt-1">
              {prescribed.sets && prescribed.reps && (
                <span>
                  {prescribed.sets} × {prescribed.reps}
                </span>
              )}
              {prescribed.rest && (
                <span className="ml-2">· {prescribed.rest}</span>
              )}
              {prescribed.trainingSystem && (
                <span className="ml-2">· {prescribed.trainingSystem}</span>
              )}
              {prescribed.tempo && (
                <span className="ml-2">· Tempo {prescribed.tempo}</span>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-400 mt-0.5">
              {logs.length} sesiones registradas · fuera del plan vigente
            </div>
          )}
        </button>

        <div className="flex items-center gap-1">
          {actions}
          <button
            aria-label={isExpanded ? "Colapsar" : "Expandir"}
            className="p-1 rounded hover:bg-gray-100"
            type="button"
            onClick={onToggle}
          >
            <Icon
              className={`text-gray-400 transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
              icon="solar:alt-arrow-down-linear"
              width={18}
            />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-gray-100">
          {variant === "strength" ? (
            <StrengthStatsGrid stats={computeStrengthStats(logs)} />
          ) : (
            <CardioStatsGrid stats={computeCardioStats(logs)} />
          )}

          <ExerciseVolumeChart logs={logs} variant={variant} />

          <ExerciseHistoryTable
            exerciseName={name}
            logs={logs}
            variant={variant}
            onPlayVideo={onPlayVideo}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/client-profile/tabs/workouts/exercise-progress-card.tsx
git commit -m "feat(trainer): add unified ExerciseProgressCard for plan + history"
```

---

### Task 7: Create `orphan-exercises-section.tsx`

**Files:**

- Create: `components/dashboard/client-profile/tabs/workouts/orphan-exercises-section.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/dashboard/client-profile/tabs/workouts/orphan-exercises-section.tsx
"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";

import type { ExerciseGroup } from "../progress/types";

import { ExerciseProgressCard } from "./exercise-progress-card";

interface Props {
  groups: ExerciseGroup[];
  variant: "strength" | "cardio";
  onPlayVideo: (url: string, name: string) => void;
}

export function OrphanExercisesSection({
  groups,
  variant,
  onPlayVideo,
}: Props) {
  const [sectionOpen, setSectionOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (groups.length === 0) return null;

  const filtered = groups.filter((g) =>
    variant === "cardio"
      ? g.exercise.category === "cardio"
      : g.exercise.category !== "cardio"
  );

  if (filtered.length === 0) return null;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="mt-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        aria-expanded={sectionOpen}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
        type="button"
        onClick={() => setSectionOpen((v) => !v)}
      >
        <div>
          <p className="font-semibold text-gray-900">
            Otros ejercicios registrados
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {filtered.length} ejercicios loggeados fuera del programa vigente
          </p>
        </div>
        <Icon
          className={`text-gray-400 transition-transform ${sectionOpen ? "rotate-180" : ""}`}
          icon="solar:alt-arrow-down-linear"
          width={18}
        />
      </button>
      {sectionOpen && (
        <div className="border-t border-gray-100 p-3 space-y-3 bg-gray-50">
          {filtered.map((g) => (
            <ExerciseProgressCard
              key={g.exercise.id}
              exerciseCategory={g.exercise.category}
              exerciseName={g.exercise.name}
              isExpanded={expanded.has(g.exercise.id)}
              logs={g.logs}
              prescribed={null}
              onPlayVideo={onPlayVideo}
              onToggle={() => toggle(g.exercise.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/client-profile/tabs/workouts/orphan-exercises-section.tsx
git commit -m "feat(trainer): add orphan exercises section for off-plan logs"
```

---

### Task 8: Integrate the new card into `workouts-tab.tsx`

**Files:**

- Modify: `components/dashboard/client-profile/tabs/workouts-tab.tsx:1338-1487`

The current inline exercise JSX (`<div className="flex items-start gap-3 p-3 bg-white rounded-lg border…">`) is replaced. Edit/Delete actions stay; they move into the card's `actions` prop. The video URL button currently opens an external link — keep that behavior in `actions` (the prescribed video lives separately from client-uploaded execution videos, which live in the history table).

- [ ] **Step 1: Add imports to `workouts-tab.tsx`**

At the top of `components/dashboard/client-profile/tabs/workouts-tab.tsx`, add (after existing imports):

```tsx
import { useRef, useMemo, useState, useCallback } from "react"; // augment existing import
import {
  TrainerExerciseVideoModal,
  type TrainerExerciseVideoHandle,
} from "@/components/trainer/trainer-exercise-video-modal";

import { ExerciseProgressCard } from "./workouts/exercise-progress-card";
import { OrphanExercisesSection } from "./workouts/orphan-exercises-section";
import { useClientExerciseLogs } from "./workouts/use-client-exercise-logs";
```

- [ ] **Step 2: Wire the hook and modal inside the component**

Inside `WorkoutsTab`, near the existing state declarations, add:

```tsx
const { getLogsForExercise, getOrphanGroups } = useClientExerciseLogs(clientId);
const videoModalRef = useRef<TrainerExerciseVideoHandle>(null);
const openVideo = useCallback(
  (url: string, name: string) => videoModalRef.current?.open(url, name),
  []
);

// Default expanded state: first exercise of every session expanded.
const [expandedExercises, setExpandedExercises] = useState<Set<string>>(
  new Set()
);
const [defaultsSeeded, setDefaultsSeeded] = useState(false);

// When programs first load, seed defaults — first exercise of each session expanded.
useEffect(() => {
  if (defaultsSeeded || programs.length === 0) return;
  const seed = new Set<string>();
  for (const program of programs) {
    for (const session of program.sessions) {
      const first = session.exercises[0];
      if (first?.id) seed.add(first.id);
    }
  }
  setExpandedExercises(seed);
  setDefaultsSeeded(true);
}, [programs, defaultsSeeded]);

const toggleExercise = useCallback(
  (id: string) =>
    setExpandedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    }),
  []
);

// Collect prescribed exercise IDs across all programs for orphan detection.
// Strength tab only — cardio category exercises in the strength tab still
// count as "in the plan" for THIS tab's orphan filter. The OrphanExercisesSection
// component filters by category internally.
const prescribedIds = useMemo(() => {
  const ids = new Set<string>();
  for (const program of programs) {
    for (const session of program.sessions) {
      for (const exercise of session.exercises) {
        if (exercise.exerciseId) ids.add(exercise.exerciseId);
      }
    }
  }
  return ids;
}, [programs]);

const orphanGroups = getOrphanGroups(prescribedIds);
```

Note: `exercise.exerciseId` is the library exercise reference; verify the actual field name by reading the type around line 187 of the file (the field is used as a foreign key when adding exercises to a session). If the prescribed exercise type uses a different key, adapt accordingly.

- [ ] **Step 3: Replace the inline exercise JSX**

Locate the block between lines 1349 and 1487 (the `<div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">` and its closing `</div>` inside the `<SortableExerciseItem>` render). Replace the whole inner content with:

```tsx
{
  ({ dragHandleProps: exerciseDragHandleProps }) => (
    <ExerciseProgressCard
      actions={
        <>
          {exercise.videoUrl && (
            <Button
              isIconOnly
              as="a"
              className="h-6 w-6 min-w-6"
              href={exercise.videoUrl}
              size="sm"
              target="_blank"
              variant="flat"
            >
              <Icon
                className="text-slate-700"
                icon="solar:play-circle-bold"
                width={16}
              />
            </Button>
          )}
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => handleEditExercise(session.id, exercise)}
          >
            <Icon
              className="text-gray-400 hover:text-gray-600"
              icon="solar:pen-linear"
              width={16}
            />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => handleDeleteExercise(session.id, exercise)}
          >
            <Icon
              className="text-gray-400 hover:text-red-600"
              icon="solar:trash-bin-trash-linear"
              width={16}
            />
          </Button>
        </>
      }
      dragHandleProps={exerciseDragHandleProps}
      isExpanded={exercise.id ? expandedExercises.has(exercise.id) : false}
      logs={getLogsForExercise(exercise.exerciseId ?? "")}
      prescribed={exercise}
      onPlayVideo={openVideo}
      onToggle={() => exercise.id && toggleExercise(exercise.id)}
    />
  );
}
```

Verify the actual field on `exercise` that points at the library exercise (likely `exercise.exerciseId` — used at line 195 of the same file when adding via `setExerciseForm({ ... exerciseId: "" })`). If it's a different field, fix the `getLogsForExercise(exercise.exerciseId ?? "")` and `prescribedIds` collection accordingly.

- [ ] **Step 4: Append OrphanExercisesSection and video modal at the end**

After the program-list render but before the tab's closing JSX, add:

```tsx
<OrphanExercisesSection
  groups={orphanGroups}
  variant="strength"
  onPlayVideo={openVideo}
/>

<TrainerExerciseVideoModal ref={videoModalRef} />
```

- [ ] **Step 5: Type-check + lint**

Run: `npm run type-check && npm run lint:check`
Expected: no errors.

- [ ] **Step 6: Manual browser verification**

```bash
npm run dev
```

Open a trainer session → client profile → Entrenamientos tab. Verify:

1. Each exercise card shows its prescription row (sets × reps · rest · system · tempo).
2. The first exercise of each session is expanded by default; the rest are collapsed.
3. Clicking a card toggles its expansion independently.
4. Expanded body shows: 4 KPI cards, a volume chart (if there are logs), and a history table.
5. Clicking a 📹 in the history table opens the `TrainerExerciseVideoModal`.
6. If the client has logged exercises that aren't in the plan, the "Otros ejercicios registrados" section appears at the bottom and lists them as collapsed orphan cards.
7. Drag-to-reorder still works.
8. Edit and Delete buttons still work.

If a step fails, fix it before continuing. Do not let cosmetic issues slide — this is the main UX surface of the work.

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/client-profile/tabs/workouts-tab.tsx
git commit -m "feat(trainer): wire ExerciseProgressCard into Entrenamientos tab"
```

---

### Task 9: Integrate the card into `cardio-tab.tsx`

**Files:**

- Modify: `components/dashboard/client-profile/tabs/cardio-tab.tsx`

Mirror Task 8 with cardio specifics. The prescribed fields on a cardio exercise differ (no sets/reps; instead duration/distance/intensity) so the prescription row in `ExerciseProgressCard` will read `prescribed.sets`/`reps` as empty for cardio — that's already handled (the card just won't render those spans). Add a check for cardio-specific prescribed metadata at the top of the card.

- [ ] **Step 1: Inspect cardio-tab's exercise JSX**

Open `components/dashboard/client-profile/tabs/cardio-tab.tsx` and locate the block analogous to lines 1338-1487 of workouts-tab. The structure should be similar (a `SortableExerciseItem` wrapping an inline div).

- [ ] **Step 2: Extend `ExerciseProgressCard` to render cardio prescription metadata**

Open `components/dashboard/client-profile/tabs/workouts/exercise-progress-card.tsx`. In the prescribed section (currently rendering sets/reps/rest/system/tempo), add cardio fields below the same block:

```tsx
{
  prescribed ? (
    <div className="text-sm text-gray-600 mt-1">
      {prescribed.sets && prescribed.reps && (
        <span>
          {prescribed.sets} × {prescribed.reps}
        </span>
      )}
      {prescribed.rest && <span className="ml-2">· {prescribed.rest}</span>}
      {prescribed.trainingSystem && (
        <span className="ml-2">· {prescribed.trainingSystem}</span>
      )}
      {prescribed.tempo && (
        <span className="ml-2">· Tempo {prescribed.tempo}</span>
      )}
      {/* Cardio-specific prescribed metadata */}
      {(prescribed as any).duration && (
        <span>{(prescribed as any).duration} min</span>
      )}
      {(prescribed as any).distance && (
        <span className="ml-2">· {(prescribed as any).distance} km</span>
      )}
      {(prescribed as any).intensity && (
        <span className="ml-2">· {(prescribed as any).intensity}</span>
      )}
    </div>
  ) : (
    <div className="text-xs text-gray-400 mt-0.5">
      {logs.length} sesiones registradas · fuera del plan vigente
    </div>
  );
}
```

Check `types/training.ts` for the actual cardio prescription field names (likely `duration`, `distance`, `intensity` — read to confirm). If they differ, fix the keys above.

- [ ] **Step 3: Repeat Task 8's steps 1–5 in cardio-tab.tsx**

Same imports, same `useClientExerciseLogs` hook usage, same expanded-set state. Replace the inline cardio exercise JSX with `<ExerciseProgressCard prescribed={exercise} … />`. Append `<OrphanExercisesSection groups={orphanGroups} variant="cardio" onPlayVideo={openVideo} />` and the modal at the bottom.

- [ ] **Step 4: Manual browser verification**

Same checklist as Task 8 step 6, on the Cardio sub-tab. Specifically verify:

- Volume chart shows distance (if logged) or duration (fallback).
- KPI grid uses cardio labels (Mejor · Último · Total · Sesiones).
- History table shows duration/distance/intensity columns.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/client-profile/tabs/cardio-tab.tsx components/dashboard/client-profile/tabs/workouts/exercise-progress-card.tsx
git commit -m "feat(trainer): wire ExerciseProgressCard into Cardio tab"
```

---

### Task 10: Migrate NEAT/steps section to the NEAT tab

**Files:**

- Modify: `components/dashboard/client-profile/tabs/neat-tab.tsx`

The current NEAT tab manages habit cards. The Progress tab's NEAT section pulls steps data via `/api/forms/responses/{clientId}?form_type=habits` and renders `NeatSection` with charts. We add that surface to neat-tab.

- [ ] **Step 1: Read the existing NEAT tab structure**

Read `components/dashboard/client-profile/tabs/neat-tab.tsx` to understand where to add the steps section. Identify a sensible header point near the top (likely below the page title, above the habit cards list).

- [ ] **Step 2: Add a steps fetcher + section**

Lift the steps fetching block from `progress-tab.tsx` lines 67-99 into a new `useStepsData(clientId, daysRange)` hook in `components/dashboard/client-profile/tabs/neat-tab-helpers.ts` or inline into `neat-tab.tsx`. Render `<NeatSection isLoading={stepsLoading} stepsData={stepsData} />` (the existing component from `progress/neat-section.tsx`) inside the NEAT tab.

Add a `DateRangeSelector` (from `progress/ui-atoms.tsx`) above the section so the trainer can change the window. Default `daysRange = "90"`.

- [ ] **Step 3: Type-check, lint, browser verification**

Run: `npm run type-check && npm run lint:check`

Browser: open the NEAT tab. Confirm:

- The existing habit cards still render.
- A new "Pasos / NEAT" section appears with the steps chart.
- Changing the date range refetches and updates the chart.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/client-profile/tabs/neat-tab.tsx
git commit -m "feat(trainer): migrate NEAT steps section into NEAT tab"
```

---

### Task 11: Remove the Progress tab from the tab list

**Files:**

- Modify: `components/dashboard/client-profile/client-profile-tabs.tsx:11, 15-24, 35, 89`

- [ ] **Step 1: Edit `client-profile-tabs.tsx`**

Remove these four lines from the file (line numbers approximate; match by content):

```tsx
// Line 11 — REMOVE
import ProgressTab from "./tabs/progress-tab";

// Line 16 — REMOVE this item from TAB_ITEMS
{ key: "progress", label: "Progreso", icon: "solar:chart-line-duotone" },

// Line 35 — CHANGE default
const [selectedTab, setSelectedTab] = useState("training"); // was "progress"

// Lines 88-89 — REMOVE the progress conditional
{selectedTab === "progress" && <ProgressTab clientId={clientId} />}
```

- [ ] **Step 2: Type-check + lint**

Run: `npm run type-check && npm run lint:check`
Expected: no errors.

- [ ] **Step 3: Browser verification**

Open a client profile. Confirm:

- The "Progreso" tab is gone.
- The tab list opens on "Entrenamientos" by default.
- No console warning about unused import.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/client-profile/client-profile-tabs.tsx
git commit -m "feat(trainer): remove Progress tab in favor of integrated per-exercise view"
```

---

### Task 12: Delete the now-unused Progress files

**Files to delete:**

- `components/dashboard/client-profile/tabs/progress-tab.tsx`
- `components/dashboard/client-profile/tabs/progress/summary-strip.tsx`
- `components/dashboard/client-profile/tabs/progress/activity-heatmap.tsx`
- `components/dashboard/client-profile/tabs/progress/strength-card.tsx`
- `components/dashboard/client-profile/tabs/progress/cardio-card.tsx`

Keep `progress/types.ts`, `progress/helpers.ts`, `progress/exercise-chart.tsx`, `progress/ui-atoms.tsx`, `progress/neat-section.tsx` — they're still consumed by the new code and by neat-tab.

- [ ] **Step 1: Verify no other imports**

Run: `grep -rn "from.*progress-tab\|progress/summary-strip\|progress/activity-heatmap\|progress/strength-card\|progress/cardio-card" components app lib`
Expected: no matches.

- [ ] **Step 2: Delete the files**

```bash
rm components/dashboard/client-profile/tabs/progress-tab.tsx
rm components/dashboard/client-profile/tabs/progress/summary-strip.tsx
rm components/dashboard/client-profile/tabs/progress/activity-heatmap.tsx
rm components/dashboard/client-profile/tabs/progress/strength-card.tsx
rm components/dashboard/client-profile/tabs/progress/cardio-card.tsx
```

- [ ] **Step 3: Type-check + lint**

Run: `npm run type-check && npm run lint:check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(trainer): remove unused Progress tab files"
```

---

### Phase 1 — Final manual QA

- [ ] **Open the trainer dashboard, navigate to a client with a populated history and an active program.**

Verify, end-to-end:

1. Tab list no longer shows "Progreso". First tab now is "Gráficas" or "Entrenamientos" depending on configured order.
2. Entrenamientos tab: each exercise card shows prescription + first-of-session expanded by default. Expanded body shows KPIs, volume chart, history table. Volume curve is genuinely kg×reps×sets (cross-check one session manually).
3. Drag-to-reorder still works; edit/delete buttons still work.
4. Cardio tab: same shape, cardio metrics.
5. "Otros ejercicios registrados" appears at the bottom of each tab when there are off-plan logs.
6. NEAT tab now hosts the steps section.
7. Video icons in history table open the `TrainerExerciseVideoModal`.
8. No console errors. Network tab shows ONE fetch for `/api/clients/{id}/exercise-logs/trainer` per tab visit, not one per exercise.

If anything fails, fix and commit before moving to Phase 2.

---

## Phase 2 — Microciclo metrics by date

This phase adds a second section to the Microciclo tab without touching `MicrocycleConfig`. The section answers "what did the client do on date X, and how does it compare to what was prescribed?". Independent of Phase 1 — could ship later.

### Task 13: Trainer-scoped scheduled-sessions endpoint

**Files:**

- Create: `app/api/clients/[clientId]/scheduled-sessions/trainer/route.ts`

The existing `/scheduled-sessions/route.ts` is client-authenticated. We need a trainer variant that verifies the requesting trainer owns the client.

- [ ] **Step 1: Write the route**

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
        `*, session:sessions(id, name, exercises:session_exercises(*, exercise:exercises(id, name, category)))`
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

    return NextResponse.json({ success: true, scheduledSessions: data ?? [] });
  } catch (error) {
    console.error("[Trainer Scheduled Sessions API] Unexpected:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
```

Note: the nested select path (`session_exercises` → `exercises`) needs to match the actual schema. Before writing, check `types/supabase.ts` and `lib/services/program-service.ts` to confirm the table names for "the exercises that belong to a session". Adapt the select accordingly.

- [ ] **Step 2: Type-check + run dev server, hit the endpoint manually**

```bash
npm run type-check
npm run dev
# In another terminal, with a valid trainer session cookie:
curl --cookie "trainer-session=..." \
  "http://localhost:3000/api/clients/<known-client-id>/scheduled-sessions/trainer?startDate=2026-05-04&endDate=2026-05-11"
```

Expected: 200 with `{ success: true, scheduledSessions: [...] }`. Verify each row has nested session.exercises with name+category.

- [ ] **Step 3: Commit**

```bash
git add "app/api/clients/[clientId]/scheduled-sessions/trainer/route.ts"
git commit -m "feat(api): trainer-scoped scheduled-sessions endpoint for microcycle metrics"
```

---

### Task 14: Adherence utilities

**Files:**

- Create: `components/dashboard/client-profile/tabs/microcycle/adherence.ts`

- [ ] **Step 1: Write the utilities**

```ts
// components/dashboard/client-profile/tabs/microcycle/adherence.ts
//
// Pure utilities for computing per-day adherence. No React, no fetch.

import type { ExerciseLog } from "../progress/types";

export interface PrescribedExercise {
  exerciseId: string;
  name: string;
  category: string;
  prescribedSets?: number;
  prescribedReps?: string | number;
  prescribedWeightKg?: number;
}

export interface DayAdherence {
  totalPrescribed: number;
  completedExercises: number; // logged at least one set
  prescribedSetsTotal: number;
  loggedSetsTotal: number;
  prescribedLoadTotal: number; // sum of (sets * reps * weight) prescribed
  loggedLoadTotal: number; // sum of (set.reps * set.weight) executed
  /** 0..1 — proportion of exercises with at least one set logged. */
  exerciseCompletion: number;
  /** 0..1 — proportion of prescribed sets that were logged. */
  setsCompletion: number;
  /** 0..1 — proportion of prescribed total load that was lifted. 1 if no prescribed load. */
  loadCompletion: number;
}

export type DayClassification = "complete" | "partial" | "pending" | "rest";

export function computeDayAdherence(
  prescribed: PrescribedExercise[],
  logs: ExerciseLog[]
): DayAdherence {
  if (prescribed.length === 0) {
    return {
      totalPrescribed: 0,
      completedExercises: 0,
      prescribedSetsTotal: 0,
      loggedSetsTotal: 0,
      prescribedLoadTotal: 0,
      loggedLoadTotal: 0,
      exerciseCompletion: 0,
      setsCompletion: 0,
      loadCompletion: 1,
    };
  }

  let completedExercises = 0;
  let prescribedSetsTotal = 0;
  let loggedSetsTotal = 0;
  let prescribedLoadTotal = 0;
  let loggedLoadTotal = 0;

  for (const p of prescribed) {
    const exerciseLogs = logs.filter((l) => l.exercise_id === p.exerciseId);
    const setsCount = exerciseLogs.flatMap((l) => l.sets ?? []).length;
    if (setsCount > 0) completedExercises += 1;
    loggedSetsTotal += setsCount;

    const prescribedSets = p.prescribedSets ?? 0;
    const prescribedReps =
      typeof p.prescribedReps === "number"
        ? p.prescribedReps
        : parseInt(String(p.prescribedReps ?? "")) || 0;
    const prescribedWeight = p.prescribedWeightKg ?? 0;
    prescribedSetsTotal += prescribedSets;
    prescribedLoadTotal += prescribedSets * prescribedReps * prescribedWeight;

    for (const log of exerciseLogs) {
      for (const s of log.sets ?? []) {
        loggedLoadTotal += (s.reps ?? 0) * (s.weight_kg ?? 0);
      }
    }
  }

  const exerciseCompletion = completedExercises / prescribed.length;
  const setsCompletion =
    prescribedSetsTotal === 0
      ? 0
      : Math.min(loggedSetsTotal / prescribedSetsTotal, 1);
  const loadCompletion =
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
    exerciseCompletion,
    setsCompletion,
    loadCompletion,
  };
}

export function classifyDay(
  hasPrescribed: boolean,
  adherence: DayAdherence
): DayClassification {
  if (!hasPrescribed) return "rest";
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
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/client-profile/tabs/microcycle/adherence.ts
git commit -m "feat(trainer): add adherence computation utilities for microcycle metrics"
```

---

### Task 15: Week navigator + week strip components

**Files:**

- Create: `components/dashboard/client-profile/tabs/microcycle/week-navigator.tsx`
- Create: `components/dashboard/client-profile/tabs/microcycle/week-strip.tsx`

- [ ] **Step 1: Week navigator**

```tsx
// components/dashboard/client-profile/tabs/microcycle/week-navigator.tsx
"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface Props {
  /** Local Y-M-D of the Monday of the displayed week. */
  weekStart: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function formatRange(weekStart: string) {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = start.toLocaleDateString("es-ES", {
    day: "numeric",
    month: sameMonth ? undefined : "short",
  });
  const endStr = end.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `Semana del ${startStr} – ${endStr}`;
}

export function WeekNavigator({ weekStart, onPrev, onNext, onToday }: Props) {
  return (
    <div className="flex items-center gap-3">
      <Button isIconOnly size="sm" variant="flat" onPress={onPrev}>
        <Icon icon="solar:alt-arrow-left-linear" width={18} />
      </Button>
      <p className="text-sm font-medium text-gray-700 min-w-[14rem] text-center tabular-nums">
        {formatRange(weekStart)}
      </p>
      <Button size="sm" variant="flat" onPress={onToday}>
        Hoy
      </Button>
      <Button isIconOnly size="sm" variant="flat" onPress={onNext}>
        <Icon icon="solar:alt-arrow-right-linear" width={18} />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Week strip**

```tsx
// components/dashboard/client-profile/tabs/microcycle/week-strip.tsx
"use client";

import { Icon } from "@iconify/react";

import {
  formatPercent,
  type DayAdherence,
  type DayClassification,
} from "./adherence";

export interface WeekStripDay {
  date: string; // YYYY-MM-DD
  isToday: boolean;
  sessionName: string | null; // null = rest day
  classification: DayClassification;
  adherence: DayAdherence | null;
}

interface Props {
  days: WeekStripDay[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
}

const DAY_LABELS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

function symbolFor(classification: DayClassification) {
  if (classification === "complete") return "●";
  if (classification === "partial") return "◐";
  if (classification === "pending") return "○";
  return "—";
}

function colorFor(classification: DayClassification) {
  if (classification === "complete") return "text-green-600";
  if (classification === "partial") return "text-amber-500";
  if (classification === "pending") return "text-gray-400";
  return "text-gray-300";
}

export function WeekStrip({ days, selectedDate, onSelect }: Props) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, idx) => {
        const isSelected = day.date === selectedDate;
        const dayNumber = parseInt(day.date.split("-")[2]);
        return (
          <button
            key={day.date}
            aria-selected={isSelected}
            className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors text-left ${
              isSelected
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:bg-gray-50"
            }`}
            type="button"
            onClick={() => onSelect(day.date)}
          >
            <span className="text-[10px] font-semibold text-gray-500 tracking-wider">
              {DAY_LABELS[idx]}
            </span>
            <span
              className={`text-base font-semibold tabular-nums ${
                day.isToday ? "text-blue-600" : "text-gray-900"
              }`}
            >
              {dayNumber}
            </span>
            <span className="text-[10px] text-gray-500 leading-tight text-center min-h-[1rem] line-clamp-1">
              {day.sessionName ?? "Descanso"}
            </span>
            <span
              className={`text-base leading-none ${colorFor(day.classification)}`}
            >
              {symbolFor(day.classification)}
            </span>
            <span className="text-[10px] tabular-nums text-gray-500">
              {day.adherence && day.classification !== "rest"
                ? formatPercent(day.adherence.exerciseCompletion)
                : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Type-check + commit**

```bash
npm run type-check
git add components/dashboard/client-profile/tabs/microcycle/week-navigator.tsx components/dashboard/client-profile/tabs/microcycle/week-strip.tsx
git commit -m "feat(trainer): add week navigator and week strip components"
```

---

### Task 16: Day detail component

**Files:**

- Create: `components/dashboard/client-profile/tabs/microcycle/day-detail.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/dashboard/client-profile/tabs/microcycle/day-detail.tsx
"use client";

import { Icon } from "@iconify/react";

import type { ExerciseLog } from "../progress/types";

import {
  formatPercent,
  type DayAdherence,
  type PrescribedExercise,
} from "./adherence";

interface Props {
  date: string;
  sessionName: string | null;
  prescribed: PrescribedExercise[];
  logs: ExerciseLog[];
  adherence: DayAdherence;
  onJumpToExercise: (exerciseId: string, category: string) => void;
}

function formatDateLong(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function DayDetail({
  date,
  sessionName,
  prescribed,
  logs,
  adherence,
  onJumpToExercise,
}: Props) {
  if (prescribed.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        {formatDateLong(date)} — día de descanso o sin sesión asignada.
      </div>
    );
  }

  return (
    <section className="rounded-lg bg-white border border-gray-200 overflow-hidden">
      <header className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900 capitalize">
          {formatDateLong(date)} · {sessionName ?? "Sesión"}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          Adherencia {formatPercent(adherence.exerciseCompletion)} —{" "}
          {adherence.completedExercises} de {adherence.totalPrescribed}{" "}
          ejercicios · {formatPercent(adherence.loadCompletion)} carga media
        </p>
      </header>
      <ul className="divide-y divide-gray-100">
        {prescribed.map((p) => {
          const exerciseLogs = logs.filter(
            (l) => l.exercise_id === p.exerciseId
          );
          const totalSets = exerciseLogs.flatMap((l) => l.sets ?? []).length;
          const totalLoad = exerciseLogs
            .flatMap((l) => l.sets ?? [])
            .reduce((acc, s) => acc + (s.reps ?? 0) * (s.weight_kg ?? 0), 0);
          const prescribedLoad =
            (p.prescribedSets ?? 0) *
            (typeof p.prescribedReps === "number"
              ? p.prescribedReps
              : parseInt(String(p.prescribedReps ?? "")) || 0) *
            (p.prescribedWeightKg ?? 0);

          const status =
            totalSets === 0
              ? "pending"
              : totalSets >= (p.prescribedSets ?? 0)
                ? "complete"
                : "partial";
          const statusSymbol =
            status === "complete" ? "●" : status === "partial" ? "◐" : "○";
          const statusColor =
            status === "complete"
              ? "text-green-600"
              : status === "partial"
                ? "text-amber-500"
                : "text-gray-400";

          return (
            <li key={p.exerciseId} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span
                    className={`text-lg leading-none mt-0.5 ${statusColor}`}
                  >
                    {statusSymbol}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {p.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Prescrito: {p.prescribedSets ?? "—"}×
                      {p.prescribedReps ?? "—"}
                      {p.prescribedWeightKg
                        ? ` @ ${p.prescribedWeightKg}kg`
                        : ""}
                    </p>
                    <p className="text-xs text-gray-500">
                      Ejecutado: {totalSets} series · {totalLoad} kg·reps
                      {prescribedLoad > 0
                        ? ` (${formatPercent(Math.min(totalLoad / prescribedLoad, 1))} carga)`
                        : ""}
                    </p>
                  </div>
                </div>
                <button
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 shrink-0"
                  type="button"
                  onClick={() => onJumpToExercise(p.exerciseId, p.category)}
                >
                  Ver
                  <Icon icon="solar:alt-arrow-right-linear" width={12} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
git add components/dashboard/client-profile/tabs/microcycle/day-detail.tsx
git commit -m "feat(trainer): add day detail component for microcycle metrics"
```

---

### Task 17: MetricsSection orchestrator

**Files:**

- Create: `components/dashboard/client-profile/tabs/microcycle/metrics-section.tsx`

This component owns: week state, fetch of scheduled-sessions + logs for the visible week, mapping of scheduled sessions → `PrescribedExercise[]`, and rendering the navigator + strip + day detail.

- [ ] **Step 1: Write the orchestrator**

```tsx
// components/dashboard/client-profile/tabs/microcycle/metrics-section.tsx
"use client";

import { Spinner } from "@heroui/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getLocalYmd } from "@/lib/forms/client-helpers";

import type { ExerciseLog } from "../progress/types";

import {
  classifyDay,
  computeDayAdherence,
  type PrescribedExercise,
} from "./adherence";
import { DayDetail } from "./day-detail";
import { WeekNavigator } from "./week-navigator";
import { WeekStrip, type WeekStripDay } from "./week-strip";

interface Props {
  clientId: string;
}

function startOfWeek(date: Date): Date {
  // Monday as week start. JS getDay() returns 0=Sun..6=Sat; we want 1=Mon..7=Sun.
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

interface ScheduledSessionRow {
  id: string;
  scheduled_date: string;
  session: {
    id: string;
    name: string;
    exercises: Array<{
      exercise: { id: string; name: string; category: string };
      sets?: number;
      reps?: string | number;
      weight_kg?: number;
    }>;
  } | null;
}

export function MetricsSection({ clientId }: Props) {
  const today = useMemo(() => new Date(), []);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(today));
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    getLocalYmd(today)
  );

  const [scheduled, setScheduled] = useState<ScheduledSessionRow[]>([]);
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [loading, setLoading] = useState(true);

  const weekStartYmd = getLocalYmd(weekStart);
  const weekEndYmd = getLocalYmd(addDays(weekStart, 6));

  const fetchWeek = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, logsRes] = await Promise.all([
        fetch(
          `/api/clients/${clientId}/scheduled-sessions/trainer?startDate=${weekStartYmd}&endDate=${weekEndYmd}`
        ),
        fetch(
          `/api/clients/${clientId}/exercise-logs/trainer?startDate=${weekStartYmd}&endDate=${weekEndYmd}`
        ),
      ]);
      const [schedJson, logsJson] = await Promise.all([
        schedRes.json(),
        logsRes.json(),
      ]);
      setScheduled(
        schedJson.success ? (schedJson.scheduledSessions ?? []) : []
      );
      setLogs(logsJson.success ? (logsJson.exerciseLogs ?? []) : []);
    } finally {
      setLoading(false);
    }
  }, [clientId, weekStartYmd, weekEndYmd]);

  useEffect(() => {
    fetchWeek();
  }, [fetchWeek]);

  const byDate = useMemo(() => {
    const map = new Map<
      string,
      { prescribed: PrescribedExercise[]; sessionName: string | null }
    >();
    for (const s of scheduled) {
      const prescribed: PrescribedExercise[] = (s.session?.exercises ?? []).map(
        (e) => ({
          exerciseId: e.exercise.id,
          name: e.exercise.name,
          category: e.exercise.category,
          prescribedSets: e.sets,
          prescribedReps: e.reps,
          prescribedWeightKg: e.weight_kg,
        })
      );
      map.set(s.scheduled_date, {
        prescribed,
        sessionName: s.session?.name ?? null,
      });
    }
    return map;
  }, [scheduled]);

  const logsByDate = useMemo(() => {
    const map = new Map<string, ExerciseLog[]>();
    for (const log of logs) {
      const arr = map.get(log.scheduled_date) ?? [];
      arr.push(log);
      map.set(log.scheduled_date, arr);
    }
    return map;
  }, [logs]);

  const days: WeekStripDay[] = useMemo(() => {
    const todayYmd = getLocalYmd(today);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      const ymd = getLocalYmd(d);
      const dayInfo = byDate.get(ymd);
      const prescribed = dayInfo?.prescribed ?? [];
      const dayLogs = logsByDate.get(ymd) ?? [];
      const adherence = computeDayAdherence(prescribed, dayLogs);
      const classification = classifyDay(prescribed.length > 0, adherence);
      return {
        date: ymd,
        isToday: ymd === todayYmd,
        sessionName: dayInfo?.sessionName ?? null,
        classification,
        adherence,
      };
    });
  }, [weekStart, byDate, logsByDate, today]);

  const selectedDayInfo = byDate.get(selectedDate);
  const selectedPrescribed = selectedDayInfo?.prescribed ?? [];
  const selectedLogs = logsByDate.get(selectedDate) ?? [];
  const selectedAdherence = computeDayAdherence(
    selectedPrescribed,
    selectedLogs
  );

  const handleJumpToExercise = (_exerciseId: string, _category: string) => {
    // TODO Phase 2.5: programmatic deep link to the exercise card in
    // Entrenamientos / Cardio sub-tab. For now we just log; the cross-tab
    // navigation wiring is its own follow-up task.
    // eslint-disable-next-line no-console
    console.log("Jump to exercise", _exerciseId, _category);
  };

  return (
    <section className="mt-8 flex flex-col gap-4 pt-6 border-t border-gray-200">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Métricas por fecha
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Ejecución y adherencia comparadas contra el template vigente.
          </p>
        </div>
        <WeekNavigator
          weekStart={weekStartYmd}
          onNext={() => setWeekStart((d) => addDays(d, 7))}
          onPrev={() => setWeekStart((d) => addDays(d, -7))}
          onToday={() => {
            setWeekStart(startOfWeek(new Date()));
            setSelectedDate(getLocalYmd(new Date()));
          }}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner color="primary" label="Cargando métricas..." />
        </div>
      ) : (
        <>
          <WeekStrip
            days={days}
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
          />
          <DayDetail
            adherence={selectedAdherence}
            date={selectedDate}
            logs={selectedLogs}
            prescribed={selectedPrescribed}
            sessionName={selectedDayInfo?.sessionName ?? null}
            onJumpToExercise={handleJumpToExercise}
          />
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/client-profile/tabs/microcycle/metrics-section.tsx
git commit -m "feat(trainer): add metrics-by-date section orchestrator for microcycle"
```

---

### Task 18: Mount MetricsSection inside microcycle-tab

**Files:**

- Modify: `components/dashboard/client-profile/tabs/microcycle-tab.tsx`

- [ ] **Step 1: Edit the file**

Replace the body with:

```tsx
"use client";

import MicrocycleConfig from "@/components/trainer/microcycle/microcycle-config";

import { MetricsSection } from "./microcycle/metrics-section";

interface Props {
  clientId: string;
}

export default function MicrocycleTab({ clientId }: Props) {
  return (
    <div className="flex flex-col">
      <MicrocycleConfig clientId={clientId} />
      <MetricsSection clientId={clientId} />
    </div>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npm run type-check && npm run lint:check`
Expected: no errors.

- [ ] **Step 3: Browser verification**

Open client profile → Entrenamientos → Microciclo. Verify:

1. The existing microcycle config editor still renders unchanged at the top.
2. A "Métricas por fecha" section appears below, separated by a top border.
3. The week navigator shows the current week with `[← Semana del X – Y mes año Hoy →]`.
4. The week strip shows 7 days with day labels, day numbers, session names, adherence symbol + %.
5. Today's date number is highlighted blue.
6. Clicking a day updates the selected state (blue border) and the day-detail card below.
7. Day detail shows prescribed-vs-executed for each prescribed exercise. Adherence numbers reflect what was logged.
8. Prev/Next week buttons navigate; Hoy returns to current week.
9. Test data: a day with no scheduled session shows "Descanso" and `—` symbol. A day with logs but no prescription is unreachable through this flow because the prescription comes from `scheduled_sessions`.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/client-profile/tabs/microcycle-tab.tsx
git commit -m "feat(trainer): mount metrics-by-date section inside Microciclo tab"
```

---

### Phase 2 — Final manual QA

- [ ] **Validate adherence numbers against ground truth.**

Pick a client with a recent week of data. For one specific date in that week:

1. Note the prescribed session and its exercises (from the program editor in Entrenamientos).
2. Note the logs for that date (visible inside each exercise card's history table in Entrenamientos).
3. Compute by hand: % of prescribed exercises with ≥1 logged set; % of total prescribed load lifted.
4. Compare against the day strip cell + day detail header in Microciclo.

If they don't match, the bug is in `computeDayAdherence` or in the prescribed-load math — fix at the source, don't paper over.

---

## Out of scope (explicit non-goals)

- **Dated prescriptions** (future-date editing of sets/reps/weights per client). The user explicitly deferred this to Phase 3.
- **Editing the prescription from the day detail.** "Ver →" is read-only navigation; editing remains in the Entrenamientos tab.
- **Cross-tab deep linking** with auto-expand-and-highlight from "Ver →" — the orchestrator stubs it (`handleJumpToExercise` logs to console). A small follow-up task wires it: it needs the `TrainingTabs` parent to lift the active sub-tab into a URL search param or a context, then expose a callback to navigate. Tackle after the rest of Phase 2 is stable so the data side is proven before adding navigation polish.
- **Tablet / mobile responsive polish** — the wireframe assumes desktop iframe. Mobile-specific compaction of the week strip (per the wireframe note) is a follow-up.

---

## Self-review notes

- Volume metric matches the spec exactly: `sum(set.reps * set.weight_kg)` per session. Confirmed in `computeSessionVolume`.
- First-of-session expanded default is implemented in Task 8 step 2 (seeding `expandedExercises` from the first exercise of each session on first load).
- Orphans handled by `OrphanExercisesSection`, populated from `getOrphanGroups(prescribedIds)` in the hook.
- Adherence uses both completion-of-exercises (the headline number on the strip) and load-completion (a secondary number in the detail).
- No dependencies added; all new components reuse existing `progress/` primitives (`ExerciseLineChart`, `LogTable`, `StatCard`, `Sparkline`) and the existing `TrainerExerciseVideoModal`.
- Microcycle config view is untouched (per "no se debe de tocar" — the only modification is appending a sibling section).
- If the `session_exercises` schema differs from what's assumed in Task 13 step 1, that's the one place where the API select needs adjustment; do not invent schema.

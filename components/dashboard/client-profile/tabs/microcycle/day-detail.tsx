"use client";

// Detalle del día de Seguimiento (rediseño aprobado — mockup "mini-tabla").
// Jerarquía: cabecera compacta (nombre + estado + hora de inicio + toggle de
// prescripción) → franja de stats con separadores finos (receta de nutrición)
// → una fila por ejercicio (punto de estado, prescripción como línea
// secundaria, resumen ejecutado a la derecha, barra de progreso de 3px) →
// series como MINI-TABLA a ancho completo (reps/kilos en columnas alineadas,
// video como botón azul etiquetado, récord histórico con medalla, reps bajo
// objetivo en ámbar) → nota del cliente como cita. Los ejercicios fuera de
// plan van en su propia tarjeta punteada (punteado = no prescrito).
//
// Se conserva todo el comportamiento previo: modo actuals-first vs modo
// prescripción, popover de métricas por ejercicio, video por serie + video
// legacy de sesión, chip "Originalmente prescrito", día futuro y descanso.

import type { ExerciseLog, ExerciseLogSet } from "../progress/types";
import type { DayMetrics, PrescribedExercise, SessionEntry } from "./types";

import { Icon } from "@iconify/react";
import { Fragment, useState } from "react";

import { allTimeMaxE1rm } from "../workouts/helpers";

import { classificationLabel } from "./adherence";
import { ExerciseMetricsPopover } from "./exercise-metrics-popover";
import { buildLoggedExerciseGroups } from "./logged-view";

import { estimateOneRepMax } from "@/lib/training/e1rm";

function formatDateLong(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Primer número de la prescripción de reps ("8-10" → 8); null si no parsea. */
function minPrescribedReps(reps: string | null | undefined): number | null {
  if (reps == null) return null;
  const match = String(reps).match(/\d+/);

  if (!match) return null;
  const parsed = parseInt(match[0], 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Formato es-ES para kilos: 82.5 → "82,5". */
function formatKg(value: number): string {
  return value.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

// ─── Franja de stats (separadores de 1px, receta de nutrición) ──────────────

interface StatItem {
  label: string;
  value: string;
  unit?: string;
}

function StatStrip({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-px border-b border-gray-100 bg-gray-100 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-white px-4 py-2.5">
          <p className="text-[9.5px] font-bold uppercase tracking-wider text-gray-400">
            {item.label}
          </p>
          <p className="text-base font-bold text-gray-900 tabular-nums">
            {item.value}
            {item.unit ? (
              <span className="ml-1 text-[11px] font-medium text-gray-500">
                {item.unit}
              </span>
            ) : null}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Mini-tabla de series (ancho completo) ──────────────────────────────────

function SetsTable({
  sets,
  exerciseName,
  prescribedMin,
  historicalMaxE1rm,
  onPlayVideo,
}: {
  sets: ExerciseLogSet[];
  exerciseName: string;
  /** Reps mínimas prescritas — por debajo, el número se tiñe ámbar. */
  prescribedMin: number | null;
  /**
   * Mejor 1RM estimado histórico del ejercicio; la serie que lo iguala lleva
   * 🏅. El criterio era el peso máximo suelto, que declaraba récord a un
   * single de 105 kg por encima de un 3×100 claramente más fuerte.
   */
  historicalMaxE1rm: number;
  onPlayVideo: ((url: string, name: string) => void) | undefined;
}) {
  // La medalla va SOLO a la primera serie que alcanza el máximo histórico —
  // dos series iguales no son dos récords. Comparación con epsilon porque el
  // máximo sale de la misma fórmula sobre los mismos números en coma flotante.
  const recordIndex =
    historicalMaxE1rm > 0
      ? sets.findIndex((s) => {
          const e1rm = estimateOneRepMax(s.weight_kg, s.reps);

          return e1rm !== null && e1rm >= historicalMaxE1rm - 1e-9;
        })
      : -1;

  return (
    // UNA sola grilla para toda la tabla (las filas son `Fragment`s): así el
    // ancho de la columna de acciones se calcula una vez para todas las filas
    // y los kilos quedan alineados aunque solo una serie tenga badge. Con una
    // grilla por fila, la fila con "Récord" encogía sus columnas y movía el
    // número a la izquierda.
    <div className="mt-2.5 grid grid-cols-[2.5rem_1fr_1fr_auto] overflow-hidden rounded-large border border-gray-100 bg-white text-xs tabular-nums">
      {sets.map((set, index) => {
        const isRecord = index === recordIndex;
        const lowReps =
          prescribedMin !== null &&
          typeof set.reps === "number" &&
          set.reps < prescribedMin;
        // Borde y fondo van por CELDA: el contenedor de fila ya no existe.
        const cell = `flex items-center ${index === 0 ? "" : "border-t border-gray-100"} ${
          isRecord ? "bg-amber-50/40" : ""
        }`;

        return (
          <Fragment key={set.id ?? set.set_number}>
            <span
              className={`${cell} px-2.5 py-1.5 text-[10.5px] font-semibold text-gray-400`}
            >
              S{set.set_number}
            </span>
            <span className={`${cell} px-2.5 py-1.5 text-gray-900`}>
              <b
                className={`font-bold ${lowReps ? "text-amber-700" : ""}`}
                title={
                  lowReps
                    ? `Por debajo del objetivo (${prescribedMin})`
                    : undefined
                }
              >
                {set.reps ?? "—"}
              </b>
              <span className="ml-1 text-[10.5px] text-gray-400">reps</span>
            </span>
            <span className={`${cell} px-2.5 py-1.5 text-gray-900`}>
              <b className="font-bold">
                {set.weight_kg != null ? formatKg(set.weight_kg) : "—"}
              </b>
              <span className="ml-1 text-[10.5px] text-gray-400">kg</span>
            </span>
            <span className={`${cell} justify-end gap-1.5 px-2.5 py-1`}>
              {isRecord ? (
                <span
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-medium border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700"
                  title="Mejor serie histórica de este ejercicio (por 1RM estimado)"
                >
                  🏅 Récord
                </span>
              ) : null}
              {set.video_url && onPlayVideo ? (
                <button
                  aria-label={`Ver video de ${exerciseName} serie ${set.set_number}`}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-medium border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 transition-colors hover:bg-blue-100"
                  type="button"
                  onClick={() => onPlayVideo(set.video_url!, exerciseName)}
                >
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[7px] text-white">
                    ▶
                  </span>
                  Video
                </button>
              ) : null}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}

// ─── Piezas compartidas de las filas ────────────────────────────────────────

function StatusDot({ tone }: { tone: "done" | "part" | "pend" }) {
  const cls =
    tone === "done"
      ? "bg-emerald-500"
      : tone === "part"
        ? "bg-amber-500"
        : "bg-gray-300";

  return (
    <span
      aria-hidden="true"
      className={`h-2 w-2 shrink-0 rounded-full ${cls}`}
    />
  );
}

function MiniProgress({
  value,
  tone,
}: {
  value: number;
  tone: "done" | "part";
}) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);

  return (
    <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-gray-100">
      <div
        aria-label={`${pct}%`}
        className={`h-full rounded-full transition-all duration-200 ${
          tone === "done" ? "bg-emerald-500" : "bg-amber-500"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function NoteQuote({ notes }: { notes: string }) {
  return (
    <div className="mt-2 flex gap-2 rounded-r-large border-l-[3px] border-gray-200 bg-gray-50 px-3 py-2">
      <span className="shrink-0 pt-px text-[9.5px] font-bold uppercase tracking-wider text-gray-400">
        Cliente
      </span>
      <p className="text-xs italic leading-snug text-gray-600">
        «{notes.trim()}»
      </p>
    </div>
  );
}

function LegacyVideoButton({
  url,
  name,
  onPlayVideo,
}: {
  url: string;
  name: string;
  onPlayVideo: (url: string, name: string) => void;
}) {
  return (
    <button
      className="mt-2 inline-flex items-center gap-1.5 rounded-medium border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-100"
      title="Video grabado para toda la sesión"
      type="button"
      onClick={() => onPlayVideo(url, name)}
    >
      <Icon icon="solar:play-circle-bold" width={13} />
      Video de la sesión completa
    </button>
  );
}

/** Cabecera común de una fila de ejercicio: punto + nombre + rx + resumen. */
function RowHeader({
  tone,
  name,
  rxLine,
  summary,
  metricsPopover,
}: {
  tone: "done" | "part" | "pend";
  name: string;
  rxLine: string | null;
  summary: React.ReactNode;
  metricsPopover: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <StatusDot tone={tone} />
      <div className="min-w-0 flex-1">
        <p
          className={`text-[13px] font-semibold ${
            tone === "pend" ? "text-gray-400" : "text-gray-900"
          }`}
        >
          {name}
        </p>
        {rxLine ? (
          <p className="text-[11px] text-gray-500 tabular-nums">{rxLine}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {summary}
        {metricsPopover}
      </div>
    </div>
  );
}

function rxLineFor(p: PrescribedExercise): string {
  const parts = [
    `Prescrito ${p.prescribedSets ?? "—"} × ${p.prescribedReps ?? "—"}`,
  ];

  if (p.prescribedWeightKg != null) parts.push(`@ ${p.prescribedWeightKg} kg`);
  if (p.prescribedRir) parts.push(`RIR ${p.prescribedRir}`);

  return parts.join(" · ");
}

// ─── Fila en modo prescripción (sin logs de la sesión / día futuro) ─────────

function PrescribedRow({
  prescribed,
  logs,
  allTimeLogs,
  isFuture,
  onPlayVideo,
}: {
  prescribed: PrescribedExercise;
  logs: ExerciseLog[];
  allTimeLogs: ExerciseLog[];
  isFuture: boolean;
  onPlayVideo: ((url: string, name: string) => void) | undefined;
}) {
  const exerciseLogs = logs.filter(
    (l) => l.exercise_id === prescribed.exerciseId
  );
  const allSets = exerciseLogs.flatMap((l) => l.sets ?? []);
  const totalSets = allSets.length;
  const prescribedSets = prescribed.prescribedSets ?? 0;
  const tone: "done" | "part" | "pend" = isFuture
    ? "pend"
    : totalSets === 0
      ? "pend"
      : totalSets >= prescribedSets
        ? "done"
        : "part";
  const notes = exerciseLogs.find((l) => l.notes)?.notes ?? null;
  const anyPerSetVideo = allSets.some((s) => Boolean(s.video_url));
  const legacySessionVideo = anyPerSetVideo
    ? null
    : (exerciseLogs.find((l) => l.video_url)?.video_url ?? null);
  const maxKg = allSets.reduce(
    (acc, s) =>
      typeof s.weight_kg === "number" && s.weight_kg > acc ? s.weight_kg : acc,
    0
  );

  return (
    <li className="px-4 py-3">
      <RowHeader
        metricsPopover={
          <ExerciseMetricsPopover
            category={prescribed.category}
            exerciseName={prescribed.name}
            logs={allTimeLogs}
            onPlayVideo={onPlayVideo}
          />
        }
        name={prescribed.name}
        rxLine={rxLineFor(prescribed)}
        summary={
          isFuture ? null : totalSets === 0 ? (
            <span className="text-[11.5px] font-medium text-gray-400">
              sin registros
            </span>
          ) : (
            <span className="text-[11.5px] font-semibold text-gray-900 tabular-nums">
              {totalSets} {totalSets === 1 ? "serie" : "series"}
              {maxKg > 0 ? ` · ${formatKg(maxKg)} kg máx` : ""}
            </span>
          )
        }
        tone={tone}
      />

      {!isFuture && prescribedSets > 0 && totalSets > 0 ? (
        <MiniProgress
          tone={totalSets >= prescribedSets ? "done" : "part"}
          value={prescribedSets === 0 ? 0 : totalSets / prescribedSets}
        />
      ) : null}

      {!isFuture && totalSets > 0 ? (
        <SetsTable
          exerciseName={prescribed.name}
          historicalMaxE1rm={allTimeMaxE1rm(allTimeLogs)}
          prescribedMin={minPrescribedReps(prescribed.prescribedReps)}
          sets={allSets}
          onPlayVideo={onPlayVideo}
        />
      ) : null}

      {legacySessionVideo && onPlayVideo ? (
        <LegacyVideoButton
          name={prescribed.name}
          url={legacySessionVideo}
          onPlayVideo={onPlayVideo}
        />
      ) : null}

      {notes ? <NoteQuote notes={notes} /> : null}
    </li>
  );
}

// ─── Fila en modo actuals (lo que el cliente hizo, primero) ─────────────────

function LoggedExerciseRow({
  exerciseName,
  logs,
  allTimeLogs,
  category,
  prescribedEntry,
  onPlayVideo,
}: {
  exerciseName: string;
  logs: ExerciseLog[];
  allTimeLogs: ExerciseLog[];
  category: string | undefined;
  /** Prescripción correspondiente cuando el ejercicio estaba en el plan. */
  prescribedEntry: PrescribedExercise | null;
  onPlayVideo: ((url: string, name: string) => void) | undefined;
}) {
  const allSets = logs.flatMap((l) => l.sets ?? []);
  const totalSets = allSets.length;
  const notes = logs.find((l) => l.notes)?.notes ?? null;
  const anyPerSetVideo = allSets.some((s) => Boolean(s.video_url));
  const legacySessionVideo = anyPerSetVideo
    ? null
    : (logs.find((l) => l.video_url)?.video_url ?? null);
  const maxKg = allSets.reduce(
    (acc, s) =>
      typeof s.weight_kg === "number" && s.weight_kg > acc ? s.weight_kg : acc,
    0
  );
  const prescribedSets = prescribedEntry?.prescribedSets ?? 0;
  const tone: "done" | "part" =
    prescribedSets > 0 && totalSets < prescribedSets ? "part" : "done";

  return (
    <li className="px-4 py-3">
      <RowHeader
        metricsPopover={
          <ExerciseMetricsPopover
            category={category}
            exerciseName={exerciseName}
            logs={allTimeLogs}
            onPlayVideo={onPlayVideo}
          />
        }
        name={exerciseName}
        rxLine={prescribedEntry ? rxLineFor(prescribedEntry) : null}
        summary={
          <span className="text-[11.5px] font-semibold text-gray-900 tabular-nums">
            {totalSets} {totalSets === 1 ? "serie" : "series"}
            {maxKg > 0 ? ` · ${formatKg(maxKg)} kg máx` : ""}
          </span>
        }
        tone={tone}
      />

      {prescribedSets > 0 ? (
        <MiniProgress tone={tone} value={totalSets / prescribedSets} />
      ) : null}

      {totalSets > 0 ? (
        <SetsTable
          exerciseName={exerciseName}
          historicalMaxE1rm={allTimeMaxE1rm(allTimeLogs)}
          prescribedMin={minPrescribedReps(prescribedEntry?.prescribedReps)}
          sets={allSets}
          onPlayVideo={onPlayVideo}
        />
      ) : null}

      {legacySessionVideo && onPlayVideo ? (
        <LegacyVideoButton
          name={exerciseName}
          url={legacySessionVideo}
          onPlayVideo={onPlayVideo}
        />
      ) : null}

      {notes ? <NoteQuote notes={notes} /> : null}
    </li>
  );
}

// ─── Tarjeta de sesión ──────────────────────────────────────────────────────

interface SessionCardProps {
  entry: SessionEntry;
  getLogsForExercise: (exerciseId: string) => ExerciseLog[];
  onPlayVideo: ((url: string, name: string) => void) | undefined;
}

function SessionCard({
  entry,
  getLogsForExercise,
  onPlayVideo,
}: SessionCardProps) {
  const [showRx, setShowRx] = useState(false);
  const showFuture = entry.classification === "future";

  // Actuals-first: whenever the client logged anything for this session, show
  // what they ACTUALLY did (the prescription folds behind a toggle).
  const hasLogs = entry.logs.length > 0;
  const showLoggedView = hasLogs && !showFuture;
  const loggedGroups = buildLoggedExerciseGroups(entry.prescribed, entry.logs);
  const onPlanGroups = loggedGroups.filter((g) => !g.offPlan);
  const offPlanGroups = loggedGroups.filter((g) => g.offPlan);
  const prescribedById = new Map(
    entry.prescribed.map((p) => [p.exerciseId, p])
  );

  // Stats del día: volumen y peso máximo salen de las series ejecutadas.
  const daySets = entry.logs.flatMap((l) => l.sets ?? []);
  const volume = Math.round(
    daySets.reduce((acc, s) => acc + (s.reps ?? 0) * (s.weight_kg ?? 0), 0)
  );
  const maxKg = daySets.reduce(
    (acc, s) =>
      typeof s.weight_kg === "number" && s.weight_kg > acc ? s.weight_kg : acc,
    0
  );

  const statusChip = classificationLabel(entry.classification);

  return (
    <section className="overflow-hidden rounded-large border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
        <p className="text-sm font-bold text-gray-900">
          {entry.scheduledSession.session?.name ?? "Sesión sin nombre"}
        </p>
        {statusChip.length > 0 ? (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              entry.classification === "complete"
                ? "bg-emerald-100 text-emerald-700"
                : entry.classification === "partial"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-500"
            }`}
          >
            {statusChip}
          </span>
        ) : null}
        {typeof entry.scheduledSession.scheduled_time === "string" &&
        entry.scheduledSession.scheduled_time.length > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 tabular-nums">
            <Icon icon="solar:clock-circle-linear" width={11} />
            Empezó {entry.scheduledSession.scheduled_time.slice(0, 5)}
          </span>
        ) : null}
        <span className="flex-1" />
        {showLoggedView && entry.prescribed.length > 0 ? (
          <button
            aria-expanded={showRx}
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-blue-600 transition-colors hover:text-blue-700"
            type="button"
            onClick={() => setShowRx((v) => !v)}
          >
            Ver prescripción
            <Icon
              icon={
                showRx
                  ? "solar:alt-arrow-up-linear"
                  : "solar:alt-arrow-down-linear"
              }
              width={13}
            />
          </button>
        ) : null}
      </header>

      {entry.scheduledSession.originally_prescribed_session ? (
        <div className="flex items-start gap-1.5 border-b border-gray-100 bg-gray-50/60 px-4 py-2 text-[11px] text-gray-600">
          <Icon
            className="mt-0.5 shrink-0"
            icon="solar:info-circle-linear"
            width={12}
          />
          <span>
            Originalmente prescrito:{" "}
            <span className="font-semibold">
              {entry.scheduledSession.originally_prescribed_session.name}
            </span>
            . El cliente cambió de sesión.
          </span>
        </div>
      ) : null}

      {showFuture ? (
        <p className="px-4 py-3 text-xs text-gray-500">
          Día programado — aún por entrenarse.
        </p>
      ) : (
        <StatStrip
          items={[
            {
              label: "Ejercicios",
              value: showLoggedView
                ? `${loggedGroups.length}${
                    entry.adherence.totalPrescribed > 0
                      ? ` de ${entry.adherence.totalPrescribed}`
                      : ""
                  }`
                : `0 de ${entry.adherence.totalPrescribed}`,
            },
            {
              label: "Series",
              value: showLoggedView
                ? `${daySets.length}${
                    entry.adherence.prescribedSetsTotal > 0
                      ? ` de ${entry.adherence.prescribedSetsTotal}`
                      : ""
                  }`
                : `0 de ${entry.adherence.prescribedSetsTotal}`,
            },
            {
              label: "Volumen",
              value: volume > 0 ? volume.toLocaleString("es-ES") : "—",
              ...(volume > 0 ? { unit: "kg·reps" } : {}),
            },
            {
              label: "Peso máx",
              value: maxKg > 0 ? formatKg(maxKg) : "—",
              ...(maxKg > 0 ? { unit: "kg" } : {}),
            },
          ]}
        />
      )}

      {/* Prescripción plegada (modo actuals): referencia, no protagonista. */}
      {showLoggedView && showRx && entry.prescribed.length > 0 ? (
        <div className="border-b border-gray-100 bg-gray-50/60 px-4 py-2.5">
          <ul className="flex flex-col gap-1">
            {entry.prescribed.map((p) => (
              <li
                key={p.exerciseId}
                className="text-[11px] text-gray-600 tabular-nums"
              >
                <span className="font-semibold text-gray-800">{p.name}</span>
                {" — "}
                {p.prescribedSets ?? "—"} × {p.prescribedReps ?? "—"}
                {p.prescribedWeightKg != null
                  ? ` @ ${p.prescribedWeightKg} kg`
                  : ""}
                {p.prescribedRir ? ` · RIR ${p.prescribedRir}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showLoggedView ? (
        <ul className="divide-y divide-gray-100">
          {onPlanGroups.map((g) => (
            <LoggedExerciseRow
              key={g.exerciseId}
              allTimeLogs={getLogsForExercise(g.exerciseId)}
              category={g.logs[0]?.exercises?.category}
              exerciseName={g.name}
              logs={g.logs}
              prescribedEntry={prescribedById.get(g.exerciseId) ?? null}
              onPlayVideo={onPlayVideo}
            />
          ))}
          {/* Prescritos que el cliente no tocó — visibles también en actuals. */}
          {entry.prescribed
            .filter(
              (p) => !onPlanGroups.some((g) => g.exerciseId === p.exerciseId)
            )
            .map((p) => (
              <PrescribedRow
                key={p.exerciseId}
                allTimeLogs={getLogsForExercise(p.exerciseId)}
                isFuture={false}
                logs={[]}
                prescribed={p}
                onPlayVideo={onPlayVideo}
              />
            ))}
        </ul>
      ) : entry.prescribed.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {entry.prescribed.map((p) => (
            <PrescribedRow
              key={p.exerciseId}
              allTimeLogs={getLogsForExercise(p.exerciseId)}
              isFuture={showFuture}
              logs={entry.logs}
              prescribed={p}
              onPlayVideo={onPlayVideo}
            />
          ))}
        </ul>
      ) : null}

      {/* Fuera de plan: tarjeta punteada (punteado = no prescrito). */}
      {showLoggedView && offPlanGroups.length > 0 ? (
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="rounded-large border border-dashed border-amber-300/70 bg-amber-50/30">
            <p className="flex items-center gap-1.5 px-4 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              <Icon icon="solar:add-circle-linear" width={12} />
              Fuera de plan
            </p>
            <ul className="divide-y divide-amber-100/60">
              {offPlanGroups.map((g) => (
                <LoggedExerciseRow
                  key={g.exerciseId}
                  allTimeLogs={getLogsForExercise(g.exerciseId)}
                  category={g.logs[0]?.exercises?.category}
                  exerciseName={g.name}
                  logs={g.logs}
                  prescribedEntry={null}
                  onPlayVideo={onPlayVideo}
                />
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ─── DayDetail (export principal) ───────────────────────────────────────────

interface Props {
  clientId: string;
  day: DayMetrics;
  orphanLogs: ExerciseLog[];
  /** Historial all-time por ejercicio (popover de métricas en cada fila). */
  getLogsForExercise: (exerciseId: string) => ExerciseLog[];
  onPlayVideo?: ((url: string, name: string) => void) | undefined;
}

export function DayDetail({
  clientId: _clientId,
  day,
  orphanLogs: _orphanLogs,
  getLogsForExercise,
  onPlayVideo,
}: Props) {
  // Día de descanso: sin sesiones en ninguna dirección.
  if (day.sessions.length === 0) {
    return (
      <section className="flex flex-col items-center gap-1.5 rounded-large border border-dashed border-gray-200 bg-gray-50/60 px-4 py-6 text-center">
        <Icon
          className="text-default-300"
          icon="solar:moon-stars-linear"
          width={22}
        />
        <p className="text-sm capitalize text-gray-600">
          {formatDateLong(day.date)} — día de descanso
          {day.recommendedSessionName != null
            ? ` · recomendado: ${day.recommendedSessionName}`
            : ""}
        </p>
      </section>
    );
  }

  // Sin línea de fecha sobre las tarjetas (la fecha ya se ve seleccionada en
  // la tira/grilla); el chip "Recomendado" se conserva solo cuando aplica.
  const showRecommended =
    day.recommendedSessionName != null &&
    !day.sessions.some(
      (s) => s.scheduledSession.session?.name === day.recommendedSessionName
    );

  return (
    <div className="flex flex-col gap-3">
      {showRecommended ? (
        <div className="flex justify-end">
          <span className="whitespace-nowrap rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
            Recomendado: {day.recommendedSessionName}
          </span>
        </div>
      ) : null}

      {day.sessions.map((entry) => (
        <SessionCard
          key={entry.scheduledSession.id}
          entry={entry}
          getLogsForExercise={getLogsForExercise}
          onPlayVideo={onPlayVideo}
        />
      ))}
    </div>
  );
}

// Capa de datos del surface unificado "Programa" (fuerza + cardio).
// Espeja las rutas /api/clients/[clientId]/programs/** tal como existen hoy:
// las respuestas NO usan el envelope {success, data} de meal-cycles sino
// {success, <clave>} (programs, session, sessionExercise, ...), así que cada
// fetcher lee su clave concreta. El GET de programas ya devuelve el árbol
// transformado (transformToWorkoutProgram corre en el servidor), por lo que
// aquí no re-transformamos: entregamos WorkoutProgram[] listo para render.

import type { Exercise, WorkoutProgram } from "@/types/training";

export type {
  WorkoutExercise,
  WorkoutProgram,
  WorkoutSession,
} from "@/types/training";

/** Fila cruda de la biblioteca de ejercicios (respuesta de /api/exercises). */
export type LibraryExercise = Exercise;

export type ProgramCategory = "strength" | "cardio";

// ─── Shapes de entrada ──────────────────────────────────────────────────────

/** Alta de programa. `division` aplica a fuerza; `goal` a cardio. */
export interface CreateProgramInput {
  name: string;
  type: string;
  category: ProgramCategory;
  division?: string;
  goal?: string;
  /** YYYY-MM-DD */
  startDate: string;
  sessionsPerWeek: number;
  notes?: string;
  /** Clona sesiones + ejercicios de esta plantilla al crear. */
  templateId?: string;
}

/** El PUT reescribe metadata al completo: enviar SIEMPRE el form entero. */
export type UpdateProgramInput = Omit<CreateProgramInput, "templateId">;

export interface CreatedProgramRefs {
  clientProgramId: string;
  programId: string;
}

/** Fila de `sessions` que devuelven los POST/PUT de sesiones. */
export interface SessionRow {
  id: string;
  program_id: string;
  name: string;
  session_order: number | null;
  session_type: string | null;
  metadata: Record<string, unknown> | null;
}

export interface SessionOrderItem {
  id: string;
  session_order: number;
}

export interface ExerciseOrderItem {
  id: string;
  exercise_order: number;
}

/**
 * Prescripción de un slot. La ruta reescribe columnas + metadata al completo
 * según el tipo de sesión: para fuerza enviar siempre sets/reps/tempo/rest/
 * trainingSystem; para cardio duration (min) y/o distance (km) + intensidad.
 */
export interface ExercisePrescription {
  // Fuerza
  sets?: number;
  reps?: string;
  tempo?: string;
  rest?: string;
  rir?: string;
  trainingSystem?: string;
  // Cardio — duration en minutos, distance en km, bpm min/max
  duration?: number;
  distance?: number;
  intensity?: string;
  minHeartRate?: number;
  maxHeartRate?: number;
  notes?: string;
}

/** Alta: el ejercicio de biblioteca es obligatorio (flujo library-only). */
export interface AddExerciseInput extends ExercisePrescription {
  exerciseId: string;
}

/** Edición: `exerciseId` presente y distinto = swap de ejercicio de biblioteca. */
export interface UpdateExerciseInput extends ExercisePrescription {
  exerciseId?: string;
}

/** Fila de `session_exercises` que devuelven los POST/PUT de ejercicios. */
export interface SessionExerciseRow {
  id: string;
  session_id: string;
  exercise_id: string;
  exercise_order: number;
}

/** Plantilla de programa según GET /api/templates?type=programs. */
export interface ProgramTemplate {
  id: string;
  name: string;
  description: string | null;
  templateType: "program";
  type: string;
  category: ProgramCategory;
  division?: string;
  goal?: string;
  sessionsPerWeek?: number;
  sessionCount: number;
  exerciseCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers puros ──────────────────────────────────────────────────────────

/** Reordena en cache las sesiones de un programa según el payload de PATCH. */
export function applySessionReorder(
  programs: WorkoutProgram[],
  programId: string,
  reorder: SessionOrderItem[]
): WorkoutProgram[] {
  const orderById = new Map(
    reorder.map((item) => [item.id, item.session_order])
  );

  return programs.map((program) => {
    if (program.programId !== programId) return program;

    const keyed = program.sessions.map((session, index) => ({
      session,
      key: orderById.get(session.id) ?? index + 1,
    }));

    keyed.sort((a, b) => a.key - b.key);

    return { ...program, sessions: keyed.map((entry) => entry.session) };
  });
}

/** Reordena en cache los ejercicios de una sesión según el payload de PATCH. */
export function applyExerciseReorder(
  programs: WorkoutProgram[],
  programId: string,
  sessionId: string,
  reorder: ExerciseOrderItem[]
): WorkoutProgram[] {
  const orderById = new Map(
    reorder.map((item) => [item.id, item.exercise_order])
  );

  return programs.map((program) => {
    if (program.programId !== programId) return program;

    return {
      ...program,
      sessions: program.sessions.map((session) => {
        if (session.id !== sessionId) return session;

        const keyed = session.exercises.map((exercise, index) => ({
          exercise,
          key:
            (exercise.id !== undefined
              ? orderById.get(exercise.id)
              : undefined) ?? index + 1,
        }));

        keyed.sort((a, b) => a.key - b.key);

        return {
          ...session,
          exercises: keyed.map((entry) => ({
            ...entry.exercise,
            order: entry.key,
          })),
        };
      }),
    };
  });
}

// ─── Capa fetch ─────────────────────────────────────────────────────────────

/** Lleva el status HTTP para que el caller pueda ramificar (409, 404, ...). */
export class TrainingApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TrainingApiError";
    this.status = status;
  }
}

/** Lee el body completo validando `success` (estas rutas no anidan en `data`). */
async function readBody<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (response.ok === false || data?.success !== true) {
    throw new TrainingApiError(data?.error ?? "Error de red", response.status);
  }

  return data as T;
}

function getJson<T>(url: string): Promise<T> {
  return fetch(url, { credentials: "same-origin", cache: "no-store" }).then(
    readBody<T>
  );
}

function sendJson<T>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: Record<string, unknown>
): Promise<T> {
  return fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }).then(readBody<T>);
}

const base = (clientId: string) => `/api/clients/${clientId}/programs`;

// ─── Programas ──────────────────────────────────────────────────────────────

/**
 * Programas ACTIVOS y PAUSADOS del cliente, de AMBAS categorías, ya
 * transformados a WorkoutProgram en el servidor (un solo GET sin `category`).
 * Antes se pedía `?status=active`, con lo que un programa desactivado
 * desaparecía sin forma de reactivarlo (llamada 29 Jul). No se piden
 * completed/cancelled: la UI no los muestra y cada programa extra multiplica
 * el fan-out por-programa del GET.
 */
export function fetchPrograms(clientId: string): Promise<WorkoutProgram[]> {
  return getJson<{ programs?: WorkoutProgram[] }>(
    `${base(clientId)}?status=active,paused`
  ).then((body) => body.programs ?? []);
}

function programBody(input: CreateProgramInput | UpdateProgramInput) {
  return {
    name: input.name,
    type: input.type,
    category: input.category,
    startDate: input.startDate,
    sessionsPerWeek: input.sessionsPerWeek,
    ...(input.division !== undefined ? { division: input.division } : {}),
    ...(input.goal !== undefined ? { goal: input.goal } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };
}

export function createProgram(
  clientId: string,
  input: CreateProgramInput
): Promise<CreatedProgramRefs> {
  return sendJson<CreatedProgramRefs>(base(clientId), "POST", {
    ...programBody(input),
    ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
  });
}

export function updateProgram(
  clientId: string,
  programId: string,
  input: UpdateProgramInput
): Promise<{ programId: string }> {
  return sendJson<{ programId: string }>(
    `${base(clientId)}?programId=${programId}`,
    "PUT",
    programBody(input)
  );
}

/** Borra programa + sesiones + ejercicios + asignación (cascada manual). */
export type ProgramStatus = "active" | "paused" | "completed" | "cancelled";

/** Cambia SOLO el estado (activar/desactivar) sin tocar metadata. */
export function updateProgramStatus(
  clientId: string,
  programId: string,
  status: ProgramStatus
): Promise<void> {
  return sendJson<Record<string, unknown>>(
    `${base(clientId)}?programId=${programId}`,
    "PATCH",
    { status }
  ).then(() => undefined);
}

export function deleteProgram(
  clientId: string,
  programId: string
): Promise<void> {
  return sendJson<void>(`${base(clientId)}?programId=${programId}`, "DELETE");
}

/** Clona el programa (sesiones + ejercicios) como plantilla reutilizable. */
export function saveProgramAsTemplate(
  programId: string,
  templateName: string
): Promise<{ templateId: string }> {
  return sendJson<{ templateId: string }>(
    `/api/programs/${programId}/save-as-template`,
    "POST",
    { templateName }
  );
}

// ─── Sesiones ───────────────────────────────────────────────────────────────

export function addSession(
  clientId: string,
  programId: string,
  input: {
    name: string;
    sessionType?: ProgramCategory;
    daysOfWeek?: (string | number)[];
  }
): Promise<SessionRow> {
  return sendJson<{ session: SessionRow }>(
    `${base(clientId)}/${programId}/sessions`,
    "POST",
    {
      name: input.name,
      ...(input.sessionType !== undefined
        ? { sessionType: input.sessionType }
        : {}),
      ...(input.daysOfWeek !== undefined
        ? { daysOfWeek: input.daysOfWeek }
        : {}),
    }
  ).then((body) => body.session);
}

/** Solo pisa los campos enviados; `daysOfWeek` se mergea en metadata. */
export function updateSession(
  clientId: string,
  programId: string,
  sessionId: string,
  patch: { name?: string; daysOfWeek?: (string | number)[] }
): Promise<SessionRow> {
  return sendJson<{ session: SessionRow }>(
    `${base(clientId)}/${programId}/sessions?sessionId=${sessionId}`,
    "PUT",
    {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.daysOfWeek !== undefined
        ? { daysOfWeek: patch.daysOfWeek }
        : {}),
    }
  ).then((body) => body.session);
}

export function deleteSession(
  clientId: string,
  programId: string,
  sessionId: string
): Promise<void> {
  return sendJson<void>(
    `${base(clientId)}/${programId}/sessions?sessionId=${sessionId}`,
    "DELETE"
  );
}

/** Clon profundo en el servidor; la copia queda justo debajo de la original. */
export function duplicateSession(
  clientId: string,
  programId: string,
  sessionId: string,
  name?: string
): Promise<{ session: SessionRow; exercisesCloned: number }> {
  return sendJson<{ session: SessionRow; exercisesCloned: number }>(
    `${base(clientId)}/${programId}/sessions/${sessionId}/duplicate`,
    "POST",
    name !== undefined ? { name } : {}
  );
}

export function reorderSessions(
  clientId: string,
  programId: string,
  reorder: SessionOrderItem[]
): Promise<void> {
  return sendJson<void>(`${base(clientId)}/${programId}/sessions`, "PATCH", {
    reorder,
  });
}

// ─── Ejercicios de sesión ───────────────────────────────────────────────────

function exerciseBody(input: UpdateExerciseInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (input.exerciseId !== undefined) body.exerciseId = input.exerciseId;
  if (input.sets !== undefined) body.sets = input.sets;
  if (input.reps !== undefined) body.reps = input.reps;
  if (input.tempo !== undefined) body.tempo = input.tempo;
  if (input.rest !== undefined) body.rest = input.rest;
  if (input.rir !== undefined) body.rir = input.rir;
  if (input.trainingSystem !== undefined)
    body.trainingSystem = input.trainingSystem;
  if (input.duration !== undefined) body.duration = input.duration;
  if (input.distance !== undefined) body.distance = input.distance;
  if (input.intensity !== undefined) body.intensity = input.intensity;
  if (input.minHeartRate !== undefined) body.minHeartRate = input.minHeartRate;
  if (input.maxHeartRate !== undefined) body.maxHeartRate = input.maxHeartRate;
  if (input.notes !== undefined) body.notes = input.notes;

  return body;
}

export function addExercise(
  clientId: string,
  programId: string,
  sessionId: string,
  input: AddExerciseInput
): Promise<SessionExerciseRow> {
  return sendJson<{ sessionExercise: SessionExerciseRow }>(
    `${base(clientId)}/${programId}/sessions/${sessionId}/exercises`,
    "POST",
    exerciseBody(input)
  ).then((body) => body.sessionExercise);
}

/** `sessionExerciseId` es el id de la fila session_exercises (NO el de biblioteca). */
export function updateExercise(
  clientId: string,
  programId: string,
  sessionId: string,
  sessionExerciseId: string,
  input: UpdateExerciseInput
): Promise<SessionExerciseRow> {
  return sendJson<{ sessionExercise: SessionExerciseRow }>(
    `${base(clientId)}/${programId}/sessions/${sessionId}/exercises?exerciseId=${sessionExerciseId}`,
    "PUT",
    exerciseBody(input)
  ).then((body) => body.sessionExercise);
}

export function deleteExercise(
  clientId: string,
  programId: string,
  sessionId: string,
  sessionExerciseId: string
): Promise<void> {
  return sendJson<void>(
    `${base(clientId)}/${programId}/sessions/${sessionId}/exercises?exerciseId=${sessionExerciseId}`,
    "DELETE"
  );
}

/** Clona un ejercicio con su prescripción completa, justo debajo del original. */
export function duplicateExercise(
  clientId: string,
  programId: string,
  sessionId: string,
  sessionExerciseId: string
): Promise<SessionExerciseRow> {
  return sendJson<{ exercise: SessionExerciseRow }>(
    `${base(clientId)}/${programId}/sessions/${sessionId}/exercises/duplicate`,
    "POST",
    { sessionExerciseId }
  ).then((body) => body.exercise);
}

export function reorderExercises(
  clientId: string,
  programId: string,
  sessionId: string,
  reorder: ExerciseOrderItem[]
): Promise<void> {
  return sendJson<void>(
    `${base(clientId)}/${programId}/sessions/${sessionId}/exercises`,
    "PATCH",
    { reorder }
  );
}

// ─── Biblioteca y plantillas ────────────────────────────────────────────────

/** Busca/lista la biblioteca del trainer (sin filtro de categoría = todas). */
export function searchExerciseLibrary(params: {
  search?: string;
  category?: "cardio";
  limit?: number;
}): Promise<LibraryExercise[]> {
  const query = new URLSearchParams();

  if (params.search !== undefined) query.set("search", params.search);
  if (params.category !== undefined) query.set("category", params.category);
  if (params.limit !== undefined) query.set("limit", String(params.limit));

  return getJson<{ exercises?: LibraryExercise[] }>(
    `/api/exercises?${query.toString()}`
  ).then((body) => body.exercises ?? []);
}

export function listProgramTemplates(
  category?: ProgramCategory
): Promise<ProgramTemplate[]> {
  const query = new URLSearchParams({ type: "programs" });

  if (category !== undefined) query.set("category", category);

  return getJson<{ templates?: ProgramTemplate[] }>(
    `/api/templates?${query.toString()}`
  ).then((body) => body.templates ?? []);
}

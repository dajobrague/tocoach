// Training-related utility functions

import type {
  ClientProgram,
  Program,
  ScheduledSession,
  Session,
  SessionExercise,
  WorkoutExercise,
  WorkoutProgram,
  WorkoutSession,
} from "@/types/training";

import { formatRestTime } from "@/lib/utils/exercise-utils";

type WeekdayAbbr = WorkoutSession["dayOfWeek"][number];

/** Resolve coaching fields from session row + library exercise (handles split storage paths). */
function resolveStrengthCoachingFields(
  se: SessionExercise & { exercise?: Record<string, unknown> | null }
): {
  tempo: string;
  rest: string;
  rir: string;
  trainingSystem: string;
  notes?: string;
} {
  const meta =
    se.metadata && typeof se.metadata === "object"
      ? (se.metadata as Record<string, unknown>)
      : {};

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const tempo = str(meta.tempo) || "";

  const rir = str(meta.rir) || "";

  const trainingSystem =
    str(meta.training_system) || str(meta.trainingSystem) || "";

  let rest = str(meta.rest_description) || str(meta.restDescription) || "";

  if (!rest) {
    const rs = se.rest_seconds;

    if (typeof rs === "number" && rs > 0) {
      rest = formatRestTime(rs);
    }
  }

  const fromColumn = str(se.notes);
  const fromMeta = str(meta.notes);
  const notesCombined = fromColumn || fromMeta;

  return {
    tempo,
    rest,
    rir,
    trainingSystem,
    ...(notesCombined ? { notes: notesCombined } : {}),
  };
}

/**
 * Calculate the current week number based on start date
 * @param startDate - ISO date string (YYYY-MM-DD)
 * @returns Formatted week string like "Semana 20" or "Completado"
 */
export function calculateCurrentWeek(
  startDate: string,
  status: "active" | "completed" | "paused" | "cancelled"
): string {
  if (status === "completed") {
    return "Completado";
  }

  const start = new Date(startDate);
  const now = new Date();

  // Calculate difference in milliseconds
  const diffMs = now.getTime() - start.getTime();

  // Convert to days and then to weeks (round up)
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weekNumber = Math.ceil(diffDays / 7);

  // Handle edge cases
  if (weekNumber < 1) {
    return "Semana 1";
  }

  return `Semana ${weekNumber}`;
}

/** Spanish abbreviations aligned with `Date#getDay()` index 0 = Sunday. */
const SPANISH_DAY_ABBR = [
  "Dom",
  "Lun",
  "Mar",
  "Mie",
  "Jue",
  "Vie",
  "Sab",
] as const;

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/**
 * Format day of week abbreviation
 * @param day - Full day name or abbreviation
 * @returns Spanish abbreviated day
 */
export function formatDayOfWeek(
  day?: string
): "Lun" | "Mar" | "Mie" | "Jue" | "Vie" | "Sab" | "Dom" {
  if (!day) return "Lun";

  const normalized = stripAccents(day.trim()).toLowerCase();

  const dayMap: Record<
    string,
    "Lun" | "Mar" | "Mie" | "Jue" | "Vie" | "Sab" | "Dom"
  > = {
    monday: "Lun",
    tuesday: "Mar",
    wednesday: "Mie",
    thursday: "Jue",
    friday: "Vie",
    saturday: "Sab",
    sunday: "Dom",
    lunes: "Lun",
    martes: "Mar",
    miércoles: "Mie",
    miercoles: "Mie",
    jueves: "Jue",
    viernes: "Vie",
    sábado: "Sab",
    sabado: "Sab",
    domingo: "Dom",
    lun: "Lun",
    mar: "Mar",
    mie: "Mie",
    mier: "Mie",
    jue: "Jue",
    vie: "Vie",
    sab: "Sab",
    dom: "Dom",
  };

  const direct = dayMap[normalized];

  if (direct) return direct;

  const three = normalized.slice(0, 3);

  if (dayMap[three]) return dayMap[three];

  // English / Spanish short prefixes (handles "mon", "thu", "mie", "mié" stripped, etc.)
  if (normalized.startsWith("sun") || normalized.startsWith("dom"))
    return "Dom";
  if (normalized.startsWith("mon") || normalized.startsWith("lun"))
    return "Lun";
  if (normalized.startsWith("tue") || normalized.startsWith("mar"))
    return "Mar";
  if (
    normalized.startsWith("wed") ||
    normalized.startsWith("mie") ||
    normalized.startsWith("mier")
  )
    return "Mie";
  if (normalized.startsWith("thu") || normalized.startsWith("jue"))
    return "Jue";
  if (normalized.startsWith("fri") || normalized.startsWith("vie"))
    return "Vie";
  if (normalized.startsWith("sat") || normalized.startsWith("sab"))
    return "Sab";

  return "Lun";
}

/**
 * Coerce session `metadata.days_of_week` from DB (0–6, strings EN/ES, abbrevs) to Spanish abbrevs.
 */
export function normalizeWorkoutDaysOfWeek(
  raw: unknown
): WorkoutSession["dayOfWeek"] {
  if (raw == null) return ["Lun"];
  const list = Array.isArray(raw) ? raw : [raw];
  const out: WeekdayAbbr[] = [];

  for (const item of list) {
    if (
      typeof item === "number" &&
      Number.isInteger(item) &&
      item >= 0 &&
      item <= 6
    ) {
      out.push(SPANISH_DAY_ABBR[item]!);
    } else if (typeof item === "string" && item.trim()) {
      out.push(formatDayOfWeek(item));
    }
  }

  const unique = [...new Set(out)];

  return unique.length > 0 ? unique : ["Lun"];
}

/**
 * Whether a calendar day (Spanish abbr from local Date, e.g. "Lun") matches a stored session day token.
 */
export function sessionCalendarDayMatches(
  calendarDayAbbr: string,
  sessionDayToken: unknown
): boolean {
  const cal = (calendarDayAbbr || "").slice(0, 3);

  if (cal.length < 2) return false;

  let sessionAbbr: string;

  if (
    typeof sessionDayToken === "number" &&
    Number.isInteger(sessionDayToken) &&
    sessionDayToken >= 0 &&
    sessionDayToken <= 6
  ) {
    sessionAbbr = SPANISH_DAY_ABBR[sessionDayToken]!;
  } else if (typeof sessionDayToken === "string") {
    sessionAbbr = formatDayOfWeek(sessionDayToken);
  } else {
    return false;
  }

  return sessionAbbr === cal;
}

/**
 * Transform database ClientProgram to UI WorkoutProgram
 */
export function transformToWorkoutProgram(
  clientProgram: ClientProgram & { program: Program },
  sessions: (Session & {
    session_exercises: (SessionExercise & { exercise: any })[];
  })[],
  scheduledSessions: ScheduledSession[]
): WorkoutProgram {
  const program = clientProgram.program;

  // Transform sessions
  const workoutSessions: WorkoutSession[] = sessions.map((session) => {
    // Check if this session has been completed this week
    const isCompleted = scheduledSessions.some(
      (ss) => ss.session_id === session.id && ss.status === "completed"
    );

    // Transform exercises (handle both strength and cardio)
    const exercises: WorkoutExercise[] = session.session_exercises
      .sort((a, b) => a.exercise_order - b.exercise_order)
      .map((se) => {
        const isCardio =
          se.exercise?.category === "cardio" ||
          session.session_type === "cardio";

        if (isCardio) {
          const cm =
            se.metadata && typeof se.metadata === "object"
              ? (se.metadata as Record<string, unknown>)
              : {};
          const noteCol = typeof se.notes === "string" ? se.notes.trim() : "";
          const noteMeta = typeof cm.notes === "string" ? cm.notes.trim() : "";
          const cardioNotes = noteCol || noteMeta || undefined;

          // Transform cardio exercise
          const cardioExercise: WorkoutExercise = {
            order: se.exercise_order,
            name: se.exercise?.name || "Ejercicio sin nombre",
            category: se.exercise?.category || "cardio",
            sets: 0,
            reps: "",
            tempo: "",
            rest: "",
            trainingSystem: "",
            // Cardio-specific fields
            duration: se.duration_seconds
              ? Math.round(se.duration_seconds / 60)
              : 0,
            distance: se.distance_meters
              ? Math.round((se.distance_meters / 1000) * 10) / 10
              : 0,
            ...(se.metadata?.intensity
              ? { intensity: se.metadata.intensity }
              : {}),
            ...(se.metadata?.heart_rate_min && se.metadata?.heart_rate_max
              ? {
                  heartRateZone: {
                    min: se.metadata.heart_rate_min,
                    max: se.metadata.heart_rate_max,
                  },
                }
              : {}),
            ...(se.metadata?.cardio_type
              ? { cardioType: se.metadata.cardio_type }
              : {}),
            description: se.exercise?.description || undefined,
            notes: cardioNotes,
            ...(se.exercise?.video_url
              ? { videoUrl: se.exercise.video_url }
              : {}),
            ...(se.exercise?.uploaded_video_url
              ? { uploadedVideoUrl: se.exercise.uploaded_video_url }
              : {}),
            ...(se.exercise?.image_url
              ? { imageUrl: se.exercise.image_url }
              : {}),
            ...(se.id ? { id: se.id } : {}),
            ...(se.exercise_id ? { exercise_id: se.exercise_id } : {}),
          };

          return cardioExercise;
        } else {
          const coaching = resolveStrengthCoachingFields(se);

          // Transform strength exercise
          return {
            order: se.exercise_order,
            name: se.exercise?.name || "Ejercicio sin nombre",
            category: se.exercise?.category || "strength",
            sets: se.sets || 0,
            reps: se.reps || "0",
            tempo: coaching.tempo,
            rest: coaching.rest,
            rir: coaching.rir,
            trainingSystem: coaching.trainingSystem,
            description: se.exercise?.description || undefined,
            notes: coaching.notes,
            videoUrl: se.exercise?.video_url,
            uploadedVideoUrl: se.exercise?.uploaded_video_url,
            imageUrl: se.exercise?.image_url,
            id: se.id,
            exercise_id: se.exercise_id,
          };
        }
      });

    const rawScheduleDays =
      session.metadata?.days_of_week != null
        ? session.metadata.days_of_week
        : session.metadata?.day_of_week != null
          ? [session.metadata.day_of_week]
          : null;
    const dayOfWeek = normalizeWorkoutDaysOfWeek(rawScheduleDays);

    return {
      id: session.id,
      dayOfWeek,
      name: session.name,
      completed: isCompleted,
      exercises,
    };
  });

  return {
    id: clientProgram.id,
    clientProgramId: clientProgram.id,
    programId: program.id,
    name: program.name,
    type: (program.metadata?.type as any) || "Strength",
    category: program.metadata?.category || "strength",
    division: program.metadata?.division || "Full Body",
    currentWeek: calculateCurrentWeek(
      clientProgram.start_date,
      clientProgram.status
    ),
    sessionsPerWeek: program.metadata?.sessions_per_week || sessions.length,
    assignedDate: clientProgram.start_date,
    lastModified: clientProgram.updated_at,
    progress: clientProgram.progress_percentage,
    status: clientProgram.status === "active" ? "active" : "completed",
    notes: clientProgram.notes,
    sessions: workoutSessions,
  };
}

/**
 * Format date to Spanish locale
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);

  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Get the current week's date range
 */
export function getCurrentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Calculate Monday of current week
  const monday = new Date(now);

  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  // Calculate Sunday of current week
  const sunday = new Date(monday);

  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

/**
 * Validate exercise form data
 */
export function validateExerciseForm(form: {
  name: string;
  sets: string;
  reps: string;
  tempo: string;
  rest: string;
  trainingSystem: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!form.name || form.name.trim() === "") {
    errors.push("El nombre del ejercicio es requerido");
  }

  if (!form.sets || parseInt(form.sets) < 1) {
    errors.push("El número de series debe ser mayor a 0");
  }

  if (!form.reps || form.reps.trim() === "") {
    errors.push("Las repeticiones son requeridas");
  }

  if (!form.tempo || form.tempo.trim() === "") {
    errors.push("El tempo es requerido");
  }

  if (!form.rest || form.rest.trim() === "") {
    errors.push("El descanso es requerido");
  }

  if (!form.trainingSystem || form.trainingSystem.trim() === "") {
    errors.push("El sistema de entrenamiento es requerido");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate program form data
 */
export function validateProgramForm(form: {
  name: string;
  division: string;
  type: string;
  startDate: string;
  sessionsPerWeek: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!form.name || form.name.trim() === "") {
    errors.push("El nombre del programa es requerido");
  }

  if (!form.division || form.division.trim() === "") {
    errors.push("La división es requerida");
  }

  if (!form.type || form.type.trim() === "") {
    errors.push("El tipo de programa es requerido");
  }

  if (!form.startDate || form.startDate.trim() === "") {
    errors.push("La fecha de inicio es requerida");
  }

  if (
    !form.sessionsPerWeek ||
    parseInt(form.sessionsPerWeek) < 1 ||
    parseInt(form.sessionsPerWeek) > 7
  ) {
    errors.push("Las sesiones por semana deben ser entre 1 y 7");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate session form data
 */
export function validateSessionForm(form: {
  name: string;
  dayOfWeek: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!form.name || form.name.trim() === "") {
    errors.push("El nombre de la sesión es requerido");
  }

  if (!form.dayOfWeek || form.dayOfWeek.trim() === "") {
    errors.push("El día de la semana es requerido");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate cardio exercise form data
 */
export function validateCardioExerciseForm(form: {
  name: string;
  type: string;
  duration?: string;
  distance?: string;
  intensity: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!form.name || form.name.trim() === "") {
    errors.push("El nombre del ejercicio es requerido");
  }

  if (!form.type || form.type.trim() === "") {
    errors.push("El tipo de actividad es requerido");
  }

  if (!form.intensity || form.intensity.trim() === "") {
    errors.push("La intensidad es requerida");
  }

  // At least one of duration or distance should be provided
  if (
    (!form.duration || form.duration.trim() === "") &&
    (!form.distance || form.distance.trim() === "")
  ) {
    errors.push("Debe proporcionar al menos duración o distancia");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate cardio program form data
 */
export function validateCardioProgramForm(form: {
  name: string;
  type: string;
  goal: string;
  startDate: string;
  sessionsPerWeek: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!form.name || form.name.trim() === "") {
    errors.push("El nombre del programa es requerido");
  }

  if (!form.type || form.type.trim() === "") {
    errors.push("El tipo de programa es requerido");
  }

  if (!form.goal || form.goal.trim() === "") {
    errors.push("El objetivo del programa es requerido");
  }

  if (!form.startDate || form.startDate.trim() === "") {
    errors.push("La fecha de inicio es requerida");
  }

  if (
    !form.sessionsPerWeek ||
    parseInt(form.sessionsPerWeek) < 1 ||
    parseInt(form.sessionsPerWeek) > 7
  ) {
    errors.push("Las sesiones por semana deben ser entre 1 y 7");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

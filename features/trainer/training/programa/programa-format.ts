// Helpers puros de presentación del surface "Programa": mapa de estados,
// visual por categoría, fechas es-ES y líneas de prescripción compactas.

import type {
  ProgramCategory,
  UpdateProgramInput,
  WorkoutExercise,
  WorkoutProgram,
} from "./training-api";

type ChipColor = "default" | "success" | "warning" | "danger";

export interface ProgramStatusVisual {
  label: string;
  color: ChipColor;
  dot: string;
}

const STATUS_FALLBACK: ProgramStatusVisual = {
  label: "Activo",
  color: "success",
  dot: "bg-success-500",
};

const STATUS_MAP: Record<string, ProgramStatusVisual> = {
  active: STATUS_FALLBACK,
  paused: { label: "Pausado", color: "warning", dot: "bg-warning-400" },
  completed: { label: "Completado", color: "default", dot: "bg-gray-300" },
  cancelled: { label: "Cancelado", color: "danger", dot: "bg-danger-400" },
};

export function programStatus(status: string): ProgramStatusVisual {
  return STATUS_MAP[status] ?? STATUS_FALLBACK;
}

export interface CategoryVisual {
  label: string;
  icon: string;
  /** Cuadrado de icono (fila de sesión / círculo de cabecera). */
  square: string;
  dot: string;
}

export const CATEGORY_VISUAL: Record<ProgramCategory, CategoryVisual> = {
  strength: {
    label: "Fuerza",
    icon: "solar:dumbbell-bold",
    square: "bg-slate-100 text-slate-700",
    dot: "bg-slate-500",
  },
  cardio: {
    label: "Cardio",
    icon: "solar:heart-pulse-bold",
    square: "bg-rose-50 text-rose-600",
    dot: "bg-rose-500",
  },
};

export function programCategory(program: WorkoutProgram): ProgramCategory {
  return program.category === "cardio" ? "cardio" : "strength";
}

/** "12 jul 2026" — es-ES corto; devuelve el valor crudo si no parsea. */
export function formatDateEs(iso: string): string {
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);

  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** La intensidad se guardó en español o inglés según la época; normaliza. */
function intensityLabel(raw: string): string {
  const map: Record<string, string> = {
    low: "Baja",
    baja: "Baja",
    moderate: "Moderada",
    moderada: "Moderada",
    high: "Alta",
    alta: "Alta",
    interval: "Por Intervalos",
    "por intervalos": "Por Intervalos",
  };

  return map[raw.toLowerCase()] ?? raw;
}

/**
 * Línea compacta de prescripción. Fuerza: "4 × 8-10 · desc. 2 min · RIR 2 ·
 * tempo 3-1-1". Cardio: "40 min · 8 km · Moderada · 120-135 bpm". Omite las
 * partes vacías; devuelve "" si no hay nada que mostrar.
 */
export function prescriptionLine(
  exercise: WorkoutExercise,
  category: ProgramCategory
): string {
  const parts: string[] = [];

  if (category === "cardio") {
    if (exercise.duration !== undefined && exercise.duration > 0) {
      parts.push(`${exercise.duration} min`);
    }
    if (exercise.distance !== undefined && exercise.distance > 0) {
      parts.push(`${exercise.distance} km`);
    }
    if (exercise.intensity !== undefined && exercise.intensity.length > 0) {
      parts.push(intensityLabel(exercise.intensity));
    }
    if (exercise.heartRateZone !== undefined) {
      parts.push(
        `${exercise.heartRateZone.min}-${exercise.heartRateZone.max} bpm`
      );
    }

    return parts.join(" · ");
  }

  if (exercise.sets > 0 && exercise.reps.length > 0 && exercise.reps !== "0") {
    parts.push(`${exercise.sets} × ${exercise.reps}`);
  } else if (exercise.sets > 0) {
    parts.push(`${exercise.sets} series`);
  }
  if (exercise.rest.length > 0) parts.push(`desc. ${exercise.rest}`);
  if (exercise.rir !== undefined && exercise.rir.length > 0) {
    parts.push(`RIR ${exercise.rir}`);
  }
  if (exercise.tempo.length > 0) parts.push(`tempo ${exercise.tempo}`);

  return parts.join(" · ");
}

/** Días del microciclo asignados a una sesión, ordenados. */
export function sessionDays(
  slotByDay: Map<number, string | null>,
  sessionId: string
): number[] {
  const days: number[] = [];

  for (const [day, id] of slotByDay.entries()) {
    if (id === sessionId) days.push(day);
  }

  return days.sort((a, b) => a - b);
}

/** "Día 1, 4" o null si la sesión no está asignada a ningún día. */
export function sessionDayLabel(
  slotByDay: Map<number, string | null>,
  sessionId: string
): string | null {
  const days = sessionDays(slotByDay, sessionId);

  if (days.length === 0) return null;

  return `Día ${days.join(", ")}`;
}

/**
 * Reconstruye el form COMPLETO del programa para updateProgram — el PUT
 * reescribe metadata al completo, así que cualquier mutación parcial (p.ej.
 * el rename inline) debe enviar todos los campos actuales. Nota: el GET
 * transformado no expone `goal`, así que en cardio se lee de forma laxa
 * (misma limitación que el tab actual).
 */
export function programToUpdateInput(
  program: WorkoutProgram
): UpdateProgramInput {
  const category = programCategory(program);
  const goal = (program as { goal?: string }).goal;

  return {
    name: program.name,
    type: program.type,
    category,
    startDate: program.assignedDate.slice(0, 10),
    sessionsPerWeek: program.sessionsPerWeek,
    ...(category === "strength" && program.division.length > 0
      ? { division: program.division }
      : {}),
    ...(category === "cardio" && goal !== undefined && goal.length > 0
      ? { goal }
      : {}),
    ...(program.notes !== undefined && program.notes.length > 0
      ? { notes: program.notes }
      : {}),
  };
}

// ─── Selección por categoría (Loom JC, 10 sep) ──────────────────────────────

export type SelectedByCategory = Record<ProgramCategory, string | null>;

export interface CategorySelection {
  /** Programa que muestra cada card: el elegido a mano en esa categoría; si
   *  no, el primer activo; si no, el primer pausado (para poder reactivarlo). */
  byCategory: Record<ProgramCategory, WorkoutProgram | null>;
  /** Card que manda sobre la cabecera, los modales y el drawer. Si la
   *  categoría enfocada no tiene programa, pasa a la otra. */
  focused: ProgramCategory;
}

export function pickByCategory(
  programs: WorkoutProgram[],
  selectedIds: SelectedByCategory,
  focus: ProgramCategory
): CategorySelection {
  const pick = (category: ProgramCategory): WorkoutProgram | null => {
    const own = programs.filter(
      (program) =>
        programCategory(program) === category &&
        (program.status === "active" || program.status === "paused")
    );

    return (
      own.find((program) => program.programId === selectedIds[category]) ??
      own.find((program) => program.status === "active") ??
      own[0] ??
      null
    );
  };
  const byCategory = { strength: pick("strength"), cardio: pick("cardio") };
  const other: ProgramCategory = focus === "strength" ? "cardio" : "strength";
  const focused =
    byCategory[focus] !== null || byCategory[other] === null ? focus : other;

  return { byCategory, focused };
}

/** Colores de los tiles Fuerza | Cardio (modal de programa) y de las pestañas
 *  del selector de sesión del día: misma paleta en los dos sitios. */
export const CATEGORY_TILE: Record<
  ProgramCategory,
  { hint: string; selected: string; accent: string; iconWrap: string }
> = {
  strength: {
    hint: "Pesas, máquinas y resistencia",
    selected: "border-slate-500 bg-slate-100 shadow-md",
    accent: "text-slate-700",
    iconWrap: "bg-slate-200",
  },
  cardio: {
    hint: "Carrera, bici, HIIT y resistencia",
    selected: "border-rose-500 bg-rose-50 shadow-md",
    accent: "text-rose-600",
    iconWrap: "bg-rose-200",
  },
};

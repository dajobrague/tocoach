/**
 * Client-side drafts for the exercise log modal so in-progress entries survive
 * app backgrounding, tab reloads, and navigation away before "Guardar".
 */

const PREFIX = "tc_exercise_log_draft:";
/** Drop drafts older than this so stale data does not override fresh server logs. */
const DRAFT_TTL_MS = 48 * 60 * 60 * 1000;

export type SetDraft = {
  reps: string;
  weight: string;
};

export type ExerciseLogFormDraft = {
  sets: SetDraft[];
  durationCompleted: string;
  distanceCompleted: string;
  intensityCompleted: string;
  avgHeartRate: string;
  notes: string;
};

export function exerciseLogDraftStorageKey(
  clientId: string,
  sessionId: string,
  exerciseId: string,
  scheduledDate: string
): string {
  return `${PREFIX}${clientId}:${sessionId}:${exerciseId}:${scheduledDate}`;
}

export type ExerciseLogDraftRead = {
  formData: ExerciseLogFormDraft;
  updatedAt: number;
};

export function readExerciseLogDraft(key: string): ExerciseLogDraftRead | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);

    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      formData?: ExerciseLogFormDraft;
      updatedAt?: number;
    };

    if (!parsed?.formData || typeof parsed.formData !== "object") {
      return null;
    }
    const updatedAt =
      typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0;

    if (Date.now() - updatedAt > DRAFT_TTL_MS) {
      sessionStorage.removeItem(key);

      return null;
    }

    return { formData: parsed.formData, updatedAt };
  } catch {
    return null;
  }
}

export function writeExerciseLogDraft(
  key: string,
  formData: ExerciseLogFormDraft
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ formData, updatedAt: Date.now() })
    );
  } catch {
    // Quota or private mode — ignore
  }
}

export function clearExerciseLogDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

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
  // Video opcional por serie. videoUrl es lo que se muestra/guarda;
  // videoPath sirve para borrar del storage si el usuario lo cambia
  // antes de hacer Save. Ambos quedan undefined cuando no hay video.
  videoUrl?: string;
  videoPath?: string;
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
  /** Fingerprint of the prescription the draft was authored against. */
  prescriptionSignature?: string;
};

export function readExerciseLogDraft(key: string): ExerciseLogDraftRead | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);

    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      formData?: ExerciseLogFormDraft;
      updatedAt?: number;
      prescriptionSignature?: string;
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

    return {
      formData: parsed.formData,
      updatedAt,
      ...(parsed.prescriptionSignature
        ? { prescriptionSignature: parsed.prescriptionSignature }
        : {}),
    };
  } catch {
    return null;
  }
}

export function writeExerciseLogDraft(
  key: string,
  formData: ExerciseLogFormDraft,
  prescriptionSignature?: string
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        formData,
        updatedAt: Date.now(),
        ...(prescriptionSignature ? { prescriptionSignature } : {}),
      })
    );
  } catch {
    // Quota or private mode — ignore
  }
}

/**
 * Fingerprint of a prescription. When the trainer edits an override the
 * fingerprint changes, so any draft cached against the old prescription is
 * detectable as stale and discarded (otherwise the empty draft from before
 * the override was saved would silently override the new prefilled values).
 *
 * Cheap stringify is enough — these arrays are O(20 sets) and the signature
 * is only computed at modal open / draft persist.
 */
export function buildPrescriptionSignature(input: {
  sets?: number | null;
  reps?: string | null;
  weightKg?: number | null;
  prescribedSets?: Array<{
    setNumber: number;
    reps: string | null;
    weightKg: number | null;
  }>;
  duration?: number | null;
  distance?: number | null;
  intensity?: string | null;
}): string {
  if (input.prescribedSets && input.prescribedSets.length > 0) {
    const flat = input.prescribedSets
      .map((s) => `${s.setNumber}:${s.reps ?? ""}:${s.weightKg ?? ""}`)
      .join("|");

    return `ps:${flat}`;
  }

  return [
    "u",
    input.sets ?? "",
    input.reps ?? "",
    input.weightKg ?? "",
    input.duration ?? "",
    input.distance ?? "",
    input.intensity ?? "",
  ].join(":");
}

export function clearExerciseLogDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

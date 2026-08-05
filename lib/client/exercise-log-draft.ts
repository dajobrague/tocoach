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

/**
 * El writer del server dedupea por session_exercises.id, así que dos slots
 * con el mismo exercise_id en una sesión necesitan drafts SEPARADOS (si no,
 * lo tipeado en un slot hidrata el otro y se atribuye al slot equivocado).
 * El slot viaja embebido en el segmento exerciseId de la key
 * ("<exerciseId>@<sessionExerciseId>") para no cambiar la aridad de
 * exerciseLogDraftStorageKey. "@" no aparece en UUIDs ni en el resto de
 * segmentos, así que el sufijo es reversible (ver legacyDraftKey).
 */
export function slotScopedExerciseId(
  exerciseId: string,
  sessionExerciseId?: string | null
): string {
  return sessionExerciseId ? `${exerciseId}@${sessionExerciseId}` : exerciseId;
}

/** Key equivalente sin slot (formato pre-scoping), o null si no lleva slot. */
function legacyDraftKey(key: string): string | null {
  if (!key.includes("@")) return null;

  return key.replace(/@[^:@]*/, "");
}

export type ExerciseLogDraftRead = {
  formData: ExerciseLogFormDraft;
  updatedAt: number;
  /** Fingerprint of the prescription the draft was authored against. */
  prescriptionSignature?: string;
};

export function readExerciseLogDraft(key: string): ExerciseLogDraftRead | null {
  const direct = readDraftAt(key);

  if (direct) return direct;
  // Fallback: drafts escritos antes del scoping por slot viven bajo la key
  // sin "@slot". Se migran leyéndolos una única vez y borrando la entrada
  // legacy, para que no contaminen el OTRO slot del mismo ejercicio (el
  // debounce del hook re-persiste el contenido bajo la key nueva).
  const legacy = legacyDraftKey(key);

  if (!legacy) return null;
  const fallback = readDraftAt(legacy);

  if (fallback) clearExerciseLogDraft(legacy);

  return fallback;
}

function readDraftAt(key: string): ExerciseLogDraftRead | null {
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
  duration?: number | null;
  distance?: number | null;
  intensity?: string | null;
  rest?: string | null;
  tempo?: string | null;
  cardioType?: string | null;
  heartRateZone?: { min?: number | null; max?: number | null } | null;
  trainingSystem?: string | null;
}): string {
  // Campos extra de cardio/coaching: si el trainer edita SOLO uno de
  // estos (e.g. cambia el tempo de 30-0-30 a 20-1-20), la signature
  // antes seguía igual y el draft cacheado pisaba la prescripción
  // nueva en silencio. Incluirlos asegura que invalidación es completa.
  const hrz = input.heartRateZone
    ? `${input.heartRateZone.min ?? ""}-${input.heartRateZone.max ?? ""}`
    : "";
  const tail = [
    input.duration ?? "",
    input.distance ?? "",
    input.intensity ?? "",
    input.rest ?? "",
    input.tempo ?? "",
    input.cardioType ?? "",
    hrz,
    input.trainingSystem ?? "",
  ].join(":");

  return [
    "u",
    input.sets ?? "",
    input.reps ?? "",
    input.weightKg ?? "",
    tail,
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

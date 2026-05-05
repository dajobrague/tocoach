// Encapsula el estado del formulario + la persistencia de draft entre
// aperturas del modal. Hidrata desde existingLog y/o draft local cuando
// se abre, y persiste con debounce mientras el usuario escribe.
// También arma la regla "draft más nuevo que el log servidor gana", que
// evita pisar cambios locales aún no guardados al volver a abrir.

import { useEffect, useRef, useState } from "react";

import { buildBaseFormData, defaultSet, type ExerciseShape } from "../helpers";

import {
  exerciseLogDraftStorageKey,
  readExerciseLogDraft,
  writeExerciseLogDraft,
  type ExerciseLogFormDraft,
} from "@/lib/client/exercise-log-draft";

const DEBOUNCE_MS = 300;

interface UseExerciseLogDraftArgs {
  isOpen: boolean;
  exercise: ExerciseShape | null;
  existingLog: any;
  clientId: string;
  sessionId: string;
  exerciseId: string;
  scheduledDate: string;
}

interface UseExerciseLogDraftReturn {
  formData: ExerciseLogFormDraft;
  setFormData: React.Dispatch<React.SetStateAction<ExerciseLogFormDraft>>;
  draftKey: string;
}

export function useExerciseLogDraft(
  args: UseExerciseLogDraftArgs
): UseExerciseLogDraftReturn {
  const {
    isOpen,
    exercise,
    existingLog,
    clientId,
    sessionId,
    exerciseId,
    scheduledDate,
  } = args;

  const [formData, setFormData] = useState<ExerciseLogFormDraft>({
    sets: [defaultSet()],
    durationCompleted: "",
    distanceCompleted: "",
    intensityCompleted: "",
    avgHeartRate: "",
    notes: "",
  });

  const formDataRef = useRef(formData);

  formDataRef.current = formData;

  const draftKey = exerciseLogDraftStorageKey(
    clientId,
    sessionId,
    exerciseId,
    scheduledDate
  );

  // Hidratación al abrir o cambiar el ejercicio.
  useEffect(() => {
    if (!isOpen || !exercise) return;
    const base = buildBaseFormData(exercise, existingLog);
    const draftRead = readExerciseLogDraft(draftKey);
    let applyDraft = draftRead;

    if (draftRead && existingLog?.completed_at) {
      const serverMs = new Date(existingLog.completed_at as string).getTime();

      if (!Number.isNaN(serverMs) && serverMs > draftRead.updatedAt) {
        applyDraft = null;
      }
    }
    setFormData(applyDraft ? { ...base, ...applyDraft.formData } : base);
  }, [
    isOpen,
    exercise,
    existingLog,
    clientId,
    sessionId,
    exerciseId,
    scheduledDate,
    draftKey,
  ]);

  // Persistencia con debounce mientras el usuario escribe.
  useEffect(() => {
    if (!isOpen || !exercise) return;
    const t = window.setTimeout(() => {
      writeExerciseLogDraft(draftKey, formDataRef.current);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(t);
  }, [formData, isOpen, exercise, draftKey]);

  // Persistencia agresiva en pagehide / visibility hidden — el debounce
  // anterior puede no llegar a disparar si el usuario navega fuera.
  useEffect(() => {
    if (!isOpen || !exercise) return;
    const persist = () => writeExerciseLogDraft(draftKey, formDataRef.current);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") persist();
    };

    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isOpen, exercise, draftKey]);

  return { formData, setFormData, draftKey };
}

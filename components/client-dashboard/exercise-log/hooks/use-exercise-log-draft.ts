// Encapsula el estado del formulario + la persistencia de draft entre
// aperturas del modal. Hidrata desde existingLog y/o draft local cuando
// se abre, y persiste con debounce mientras el usuario escribe.
// También arma la regla "draft más nuevo que el log servidor gana", que
// evita pisar cambios locales aún no guardados al volver a abrir.

import { useEffect, useRef, useState } from "react";

import { buildBaseFormData, defaultSet, type ExerciseShape } from "../helpers";

import {
  buildPrescriptionSignature,
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
  /**
   * Signature (JSON.stringify) del último estado aplicado por la
   * hidratación. El autosave compara contra esto para distinguir
   * "form prellenado intacto" de "el cliente registró algo" — el
   * prellenado (reps de prescripción, peso de lastUsedWeights) NUNCA
   * debe persistirse solo porque el cliente tocó un input.
   */
  hydratedSigRef: React.MutableRefObject<string>;
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

  // Signature del último estado que la hidratación pisó. La hidratación
  // solo se permite cuando formData actual MATCHEA esta signature, lo
  // que indica "el usuario no tipeó nada desde el último hydrate".
  // Si no matchea, hay keystrokes locales no persistidos y NO los pisamos
  // — antes el efecto re-corría tras cada autosave (que invalidaba la
  // query de existingLog) y borraba lo que el cliente estaba escribiendo.
  const lastHydrateSigRef = useRef<string>("");
  // Contexto (cliente/sesión/ejercicio/fecha) del último hydrate. Si
  // cambia, forzamos una hidratación fresca aunque el usuario haya
  // tipeado — el modal sigue abierto pero apunta a otro ejercicio.
  const lastContextKeyRef = useRef<string>("");

  const draftKey = exerciseLogDraftStorageKey(
    clientId,
    sessionId,
    exerciseId,
    scheduledDate
  );

  // Fingerprint of the current prescription. When the trainer saves an
  // override the fingerprint changes, so any cached draft authored against
  // the previous prescription is detected as stale and discarded.
  const prescriptionSignature = exercise
    ? buildPrescriptionSignature(exercise)
    : "";

  // Hidratación al abrir o cambiar el ejercicio.
  useEffect(() => {
    if (!isOpen || !exercise) {
      // Reset signature al cerrar para que el próximo open hidrate de
      // cero (incluyendo recuperar draft local si existe).
      lastHydrateSigRef.current = "";
      lastContextKeyRef.current = "";

      return;
    }
    const base = buildBaseFormData(exercise, existingLog);
    const draftRead = readExerciseLogDraft(draftKey);
    let applyDraft = draftRead;

    if (draftRead && existingLog?.completed_at) {
      const serverMs = new Date(existingLog.completed_at as string).getTime();

      if (!Number.isNaN(serverMs) && serverMs > draftRead.updatedAt) {
        applyDraft = null;
      }
    }
    // Drop the draft when it was authored against a different prescription
    // (trainer edited sets/reps/weight after the client cached the draft).
    // Without this, an empty draft from before the override silently wins
    // over the freshly-saved prescription's prefilled values.
    //
    // Drafts written before this fix didn't carry a signature; treat them
    // the same as a mismatch so a one-time refresh after deploy picks up
    // any new prescription. Users mid-edit lose at most one draft.
    if (
      applyDraft &&
      applyDraft.prescriptionSignature !== prescriptionSignature
    ) {
      applyDraft = null;
    }
    const next = applyDraft ? { ...base, ...applyDraft.formData } : base;
    const nextSig = JSON.stringify(next);
    const currentSig = JSON.stringify(formDataRef.current);
    const contextKey = `${clientId}|${sessionId}|${exerciseId}|${scheduledDate}`;
    const contextChanged = contextKey !== lastContextKeyRef.current;

    // Si el contexto NO cambió y NO es la primera hidratación, y el
    // usuario tipeó algo desde el último hydrate, no pisamos sus
    // keystrokes con datos del servidor (autosave invalida existingLog
    // y reactiva este efecto sin que el usuario haya cambiado de modal).
    //
    // Si el contexto cambió (otro ejercicio/fecha/sesión), forzamos
    // hydrate fresco: lo que escribió antes pertenecía a otro contexto.
    if (
      !contextChanged &&
      lastHydrateSigRef.current !== "" &&
      currentSig !== lastHydrateSigRef.current
    ) {
      return;
    }

    setFormData(next);
    lastHydrateSigRef.current = nextSig;
    lastContextKeyRef.current = contextKey;
  }, [
    isOpen,
    exercise,
    existingLog,
    clientId,
    sessionId,
    exerciseId,
    scheduledDate,
    draftKey,
    prescriptionSignature,
  ]);

  // Persistencia con debounce mientras el usuario escribe.
  useEffect(() => {
    if (!isOpen || !exercise) return;
    const t = window.setTimeout(() => {
      writeExerciseLogDraft(
        draftKey,
        formDataRef.current,
        prescriptionSignature
      );
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(t);
  }, [formData, isOpen, exercise, draftKey, prescriptionSignature]);

  // Persistencia agresiva en pagehide / visibility hidden — el debounce
  // anterior puede no llegar a disparar si el usuario navega fuera.
  useEffect(() => {
    if (!isOpen || !exercise) return;
    const persist = () =>
      writeExerciseLogDraft(
        draftKey,
        formDataRef.current,
        prescriptionSignature
      );
    const onVisibility = () => {
      if (document.visibilityState === "hidden") persist();
    };

    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isOpen, exercise, draftKey, prescriptionSignature]);

  return { formData, setFormData, draftKey, hydratedSigRef: lastHydrateSigRef };
}

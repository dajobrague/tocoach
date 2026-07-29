// Orquestador del modal de registro de ejercicio.
//
// Layout (rediseñado, estilo página de detalle):
//
//   [hero ~33vh con imagen + close X]
//   ┌─ scroll body ────────────────────┐
//   │ [identidad: nombre + tipo + nota] │
//   │ [banner video del entrenador]     │
//   │ [datos del programa — chips]      │
//   │ [PR + últimas sesiones]           │
//   │ [form: tus números de hoy]        │
//   └───────────────────────────────────┘
//   [footer sticky: Borrar | Cancelar | Guardar]
//
// Estado mínimo (saving, keyboard) y delega a hooks especializados:
//   useExerciseLogDraft     — formData + persistencia local
//   useExerciseVideo        — video por log (cardio)
//   useSetVideos            — video por serie (fuerza)
//   useDeleteExerciseLogs   — borrar registro existente
//
// Y compone los sub-componentes presentacionales:
//   ExerciseLogHero / ExerciseLogIdentity
//   TrainerVideoBanner
//   ExerciseTargetSection
//   ExerciseHistorySection
//   ExerciseLogForm

/* eslint-disable no-console */
"use client";

import type { NewRecord } from "@/lib/training/e1rm";

import {
  addToast,
  Button,
  Modal,
  ModalContent,
  ModalFooter,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ExerciseHistorySection } from "./exercise-history-section";
import { ExerciseLogForm } from "./exercise-log-form";
import { ExerciseLogHero } from "./exercise-log-hero";
import { ExerciseLogIdentity } from "./exercise-log-identity";
import { ExerciseProgressionSection } from "./exercise-progression-section";
import { ExerciseTargetSection } from "./exercise-target-section";
import {
  formatKg,
  isExerciseCardio,
  shouldAutosaveDraft,
  type ExerciseShape,
} from "./helpers";
import { useExerciseLogDraft } from "./hooks/use-exercise-log-draft";
import { useExerciseVideo } from "./hooks/use-exercise-video";
import { useSetVideos } from "./hooks/use-set-videos";
import { TrainerNoteCard } from "./trainer-note-card";
import { TrainerVideoBanner } from "./trainer-video-banner";

import { clearExerciseLogDraft } from "@/lib/client/exercise-log-draft";
import { clientFetch } from "@/lib/auth/client-token-storage";
import { getLocalTodayYmd } from "@/lib/forms/client-helpers";
import { useDeleteExerciseLogs } from "@/lib/hooks/use-client-queries";

interface ExtendedExerciseShape extends ExerciseShape {
  imageUrl?: string;
  videoUrl?: string;
  uploadedVideoUrl?: string;
  notes?: string;
  description?: string;
}

export interface ExerciseLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  exercise: ExtendedExerciseShape | null;
  sessionId: string;
  exerciseId: string;
  /**
   * Slot específico del plan (session_exercises.id) que se está logueando.
   * El writer lo persiste y dedupea por él, así que dos slots con el mismo
   * exercise_id en la sesión obtienen filas separadas (no "false done").
   */
  sessionExerciseId?: string | null;
  scheduledDate: string;
  clientId: string;
  existingLog?: any;
  onSuccess: () => void;
}

/** Respuesta del writer de logs, en la parte que nos interesa. */
interface SaveResponse {
  success?: boolean;
  error?: string;
  newRecords?: NewRecord[] | null;
  firstTime?: boolean;
}

/**
 * Resultado de un guardado. `newRecords` / `firstTime` sólo pueden venir
 * llenos en el PRIMER finalize: los autosaves y los re-finalize devuelven
 * la forma vacía, así que la celebración no se puede disparar dos veces.
 */
interface SaveOutcome {
  ok: boolean;
  newRecords: NewRecord[];
  firstTime: boolean;
}

const FAILED_SAVE: SaveOutcome = {
  ok: false,
  newRecords: [],
  firstTime: false,
};

type Celebration =
  | { kind: "records"; records: NewRecord[] }
  | { kind: "first" };

// Cuánto dejamos el modal abierto tras finalizar para que la celebración
// se vea antes de cerrar. Sin esto el modal se cierra al instante y ni el
// confeti ni el banner llegan a existir.
const RECORD_CELEBRATION_MS = 2200;
const FIRST_TIME_CELEBRATION_MS = 1400;

// Por encima del modal de HeroUI (react-aria monta overlays con z-index
// inline de 100000); si no, el confeti cae por detrás del modal.
const CONFETTI_Z_INDEX = 100060;

/**
 * Confeti de récord: ráfaga central desde abajo + dos laterales, ~1,5s.
 * Import dinámico para que canvas-confetti no entre en el bundle inicial.
 * Se salta entero si el usuario pidió menos movimiento (el banner y el
 * toast siguen apareciendo).
 */
async function fireConfetti(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const { default: confetti } = await import("canvas-confetti");
  const base = {
    disableForReducedMotion: true,
    zIndex: CONFETTI_Z_INDEX,
  };

  void confetti({
    ...base,
    origin: { x: 0.5, y: 1 },
    particleCount: 90,
    spread: 75,
    startVelocity: 45,
  });
  window.setTimeout(() => {
    void confetti({
      ...base,
      angle: 60,
      origin: { x: 0, y: 0.9 },
      particleCount: 30,
      spread: 55,
    });
  }, 220);
  window.setTimeout(() => {
    void confetti({
      ...base,
      angle: 120,
      origin: { x: 1, y: 0.9 },
      particleCount: 30,
      spread: 55,
    });
  }, 380);
}

/** "6 × 97,5 kg (antes 95 kg)" — para el toast, con el nombre delante. */
function toastLine(record: NewRecord): string {
  const weight = `${record.bucket} × ${formatKg(record.weightKg)} kg`;

  return record.previousWeightKg == null
    ? `${weight} (primera marca en ${record.bucket} reps)`
    : `${weight} (antes ${formatKg(record.previousWeightKg)} kg)`;
}

/** "6 × 97,5 kg — antes 95 kg" — una línea por récord en el banner. */
function bannerLine(record: NewRecord): string {
  const weight = `${record.bucket} × ${formatKg(record.weightKg)} kg`;

  return record.previousWeightKg == null
    ? `${weight} — primera marca en ${record.bucket} reps`
    : `${weight} — antes ${formatKg(record.previousWeightKg)} kg`;
}

export function ExerciseLogModal({
  isOpen,
  onClose,
  exercise,
  sessionId,
  exerciseId,
  sessionExerciseId,
  scheduledDate,
  clientId,
  existingLog,
  onSuccess,
}: ExerciseLogModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const deleteLog = useDeleteExerciseLogs(clientId);

  const isCardio = exercise ? isExerciseCardio(exercise) : false;

  const { formData, setFormData, draftKey, hydratedSigRef } =
    useExerciseLogDraft({
      isOpen,
      exercise,
      existingLog,
      clientId,
      sessionId,
      exerciseId,
      scheduledDate,
    });

  // Flag de "el usuario tocó algo desde el último save". Solo cuando
  // está en true disparamos autosave. Lo manejamos por ref para no
  // re-renderizar al setearlo, y lo limpiamos al guardar y al cerrar.
  const isDirtyRef = useRef(false);

  // Wrapper que delega a setFormData de useExerciseLogDraft pero marca
  // el form como sucio. El hook interno usa setFormData directo (sin
  // dirty flag) para hidratar — esa hidratación NUNCA debe disparar
  // autosave, porque viene del server, no del usuario.
  const handleUserFormChange = useCallback<typeof setFormData>(
    (next) => {
      isDirtyRef.current = true;
      setFormData(next);
    },
    [setFormData]
  );

  const rawCardioVideo = useExerciseVideo({
    isOpen,
    clientId,
    initialVideoUrl: existingLog?.video_url ?? null,
  });

  // Cardio: el video también es input del usuario, así que marcamos
  // dirty al subir/borrar. Wrapping puntual.
  const cardioVideo = useMemo(
    () => ({
      ...rawCardioVideo,
      onPickFile: (file: File) => {
        isDirtyRef.current = true;
        rawCardioVideo.onPickFile(file);
      },
      onRemove: () => {
        isDirtyRef.current = true;
        rawCardioVideo.onRemove();
      },
    }),
    [rawCardioVideo]
  );

  const setVideos = useSetVideos({
    clientId,
    setFormData: handleUserFormChange,
  });

  const scrollToFocused = useCallback(() => {
    requestAnimationFrame(() => {
      const el = document.activeElement as HTMLElement | null;

      if (el && bodyRef.current?.contains(el)) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }, []);

  // Detección de teclado virtual en mobile: si el visualViewport baja
  // del 75% del innerHeight, padding extra al body para que el input
  // enfocado no quede tapado por el teclado.
  useEffect(() => {
    if (!isOpen) return;
    const vv = window.visualViewport;

    if (!vv) return;
    const onResize = () => {
      const threshold = window.innerHeight * 0.75;
      const isKb = vv.height < threshold;

      setKeyboardOpen(isKb);
      if (isKb) setTimeout(scrollToFocused, 120);
    };

    vv.addEventListener("resize", onResize);

    return () => vv.removeEventListener("resize", onResize);
  }, [isOpen, scrollToFocused]);

  // Estado del autosave para feedback visual al cliente. "saved" indica
  // que la última versión del draft fue persistida en BD (la app puede
  // matarse y nada se pierde).
  const [autoSaveState, setAutoSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // Lock para que dos saves no compitan. Si cae uno mientras hay otro
  // en vuelo, el debounce trigger lo va a re-disparar al terminar.
  const isSavingRef = useRef(false);

  const buildRequestBody = useCallback(() => {
    const body: any = {
      sessionId,
      exerciseId,
      sessionExerciseId,
      scheduledDate,
      notes: formData.notes,
      videoUrl: isCardio ? cardioVideo.videoUrl || null : null,
      // Ejercicio prestado de otro día: la procedencia viaja en cada save
      // (los autosaves reescriben el log entero, así que debe ir siempre).
      borrowedFromSessionName: exercise?.borrowedFromSessionName ?? null,
    };

    if (isCardio) {
      body.durationCompleted = formData.durationCompleted
        ? parseInt(formData.durationCompleted)
        : null;
      body.distanceCompleted = formData.distanceCompleted
        ? parseFloat(formData.distanceCompleted)
        : null;
      body.intensityCompleted = formData.intensityCompleted || null;
      body.avgHeartRate = formData.avgHeartRate
        ? parseInt(formData.avgHeartRate)
        : null;
    } else {
      body.sets = formData.sets.map((s) => ({
        reps: s.reps ? parseInt(s.reps) : null,
        weight: s.weight || null,
        videoUrl: s.videoUrl || null,
      }));
    }

    return body;
  }, [
    sessionId,
    exerciseId,
    sessionExerciseId,
    scheduledDate,
    formData,
    isCardio,
    cardioVideo.videoUrl,
    exercise?.borrowedFromSessionName,
  ]);

  // Persistencia compartida entre autosave (silent=true, finalize=false)
  // y "Finalizado" (silent=false, finalize=true). El flag `finalize`
  // viaja al server y determina si el log se marca como completado.
  const performSave = useCallback(
    async (silent: boolean, finalize: boolean): Promise<SaveOutcome> => {
      if (isSavingRef.current) return FAILED_SAVE;
      isSavingRef.current = true;
      setAutoSaveState("saving");
      try {
        const response = await clientFetch(
          `/api/clients/${clientId}/exercise-logs`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...buildRequestBody(), finalize }),
          }
        );
        const data = (await response.json()) as SaveResponse;

        if (data.success) {
          clearExerciseLogDraft(draftKey);
          isDirtyRef.current = false;
          setAutoSaveState("saved");
          onSuccess();

          return {
            ok: true,
            newRecords:
              finalize && Array.isArray(data.newRecords) ? data.newRecords : [],
            firstTime: finalize && data.firstTime === true,
          };
        }
        setAutoSaveState("error");
        if (!silent) {
          alert(
            "Error al guardar registro: " + (data.error || "Error desconocido")
          );
        }

        return FAILED_SAVE;
      } catch (err) {
        console.error("[ExerciseLogModal] Error saving log:", err);
        setAutoSaveState("error");
        if (!silent) alert("Error al guardar registro");

        return FAILED_SAVE;
      } finally {
        isSavingRef.current = false;
      }
    },
    [buildRequestBody, clientId, draftKey, onSuccess]
  );

  // Autosave debounced. Solo dispara si el usuario tocó algo desde el
  // último save (isDirtyRef) Y el form difiere del baseline de
  // hidratación (shouldAutosaveDraft). El re-hydrate post-save NO es
  // input del usuario; y el contenido PRELLENADO (reps de prescripción,
  // peso de lastUsedWeights) tampoco — sin la comparación contra el
  // baseline, mirar un ejercicio por curiosidad y rozar un input creaba
  // un log fantasma "En curso" con los valores prescritos.
  useEffect(() => {
    if (!isOpen || !exercise) return;
    if (
      !shouldAutosaveDraft(
        formData,
        isCardio,
        isDirtyRef.current,
        hydratedSigRef.current
      )
    ) {
      return;
    }

    const t = window.setTimeout(() => {
      void performSave(true, false);
    }, 1500);

    return () => window.clearTimeout(t);
  }, [formData, isCardio, isOpen, exercise, performSave, hydratedSigRef]);

  // Celebración de récord: vive mientras el modal siga abierto y se
  // limpia al cerrarlo, como el resto del estado de sesión del modal.
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const cancelPendingClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  // Reset al cerrar el modal: volvemos a estado limpio para la próxima
  // apertura (otro ejercicio o reapertura del mismo).
  useEffect(() => {
    if (!isOpen) {
      isDirtyRef.current = false;
      setAutoSaveState("idle");
      setCelebration(null);
      setIsCelebrating(false);
      cancelPendingClose();
    }
  }, [isOpen, cancelPendingClose]);

  useEffect(() => cancelPendingClose, [cancelPendingClose]);

  /**
   * Arranca la celebración y devuelve cuántos ms hay que dejar el modal
   * abierto (0 = cerrar ya). Nunca puede tumbar el guardado: el log ya
   * está persistido cuando llegamos acá.
   */
  const startCelebration = useCallback(
    (outcome: SaveOutcome): number => {
      try {
        const [first] = outcome.newRecords;

        if (first) {
          setCelebration({ kind: "records", records: outcome.newRecords });
          setIsCelebrating(true);
          void fireConfetti().catch((err) => {
            console.error("[ExerciseLogModal] Confetti failed:", err);
          });
          addToast({
            color: "success",
            description: `${exercise?.name ?? "Tu ejercicio"} — ${toastLine(first)}`,
            title: "¡Nuevo récord! 🎉",
          });

          return RECORD_CELEBRATION_MS;
        }

        if (outcome.firstTime) {
          setCelebration({ kind: "first" });
          setIsCelebrating(true);

          return FIRST_TIME_CELEBRATION_MS;
        }
      } catch (err) {
        console.error("[ExerciseLogModal] Celebration failed:", err);
      }

      return 0;
    },
    [exercise?.name]
  );

  const handleFinalize = async () => {
    setIsSaving(true);
    // Hace flush del posible debounce pendiente Y manda finalize=true
    // para que el server marque el log como completado.
    let outcome: SaveOutcome = FAILED_SAVE;

    try {
      outcome = await performSave(false, true);
    } finally {
      setIsSaving(false);
    }

    if (!outcome.ok) return;

    const holdMs = startCelebration(outcome);

    if (holdMs === 0) {
      onClose();

      return;
    }

    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, holdMs);
  };

  const handleClose = () => {
    if (isSaving) return;
    // Si el usuario cierra durante la celebración, no dejamos vivo el
    // timer que cerraría un modal ya cerrado (o el siguiente).
    cancelPendingClose();
    onClose();
  };

  const handleDelete = async () => {
    if (!existingLog?.id) return;
    if (
      !window.confirm(
        "¿Borrar este registro? Esta acción no se puede deshacer."
      )
    ) {
      return;
    }
    try {
      await deleteLog.mutateAsync({ logId: existingLog.id });
      clearExerciseLogDraft(draftKey);
      onSuccess();
      onClose();
    } catch (err) {
      console.error("[ExerciseLogModal] Error deleting log:", err);
      alert("Error al borrar registro");
    }
  };

  if (!exercise) return null;

  // Título del bloque "form" según contexto de la fecha:
  //   - hoy → "Tus números de hoy"
  //   - editando un log existente → "Edita tu registro"
  //   - fecha pasada sin log → "Lo que hiciste ese día"
  const today = getLocalTodayYmd();
  const formTitle = existingLog
    ? "Edita tu registro"
    : scheduledDate < today
      ? "Lo que hiciste ese día"
      : "Tus números de hoy";

  const trainerVideoUrl =
    exercise.uploadedVideoUrl || exercise.videoUrl || null;
  const trainerNote = exercise.notes || exercise.description || null;

  return (
    <Modal
      hideCloseButton
      // Backdrop click NO debería cerrar este modal: a) está full-screen
      // (no hay backdrop visible para clickear), y b) el player de
      // video del entrenador se monta en un portal sobre document.body
      // — sin esto, el click cierra del player se interpreta como
      // "click outside the modal" y cierra el log entero.
      isDismissable={false}
      // Escape se maneja en cada overlay de video por su cuenta. El log
      // se cierra solo via los botones X / Cerrar / Finalizado.
      isKeyboardDismissDisabled
      classNames={{
        base: "max-h-[100vh] m-0 bg-background",
        wrapper: "items-end sm:items-center",
        backdrop: "bg-black/80",
        body: "p-0",
      }}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="full"
      onClose={handleClose}
    >
      <ModalContent>
        <div className="flex-1 overflow-y-auto">
          <ExerciseLogHero
            imageUrl={exercise.imageUrl ?? null}
            isCardio={isCardio}
            onClose={handleClose}
          />

          <div
            ref={bodyRef}
            className={`px-4 py-5 flex flex-col gap-6 ${keyboardOpen ? "pb-[40vh]" : ""}`}
            onFocus={() => setTimeout(scrollToFocused, 200)}
          >
            <ExerciseLogIdentity name={exercise.name} />

            {trainerVideoUrl ? (
              <TrainerVideoBanner videoUrl={trainerVideoUrl} />
            ) : null}

            <ExerciseTargetSection exercise={exercise} isCardio={isCardio} />

            {trainerNote ? <TrainerNoteCard note={trainerNote} /> : null}

            <ExerciseHistorySection
              exerciseId={exerciseId || null}
              exerciseName={exercise.name}
              isOpen={isOpen}
            />

            <ExerciseProgressionSection
              exerciseId={exerciseId || null}
              exerciseName={exercise.name}
              isOpen={isOpen}
            />

            <ExerciseLogForm
              autoSaveState={autoSaveState}
              cardioVideo={cardioVideo}
              formData={formData}
              formTitle={formTitle}
              isCardio={isCardio}
              setVideos={setVideos}
              onChange={handleUserFormChange}
            />
          </div>
        </div>

        <ModalFooter className="flex-col gap-2 border-t border-default-200 bg-background">
          {/* La celebración vive en el footer, no arriba del body: al
              finalizar el usuario está mirando el botón, y el body puede
              estar scrolleado abajo del todo. */}
          {celebration ? <CelebrationBanner celebration={celebration} /> : null}

          {existingLog?.id ? (
            <Button
              className="w-full"
              color="danger"
              isDisabled={isSaving || deleteLog.isPending}
              isLoading={deleteLog.isPending}
              radius="md"
              startContent={
                !deleteLog.isPending && (
                  <Icon icon="solar:trash-bin-minimalistic-bold" width={18} />
                )
              }
              variant="flat"
              onPress={handleDelete}
            >
              Borrar registro
            </Button>
          ) : null}
          <div className="flex gap-2 w-full">
            <Button
              className="flex-1"
              isDisabled={isSaving || deleteLog.isPending}
              variant="flat"
              onPress={handleClose}
            >
              Cerrar
            </Button>
            <Button
              className="flex-1 text-white font-semibold"
              color="primary"
              isDisabled={
                isSaving ||
                isCelebrating ||
                cardioVideo.isUploading ||
                setVideos.uploadingIndex !== null ||
                deleteLog.isPending
              }
              isLoading={isSaving}
              startContent={
                !isSaving && <Icon icon="solar:check-circle-bold" width={18} />
              }
              onPress={handleFinalize}
            >
              {isSaving
                ? "Guardando..."
                : isCelebrating
                  ? "¡Guardado!"
                  : "Finalizado"}
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/**
 * Récord nuevo: banner amber con una línea por marca. La primera vez que
 * se registra el ejercicio no hay récord que batir, así que ahí sólo va
 * una línea discreta (sin confeti, sin toast).
 *
 * El amber es literal (no la paleta warning del theme) por lo mismo que
 * el PR de exercise-history-section: warning pelea con el primario del
 * entrenador. El texto se queda neutro — el amber marrón se leía sucio.
 */
function CelebrationBanner({ celebration }: { celebration: Celebration }) {
  if (celebration.kind === "first") {
    return (
      <p className="w-full text-center text-xs font-body text-foreground/60">
        Primera marca registrada 📈
      </p>
    );
  }

  return (
    <div className="w-full rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
      <p className="text-xs font-semibold text-foreground font-heading">
        🏅 ¡Nuevo récord!
      </p>
      <ul className="mt-1 space-y-0.5">
        {celebration.records.map((record) => (
          <li
            key={record.bucket}
            className="text-xs font-body text-foreground/70"
          >
            {bannerLine(record)}
          </li>
        ))}
      </ul>
    </div>
  );
}

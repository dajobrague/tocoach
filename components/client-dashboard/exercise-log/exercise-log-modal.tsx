// Orquestador del modal de registro de ejercicio. Gestiona estado mínimo
// (saving, keyboard) y delega a hooks especializados:
//
//   useExerciseLogDraft     — formData + persistencia local
//   useExerciseVideo        — upload/compress/remove del video
//
// Y compone los sub-componentes presentacionales:
//
//   ExerciseTargetSection   — datos del programa (read-only)
//   ExerciseHistorySection  — PR + últimas 3 sesiones (NUEVO §5.3)
//   ExerciseLogForm         — inputs de registro + video + notas

/* eslint-disable no-console */
"use client";

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ExerciseHistorySection } from "./exercise-history-section";
import { ExerciseLogForm } from "./exercise-log-form";
import { ExerciseTargetSection } from "./exercise-target-section";
import { isExerciseCardio, type ExerciseShape } from "./helpers";
import { useExerciseLogDraft } from "./hooks/use-exercise-log-draft";
import { useExerciseVideo } from "./hooks/use-exercise-video";

import { clearExerciseLogDraft } from "@/lib/client/exercise-log-draft";
import { clientFetch } from "@/lib/auth/client-token-storage";

export interface ExerciseLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  exercise: ExerciseShape | null;
  sessionId: string;
  exerciseId: string;
  scheduledDate: string;
  clientId: string;
  existingLog?: any;
  onSuccess: () => void;
}

export function ExerciseLogModal({
  isOpen,
  onClose,
  exercise,
  sessionId,
  exerciseId,
  scheduledDate,
  clientId,
  existingLog,
  onSuccess,
}: ExerciseLogModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const isCardio = exercise ? isExerciseCardio(exercise) : false;

  const { formData, setFormData, draftKey } = useExerciseLogDraft({
    isOpen,
    exercise,
    existingLog,
    clientId,
    sessionId,
    exerciseId,
    scheduledDate,
  });

  const video = useExerciseVideo({
    isOpen,
    clientId,
    initialVideoUrl: existingLog?.video_url ?? null,
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const requestBody: any = {
        sessionId,
        exerciseId,
        scheduledDate,
        notes: formData.notes,
        videoUrl: video.videoUrl || null,
      };

      if (isCardio) {
        requestBody.durationCompleted = formData.durationCompleted
          ? parseInt(formData.durationCompleted)
          : null;
        requestBody.distanceCompleted = formData.distanceCompleted
          ? parseFloat(formData.distanceCompleted)
          : null;
        requestBody.intensityCompleted = formData.intensityCompleted || null;
        requestBody.avgHeartRate = formData.avgHeartRate
          ? parseInt(formData.avgHeartRate)
          : null;
      } else {
        requestBody.sets = formData.sets.map((s) => ({
          reps: s.reps ? parseInt(s.reps) : null,
          weight: s.weight || null,
        }));
      }

      const response = await clientFetch(
        `/api/clients/${clientId}/exercise-logs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );
      const data = await response.json();

      if (data.success) {
        clearExerciseLogDraft(draftKey);
        onSuccess();
        onClose();
      } else {
        alert(
          "Error al guardar registro: " + (data.error || "Error desconocido")
        );
      }
    } catch (err) {
      console.error("[ExerciseLogModal] Error saving log:", err);
      alert("Error al guardar registro");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) onClose();
  };

  if (!exercise) return null;

  const titlePrefix = existingLog ? "Editar" : "Registrar";
  const titleSuffix = isCardio
    ? "Cardio"
    : existingLog
      ? "Registro"
      : "Ejercicio";

  return (
    <Modal
      classNames={{
        base: "max-h-[100vh] m-0",
        wrapper: "items-end sm:items-center",
        backdrop: "bg-black/80",
        header: "border-b border-default-200",
        footer: "border-t border-default-200",
        body: "py-6",
      }}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="full"
      onClose={handleClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div
              className={`${isCardio ? "bg-red-500" : "bg-primary"} p-2 rounded-lg`}
            >
              <Icon
                className="text-white text-xl"
                icon={
                  isCardio ? "solar:heart-pulse-bold" : "solar:dumbbell-bold"
                }
              />
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-foreground">
                {titlePrefix} {titleSuffix}
              </h3>
              <p className="text-sm text-foreground/60 font-body font-normal">
                {exercise.name}
              </p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div
            ref={bodyRef}
            className={`flex flex-col gap-6 ${keyboardOpen ? "pb-[40vh]" : ""}`}
            onFocus={() => setTimeout(scrollToFocused, 200)}
          >
            <ExerciseTargetSection exercise={exercise} isCardio={isCardio} />
            <ExerciseHistorySection
              exerciseId={exerciseId || null}
              isOpen={isOpen}
            />
            <ExerciseLogForm
              formData={formData}
              isCardio={isCardio}
              video={video}
              onChange={setFormData}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button isDisabled={isSaving} variant="light" onPress={handleClose}>
            Cancelar
          </Button>
          <Button
            className="text-white font-semibold"
            color="primary"
            isDisabled={isSaving || video.isUploading || video.isCompressing}
            isLoading={isSaving}
            startContent={
              !isSaving && <Icon icon="solar:check-circle-bold" width={18} />
            }
            onPress={handleSave}
          >
            {isSaving
              ? "Guardando..."
              : existingLog
                ? "Actualizar Registro"
                : "Guardar Registro"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

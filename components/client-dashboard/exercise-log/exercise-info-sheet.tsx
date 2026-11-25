// "Cómo se hace": hoja inferior con la imagen o animación del ejercicio, el
// vídeo de demostración del entrenador, la prescripción y su nota. Se abre
// desde la pantalla de biserie, donde no hay sitio para la ficha de cada
// ejercicio, sin salir del registro.

"use client";

import type { LibraryMedia } from "@/lib/hooks/use-library-media";

import { ModalBody, ModalContent } from "@heroui/react";
import { useState } from "react";

import { ExerciseLogHero } from "./exercise-log-hero";
import { ExerciseTargetSection } from "./exercise-target-section";
import { TrainerNoteCard } from "./trainer-note-card";

import {
  ClientSheet,
  ClientSheetGrabber,
} from "@/components/client-dashboard/client-sheet";

export interface ExerciseInfo {
  name: string;
  imageUrl?: string;
  videoUrl?: string;
  uploadedVideoUrl?: string;
  notes?: string;
  description?: string;
  libraryMedia?: LibraryMedia | undefined;
  // Prescripción (la misma que enseña la ficha del ejercicio).
  sets?: number;
  reps?: string;
  weightKg?: number | null;
  tempo?: string;
  rest?: string;
  rir?: string;
  trainingSystem?: string;
}

interface Props {
  /** Ejercicio a mostrar; null = cerrada. */
  exercise: (ExerciseInfo & Record<string, unknown>) | null;
  onClose: () => void;
  /** Abre la ficha completa (historial y récords). */
  onOpenFull: () => void;
}

export function ExerciseInfoSheet({ exercise, onClose, onOpenFull }: Props) {
  const note = exercise?.notes || exercise?.description || null;
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <ClientSheet
      hideCloseButton
      classNames={{ base: "bg-background" }}
      // Con el vídeo abierto la hoja no se puede cerrar "tocando fuera": el
      // visor se pinta fuera de ella a pantalla completa, y tocar en él
      // —incluido su botón de cerrar— cerraba también la hoja.
      isDismissable={!videoOpen}
      isKeyboardDismissDisabled={videoOpen}
      isOpen={exercise !== null}
      size="xl"
      onClose={onClose}
    >
      <ModalContent aria-label={exercise?.name ?? "Ejercicio"}>
        {exercise ? (
          <>
            <ClientSheetGrabber onClose={onClose} />
            <ModalBody className="gap-0 p-0">
              <ExerciseLogHero
                exerciseName={exercise.name}
                imageUrl={exercise.imageUrl ?? null}
                isCardio={false}
                libraryMedia={exercise.libraryMedia}
                videoUrl={
                  exercise.uploadedVideoUrl || exercise.videoUrl || null
                }
                onClose={onClose}
                onVideoOpenChange={setVideoOpen}
              />
              <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
                <h2 className="text-balance font-heading text-[22px] leading-tight tracking-[-0.015em] text-foreground">
                  {exercise.name}
                </h2>
                <ExerciseTargetSection exercise={exercise} isCardio={false} />
                {note ? <TrainerNoteCard note={note} /> : null}
                <button
                  className="flex h-12 w-full items-center justify-center rounded-medium bg-default-100 text-[15px] font-semibold text-foreground active:scale-[0.97] motion-reduce:transform-none [@media(hover:hover)]:hover:bg-default-200"
                  type="button"
                  onClick={onOpenFull}
                >
                  Ver historial y récords
                </button>
              </div>
            </ModalBody>
          </>
        ) : null}
      </ModalContent>
    </ClientSheet>
  );
}

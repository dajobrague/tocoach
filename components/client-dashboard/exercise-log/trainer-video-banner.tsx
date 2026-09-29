// Banner clickable para abrir el video de demostración del entrenador.
// Solo se renderiza si el ejercicio tiene videoUrl o uploadedVideoUrl
// — es la referencia, no el video del cliente.
//
// Tap → abre TrainerVideoPlayer en fullscreen sobre el modal.

"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";

import { TrainerVideoPlayer } from "./trainer-video-player";

import { IconTile } from "@/components/shared/icon-tile";

interface Props {
  videoUrl: string;
}

export function TrainerVideoBanner({ videoUrl }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="flex w-full items-center gap-3 rounded-large bg-content1 px-3 py-3 text-left shadow-small transition-colors hover:bg-default-50"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <IconTile icon="solar:play-bold" size="lg" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-default-500">
            Demostración del entrenador
          </p>
          <p className="text-sm font-heading font-semibold text-foreground">
            Ver cómo se hace
          </p>
        </div>
        <Icon
          className="shrink-0 text-default-400"
          icon="solar:alt-arrow-right-linear"
          width={18}
        />
      </button>

      {isOpen ? (
        <TrainerVideoPlayer
          videoUrl={videoUrl}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}

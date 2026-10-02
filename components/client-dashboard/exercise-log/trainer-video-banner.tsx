// Chip compacto (en la cabecera del modal) para abrir el video de
// demostración del entrenador.
// Solo se renderiza si el ejercicio tiene videoUrl o uploadedVideoUrl
// — es la referencia, no el video del cliente.
//
// Tap → abre TrainerVideoPlayer en fullscreen sobre el modal.

"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";

import { TrainerVideoPlayer } from "./trainer-video-player";
interface Props {
  videoUrl: string;
}

export function TrainerVideoBanner({ videoUrl }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <Icon aria-hidden icon="solar:play-bold" width={14} />
        Ver vídeo del entrenador
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

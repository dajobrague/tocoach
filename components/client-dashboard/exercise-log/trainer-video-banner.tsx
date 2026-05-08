// Banner clickable para abrir el video de demostración del entrenador.
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
        className="w-full flex items-center gap-3 rounded-xl border border-default-200 bg-content1 px-3 py-3 text-left hover:bg-default-50 transition-colors"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-foreground/90 relative">
          <Icon
            aria-hidden="true"
            className="text-white"
            icon="solar:play-bold"
            width={22}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-body uppercase tracking-wide text-foreground/50">
            Demostración del entrenador
          </p>
          <p className="text-sm font-heading font-semibold text-foreground">
            Ver cómo se hace
          </p>
        </div>
        <Icon
          className="text-foreground/40 shrink-0"
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

// Hero del modal de registro: ocupa ~1/3 del viewport con la imagen
// del ejercicio (estilo Airbnb detail page). Si no hay imagen, el primer
// fotograma del vídeo del entrenador (si es un archivo subido) o un bloque
// tintado con el icono del tipo de ejercicio.
//
// Sobre la imagen flotan el botón de volver y, si hay vídeo del
// entrenador, una pastilla "Ver vídeo" en la esquina inferior derecha que
// abre el reproductor (antes era una fila aparte bajo el título).

"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";

import { TrainerVideoPlayer } from "./trainer-video-player";

import { getSessionTypeStyle } from "@/components/client-dashboard/workouts/session-type-style";
import { getVideoEmbed } from "@/lib/utils/video-url";

interface Props {
  imageUrl?: string | null;
  isCardio: boolean;
  /** Vídeo de demostración del entrenador (archivo, YouTube o Vimeo). */
  videoUrl?: string | null;
  exerciseName?: string | undefined;
  onClose: () => void;
}

export function ExerciseLogHero({
  imageUrl,
  isCardio,
  videoUrl = null,
  exerciseName,
  onClose,
}: Props) {
  const typeStyle = getSessionTypeStyle(isCardio ? "cardio" : "strength");
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const embed = videoUrl ? getVideoEmbed(videoUrl) : null;

  return (
    <div className="relative w-full h-[33vh] min-h-[180px] max-h-[320px] overflow-hidden">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="w-full h-full object-cover"
          decoding="async"
          src={imageUrl}
        />
      ) : embed?.type === "direct" ? (
        // #t=0.1 fuerza a iOS a pintar el primer fotograma como póster.
        <video
          muted
          playsInline
          aria-hidden="true"
          className="h-full w-full object-cover"
          preload="metadata"
          src={`${embed.embedUrl}#t=0.1`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-primary/10">
          <Icon
            aria-hidden="true"
            className="text-primary"
            icon={typeStyle.icon}
            width={72}
          />
        </div>
      )}

      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/30 to-transparent pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent pointer-events-none"
      />

      <button
        aria-label="Volver"
        className="absolute top-3 left-3 inline-flex items-center justify-center h-9 w-9 rounded-full text-white drop-shadow-md hover:bg-white/10 transition-colors"
        type="button"
        onClick={onClose}
      >
        <Icon icon="solar:alt-arrow-left-linear" width={26} />
      </button>

      {videoUrl ? (
        <button
          aria-label="Ver vídeo de demostración del entrenador"
          className="absolute bottom-3 right-3 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-black/60 py-2 pl-2.5 pr-3.5 text-sm font-semibold text-white shadow-medium backdrop-blur transition-colors hover:bg-black/75"
          type="button"
          onClick={() => setIsVideoOpen(true)}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black">
            <Icon aria-hidden icon="solar:play-bold" width={13} />
          </span>
          Ver vídeo
        </button>
      ) : null}

      {isVideoOpen && videoUrl ? (
        <TrainerVideoPlayer
          title={exerciseName}
          videoUrl={videoUrl}
          onClose={() => setIsVideoOpen(false)}
        />
      ) : null}
    </div>
  );
}

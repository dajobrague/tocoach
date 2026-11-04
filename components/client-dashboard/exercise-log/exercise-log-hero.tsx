// Hero del modal de registro: ocupa ~1/3 del viewport con la imagen
// del ejercicio (estilo Airbnb detail page). Si no hay imagen, el primer
// fotograma del vídeo del entrenador (si es un archivo subido) o un bloque
// tintado con el icono del tipo de ejercicio.
//
// Sobre la imagen flotan el botón de volver y, si hay vídeo del
// entrenador, una pastilla "Ver vídeo" en la esquina inferior derecha que
// abre el reproductor (antes era una fila aparte bajo el título). Ambos van
// sobre una placa sólida translúcida (sin degradados): se leen sobre
// cualquier foto.

"use client";

import type { LibraryMedia } from "@/lib/hooks/use-library-media";

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
  /** Animación del catálogo: solo si no hay imagen ni vídeo del entrenador. */
  libraryMedia?: LibraryMedia | undefined;
  onClose: () => void;
}

export function ExerciseLogHero({
  imageUrl,
  isCardio,
  videoUrl = null,
  exerciseName,
  libraryMedia,
  onClose,
}: Props) {
  const typeStyle = getSessionTypeStyle(isCardio ? "cardio" : "strength");
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const embed = videoUrl ? getVideoEmbed(videoUrl) : null;

  return (
    <div className="relative h-[33vh] max-h-[300px] min-h-[200px] w-full overflow-hidden">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="h-full w-full object-cover"
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
      ) : libraryMedia?.video || libraryMedia?.poster ? (
        // Clip del catálogo sobre blanco (el vídeo ya trae el fondo). Con
        // "reducir movimiento" solo el póster, sin reproducción.
        <div className="h-full w-full bg-white">
          {libraryMedia.video ? (
            <video
              autoPlay
              loop
              muted
              playsInline
              aria-hidden="true"
              className="h-full w-full object-contain motion-reduce:hidden"
              poster={libraryMedia.poster}
              src={libraryMedia.video}
            />
          ) : null}
          {libraryMedia.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className={`h-full w-full object-contain ${libraryMedia.video ? "hidden motion-reduce:block" : ""}`}
              decoding="async"
              src={libraryMedia.poster}
            />
          ) : null}
        </div>
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center ${typeStyle.tileClass}`}
        >
          <Icon
            aria-hidden="true"
            className="opacity-80"
            icon={typeStyle.icon}
            width={96}
          />
        </div>
      )}

      <button
        aria-label="Volver"
        className="absolute left-3 top-[calc(env(safe-area-inset-top)+10px)] z-[3] flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white active:scale-[0.97] motion-reduce:transform-none"
        type="button"
        onClick={onClose}
      >
        <Icon
          className="-ml-0.5"
          icon="solar:alt-arrow-left-linear"
          width={22}
        />
      </button>

      {videoUrl ? (
        <button
          aria-label="Ver vídeo de demostración del entrenador"
          className="absolute bottom-3.5 right-3.5 inline-flex h-10 items-center gap-1.5 rounded-full bg-black/55 pl-2.5 pr-3.5 text-sm font-semibold text-white active:scale-[0.97] motion-reduce:transform-none [@media(hover:hover)]:hover:bg-black/70"
          type="button"
          onClick={() => setIsVideoOpen(true)}
        >
          <Icon aria-hidden icon="solar:play-bold" width={18} />
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

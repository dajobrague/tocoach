// Banner clickable para abrir el video de demostración del entrenador.
// Solo se renderiza si el ejercicio tiene videoUrl o uploadedVideoUrl
// — es la referencia, no el video del cliente.
//
// Tap → abre TrainerVideoPlayer en fullscreen sobre el modal.

"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";

import { TrainerVideoPlayer } from "./trainer-video-player";

import { getVideoEmbed } from "@/lib/utils/video-url";

interface Props {
  videoUrl: string;
  exerciseName?: string;
}

/**
 * Miniatura del vídeo: primer fotograma si es un archivo subido, la de
 * YouTube si es YouTube; para el resto (Vimeo, enlaces no soportados) un
 * icono de play.
 */
function VideoThumb({ videoUrl }: { videoUrl: string }) {
  const embed = getVideoEmbed(videoUrl);
  const youtubeId =
    embed.type === "youtube"
      ? (/\/embed\/([\w-]{6,})/.exec(embed.embedUrl)?.[1] ?? null)
      : null;

  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-medium bg-default-100">
      {embed.type === "direct" ? (
        // #t=0.1 fuerza a iOS a pintar el primer fotograma como póster.
        <video
          muted
          playsInline
          aria-hidden="true"
          className="h-full w-full object-cover"
          preload="metadata"
          src={`${embed.embedUrl}#t=0.1`}
        />
      ) : youtubeId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="h-full w-full object-cover"
          src={`https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`}
        />
      ) : null}
      <span className="absolute inset-0 flex items-center justify-center bg-black/25">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-black shadow-small">
          <Icon icon="solar:play-bold" width={16} />
        </span>
      </span>
    </div>
  );
}

export function TrainerVideoBanner({ videoUrl, exerciseName }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="flex w-full items-center gap-3 rounded-large bg-content1 px-3 py-3 text-left shadow-small transition-colors hover:bg-default-50"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <VideoThumb videoUrl={videoUrl} />
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
          title={exerciseName}
          videoUrl={videoUrl}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}

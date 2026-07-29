// Visor tipo "story" (Instagram) para el feedback en video del coach.
//
// Se abre desde la campana de notificaciones (varias historias encadenadas)
// y desde el historial de ejercicios (una sola). Es deliberadamente oscuro
// e inmersivo: NO usa el theme del tenant, igual que una story.
//
// Navegación manual (los videos tienen su propia duración, no hay timer):
// zonas de tap invisibles en el tercio izquierdo/derecho de la mitad
// superior, más Escape / flechas. El tercio central alterna play/pausa y
// reinicia el video cuando ya terminó.

"use client";

import { Icon } from "@iconify/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface StoryItem {
  videoUrl: string;
  exerciseName: string;
  setLabel: string;
  scheduledDate: string;
  comment: string;
  notificationId?: string;
}

interface Props {
  items: StoryItem[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onViewed?: (item: StoryItem) => void;
}

export function VideoFeedbackStoryViewer({
  items,
  initialIndex,
  isOpen,
  onClose,
  onViewed,
}: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [wasOpen, setWasOpen] = useState(isOpen);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hasEnded, setHasEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewedRef = useRef<Set<string>>(new Set());
  const onViewedRef = useRef(onViewed);

  onViewedRef.current = onViewed;

  // Reset al abrir, en fase de render para que el efecto de "visto" no
  // dispare con el índice viejo (patrón de ajuste de estado de React).
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setIndex(initialIndex);
      setHasEnded(false);
      setIsPlaying(true);
      viewedRef.current = new Set();
    }
  }

  const current = items[index];

  const goNext = useCallback(() => {
    // Pasar de la última historia cierra el visor.
    if (index + 1 >= items.length) {
      onClose();

      return;
    }
    setHasEnded(false);
    setIsPlaying(true);
    setIndex(index + 1);
  }, [index, items.length, onClose]);

  const goPrev = useCallback(() => {
    if (index <= 0) return;
    setHasEnded(false);
    setIsPlaying(true);
    setIndex(index - 1);
  }, [index]);

  // Marca cada historia como vista una sola vez por apertura.
  useEffect(() => {
    if (!isOpen) return;
    const item = items[index];

    if (!item) return;
    const key = item.notificationId ?? `idx-${index}`;

    if (viewedRef.current.has(key)) return;
    viewedRef.current.add(key);
    onViewedRef.current?.(item);
  }, [isOpen, index, items]);

  // Escape cierra, flechas navegan. Capturamos para ganarle a modales
  // que puedan estar detrás (el visor se abre encima del log/dropdown).
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };

    document.addEventListener("keydown", onKey, true);

    return () => document.removeEventListener("keydown", onKey, true);
  }, [isOpen, onClose, goNext, goPrev]);

  // Bloquea el scroll del body mientras el visor está abierto.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;

    if (!video) return;

    if (video.ended) {
      video.currentTime = 0;
      setHasEnded(false);
      void video.play();

      return;
    }

    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }, []);

  if (!isOpen || !current) return null;
  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      aria-label="Feedback del coach"
      aria-modal="true"
      className="fixed inset-0 z-[100050] bg-black overflow-hidden"
      role="dialog"
      style={{ height: "100dvh" }}
    >
      {/* El visor puede abrirse encima de un Modal de HeroUI: cortamos la
          propagación para que no se lea como click-outside y lo cierre. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="absolute inset-0"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Video */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            key={current.videoUrl}
            ref={videoRef}
            autoPlay
            playsInline
            className="max-h-full max-w-full object-contain"
            controls={false}
            src={current.videoUrl}
            onEnded={() => {
              setHasEnded(true);
              setIsPlaying(false);
            }}
            onPause={() => setIsPlaying(false)}
            onPlay={() => {
              setHasEnded(false);
              setIsPlaying(true);
            }}
          />
        </div>

        {/* Indicador de pausa / repetir, centrado sobre el video */}
        {!isPlaying ? (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur">
              <Icon
                icon={hasEnded ? "solar:restart-bold" : "solar:play-bold"}
                width={26}
              />
            </span>
          </div>
        ) : null}

        {/* Zonas de tap: sólo la mitad superior para no robarle taps a la
          burbuja del comentario. */}
        <div className="absolute inset-x-0 bottom-1/3 top-0 flex">
          <button
            aria-label="Anterior"
            className="flex-1 cursor-default"
            type="button"
            onClick={goPrev}
          />
          <button
            aria-label={hasEnded ? "Repetir" : "Reproducir o pausar"}
            className="flex-1 cursor-default"
            type="button"
            onClick={togglePlay}
          />
          <button
            aria-label="Siguiente"
            className="flex-1 cursor-default"
            type="button"
            onClick={goNext}
          />
        </div>

        {/* Cabecera */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-3 pb-8"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div className="flex gap-1">
            {items.map((item, i) => (
              <span
                key={item.notificationId ?? `${item.videoUrl}-${i}`}
                className={`h-[2.5px] flex-1 rounded-full ${
                  i <= index ? "bg-white" : "bg-white/35"
                }`}
              />
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[13px] font-bold text-white">
              C
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">
                {current.exerciseName}
              </p>
              <p className="truncate text-[10.5px] text-white/75">
                {formatStoryDate(current.scheduledDate)}
                {current.setLabel ? ` · ${current.setLabel}` : ""}
              </p>
            </div>
            <button
              aria-label="Cerrar"
              className="pointer-events-auto -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/90"
              type="button"
              onClick={onClose}
            >
              <Icon icon="solar:close-circle-linear" width={24} />
            </button>
          </div>
        </div>

        {/* Comentario del coach */}
        <div
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-12"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {current.setLabel ? (
            <p className="mb-1.5 text-[10.5px] text-white/70">
              {current.setLabel}
            </p>
          ) : null}
          <div className="flex items-end gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">
              C
            </span>
            <div className="max-h-[28dvh] min-w-0 flex-1 overflow-y-auto rounded-[4px_14px_14px_14px] bg-white/15 px-3 py-2 text-[13px] text-white backdrop-blur">
              <p className="mb-0.5 text-[11px] font-bold text-emerald-300">
                Tu coach
              </p>
              <p className="whitespace-pre-line break-words">
                {current.comment}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// "2026-07-27" → "Lun 27 jul"
function formatStoryDate(isoYmd: string): string {
  try {
    const d = new Date(`${isoYmd}T12:00:00Z`);

    if (Number.isNaN(d.getTime())) return isoYmd;

    const formatted = new Intl.DateTimeFormat("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })
      .format(d)
      .replace(/,/g, "")
      .replace(/\./g, "");

    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return isoYmd;
  }
}

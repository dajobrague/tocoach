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
  /** Nombre del entrenador para el avatar (iniciales). Sin él, icono neutro. */
  coachName?: string;
}

export function VideoFeedbackStoryViewer({
  items,
  initialIndex,
  isOpen,
  onClose,
  onViewed,
  coachName,
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
  const coachInitials = (coachName ?? "")
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const avatar = (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 font-heading text-[13px] font-extrabold text-white"
    >
      {coachInitials || <Icon icon="solar:user-linear" width={18} />}
    </span>
  );

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
          className="pointer-events-none absolute inset-x-0 top-0 px-2.5"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div className="flex gap-1 px-0.5">
            {items.map((item, i) => (
              <span
                key={item.notificationId ?? `${item.videoUrl}-${i}`}
                className={`h-[3px] flex-1 rounded-full ${
                  i <= index ? "bg-white" : "bg-white/30"
                }`}
              />
            ))}
          </div>

          <div className="mt-2.5 flex items-center gap-2.5 pl-1">
            {avatar}
            {/* Placa translúcida sólida (sin degradado) para leer el título
                sobre cualquier fotograma. */}
            <div className="min-w-0 flex-1 rounded-[10px] bg-black/35 px-2 py-1">
              <p className="truncate text-[15px] font-semibold text-white">
                {current.exerciseName}
              </p>
              <p className="truncate text-[13px] tabular-nums text-white/80">
                {formatStoryDate(current.scheduledDate)}
                {current.setLabel ? ` · ${current.setLabel}` : ""}
              </p>
            </div>
            <button
              aria-label="Cerrar"
              className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white active:scale-[0.97] motion-reduce:active:scale-100"
              type="button"
              onClick={onClose}
            >
              <Icon icon="solar:close-circle-linear" width={26} />
            </button>
          </div>
        </div>

        {/* Comentario del coach: placa negra translúcida sólida, sin
            degradado (regla del portal: nada de degradados ni scrims). */}
        {current.comment ? (
          <div
            className="absolute inset-x-3 max-h-[34dvh] overflow-y-auto overscroll-contain rounded-[18px] bg-black/60 px-3.5 py-3 text-white"
            style={{
              bottom: "max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))",
            }}
          >
            <p className="text-[13px] font-bold text-white/75">Tu coach</p>
            <p className="mt-1 whitespace-pre-line break-words text-[15px] leading-relaxed">
              {current.comment}
            </p>
          </div>
        ) : null}
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

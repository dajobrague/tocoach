// Player fullscreen para el video de demostración del entrenador.
// Se monta en un portal sobre <body> para garantizar que cubre el
// modal de registro que está abajo, sin pelearse con el z-index/trap
// de HeroUI Modal.
//
// Adapta a diferentes pantallas:
// - Usa `dvh` para que el alto siga la viewport real en mobile (la
//   barra de URL de Safari/Chrome cambia el `vh` y dejaba huecos).
// - El video usa `max-w-full max-h-full` con `object-contain` para no
//   pasarse del viewport en horizontal ni recortarse en vertical.
// - El botón de cerrar respeta safe-area-insets (notch / dynamic
//   island / home indicator).
//
// Tres modos de reproducción según la URL:
//   1. `direct` — archivo Supabase/CDN (.mp4/.webm/etc) → <video src=>
//      EXACTAMENTE igual que antes; este path no debe cambiar.
//   2. `youtube`/`vimeo` — embed iframe oficial.
//   3. `unsupported` — Reels, TikTok, etc. Mostramos un fallback con
//      "abrir en nueva pestaña" para no dejar pantalla en blanco.

"use client";

import { Icon } from "@iconify/react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { getVideoEmbed } from "@/lib/utils/video-url";

interface Props {
  videoUrl: string;
  onClose: () => void;
}

export function TrainerVideoPlayer({ videoUrl, onClose }: Props) {
  // Cerrar con Esc + lock del scroll del body. Capture phase +
  // stopImmediatePropagation para que el handler global de HeroUI no
  // dispare un close del modal padre cuando el player está arriba.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };

    document.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (typeof window === "undefined") return null;

  const embed = getVideoEmbed(videoUrl);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
      style={{ height: "100dvh" }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        aria-label="Cerrar video"
        className="absolute z-10 inline-flex items-center justify-center h-10 w-10 rounded-full bg-white/90 text-foreground shadow-md"
        style={{
          top: "max(0.75rem, env(safe-area-inset-top))",
          right: "max(0.75rem, env(safe-area-inset-right))",
        }}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <Icon icon="solar:close-circle-linear" width={22} />
      </button>

      {embed.type === "direct" ? (
        // PATH ORIGINAL — no tocar. Cualquier archivo subido (Supabase
        // u otro CDN) cae aquí. Mismo markup, mismas props.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          autoPlay
          controls
          playsInline
          className="max-w-full max-h-full"
          src={embed.embedUrl}
        />
      ) : embed.type === "youtube" || embed.type === "vimeo" ? (
        <iframe
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          className="w-full h-full max-w-screen-lg border-0"
          referrerPolicy="strict-origin-when-cross-origin"
          src={embed.embedUrl}
          title="Demostración del entrenador"
        />
      ) : (
        <UnsupportedVideoFallback originalUrl={embed.originalUrl} />
      )}
    </div>,
    document.body
  );
}

function UnsupportedVideoFallback({ originalUrl }: { originalUrl: string }) {
  // Fallback amistoso para URLs que no podemos incrustar (Instagram
  // Reels, TikTok, Facebook, etc. — sus servidores envían
  // X-Frame-Options/CSP que bloquean el iframe). Antes de este cambio
  // el iframe se renderizaba en blanco sin explicación.
  const hasUrl = originalUrl.trim().length > 0;

  return (
    <div
      className="flex flex-col items-center justify-center gap-5 px-6 text-center text-white max-w-md"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Icon
        className="text-white/50"
        icon="solar:videocamera-record-broken"
        width={56}
      />
      <div className="space-y-2">
        <h3 className="text-lg font-heading font-semibold">
          Este video no se puede reproducir aquí
        </h3>
        <p className="text-sm text-white/70 font-body">
          Solo podemos incrustar videos de YouTube y Vimeo. Si tu entrenador usó
          un enlace de Instagram Reels, TikTok u otra plataforma, pídele que
          suba el archivo directamente.
        </p>
      </div>
      {hasUrl ? (
        <a
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-foreground hover:bg-white/90"
          href={originalUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Icon icon="solar:square-top-down-linear" width={16} />
          Abrir en nueva pestaña
        </a>
      ) : null}
    </div>
  );
}

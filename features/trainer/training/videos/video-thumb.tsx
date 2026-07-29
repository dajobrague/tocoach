"use client";

// Miniatura del video con forma consciente de la orientación: los clientes
// graban casi siempre en vertical, así que un contenedor 16:9 fijo recortaría
// medio cuerpo. Leemos videoWidth/videoHeight de `loadedmetadata` y elegimos
// caja vertical (40×68) u horizontal (96×54). Hasta que carguen los metadatos
// asumimos horizontal — es la caja más ancha y no salta el layout hacia fuera.

import { useState } from "react";

type Orientation = "portrait" | "landscape";

/** 41 → "0:41"; 95 → "1:35". */
function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;

  return `${mins}:${String(secs).padStart(2, "0")}`;
}

interface Props {
  url: string;
  /** Texto del aria-label ("Ver video de Press banca serie 2"). */
  label: string;
  onOpen: () => void;
}

export function VideoThumb({ url, label, onOpen }: Props) {
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [duration, setDuration] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const box = orientation === "portrait" ? "w-10 h-[68px]" : "w-24 h-[54px]";

  return (
    <button
      aria-label={label}
      className={`relative shrink-0 cursor-pointer overflow-hidden rounded-lg bg-gray-800 ${box}`}
      type="button"
      onClick={onOpen}
    >
      {failed ? null : (
        <video
          muted
          playsInline
          className="h-full w-full object-cover"
          preload="metadata"
          src={url}
          onError={() => setFailed(true)}
          onLoadedMetadata={(event) => {
            const el = event.currentTarget;

            if (el.videoHeight > 0 && el.videoWidth > 0) {
              setOrientation(
                el.videoHeight > el.videoWidth ? "portrait" : "landscape"
              );
            }
            if (Number.isFinite(el.duration) && el.duration > 0) {
              setDuration(el.duration);
            }
          }}
        >
          <track kind="captions" label="Spanish" srcLang="es" />
        </video>
      )}

      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white/90 shadow-sm">
          {/* Triángulo en CSS: no depende de que exista el icono. */}
          <span className="ml-[2px] h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-gray-900" />
        </span>
      </span>

      {duration !== null ? (
        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/55 px-1 text-[9px] text-white tabular-nums">
          {formatDuration(duration)}
        </span>
      ) : null}
    </button>
  );
}

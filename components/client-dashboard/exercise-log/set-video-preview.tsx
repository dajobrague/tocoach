// Preview fullscreen del video subido por el cliente para una serie
// específica. Igual que TrainerVideoPlayer pero con barra inferior de
// acciones (Reemplazar / Borrar). Mismo enfoque de portal +
// stopPropagation + safe-area-insets para que no se confunda con un
// click outside del Modal de log.

"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  videoUrl: string;
  onClose: () => void;
  onRemove: () => void;
  onReplace: () => void;
}

export function SetVideoPreview({
  videoUrl,
  onClose,
  onRemove,
  onReplace,
}: Props) {
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

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
      style={{ height: "100dvh" }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        aria-label="Cerrar"
        className="absolute z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white active:bg-white/25"
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
        <Icon icon="solar:close-linear" width={22} />
      </button>
      <div className="flex-1 flex items-center justify-center min-h-0">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          autoPlay
          controls
          playsInline
          className="max-w-full max-h-full"
          src={videoUrl}
        />
      </div>
      <div
        className="grid grid-cols-2 gap-2.5 px-3 pt-3"
        style={{
          paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
        }}
      >
        <Button
          className="h-[52px] bg-white/15 text-[17px] font-semibold text-danger-300"
          radius="lg"
          startContent={
            <Icon icon="solar:trash-bin-minimalistic-linear" width={20} />
          }
          onPress={onRemove}
        >
          Borrar
        </Button>
        <Button
          className="h-[52px] bg-white text-[17px] font-semibold text-black"
          radius="lg"
          startContent={<Icon icon="solar:camera-linear" width={20} />}
          onPress={onReplace}
        >
          Reemplazar
        </Button>
      </div>
    </div>,
    document.body
  );
}

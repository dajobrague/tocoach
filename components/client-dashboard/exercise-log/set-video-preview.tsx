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
        className="bg-content1 border-t border-default-200 px-4 py-3 flex gap-2 justify-end"
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        <Button
          color="danger"
          startContent={
            <Icon icon="solar:trash-bin-minimalistic-bold" width={16} />
          }
          variant="flat"
          onPress={onRemove}
        >
          Borrar
        </Button>
        <Button
          color="primary"
          startContent={<Icon icon="solar:upload-linear" width={16} />}
          variant="flat"
          onPress={onReplace}
        >
          Reemplazar
        </Button>
      </div>
    </div>,
    document.body
  );
}

// Sub-sección "Video (Opcional)" del formulario de registro: preview de
// video subido + delete, o botón de subida. La compresión ocurre en el
// servidor durante el upload, así que mostramos un solo estado de carga.

import type { MutableRefObject } from "react";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface Props {
  videoUrl: string | null;
  isUploading: boolean;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  onPickFile: (file: File) => void;
  onRemove: () => void;
}

export function ExerciseVideoUpload({
  videoUrl,
  isUploading,
  fileInputRef,
  onPickFile,
  onRemove,
}: Props) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground font-heading">
        Video (Opcional)
      </h4>

      {videoUrl ? (
        <div className="relative rounded-lg overflow-hidden bg-black">
          <video
            controls
            playsInline
            className="w-full max-h-48 object-contain"
            preload="metadata"
            src={videoUrl}
          />
          <Button
            isIconOnly
            className="absolute top-2 right-2"
            color="danger"
            size="sm"
            variant="solid"
            onPress={onRemove}
          >
            <Icon icon="solar:trash-bin-minimalistic-bold" width={16} />
          </Button>
        </div>
      ) : (
        <>
          <input
            ref={fileInputRef}
            accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.mov,.webm,.m4v"
            className="hidden"
            disabled={isUploading}
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];

              if (file) onPickFile(file);
              e.target.value = "";
            }}
          />
          <Button
            className="w-full"
            isDisabled={isUploading}
            isLoading={isUploading}
            size="sm"
            startContent={
              !isUploading && <Icon icon="solar:videocamera-bold" width={18} />
            }
            variant="flat"
            onPress={() => fileInputRef.current?.click()}
          >
            {isUploading ? "Procesando video..." : "Subir video"}
          </Button>
          {isUploading ? (
            <p className="text-xs text-foreground/60">
              Esto puede tardar un momento. Estamos optimizando el video para
              que se vea bien y cargue rápido.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

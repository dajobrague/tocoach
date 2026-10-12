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
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-default-500">
        Video (Opcional)
      </span>

      {videoUrl ? (
        <div className="relative overflow-hidden rounded-medium bg-black">
          <video
            controls
            playsInline
            className="w-full max-h-48 object-contain"
            preload="metadata"
            src={videoUrl}
          />
          <Button
            isIconOnly
            aria-label="Borrar video"
            className="absolute right-2 top-2 h-11 w-11 min-w-11"
            color="danger"
            radius="full"
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
            className="h-[52px] w-full bg-default-100 text-[17px] font-semibold text-foreground"
            isDisabled={isUploading}
            isLoading={isUploading}
            radius="md"
            startContent={
              !isUploading && <Icon icon="solar:camera-linear" width={20} />
            }
            onPress={() => fileInputRef.current?.click()}
          >
            {isUploading ? "Procesando video..." : "Subir video"}
          </Button>
          {isUploading ? (
            <p className="text-[13px] leading-snug text-default-500">
              Esto puede tardar un momento. Estamos optimizando el video para
              que se vea bien y cargue rápido.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

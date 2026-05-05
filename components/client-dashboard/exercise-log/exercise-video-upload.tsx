// Sub-sección "Video (Opcional)" del formulario de registro: preview de
// video subido + delete, o botón de subida con progress de compresión.

import type { MutableRefObject } from "react";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface Props {
  videoUrl: string | null;
  isUploading: boolean;
  isCompressing: boolean;
  compressionProgress: number;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  onPickFile: (file: File) => void;
  onRemove: () => void;
}

export function ExerciseVideoUpload({
  videoUrl,
  isUploading,
  isCompressing,
  compressionProgress,
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
            disabled={isCompressing || isUploading}
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];

              if (file) onPickFile(file);
              e.target.value = "";
            }}
          />
          <Button
            className="w-full"
            isDisabled={isCompressing || isUploading}
            isLoading={isUploading && !isCompressing}
            size="sm"
            startContent={
              !isUploading &&
              !isCompressing && (
                <Icon icon="solar:videocamera-bold" width={18} />
              )
            }
            variant="flat"
            onPress={() => fileInputRef.current?.click()}
          >
            {isCompressing
              ? "Comprimiendo video..."
              : isUploading
                ? "Subiendo video..."
                : "Subir video"}
          </Button>
          {isCompressing ? (
            <div>
              <div className="flex items-center gap-2 text-sm text-foreground/60">
                <Icon
                  className="animate-spin"
                  icon="solar:refresh-bold"
                  width={16}
                />
                Comprimiendo video... {compressionProgress}%
              </div>
              <div className="w-full bg-default-200 rounded-full h-2 mt-1">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${compressionProgress}%` }}
                />
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

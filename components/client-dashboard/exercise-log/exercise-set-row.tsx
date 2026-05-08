// Una fila del formulario de fuerza: número de serie · reps · peso ·
// botón de video. El video es por SERIE — el state vive en
// formData.sets[index].videoUrl|videoPath y se sube via useSetVideos.
//
// Los headers (Serie / Reps / Peso) viven en el padre (StrengthFields)
// para que cada fila sea uniforme y no tengamos label flotante +
// placeholder repitiendo "Reps" en la primera fila.
//
// Estados del botón de video:
//   sin video → icon outline, gris, abre file picker
//   con video → icon bold, primary, abre el preview con opción de
//                borrar/reemplazar
//   subiendo  → spinner

"use client";

import type { SetDraft } from "@/lib/client/exercise-log-draft";

import { Button, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRef, useState } from "react";

import { SetVideoPreview } from "./set-video-preview";

interface Props {
  index: number;
  set: SetDraft;
  canRemove: boolean;
  isUploading: boolean;
  onUpdate: (field: "reps" | "weight", value: string) => void;
  onRemove: () => void;
  onPickVideo: (file: File) => void;
  onRemoveVideo: () => void;
}

export function ExerciseSetRow({
  index,
  set,
  canRemove,
  isUploading,
  onUpdate,
  onRemove,
  onPickVideo,
  onRemoveVideo,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasVideo = Boolean(set.videoUrl);

  const handleVideoClick = () => {
    if (isUploading) return;
    if (hasVideo) {
      setPreviewOpen(true);
    } else {
      fileRef.current?.click();
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="flex items-center justify-center w-10 h-10 rounded-medium bg-default-100 text-primary text-base font-bold shrink-0">
          {index + 1}
        </div>
        <Input
          classNames={{ input: "text-base", base: "flex-1" }}
          inputMode="decimal"
          placeholder="Peso"
          size="md"
          value={set.weight}
          onValueChange={(value) => onUpdate("weight", value)}
        />
        <Input
          classNames={{ input: "text-base", base: "flex-1" }}
          inputMode="numeric"
          placeholder="Reps"
          size="md"
          type="number"
          value={set.reps}
          onValueChange={(value) => onUpdate("reps", value)}
        />
        <input
          ref={fileRef}
          accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.mov,.webm,.m4v"
          className="hidden"
          disabled={isUploading}
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0];

            if (file) onPickVideo(file);
            e.target.value = "";
          }}
        />
        <Button
          isIconOnly
          aria-label={
            hasVideo ? "Ver video de esta serie" : "Subir video de esta serie"
          }
          className={`shrink-0 h-10 w-10 min-w-10 ${
            hasVideo ? "text-primary" : ""
          }`}
          color="default"
          isLoading={isUploading}
          radius="md"
          variant="flat"
          onPress={handleVideoClick}
        >
          {!isUploading ? (
            <Icon
              icon={hasVideo ? "solar:play-circle-bold" : "solar:upload-linear"}
              width={20}
            />
          ) : null}
        </Button>
        {canRemove ? (
          <Button
            isIconOnly
            aria-label="Quitar serie"
            className="shrink-0 h-10 w-10 min-w-10"
            color="danger"
            radius="md"
            variant="flat"
            onPress={onRemove}
          >
            <Icon icon="solar:trash-bin-minimalistic-bold" width={20} />
          </Button>
        ) : null}
      </div>

      {previewOpen && set.videoUrl ? (
        <SetVideoPreview
          videoUrl={set.videoUrl}
          onClose={() => setPreviewOpen(false)}
          onRemove={() => {
            setPreviewOpen(false);
            onRemoveVideo();
          }}
          onReplace={() => {
            setPreviewOpen(false);
            onRemoveVideo();
            // Pequeño delay para que el state se asiente antes de
            // disparar el picker.
            setTimeout(() => fileRef.current?.click(), 50);
          }}
        />
      ) : null}
    </>
  );
}

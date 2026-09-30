// Una fila del formulario de fuerza: número de serie · reps · peso ·
// botón de nota · botón de video. El video es por SERIE — el state vive
// en formData.sets[index].videoUrl|videoPath y se sube via useSetVideos.
//
// La nota también es por serie ("8 izq / 10 der"): el input de reps es
// numérico, así que las asimetrías por lado se anotan acá. El botón
// despliega un input de texto bajo la fila; con contenido queda
// resaltado en primary igual que el de video.
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

import { Button, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRef, useState } from "react";

import { type SetDraftWithTarget } from "./helpers";
import { SetVideoPreview } from "./set-video-preview";

interface Props {
  index: number;
  set: SetDraftWithTarget;
  canRemove: boolean;
  isUploading: boolean;
  onUpdate: (field: "reps" | "weight" | "note", value: string) => void;
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
  const hasNote = Boolean(set.note && set.note.trim().length > 0);
  // null = seguir a hasNote: una nota que llega por hidratación (log
  // existente o draft) se despliega sola. El toggle explícito del
  // usuario (true/false) gana después.
  const [noteToggled, setNoteToggled] = useState<boolean | null>(null);
  const noteOpen = noteToggled ?? hasNote;

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
        {/* Prescripción no numérica ("8-12") como placeholder: el input
            number no puede mostrarla como value y guardarla persistiría
            el límite inferior sin que el cliente registrara nada. */}
        <Input
          classNames={{ input: "text-base", base: "flex-1" }}
          inputMode="numeric"
          placeholder={set.repsPlaceholder ?? "Reps"}
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
          aria-expanded={noteOpen}
          aria-label={
            hasNote ? "Editar nota de esta serie" : "Añadir nota a esta serie"
          }
          className={`shrink-0 h-10 w-10 min-w-10 ${
            hasNote ? "text-primary" : ""
          }`}
          color="default"
          radius="md"
          variant="flat"
          onPress={() => setNoteToggled(!noteOpen)}
        >
          <Icon
            icon={hasNote ? "solar:notes-bold" : "solar:notes-linear"}
            width={20}
          />
        </Button>
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

      {noteOpen ? (
        <Input
          autoFocus={noteToggled === true}
          classNames={{
            input: "text-sm",
            base: "ml-[46px] sm:ml-12 w-auto",
          }}
          placeholder="Nota de la serie (ej: 8 izq / 10 der)"
          size="sm"
          startContent={
            <Icon
              className="text-foreground/40 shrink-0"
              icon="solar:notes-linear"
              width={16}
            />
          }
          value={set.note ?? ""}
          onValueChange={(value) => onUpdate("note", value)}
        />
      ) : null}

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

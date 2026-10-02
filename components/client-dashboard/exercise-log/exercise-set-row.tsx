// Una fila del formulario de fuerza: número de serie · peso · reps ·
// check · menú "⋯". El video es por SERIE — el state vive en
// formData.sets[index].videoUrl|videoPath y se sube via useSetVideos.
//
// Los headers (Serie / Peso / Reps) viven en el padre (StrengthFields)
// para que cada fila sea uniforme.
//
// "Quitar serie" y el video viven en el menú "⋯": antes la papelera
// quedaba a 6px del input de reps (dedazo sin deshacer). El check es
// progreso visual + arranque del descanso; NO forma parte de lo que se
// guarda.
//
// Video: sin video → el menú ofrece subir (abre el file picker); con
// video → indicador en el número de serie y el menú abre el preview
// (borrar/reemplazar); subiendo → spinner en el botón "⋯".

"use client";

import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRef, useState } from "react";

import { type SetDraftWithTarget } from "./helpers";
import { SetVideoPreview } from "./set-video-preview";

interface Props {
  index: number;
  set: SetDraftWithTarget;
  canRemove: boolean;
  isUploading: boolean;
  isChecked: boolean;
  onToggleCheck: () => void;
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
  isChecked,
  onToggleCheck,
  onUpdate,
  onRemove,
  onPickVideo,
  onRemoveVideo,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasVideo = Boolean(set.videoUrl);
  const setNumber = index + 1;

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
        <div
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-medium text-base font-bold transition-colors ${
            isChecked
              ? "bg-primary text-primary-foreground"
              : "bg-default-100 text-primary"
          }`}
        >
          {setNumber}
          {hasVideo ? (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-content1 text-primary shadow-small">
              <Icon
                aria-label="Serie con video"
                icon="solar:videocamera-bold"
                width={10}
              />
            </span>
          ) : null}
        </div>
        <Input
          aria-label={`Peso de la serie ${setNumber}`}
          classNames={{ input: "text-base", base: "flex-1 min-w-0" }}
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
          aria-label={`Reps de la serie ${setNumber}`}
          classNames={{ input: "text-base", base: "flex-1 min-w-0" }}
          inputMode="numeric"
          placeholder={set.repsPlaceholder ?? "Reps"}
          size="md"
          type="number"
          value={set.reps}
          onValueChange={(value) => onUpdate("reps", value)}
        />
        <Button
          isIconOnly
          aria-label={`Serie ${setNumber} hecha`}
          aria-pressed={isChecked}
          className="h-11 w-11 min-w-11 shrink-0"
          radius="full"
          variant="light"
          onPress={onToggleCheck}
        >
          <Icon
            className={isChecked ? "text-primary" : "text-default-400"}
            icon={
              isChecked
                ? "solar:check-circle-bold"
                : "solar:check-circle-linear"
            }
            width={30}
          />
        </Button>
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
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <Button
              isIconOnly
              aria-label={`Más opciones de la serie ${setNumber}`}
              className="h-11 w-8 min-w-8 shrink-0"
              isLoading={isUploading}
              radius="md"
              size="sm"
              variant="light"
            >
              {!isUploading ? (
                <Icon
                  className="text-default-500"
                  icon="solar:menu-dots-bold"
                  width={20}
                />
              ) : null}
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label={`Opciones de la serie ${setNumber}`}
            disabledKeys={canRemove ? [] : ["remove"]}
            onAction={(key) => {
              if (key === "video") handleVideoClick();
              if (key === "remove") onRemove();
            }}
          >
            <DropdownItem
              key="video"
              startContent={
                <Icon
                  icon={
                    hasVideo ? "solar:play-circle-bold" : "solar:upload-linear"
                  }
                  width={18}
                />
              }
            >
              {hasVideo
                ? "Ver video de esta serie"
                : "Subir video de esta serie"}
            </DropdownItem>
            <DropdownItem
              key="remove"
              className="text-danger"
              color="danger"
              startContent={
                <Icon icon="solar:trash-bin-minimalistic-bold" width={18} />
              }
            >
              Quitar serie
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
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

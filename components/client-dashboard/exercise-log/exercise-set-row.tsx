// Una fila del formulario de fuerza: número de serie · peso · reps ·
// botón de video. Solo si el entrenador lo pide: RIR por serie (prescribió
// RIR) y reps por lado D / I (ejercicio unilateral). Sin check por serie ni temporizador de descanso (a
// propósito: registro simple). El video es por SERIE — el state vive en
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

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRef, useState } from "react";

import { LOG_INPUT_CLASS, type SetDraftWithTarget } from "./helpers";
import { SetVideoPreview } from "./set-video-preview";

// Repeticiones en reserva: 0 = al fallo. Más de 5 no aporta.
const RIR_OPTIONS = ["0", "1", "2", "3", "4", "5"];

interface Props {
  index: number;
  /** Grid compartido con la cabecera (StrengthFields). */
  gridClass: string;
  /** Última fila: el teclado muestra "Hecho" en vez de "Siguiente". */
  isLast: boolean;
  set: SetDraftWithTarget;
  canRemove: boolean;
  isUploading: boolean;
  showRir: boolean;
  perSide: boolean;
  onUpdate: (
    field: "reps" | "weight" | "rir" | "repsLeft",
    value: string
  ) => void;
  onRemove: () => void;
  onPickVideo: (file: File) => void;
  onRemoveVideo: () => void;
  /**
   * Sin la celda del número de serie: en la pantalla de biserie el número
   * va en la cabecera del bloque, no en cada fila.
   */
  hideIndex?: boolean;
  /** Nombre del ejercicio para las etiquetas accesibles (biserie). */
  ariaContext?: string;
}

export function ExerciseSetRow({
  index,
  gridClass,
  isLast,
  set,
  canRemove,
  isUploading,
  showRir,
  perSide,
  onUpdate,
  onRemove,
  onPickVideo,
  onRemoveVideo,
  hideIndex = false,
  ariaContext,
}: Props) {
  const ctx = ariaContext ? `, ${ariaContext}` : "";
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
      <div className={gridClass}>
        {hideIndex ? null : (
          <span className="flex h-[52px] items-center justify-center rounded-xl bg-default-100 text-[15px] font-bold tabular-nums text-default-500">
            {index + 1}
          </span>
        )}
        <input
          aria-label={`Peso de la serie ${index + 1}, en kilos${ctx}`}
          autoComplete="off"
          className={`${LOG_INPUT_CLASS} text-center`}
          enterKeyHint="next"
          inputMode="decimal"
          placeholder="kg"
          value={set.weight}
          onChange={(e) => onUpdate("weight", e.target.value)}
        />
        {/* Prescripción no numérica ("8-12") como placeholder: el input
            number no puede mostrarla como value y guardarla persistiría
            el límite inferior sin que el cliente registrara nada. */}
        {perSide ? (
          <div className="grid min-w-0 grid-cols-2 gap-1">
            <input
              aria-label={`Repeticiones lado derecho, serie ${index + 1}${ctx}`}
              autoComplete="off"
              className={`${LOG_INPUT_CLASS} px-1 text-center`}
              enterKeyHint="next"
              inputMode="numeric"
              placeholder="Der."
              type="number"
              value={set.reps}
              onChange={(e) => onUpdate("reps", e.target.value)}
            />
            <input
              aria-label={`Repeticiones lado izquierdo, serie ${index + 1}${ctx}`}
              autoComplete="off"
              className={`${LOG_INPUT_CLASS} px-1 text-center`}
              enterKeyHint={isLast ? "done" : "next"}
              inputMode="numeric"
              placeholder="Izq."
              type="number"
              value={set.repsLeft ?? ""}
              onChange={(e) => onUpdate("repsLeft", e.target.value)}
            />
          </div>
        ) : (
          <input
            aria-label={`Repeticiones de la serie ${index + 1}${ctx}`}
            autoComplete="off"
            className={`${LOG_INPUT_CLASS} text-center`}
            enterKeyHint={isLast ? "done" : "next"}
            inputMode="numeric"
            placeholder={set.repsPlaceholder ?? "Reps"}
            type="number"
            value={set.reps}
            onChange={(e) => onUpdate("reps", e.target.value)}
          />
        )}
        {showRir ? (
          <select
            aria-label={`RIR de la serie ${index + 1}${ctx}`}
            className={`${LOG_INPUT_CLASS} appearance-none px-1 text-center`}
            value={set.rir ?? ""}
            onChange={(e) => onUpdate("rir", e.target.value)}
          >
            <option value="">–</option>
            {RIR_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ) : null}
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
            hasVideo
              ? `Ver video de esta serie${ctx}`
              : `Subir video de esta serie${ctx}`
          }
          // Cámara en tinte de marca para invitar a grabar (37% de los
          // clientes activos lo usa); con vídeo, sólido con ▶ para ver
          // de un vistazo qué series ya lo tienen.
          className={`h-11 w-11 min-w-11 justify-self-center ${
            isUploading
              ? "bg-default-100 text-default-500"
              : hasVideo
                ? "bg-primary text-primary-foreground"
                : "bg-primary/10 text-primary"
          }`}
          isLoading={isUploading}
          radius="full"
          variant="flat"
          onPress={handleVideoClick}
        >
          {!isUploading ? (
            <Icon
              className={hasVideo ? "ml-0.5" : ""}
              icon={
                hasVideo ? "solar:play-bold" : "solar:videocamera-record-linear"
              }
              width={hasVideo ? 16 : 20}
            />
          ) : null}
        </Button>
        {canRemove ? (
          <button
            aria-label={`Quitar serie ${index + 1}`}
            className="flex h-11 w-9 items-center justify-center rounded-[10px] text-default-500 active:bg-default-100"
            type="button"
            onClick={onRemove}
          >
            <Icon icon="solar:trash-bin-minimalistic-linear" width={18} />
          </button>
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

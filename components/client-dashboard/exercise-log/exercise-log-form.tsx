// Formulario de registro: variantes fuerza (sets/reps/peso por serie) y
// cardio (duración/distancia/intensidad/FC), notas y subida de video.
// El estado vive en el orquestador (para persistencia de draft y save);
// aquí solo recibimos formData + setter + handlers de video.

import type { MutableRefObject } from "react";
import type {
  ExerciseLogFormDraft,
  SetDraft,
} from "@/lib/client/exercise-log-draft";

import { Button, Input, Select, SelectItem, Textarea } from "@heroui/react";
import { Icon } from "@iconify/react";

import { ExerciseVideoUpload } from "./exercise-video-upload";
import { defaultSet } from "./helpers";

interface VideoState {
  videoUrl: string | null;
  isUploading: boolean;
  isCompressing: boolean;
  compressionProgress: number;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  onPickFile: (file: File) => void;
  onRemove: () => void;
}

interface Props {
  isCardio: boolean;
  formData: ExerciseLogFormDraft;
  onChange: (next: ExerciseLogFormDraft) => void;
  video: VideoState;
}

export function ExerciseLogForm({
  isCardio,
  formData,
  onChange,
  video,
}: Props) {
  const updateSet = (index: number, field: keyof SetDraft, value: string) => {
    const newSets = [...formData.sets];

    newSets[index] = {
      reps: "",
      weight: "",
      ...newSets[index],
      [field]: value,
    };
    onChange({ ...formData, sets: newSets });
  };

  const addSet = () => {
    const lastSet = formData.sets[formData.sets.length - 1];
    const newSet: SetDraft = lastSet
      ? { reps: lastSet.reps, weight: lastSet.weight }
      : defaultSet();

    onChange({ ...formData, sets: [...formData.sets, newSet] });
  };

  const removeSet = (index: number) => {
    if (formData.sets.length <= 1) return;
    const newSets = formData.sets.filter((_, i) => i !== index);

    onChange({ ...formData, sets: newSets });
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-foreground font-heading">
        ¿Qué realizaste?
      </h4>

      {isCardio ? (
        <CardioFields formData={formData} onChange={onChange} />
      ) : (
        <StrengthFields
          addSet={addSet}
          formData={formData}
          removeSet={removeSet}
          updateSet={updateSet}
          onChange={onChange}
        />
      )}

      <ExerciseVideoUpload {...video} />
    </div>
  );
}

function CardioFields({
  formData,
  onChange,
}: {
  formData: ExerciseLogFormDraft;
  onChange: (next: ExerciseLogFormDraft) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Input
          classNames={{ input: "text-base" }}
          label="Duración (min)"
          placeholder="Ej: 30"
          startContent={
            <Icon
              className="text-foreground/40"
              icon="solar:clock-circle-bold"
              width={18}
            />
          }
          type="number"
          value={formData.durationCompleted}
          onValueChange={(value) =>
            onChange({ ...formData, durationCompleted: value })
          }
        />
        <Input
          classNames={{ input: "text-base" }}
          label="Distancia (km)"
          placeholder="Ej: 5.2"
          startContent={
            <Icon
              className="text-foreground/40"
              icon="solar:route-bold"
              width={18}
            />
          }
          step="0.1"
          type="number"
          value={formData.distanceCompleted}
          onValueChange={(value) =>
            onChange({ ...formData, distanceCompleted: value })
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select
          classNames={{ value: "text-base" }}
          label="Intensidad"
          placeholder="Selecciona"
          selectedKeys={
            formData.intensityCompleted ? [formData.intensityCompleted] : []
          }
          startContent={
            <Icon
              className="text-foreground/40"
              icon="solar:fire-bold"
              width={18}
            />
          }
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as string;

            onChange({ ...formData, intensityCompleted: selected });
          }}
        >
          <SelectItem key="Baja">Baja</SelectItem>
          <SelectItem key="Moderada">Moderada</SelectItem>
          <SelectItem key="Alta">Alta</SelectItem>
          <SelectItem key="Por Intervalos">Por Intervalos</SelectItem>
        </Select>

        <Input
          classNames={{ input: "text-base" }}
          label="FC Promedio (bpm)"
          placeholder="Ej: 145"
          startContent={
            <Icon
              className="text-foreground/40"
              icon="solar:heart-pulse-bold"
              width={18}
            />
          }
          type="number"
          value={formData.avgHeartRate}
          onValueChange={(value) =>
            onChange({ ...formData, avgHeartRate: value })
          }
        />
      </div>

      <NotesField formData={formData} onChange={onChange} />
    </>
  );
}

function StrengthFields({
  formData,
  updateSet,
  addSet,
  removeSet,
  onChange,
}: {
  formData: ExerciseLogFormDraft;
  updateSet: (index: number, field: keyof SetDraft, value: string) => void;
  addSet: () => void;
  removeSet: (index: number) => void;
  onChange: (next: ExerciseLogFormDraft) => void;
}) {
  return (
    <>
      <div className="space-y-3">
        {formData.sets.map((set, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mb-1">
              {index + 1}
            </div>
            <Input
              classNames={{ input: "text-base", base: "flex-1" }}
              label={index === 0 ? "Reps" : undefined}
              placeholder="10"
              size="sm"
              type="number"
              value={set.reps}
              onValueChange={(value) => updateSet(index, "reps", value)}
            />
            <Input
              classNames={{ input: "text-base", base: "flex-1" }}
              label={index === 0 ? "Peso" : undefined}
              placeholder="80kg"
              size="sm"
              value={set.weight}
              onValueChange={(value) => updateSet(index, "weight", value)}
            />
            {formData.sets.length > 1 && (
              <Button
                isIconOnly
                className="mb-1"
                size="sm"
                variant="light"
                onPress={() => removeSet(index)}
              >
                <Icon
                  className="text-danger"
                  icon="solar:trash-bin-minimalistic-bold"
                  width={16}
                />
              </Button>
            )}
          </div>
        ))}
      </div>

      <Button
        className="w-full"
        size="sm"
        startContent={<Icon icon="solar:add-circle-bold" width={18} />}
        variant="flat"
        onPress={addSet}
      >
        Añadir serie
      </Button>

      <NotesField formData={formData} onChange={onChange} />
    </>
  );
}

function NotesField({
  formData,
  onChange,
}: {
  formData: ExerciseLogFormDraft;
  onChange: (next: ExerciseLogFormDraft) => void;
}) {
  return (
    <Textarea
      classNames={{ input: "text-base" }}
      label="Notas (Opcional)"
      minRows={2}
      placeholder="Ej: Me sentí fuerte, podría subir peso la próxima vez"
      startContent={
        <Icon
          className="text-foreground/40"
          icon="solar:notes-bold"
          width={18}
        />
      }
      value={formData.notes}
      onValueChange={(value) => onChange({ ...formData, notes: value })}
    />
  );
}

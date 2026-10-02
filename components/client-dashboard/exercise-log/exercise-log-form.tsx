// Formulario de registro: variantes fuerza (sets/reps/peso/check +
// menú con video por serie) y cardio (duración/distancia/intensidad/FC + un solo video
// porque cardio no tiene series). El estado vive en el orquestador;
// acá solo recibimos formData + setters.

import type { MutableRefObject } from "react";
import type {
  ExerciseLogFormDraft,
  SetDraft,
} from "@/lib/client/exercise-log-draft";

import { Button, Input, Select, SelectItem, Textarea } from "@heroui/react";
import { Icon } from "@iconify/react";

import { ExerciseSetRow } from "./exercise-set-row";
import { ExerciseVideoUpload } from "./exercise-video-upload";
import { defaultSet } from "./helpers";

interface CardioVideoState {
  videoUrl: string | null;
  isUploading: boolean;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  onPickFile: (file: File) => void;
  onRemove: () => void;
}

interface SetVideosState {
  uploadingIndex: number | null;
  onPickFile: (setIndex: number, file: File) => void;
  onRemove: (setIndex: number) => void;
}

interface Props {
  isCardio: boolean;
  formData: ExerciseLogFormDraft;
  onChange: (next: ExerciseLogFormDraft) => void;
  // Solo cardio usa el video por log (legacy, una sola pieza).
  cardioVideo: CardioVideoState;
  // Solo fuerza usa el video por serie.
  setVideos: SetVideosState;
  // Título adaptado al contexto: hoy, fecha pasada, edición.
  formTitle: string;
  // Estado del autosave para mostrar inline al lado del título.
  autoSaveState: "idle" | "saving" | "saved" | "error";
  // Checks por serie (solo fuerza). Estado SOLO de cliente: no viaja en
  // formData, así que ni el draft, ni el autosave, ni el payload lo ven.
  checkedSets: boolean[];
  onCheckedSetsChange: (next: boolean[]) => void;
  // Se llama al MARCAR una serie (no al desmarcar): arranca el descanso.
  onSetChecked: () => void;
}

export function ExerciseLogForm({
  isCardio,
  formData,
  onChange,
  cardioVideo,
  setVideos,
  formTitle,
  autoSaveState,
  checkedSets,
  onCheckedSetsChange,
  onSetChecked,
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
    // Siempre nueva serie vacía. Antes copiábamos reps/peso de la
    // última fila como "atajo", pero a los clientes les confunde — la
    // serie nueva debe arrancar en blanco para que registren su
    // verdadero peso/reps.
    onChange({ ...formData, sets: [...formData.sets, defaultSet()] });
  };

  const removeSet = (index: number) => {
    if (formData.sets.length <= 1) return;
    const newSets = formData.sets.filter((_, i) => i !== index);

    onChange({ ...formData, sets: newSets });
    // Los checks van por índice: corremos los posteriores con la serie.
    onCheckedSetsChange(checkedSets.filter((_, i) => i !== index));
  };

  const toggleCheck = (index: number) => {
    const willCheck = !checkedSets[index];

    onCheckedSetsChange(
      formData.sets.map((_, i) =>
        i === index ? willCheck : Boolean(checkedSets[i])
      )
    );
    if (willCheck) onSetChecked();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground font-heading">
          {formTitle}
        </h4>
        <InlineSaveStatus state={autoSaveState} />
      </div>

      {isCardio ? (
        <CardioFields formData={formData} onChange={onChange} />
      ) : (
        <StrengthFields
          addSet={addSet}
          checkedSets={checkedSets}
          formData={formData}
          removeSet={removeSet}
          setVideos={setVideos}
          toggleCheck={toggleCheck}
          updateSet={updateSet}
          onChange={onChange}
        />
      )}

      {isCardio ? <ExerciseVideoUpload {...cardioVideo} /> : null}
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
          inputMode="numeric"
          label="Duración (min)"
          startContent={
            <Icon
              className="text-default-400"
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
          inputMode="decimal"
          label="Distancia (km)"
          startContent={
            <Icon
              className="text-default-400"
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
          selectedKeys={
            formData.intensityCompleted ? [formData.intensityCompleted] : []
          }
          startContent={
            <Icon
              className="text-default-400"
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
          inputMode="numeric"
          label="FC promedio (bpm)"
          startContent={
            <Icon
              className="text-default-400"
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
  setVideos,
  checkedSets,
  toggleCheck,
  onChange,
}: {
  formData: ExerciseLogFormDraft;
  checkedSets: boolean[];
  toggleCheck: (index: number) => void;
  updateSet: (index: number, field: keyof SetDraft, value: string) => void;
  addSet: () => void;
  removeSet: (index: number) => void;
  setVideos: SetVideosState;
  onChange: (next: ExerciseLogFormDraft) => void;
}) {
  const hasMultipleSets = formData.sets.length > 1;

  return (
    <>
      <div className="space-y-2">
        {/* Headers — afuera de las filas para que cada fila quede pareja
            y no haya doble texto (label flotante + placeholder) en la
            primera. Los anchos son los mismos que los de la fila para
            que se alineen visualmente. */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-0.5 text-[11px] text-default-500">
          <span className="w-10 shrink-0 text-center">Serie</span>
          <span className="flex-1">Peso (kg)</span>
          <span className="flex-1">Reps</span>
          <span className="w-11 shrink-0 text-center">Hecha</span>
          <span className="w-8 shrink-0" />
        </div>

        {formData.sets.map((set, index) => (
          <ExerciseSetRow
            key={index}
            canRemove={hasMultipleSets}
            index={index}
            isChecked={Boolean(checkedSets[index])}
            isUploading={setVideos.uploadingIndex === index}
            set={set}
            onPickVideo={(file) => setVideos.onPickFile(index, file)}
            onRemove={() => removeSet(index)}
            onRemoveVideo={() => setVideos.onRemove(index)}
            onToggleCheck={() => toggleCheck(index)}
            onUpdate={(field, value) => updateSet(index, field, value)}
          />
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

// Indicador inline de autosave al lado del título "Tus números de hoy".
// Tamaño muy chico, solo aparece mientras está guardando, después del
// guardado exitoso, o si hubo un error. En idle no se muestra nada
// para no agregar ruido visual.
function InlineSaveStatus({
  state,
}: {
  state: "idle" | "saving" | "saved" | "error";
}) {
  if (state === "idle") return null;
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-default-500">
        <Icon className="animate-spin" icon="solar:refresh-linear" width={11} />
        Guardando
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-success">
        <Icon icon="solar:check-circle-bold" width={11} />
        Guardado
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-danger">
      <Icon icon="solar:danger-circle-linear" width={11} />
      Error
    </span>
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
      classNames={{ input: "text-base", inputWrapper: "min-h-unit-12" }}
      minRows={2}
      placeholder="Notas"
      startContent={
        <Icon className="text-default-400" icon="solar:notes-bold" width={18} />
      }
      value={formData.notes}
      onValueChange={(value) => onChange({ ...formData, notes: value })}
    />
  );
}

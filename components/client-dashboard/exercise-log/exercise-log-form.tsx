// Formulario de registro: variantes fuerza (sets/reps/peso/video por
// serie) y cardio (duración/distancia/intensidad/FC + un solo video
// porque cardio no tiene series). El estado vive en el orquestador;
// acá solo recibimos formData + setters.

import type { MutableRefObject, ReactNode } from "react";
import type {
  ExerciseLogFormDraft,
  SetDraft,
} from "@/lib/client/exercise-log-draft";

import { Icon } from "@iconify/react";
import { useId } from "react";

import { ExerciseSetRow } from "./exercise-set-row";
import { ExerciseVideoUpload } from "./exercise-video-upload";
import { LOG_INPUT_CLASS, defaultSet } from "./helpers";

import { SegmentedControl } from "@/components/shared/segmented-control";

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
}

export function ExerciseLogForm({
  isCardio,
  formData,
  onChange,
  cardioVideo,
  setVideos,
  formTitle,
  autoSaveState,
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
  };

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-[22px] leading-tight tracking-[-0.015em] text-foreground">
          {formTitle}
        </h2>
        <InlineSaveStatus state={autoSaveState} />
      </div>

      <div className="flex flex-col gap-4">
        {isCardio ? (
          <CardioFields formData={formData} onChange={onChange} />
        ) : (
          <StrengthFields
            addSet={addSet}
            formData={formData}
            removeSet={removeSet}
            setVideos={setVideos}
            updateSet={updateSet}
            onChange={onChange}
          />
        )}

        {isCardio ? <ExerciseVideoUpload {...cardioVideo} /> : null}
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <label
        className="text-[13px] font-semibold text-default-500"
        htmlFor={id}
      >
        {label}
      </label>
      {children(id)}
    </div>
  );
}

const INTENSITY_OPTIONS = [
  { key: "Baja", label: "Baja" },
  { key: "Moderada", label: "Moderada" },
  { key: "Alta", label: "Alta" },
  // El valor guardado sigue siendo "Por Intervalos"; solo se acorta la etiqueta.
  { key: "Por Intervalos", label: "Intervalos" },
] as const;

function CardioFields({
  formData,
  onChange,
}: {
  formData: ExerciseLogFormDraft;
  onChange: (next: ExerciseLogFormDraft) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duración (min)">
          {(id) => (
            <input
              className={LOG_INPUT_CLASS}
              enterKeyHint="next"
              id={id}
              inputMode="numeric"
              type="number"
              value={formData.durationCompleted}
              onChange={(e) =>
                onChange({ ...formData, durationCompleted: e.target.value })
              }
            />
          )}
        </Field>
        <Field label="Distancia (km)">
          {(id) => (
            <input
              className={LOG_INPUT_CLASS}
              enterKeyHint="next"
              id={id}
              inputMode="decimal"
              step="0.1"
              type="number"
              value={formData.distanceCompleted}
              onChange={(e) =>
                onChange({ ...formData, distanceCompleted: e.target.value })
              }
            />
          )}
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-default-500">
          Intensidad
        </span>
        <SegmentedControl<string>
          ariaLabel="Intensidad"
          options={INTENSITY_OPTIONS}
          size="md"
          value={formData.intensityCompleted}
          onChange={(key) => onChange({ ...formData, intensityCompleted: key })}
        />
      </div>

      <Field label="FC promedio (bpm)">
        {(id) => (
          <input
            className={LOG_INPUT_CLASS}
            enterKeyHint="next"
            id={id}
            inputMode="numeric"
            type="number"
            value={formData.avgHeartRate}
            onChange={(e) =>
              onChange({ ...formData, avgHeartRate: e.target.value })
            }
          />
        )}
      </Field>

      <NotesField
        formData={formData}
        placeholder="¿Cómo te sentiste?"
        onChange={onChange}
      />
    </>
  );
}

function StrengthFields({
  formData,
  updateSet,
  addSet,
  removeSet,
  setVideos,
  onChange,
}: {
  formData: ExerciseLogFormDraft;
  updateSet: (index: number, field: keyof SetDraft, value: string) => void;
  addSet: () => void;
  removeSet: (index: number) => void;
  setVideos: SetVideosState;
  onChange: (next: ExerciseLogFormDraft) => void;
}) {
  const hasMultipleSets = formData.sets.length > 1;
  const grid = hasMultipleSets ? SET_GRID_MANY : SET_GRID_ONE;

  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Headers — afuera de las filas para que cada fila quede pareja
            y no haya doble texto (label flotante + placeholder) en la
            primera. Mismo grid que las filas para que se alineen. */}
        <div
          aria-hidden
          className={`${grid} text-xs font-semibold text-default-500`}
        >
          <span className="text-center">Serie</span>
          <span>Peso (kg)</span>
          <span>Reps</span>
          <span className="text-center">Vídeo</span>
          {hasMultipleSets ? <span /> : null}
        </div>

        {formData.sets.map((set, index) => (
          <ExerciseSetRow
            key={index}
            canRemove={hasMultipleSets}
            gridClass={grid}
            index={index}
            isLast={index === formData.sets.length - 1}
            isUploading={setVideos.uploadingIndex === index}
            set={set}
            onPickVideo={(file) => setVideos.onPickFile(index, file)}
            onRemove={() => removeSet(index)}
            onRemoveVideo={() => setVideos.onRemove(index)}
            onUpdate={(field, value) => updateSet(index, field, value)}
          />
        ))}
      </div>

      {!formData.sets.some((s) => s.videoUrl) ? (
        <p className="flex items-start gap-2 text-[13px] leading-snug text-default-500">
          <Icon
            aria-hidden
            className="mt-px shrink-0 text-primary"
            icon="solar:videocamera-record-linear"
            width={16}
          />
          Graba una serie y tu entrenador revisará tu técnica.
        </p>
      ) : null}

      <button
        className="flex h-12 w-full items-center justify-center gap-2 rounded-medium bg-default-100 text-[15px] font-semibold text-foreground active:scale-[0.97] motion-reduce:transform-none [@media(hover:hover)]:hover:bg-default-200"
        type="button"
        onClick={addSet}
      >
        <Icon aria-hidden icon="solar:add-linear" width={18} />
        Añadir serie
      </button>

      <NotesField
        formData={formData}
        placeholder="Sensaciones, molestias, ajustes…"
        onChange={onChange}
      />
    </>
  );
}

const SET_GRID_MANY =
  "grid grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)_44px_36px] items-center gap-2";
const SET_GRID_ONE =
  "grid grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-2";

// Indicador inline de autosave al lado del título "Tus números de hoy".
// Solo aparece mientras está guardando, después del guardado exitoso, o si
// hubo un error. En idle no se muestra nada para no agregar ruido visual.
function InlineSaveStatus({
  state,
}: {
  state: "idle" | "saving" | "saved" | "error";
}) {
  const content =
    state === "saving" ? (
      <span className="inline-flex items-center gap-1 text-default-500">
        <Icon
          className="animate-spin motion-reduce:animate-none"
          icon="solar:refresh-linear"
          width={14}
        />
        Guardando
      </span>
    ) : state === "saved" ? (
      <span className="inline-flex items-center gap-1 text-success-700">
        <Icon icon="solar:check-circle-bold" width={14} />
        Guardado
      </span>
    ) : state === "error" ? (
      <span className="inline-flex items-center gap-1 text-danger">
        <Icon icon="solar:danger-triangle-linear" width={14} />
        Error al guardar
      </span>
    ) : null;

  return (
    <span
      aria-live="polite"
      className="whitespace-nowrap text-[13px] font-semibold"
      role="status"
    >
      {content}
    </span>
  );
}

function NotesField({
  formData,
  placeholder,
  onChange,
}: {
  formData: ExerciseLogFormDraft;
  placeholder: string;
  onChange: (next: ExerciseLogFormDraft) => void;
}) {
  return (
    <Field label="Notas">
      {(id) => (
        <textarea
          className="min-h-24 w-full rounded-medium border border-default-200 bg-content1 px-4 py-3 text-[17px] text-foreground caret-primary outline-none transition-[border-color,box-shadow] placeholder:text-default-400 focus:border-primary focus:ring-4 focus:ring-primary/20 motion-reduce:transition-none"
          id={id}
          placeholder={placeholder}
          rows={3}
          value={formData.notes}
          onChange={(e) => onChange({ ...formData, notes: e.target.value })}
        />
      )}
    </Field>
  );
}

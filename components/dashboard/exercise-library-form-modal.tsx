"use client";

import type { Exercise } from "@/types/training";

import {
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import {
  MUSCLE_PICKER_ID,
  MusclePicker,
} from "@/features/trainer/library/muscle-picker";
import { TagsField } from "@/features/trainer/library/tags-field";
import {
  deleteExerciseVideo,
  extractVideoPathFromUrl,
  uploadExerciseImage,
  uploadExerciseVideo,
  validateExerciseLibraryForm,
} from "@/lib/utils/exercise-utils";
import { isUnsupportedExternalUrl } from "@/lib/utils/video-url";
import { primaryMuscleRequired, type MuscleId } from "@/lib/training/muscles";

// One form for "Añadir" and "Editar": same layout, same fields, same rules.
// Only the data source (empty vs. the exercise), the request (POST vs. PUT)
// and a few labels change with `mode`.
interface ExerciseLibraryFormModalProps {
  mode: "add" | "edit";
  isOpen: boolean;
  /** Required in edit mode. */
  exercise?: Exercise | undefined;
  onClose: () => void;
  onSuccess: (exercise?: any) => void;
}

const ALL_CATEGORIES = [
  { key: "strength", label: "Fuerza" },
  { key: "cardio", label: "Cardio" },
  { key: "flexibility", label: "Movilidad" },
  { key: "balance", label: "Equilibrio" },
  { key: "plyometric", label: "Pliométrico" },
  { key: "olympic", label: "Olímpico" },
  { key: "powerlifting", label: "Powerlifting" },
  { key: "bodyweight", label: "Peso corporal" },
  { key: "other", label: "Otro" },
];
// The trainer app has two exercise types; new exercises pick one of them.
const NEW_CATEGORIES = ALL_CATEGORIES.slice(0, 2);

const IMAGE_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/gif";
const VIDEO_ACCEPT =
  "video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.mov,.webm,.m4v";

const EMPTY_FORM = {
  name: "",
  description: "",
  category: "",
  primary_muscles: [] as MuscleId[],
  secondary_muscles: [] as MuscleId[],
  equipment: [] as string[],
  movement_pattern: "",
  video_url: "",
  uploaded_video_url: "",
  image_url: "",
  cardio_type: "",
  tags: [] as string[],
};

/** One step per line; blank lines are dropped. */
const toLines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** A titled block of the form: no boxes inside boxes, just rhythm. */
function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="font-heading text-base font-semibold text-foreground">
          {title}
        </h3>
        {hint ? (
          <p className="mt-0.5 text-sm text-default-500">{hint}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function ExerciseLibraryFormModal({
  mode,
  isOpen,
  exercise,
  onClose,
  onSuccess,
}: ExerciseLibraryFormModalProps) {
  const editing = mode === "edit" ? exercise : undefined;
  const [formData, setFormData] = useState(EMPTY_FORM);
  // Kept as raw text while typing (a trimmed array would eat the Enter key).
  const [instructionsText, setInstructionsText] = useState("");
  const [tipsText, setTipsText] = useState("");
  const [muscleError, setMuscleError] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [equipmentInput, setEquipmentInput] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit: load the exercise. Add: start empty every time the modal opens.
  useEffect(() => {
    if (mode === "edit" && !exercise) return;
    if (mode === "add" && !isOpen) return;

    if (exercise && mode === "edit") {
      setFormData({
        name: exercise.name || "",
        description: exercise.description || "",
        category: exercise.category || "",
        primary_muscles: exercise.primary_muscles ?? [],
        secondary_muscles: exercise.secondary_muscles ?? [],
        equipment: exercise.equipment || [],
        movement_pattern: exercise.movement_pattern || "",
        video_url: exercise.video_url || "",
        uploaded_video_url: exercise.uploaded_video_url || "",
        image_url: exercise.image_url || "",
        tags: exercise.tags ?? [],
        cardio_type:
          (exercise as any).metadata?.cardio_type ??
          (exercise as any).default_training_system ??
          "",
      });
      setInstructionsText((exercise.instructions || []).join("\n"));
      setTipsText((exercise.tips || []).join("\n"));
      setImagePreview(exercise.image_url || null);
      setVideoPreview(exercise.uploaded_video_url || null);
    } else {
      setFormData(EMPTY_FORM);
      setInstructionsText("");
      setTipsText("");
      setImagePreview(null);
      setVideoPreview(null);
    }
    setMuscleError(false);
    setFormError(null);
    setMediaError(null);
    setEquipmentInput("");
  }, [mode, exercise, isOpen]);

  const handleClose = () => {
    if (videoPreview && !videoPreview.startsWith("http")) {
      URL.revokeObjectURL(videoPreview);
    }
    onClose();
  };

  const handleImageSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setMediaError("La imagen es demasiado grande (máx. 5 MB).");

      return;
    }

    setMediaError(null);
    setUploadingImage(true);

    try {
      // Create preview
      const reader = new FileReader();

      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to server
      const result = await uploadExerciseImage(file);

      if (result.success && result.url) {
        setFormData((prev) => ({ ...prev, image_url: result.url || "" }));
      } else {
        setMediaError(result.error || "No se pudo subir la imagen.");
        setImagePreview(formData.image_url || null);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      setMediaError("No se pudo subir la imagen. Inténtalo de nuevo.");
      setImagePreview(formData.image_url || null);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, image_url: "" }));
    setImagePreview(null);
  };

  const handleVideoSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.size > 1024 * 1024 * 1024) {
      setMediaError("El vídeo es demasiado grande (máx. 1 GB).");

      return;
    }

    setMediaError(null);
    const previewUrl = URL.createObjectURL(file);

    setVideoPreview(previewUrl);

    try {
      setUploadingVideo(true);
      const result = await uploadExerciseVideo(file);

      if (result.success && result.url) {
        setFormData((prev) => ({
          ...prev,
          uploaded_video_url: result.url || "",
        }));
        // The server returns the processed video: preview that, not the raw blob.
        URL.revokeObjectURL(previewUrl);
        setVideoPreview(result.url);
      } else {
        setMediaError(result.error || "No se pudo subir el vídeo.");
        URL.revokeObjectURL(previewUrl);
        setVideoPreview(formData.uploaded_video_url || null);
      }
    } catch (error) {
      console.error("Error uploading video:", error);
      setMediaError("No se pudo subir el vídeo. Inténtalo de nuevo.");
      URL.revokeObjectURL(previewUrl);
      setVideoPreview(formData.uploaded_video_url || null);
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleRemoveVideo = async () => {
    const urlToDelete = formData.uploaded_video_url;

    if (urlToDelete) {
      const path = extractVideoPathFromUrl(urlToDelete);

      if (path) {
        await deleteExerciseVideo(path);
      }
    }
    if (videoPreview && !videoPreview.startsWith("http")) {
      URL.revokeObjectURL(videoPreview);
    }
    setFormData((prev) => ({ ...prev, uploaded_video_url: "" }));
    setVideoPreview(null);
  };

  const handleAddEquipment = () => {
    if (
      equipmentInput.trim() &&
      !formData.equipment.includes(equipmentInput.trim())
    ) {
      setFormData((prev) => ({
        ...prev,
        equipment: [...prev.equipment, equipmentInput.trim()],
      }));
      setEquipmentInput("");
    }
  };

  const handleRemoveEquipment = (item: string) => {
    setFormData((prev) => ({
      ...prev,
      equipment: prev.equipment.filter((e) => e !== item),
    }));
  };

  const handleSubmit = async () => {
    setFormError(null);

    // Validate required fields
    const validation = validateExerciseLibraryForm(formData);

    if (!validation.valid) {
      setFormError(validation.errors.join(". "));

      return;
    }

    if (
      primaryMuscleRequired(formData.category) &&
      formData.primary_muscles.length === 0
    ) {
      setMuscleError(true);
      document
        .getElementById(MUSCLE_PICKER_ID)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });

      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        instructions: toLines(instructionsText),
        tips: toLines(tipsText),
      };
      // Tags are sent only when needed: the column may not be migrated yet.
      const tagsChanged = editing
        ? formData.tags.join("\n") !== (editing.tags ?? []).join("\n")
        : formData.tags.length > 0;
      const response = await fetch(
        editing ? `/api/exercises/${editing.id}` : "/api/exercises",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            tags: tagsChanged ? formData.tags : undefined,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        onSuccess(editing ? undefined : result.exercise);
        handleClose();
      } else {
        setFormError(
          result.error ||
            (editing
              ? "No se pudo guardar el ejercicio."
              : "No se pudo crear el ejercicio.")
        );
      }
    } catch (error) {
      console.error("Error saving exercise:", error);
      setFormError(
        editing
          ? "No se pudo guardar el ejercicio. Inténtalo de nuevo."
          : "No se pudo crear el ejercicio. Inténtalo de nuevo."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasImage = Boolean(imagePreview || formData.image_url);
  const hasVideo = Boolean(videoPreview || formData.uploaded_video_url);
  const busy = isSubmitting || uploadingImage || uploadingVideo;
  const isCardio = formData.category === "cardio";
  const categories = editing ? ALL_CATEGORIES : NEW_CATEGORIES;

  return (
    <Modal
      hideCloseButton
      classNames={{
        base: "m-0 h-[calc(100vh-48px)] max-h-[calc(100vh-48px)] w-[min(1560px,calc(100vw-48px))] max-w-none",
        header: "border-b border-default-200 px-6 py-4",
        body: "px-6 py-6",
      }}
      isDismissable={!busy}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="5xl"
      onClose={handleClose}
    >
      <ModalContent>
        {/* Title and the two actions stay in view while the form scrolls. */}
        <ModalHeader className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col">
            <h2 className="font-heading text-xl font-semibold text-foreground">
              {editing ? "Editar ejercicio" : "Añadir ejercicio"}
            </h2>
            <p className="flex min-w-0 items-center gap-2 text-sm font-normal text-default-500">
              <span className="truncate">
                {editing
                  ? editing.name
                  : "Se guardará en tu biblioteca de ejercicios"}
              </span>
              {editing?.library_exercise_id ? (
                <Chip color="primary" size="sm" variant="flat">
                  Del catálogo
                </Chip>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              isDisabled={isSubmitting}
              variant="light"
              onPress={handleClose}
            >
              Cancelar
            </Button>
            <Button
              color="primary"
              isDisabled={busy || !formData.category}
              isLoading={isSubmitting}
              startContent={
                !isSubmitting && (
                  <Icon
                    icon={
                      editing ? "solar:diskette-bold" : "solar:add-circle-bold"
                    }
                    width={18}
                  />
                )
              }
              onPress={handleSubmit}
            >
              {isSubmitting
                ? editing
                  ? "Guardando…"
                  : "Creando…"
                : editing
                  ? "Guardar cambios"
                  : "Añadir ejercicio"}
            </Button>
          </div>
        </ModalHeader>

        <ModalBody>
          {formError ? (
            <p
              className="mb-4 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger"
              role="alert"
            >
              {formError}
            </p>
          ) : null}

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
            {/* Main column: what the exercise is and how it is done. */}
            <div className="flex min-w-0 flex-col gap-8">
              <Section
                {...(editing
                  ? {}
                  : {
                      hint: "Series, repeticiones y descanso se completan al añadirlo a un programa; después puedes cambiarlos.",
                    })}
                title="Datos del ejercicio"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    isRequired
                    label="Tipo"
                    labelPlacement="outside"
                    placeholder="Elige Fuerza o Cardio"
                    selectedKeys={formData.category ? [formData.category] : []}
                    variant="bordered"
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0] as string;

                      if (value) setFormData({ ...formData, category: value });
                    }}
                  >
                    {categories.map((cat) => (
                      <SelectItem key={cat.key}>{cat.label}</SelectItem>
                    ))}
                  </Select>
                  <Input
                    isRequired
                    label="Nombre"
                    labelPlacement="outside"
                    placeholder={
                      isCardio ? "Ej: Carrera continua" : "Ej: Sentadilla hack"
                    }
                    value={formData.name}
                    variant="bordered"
                    onValueChange={(value) =>
                      setFormData({ ...formData, name: value })
                    }
                  />
                </div>
                <div
                  className={`grid gap-4 ${isCardio ? "sm:grid-cols-2" : ""}`}
                >
                  <Input
                    label="Patrón de movimiento"
                    labelPlacement="outside"
                    placeholder="Ej: Sentadilla, empuje horizontal"
                    value={formData.movement_pattern}
                    variant="bordered"
                    onValueChange={(value) =>
                      setFormData({ ...formData, movement_pattern: value })
                    }
                  />
                  {isCardio ? (
                    <Input
                      label="Tipo de actividad"
                      labelPlacement="outside"
                      placeholder="Ej: Carrera, ciclismo"
                      value={formData.cardio_type}
                      variant="bordered"
                      onValueChange={(value) =>
                        setFormData({ ...formData, cardio_type: value })
                      }
                    />
                  ) : null}
                </div>
                <Textarea
                  label="Descripción"
                  labelPlacement="outside"
                  minRows={2}
                  placeholder="Qué es y para qué sirve"
                  value={formData.description}
                  variant="bordered"
                  onValueChange={(value) =>
                    setFormData({ ...formData, description: value })
                  }
                />
              </Section>

              {/* Muscles (Oct 14 call, JC): required except for cardio. */}
              <div className="border-t border-default-200 pt-8">
                <Section title="Músculos trabajados">
                  <MusclePicker
                    assistantRequest={() =>
                      editing
                        ? { exerciseIds: [editing.id] }
                        : {
                            draft: {
                              name: formData.name,
                              category: formData.category,
                              description: formData.description,
                              equipment: formData.equipment,
                              movement_pattern: formData.movement_pattern,
                              instructions: toLines(instructionsText),
                            },
                          }
                    }
                    category={formData.category}
                    disabled={isSubmitting}
                    exerciseName={formData.name}
                    showError={muscleError}
                    value={{
                      primary: formData.primary_muscles,
                      secondary: formData.secondary_muscles,
                    }}
                    onChange={(muscles) =>
                      setFormData((prev) => ({
                        ...prev,
                        primary_muscles: muscles.primary,
                        secondary_muscles: muscles.secondary,
                      }))
                    }
                    {...(editing
                      ? {
                          legacy: editing.muscle_groups,
                          savedSuggestion: editing.metadata?.muscle_suggestion,
                        }
                      : {})}
                  />
                </Section>
              </div>

              <div className="border-t border-default-200 pt-8">
                <Section
                  hint="Lo que verá tu cliente al abrir el ejercicio."
                  title="Cómo se hace"
                >
                  <Textarea
                    description="Un paso por línea."
                    label="Instrucciones"
                    labelPlacement="outside"
                    minRows={5}
                    placeholder={
                      "Siéntate en la máquina con la espalda apoyada\nAgarra las asas a la altura del pecho"
                    }
                    value={instructionsText}
                    variant="bordered"
                    onValueChange={setInstructionsText}
                  />
                  <Textarea
                    description="Un consejo por línea."
                    label="Consejos"
                    labelPlacement="outside"
                    minRows={3}
                    placeholder="Mantén la espalda recta durante todo el recorrido"
                    value={tipsText}
                    variant="bordered"
                    onValueChange={setTipsText}
                  />
                </Section>
              </div>
            </div>

            {/* Side column: media and organisation. */}
            <aside className="flex min-w-0 flex-col gap-8 rounded-xl bg-default-50 p-5 lg:self-start">
              <Section title="Multimedia">
                {/* Image */}
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Imagen
                  </span>
                  {hasImage ? (
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-default-200 bg-content1">
                      <img
                        alt="Vista previa de la imagen"
                        className="h-full w-full object-cover"
                        src={imagePreview || formData.image_url}
                      />
                      <div className="absolute right-2 top-2 flex gap-1.5">
                        <label className="cursor-pointer rounded-full focus-within:ring-2 focus-within:ring-primary">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-content1 text-foreground shadow-small [@media(hover:hover)]:hover:bg-default-100">
                            <Icon icon="solar:pen-bold" width={16} />
                          </span>
                          <span className="sr-only">Reemplazar imagen</span>
                          <input
                            accept={IMAGE_ACCEPT}
                            className="sr-only"
                            disabled={uploadingImage}
                            type="file"
                            onChange={handleImageSelect}
                          />
                        </label>
                        <Button
                          isIconOnly
                          aria-label="Quitar imagen"
                          className="h-8 w-8 min-w-8 bg-content1 text-danger shadow-small"
                          radius="full"
                          size="sm"
                          variant="flat"
                          onPress={handleRemoveImage}
                        >
                          <Icon icon="solar:trash-bin-trash-bold" width={16} />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-default-300 bg-content1 text-center transition-colors duration-150 focus-within:ring-2 focus-within:ring-primary [@media(hover:hover)]:hover:border-primary">
                      <Icon
                        className="text-default-400"
                        icon="solar:gallery-add-linear"
                        width={32}
                      />
                      <span className="text-sm font-medium text-foreground">
                        Subir imagen
                      </span>
                      <span className="text-xs text-default-500">
                        PNG, JPG, WEBP o GIF · máx. 5 MB
                      </span>
                      <input
                        accept={IMAGE_ACCEPT}
                        className="sr-only"
                        disabled={uploadingImage}
                        type="file"
                        onChange={handleImageSelect}
                      />
                    </label>
                  )}
                  {uploadingImage && (
                    <p className="text-sm text-default-500" role="status">
                      Subiendo imagen…
                    </p>
                  )}
                </div>

                {/* Vertical video */}
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Vídeo vertical
                  </span>
                  <p className="text-xs text-default-500">
                    9:16, hasta 1 GB. Se comprime solo.
                  </p>
                  {hasVideo ? (
                    <div className="flex items-start gap-4">
                      <div className="aspect-[9/16] w-[120px] shrink-0 overflow-hidden rounded-xl border border-default-200 bg-black shadow-small">
                        <video
                          controls
                          playsInline
                          className="h-full w-full object-cover"
                          src={videoPreview || formData.uploaded_video_url}
                        >
                          <track kind="captions" label="Spanish" srcLang="es" />
                        </video>
                      </div>
                      <div className="flex flex-col gap-2">
                        <p className="flex items-center gap-1 text-xs text-default-500">
                          <Icon icon="solar:smartphone-linear" width={14} />
                          Así lo ve tu cliente
                        </p>
                        <label className="cursor-pointer rounded-lg focus-within:ring-2 focus-within:ring-primary">
                          <span
                            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border border-default-300 bg-content1 px-3 text-sm font-medium text-foreground [@media(hover:hover)]:hover:bg-default-100 ${uploadingVideo ? "opacity-50" : ""}`}
                          >
                            <Icon icon="solar:pen-linear" width={16} />
                            Reemplazar
                          </span>
                          <input
                            accept={VIDEO_ACCEPT}
                            className="sr-only"
                            disabled={uploadingVideo}
                            type="file"
                            onChange={handleVideoSelect}
                          />
                        </label>
                        <Button
                          color="danger"
                          isDisabled={uploadingVideo}
                          size="sm"
                          startContent={
                            <Icon
                              icon="solar:trash-bin-trash-linear"
                              width={16}
                            />
                          }
                          variant="flat"
                          onPress={handleRemoveVideo}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-default-300 bg-content1 px-4 py-4 transition-colors duration-150 focus-within:ring-2 focus-within:ring-primary [@media(hover:hover)]:hover:border-primary">
                      <Icon
                        className="shrink-0 text-default-400"
                        icon="solar:videocamera-add-linear"
                        width={28}
                      />
                      <span className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          Subir vídeo
                        </span>
                        <span className="text-xs text-default-500">
                          MP4, WebM o MOV · máx. 1 GB
                        </span>
                      </span>
                      <input
                        accept={VIDEO_ACCEPT}
                        className="sr-only"
                        disabled={uploadingVideo}
                        type="file"
                        onChange={handleVideoSelect}
                      />
                    </label>
                  )}
                  {uploadingVideo && (
                    <p className="text-sm text-default-500" role="status">
                      Procesando el vídeo… puede tardar un momento.
                    </p>
                  )}
                </div>

                <Input
                  description="YouTube o Vimeo. Para Reels, TikTok o Instagram, sube el archivo."
                  errorMessage="Este enlace no se puede mostrar al cliente. Usa YouTube o Vimeo, o sube el archivo."
                  isInvalid={isUnsupportedExternalUrl(formData.video_url)}
                  label="Enlace de vídeo tutorial"
                  labelPlacement="outside"
                  placeholder="https://youtube.com/…"
                  value={formData.video_url}
                  variant="bordered"
                  onValueChange={(value) =>
                    setFormData({ ...formData, video_url: value })
                  }
                />

                {mediaError ? (
                  <p className="text-sm text-danger" role="alert">
                    {mediaError}
                  </p>
                ) : null}
              </Section>

              <div className="border-t border-default-200 pt-8">
                <Section title="Organización">
                  <TagsField
                    description="Para filtrar la biblioteca al montar sesiones."
                    disabled={isSubmitting}
                    kind="exercise"
                    labelPlacement="outside"
                    placeholder="Ej. pectoral, mancuernas…"
                    value={formData.tags}
                    onChange={(tags) =>
                      setFormData((prev) => ({ ...prev, tags }))
                    }
                  />

                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-foreground">
                      Equipamiento
                    </span>
                    <div className="flex gap-2">
                      <Input
                        aria-label="Añadir equipamiento"
                        placeholder="Ej: barra, máquina hack"
                        value={equipmentInput}
                        variant="bordered"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddEquipment();
                          }
                        }}
                        onValueChange={setEquipmentInput}
                      />
                      <Button
                        isDisabled={!equipmentInput.trim()}
                        variant="flat"
                        onPress={handleAddEquipment}
                      >
                        Añadir
                      </Button>
                    </div>
                    {formData.equipment.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.equipment.map((item) => (
                          <Chip
                            key={item}
                            endContent={
                              <button
                                aria-label={`Quitar ${item}`}
                                className="compact-control ml-1"
                                type="button"
                                onClick={() => handleRemoveEquipment(item)}
                              >
                                <Icon
                                  icon="solar:close-circle-bold"
                                  width={16}
                                />
                              </button>
                            }
                            variant="flat"
                          >
                            {item}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </div>
                </Section>
              </div>
            </aside>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

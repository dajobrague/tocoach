"use client";

import type { Exercise } from "@/types/training";

import {
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import {
  deleteExerciseVideo,
  extractVideoPathFromUrl,
  uploadExerciseImage,
  uploadExerciseVideo,
  validateExerciseLibraryForm,
} from "@/lib/utils/exercise-utils";
import { isUnsupportedExternalUrl } from "@/lib/utils/video-url";

interface EditExerciseLibraryModalProps {
  isOpen: boolean;
  exercise: Exercise;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditExerciseLibraryModal({
  isOpen,
  exercise,
  onClose,
  onSuccess,
}: EditExerciseLibraryModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    muscle_groups: [] as string[],
    equipment: [] as string[],
    movement_pattern: "",
    video_url: "",
    uploaded_video_url: "",
    image_url: "",
    instructions: [] as string[],
    tips: [] as string[],
    cardio_type: "",
  });
  const [muscleGroupInput, setMuscleGroupInput] = useState("");
  const [equipmentInput, setEquipmentInput] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form with exercise data
  useEffect(() => {
    if (exercise) {
      setFormData({
        name: exercise.name || "",
        description: exercise.description || "",
        category: exercise.category || "",
        muscle_groups: exercise.muscle_groups || [],
        equipment: exercise.equipment || [],
        movement_pattern: exercise.movement_pattern || "",
        video_url: exercise.video_url || "",
        uploaded_video_url: exercise.uploaded_video_url || "",
        image_url: exercise.image_url || "",
        instructions: exercise.instructions || [],
        tips: exercise.tips || [],
        cardio_type:
          (exercise as any).metadata?.cardio_type ??
          (exercise as any).default_training_system ??
          "",
      });
      setImagePreview(exercise.image_url || null);
      setVideoPreview(exercise.uploaded_video_url || null);
    }
  }, [exercise]);

  const categories = [
    { key: "strength", label: "Fuerza" },
    { key: "cardio", label: "Cardio" },
    { key: "flexibility", label: "Flexibilidad" },
    { key: "balance", label: "Equilibrio" },
    { key: "plyometric", label: "Pliométrico" },
    { key: "olympic", label: "Olímpico" },
    { key: "powerlifting", label: "Powerlifting" },
    { key: "bodyweight", label: "Peso Corporal" },
    { key: "other", label: "Otro" },
  ];

  const handleImageSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert("El archivo es demasiado grande (máx 5MB)");

      return;
    }

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
        alert(result.error || "Error al subir imagen");
        setImagePreview(formData.image_url || null);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Error al subir imagen. Por favor intenta de nuevo.");
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
      alert("El archivo es demasiado grande (máx 1GB)");

      return;
    }

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
        URL.revokeObjectURL(previewUrl);
        setVideoPreview(result.url);
      } else {
        alert(result.error || "Error al subir video");
        URL.revokeObjectURL(previewUrl);
        setVideoPreview(formData.uploaded_video_url || null);
      }
    } catch (error) {
      console.error("Error uploading video:", error);
      alert("Error al subir video. Por favor intenta de nuevo.");
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

  const handleAddMuscleGroup = () => {
    if (
      muscleGroupInput.trim() &&
      !formData.muscle_groups.includes(muscleGroupInput.trim())
    ) {
      setFormData((prev) => ({
        ...prev,
        muscle_groups: [...prev.muscle_groups, muscleGroupInput.trim()],
      }));
      setMuscleGroupInput("");
    }
  };

  const handleRemoveMuscleGroup = (group: string) => {
    setFormData((prev) => ({
      ...prev,
      muscle_groups: prev.muscle_groups.filter((g) => g !== group),
    }));
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
    // Validate required fields
    const validation = validateExerciseLibraryForm(formData);

    if (!validation.valid) {
      alert(validation.errors.join("\n"));

      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/exercises/${exercise.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Error updating exercise:", error);
      alert("Error al actualizar ejercicio. Por favor intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      classNames={{
        base: "max-h-[90vh]",
        header: "border-b border-gray-200",
        footer: "border-t border-gray-200",
        body: "py-6",
      }}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="4xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-2 rounded-lg">
              <Icon
                className="text-slate-700 text-xl"
                icon="solar:dumbbell-bold"
              />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Editar Ejercicio
              </h3>
              <p className="text-sm text-gray-500 font-normal">
                Actualiza la información del ejercicio
              </p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-6">
            {/* Basic Information */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Icon
                  className="text-slate-700"
                  icon="solar:clipboard-list-bold"
                  width={18}
                />
                Información Básica
              </h4>
              <div className="space-y-4">
                <Input
                  isRequired
                  label="Nombre del Ejercicio"
                  placeholder="Ej: Sentadilla Hack"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:clipboard-text-linear"
                      width={18}
                    />
                  }
                  value={formData.name}
                  onValueChange={(value) =>
                    setFormData({ ...formData, name: value })
                  }
                />
                <Textarea
                  label="Descripción (Opcional)"
                  minRows={2}
                  placeholder="Describe el ejercicio..."
                  value={formData.description}
                  onValueChange={(value) =>
                    setFormData({ ...formData, description: value })
                  }
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    isRequired
                    label="Categoría"
                    placeholder="Selecciona una categoría"
                    selectedKeys={formData.category ? [formData.category] : []}
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:tag-linear"
                        width={18}
                      />
                    }
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0] as string;

                      setFormData({ ...formData, category: value });
                    }}
                  >
                    {categories.map((cat) => (
                      <SelectItem key={cat.key}>{cat.label}</SelectItem>
                    ))}
                  </Select>
                  <Input
                    label="Patrón de movimiento (Opcional)"
                    placeholder="Ej: Sentadilla, Bisagra de cadera, Empuje horizontal"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:target-linear"
                        width={18}
                      />
                    }
                    value={formData.movement_pattern}
                    onValueChange={(value) =>
                      setFormData({ ...formData, movement_pattern: value })
                    }
                  />
                </div>
                {formData.category === "cardio" && (
                  <Input
                    label="Tipo de Actividad"
                    placeholder="Ej: Carrera, Ciclismo"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:running-linear"
                        width={18}
                      />
                    }
                    value={formData.cardio_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, cardio_type: value })
                    }
                  />
                )}
              </div>
            </div>

            {/* Media */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Icon
                  className="text-slate-700"
                  icon="solar:gallery-bold"
                  width={18}
                />
                Multimedia
              </h4>
              <div className="space-y-4">
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Imagen del Ejercicio
                  </label>
                  {imagePreview || formData.image_url ? (
                    <div className="relative w-full h-64 rounded-lg overflow-hidden border-2 border-gray-200">
                      <img
                        alt="Preview"
                        className="w-full h-full object-cover"
                        src={imagePreview || formData.image_url}
                      />
                      <div className="absolute top-2 right-2 flex gap-2">
                        <label>
                          <Button
                            isIconOnly
                            as="span"
                            className="bg-black text-white hover:bg-slate-800"
                            size="sm"
                            variant="solid"
                          >
                            <Icon icon="solar:pen-bold" width={18} />
                          </Button>
                          <input
                            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                            className="hidden"
                            disabled={uploadingImage}
                            type="file"
                            onChange={handleImageSelect}
                          />
                        </label>
                        <Button
                          isIconOnly
                          color="danger"
                          size="sm"
                          variant="solid"
                          onPress={handleRemoveImage}
                        >
                          <Icon icon="solar:trash-bin-trash-bold" width={18} />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Icon
                          className="text-gray-400 mb-3"
                          icon="solar:cloud-upload-bold"
                          width={48}
                        />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">
                            Click para subir
                          </span>{" "}
                          o arrastra y suelta
                        </p>
                        <p className="text-xs text-gray-500">
                          PNG, JPG, WEBP o GIF (MAX. 5MB)
                        </p>
                      </div>
                      <input
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                        className="hidden"
                        disabled={uploadingImage}
                        type="file"
                        onChange={handleImageSelect}
                      />
                    </label>
                  )}
                  {uploadingImage && (
                    <p className="text-sm text-slate-700 mt-2">
                      Subiendo imagen...
                    </p>
                  )}
                </div>

                {/* Video Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Video Vertical del Ejercicio (Opcional)
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Sube un video vertical (9:16) de hasta 1GB. Se comprimirá
                    automáticamente.
                  </p>
                  {videoPreview || formData.uploaded_video_url ? (
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Icon icon="solar:smartphone-bold" width={14} />
                        Vista previa del cliente
                      </p>
                      <div
                        className="relative rounded-2xl overflow-hidden border-2 border-gray-300 bg-black shadow-lg"
                        style={{ width: 192, height: 341 }}
                      >
                        <video
                          controls
                          playsInline
                          className="w-full h-full object-cover"
                          src={videoPreview || formData.uploaded_video_url}
                        >
                          <track kind="captions" label="Spanish" srcLang="es" />
                        </video>
                      </div>
                      <div className="flex gap-2">
                        <label>
                          <Button
                            as="span"
                            className="bg-black text-white hover:bg-slate-800"
                            isDisabled={uploadingVideo}
                            size="sm"
                            startContent={
                              <Icon icon="solar:pen-bold" width={16} />
                            }
                            variant="solid"
                          >
                            Reemplazar
                          </Button>
                          <input
                            accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.mov,.webm,.m4v"
                            className="hidden"
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
                              icon="solar:trash-bin-trash-bold"
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
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Icon
                          className="text-gray-400 mb-3"
                          icon="solar:videocamera-record-bold"
                          width={48}
                        />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">
                            Click para subir video
                          </span>{" "}
                          o arrastra y suelta
                        </p>
                        <p className="text-xs text-gray-500">
                          MP4, WebM o MOV (MÁX. 1GB)
                        </p>
                      </div>
                      <input
                        accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.mov,.webm,.m4v"
                        className="hidden"
                        disabled={uploadingVideo}
                        type="file"
                        onChange={handleVideoSelect}
                      />
                    </label>
                  )}
                  {uploadingVideo && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Icon
                          className="animate-spin"
                          icon="solar:refresh-bold"
                          width={16}
                        />
                        Procesando video...
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Esto puede tardar un momento. Estamos optimizando el
                        video para que se vea bien y cargue rápido.
                      </p>
                    </div>
                  )}
                </div>

                <Input
                  description="YouTube o Vimeo. Para Reels, TikTok o Instagram, sube el archivo arriba — esos enlaces no se reproducen dentro de la app."
                  errorMessage="Este enlace no se puede mostrar al cliente. Usa YouTube/Vimeo o sube el archivo arriba."
                  isInvalid={isUnsupportedExternalUrl(formData.video_url)}
                  label="URL del Video Tutorial (Opcional)"
                  placeholder="https://youtube.com/... o https://vimeo.com/..."
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:video-library-linear"
                      width={18}
                    />
                  }
                  value={formData.video_url}
                  onValueChange={(value) =>
                    setFormData({ ...formData, video_url: value })
                  }
                />
              </div>
            </div>

            {/* Additional Details */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Icon
                  className="text-slate-700"
                  icon="solar:notes-bold"
                  width={18}
                />
                Detalles Adicionales (Opcional)
              </h4>
              <div className="space-y-4">
                {/* Muscle Groups */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grupos Musculares
                  </label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      placeholder="Ej: Cuádriceps, Glúteos"
                      value={muscleGroupInput}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddMuscleGroup();
                        }
                      }}
                      onValueChange={setMuscleGroupInput}
                    />
                    <Button
                      className="bg-black text-white hover:bg-slate-800"
                      variant="flat"
                      onPress={handleAddMuscleGroup}
                    >
                      Añadir
                    </Button>
                  </div>
                  {formData.muscle_groups.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.muscle_groups.map((group) => (
                        <Chip
                          key={group}
                          className="bg-slate-200 text-slate-800"
                          endContent={
                            <button
                              className="ml-1"
                              type="button"
                              onClick={() => handleRemoveMuscleGroup(group)}
                            >
                              <Icon icon="solar:close-circle-bold" width={16} />
                            </button>
                          }
                          variant="flat"
                        >
                          {group}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>

                {/* Equipment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Equipamiento Necesario
                  </label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      placeholder="Ej: Máquina Hack, Barra"
                      value={equipmentInput}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddEquipment();
                        }
                      }}
                      onValueChange={setEquipmentInput}
                    />
                    <Button
                      className="bg-black text-white hover:bg-slate-800"
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
                          className="bg-slate-200 text-slate-800"
                          endContent={
                            <button
                              className="ml-1"
                              type="button"
                              onClick={() => handleRemoveEquipment(item)}
                            >
                              <Icon icon="solar:close-circle-bold" width={16} />
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
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button isDisabled={isSubmitting} variant="light" onPress={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-black text-white hover:bg-slate-800 font-semibold"
            isDisabled={isSubmitting || uploadingImage || uploadingVideo}
            isLoading={isSubmitting}
            startContent={
              !isSubmitting && <Icon icon="solar:save-bold" width={18} />
            }
            onPress={handleSubmit}
          >
            {isSubmitting ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

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
  uploadExerciseImage,
  validateExerciseLibraryForm,
} from "@/lib/utils/exercise-utils";

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
    image_url: "",
    instructions: [] as string[],
    tips: [] as string[],
    default_sets: "",
    default_reps: "",
    default_tempo: "",
    default_rest_seconds: "",
    default_training_system: "",
  });
  const [muscleGroupInput, setMuscleGroupInput] = useState("");
  const [equipmentInput, setEquipmentInput] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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
        image_url: exercise.image_url || "",
        instructions: exercise.instructions || [],
        tips: exercise.tips || [],
        default_sets: exercise.default_sets?.toString() || "",
        default_reps: exercise.default_reps || "",
        default_tempo: exercise.default_tempo || "",
        default_rest_seconds: exercise.default_rest_seconds?.toString() || "",
        default_training_system: exercise.default_training_system || "",
      });
      setImagePreview(exercise.image_url || null);
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

                <Input
                  label="URL del Video Tutorial (Opcional)"
                  placeholder="https://youtube.com/..."
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

            {/* Default Training Parameters */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Icon
                  className="text-slate-700"
                  icon="solar:settings-bold"
                  width={18}
                />
                Programación del ejercicio por defecto
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                Estos valores se autocompletarán, al añadir el ejercicio a un
                programa. Podrás modificarlos posteriormente según sea
                necesario.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Series"
                  placeholder="Ej: 4"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:copy-linear"
                      width={18}
                    />
                  }
                  type="number"
                  value={formData.default_sets}
                  onValueChange={(value) =>
                    setFormData({ ...formData, default_sets: value })
                  }
                />
                <Input
                  label="Repeticiones"
                  placeholder="Ej: 10-12 o AMRAP"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:hashtag-linear"
                      width={18}
                    />
                  }
                  value={formData.default_reps}
                  onValueChange={(value) =>
                    setFormData({ ...formData, default_reps: value })
                  }
                />
                <Input
                  label="Tempo"
                  placeholder="Ej: Explosivo, Normal"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:speedometer-linear"
                      width={18}
                    />
                  }
                  value={formData.default_tempo}
                  onValueChange={(value) =>
                    setFormData({ ...formData, default_tempo: value })
                  }
                />
                <Input
                  label="Descanso (segundos)"
                  placeholder="Ej: 90"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:clock-circle-linear"
                      width={18}
                    />
                  }
                  type="number"
                  value={formData.default_rest_seconds}
                  onValueChange={(value) =>
                    setFormData({ ...formData, default_rest_seconds: value })
                  }
                />
                <Input
                  className="md:col-span-2"
                  label="Sistema de Entrenamiento"
                  placeholder="Ej: Series Rectas, Drop Sets"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:chart-linear"
                      width={18}
                    />
                  }
                  value={formData.default_training_system}
                  onValueChange={(value) =>
                    setFormData({ ...formData, default_training_system: value })
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
            isDisabled={isSubmitting || uploadingImage}
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

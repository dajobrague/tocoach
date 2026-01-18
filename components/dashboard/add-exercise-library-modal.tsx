"use client";

import {
  Button,
  Card,
  CardBody,
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
import { useState } from "react";

import {
  uploadExerciseImage,
  validateExerciseLibraryForm,
} from "@/lib/utils/exercise-utils";

interface AddExerciseLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (exercise?: any) => void;
}

export default function AddExerciseLibraryModal({
  isOpen,
  onClose,
  onSuccess,
}: AddExerciseLibraryModalProps) {
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
        setImagePreview(null);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Error al subir imagen. Por favor intenta de nuevo.");
      setImagePreview(null);
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
      const response = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        onSuccess(result.exercise);
        handleClose();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Error creating exercise:", error);
      alert("Error al crear ejercicio. Por favor intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: "",
      description: "",
      category: "",
      muscle_groups: [],
      equipment: [],
      movement_pattern: "",
      video_url: "",
      image_url: "",
      instructions: [],
      tips: [],
      default_sets: "",
      default_reps: "",
      default_tempo: "",
      default_rest_seconds: "",
      default_training_system: "",
    });
    setImagePreview(null);
    setMuscleGroupInput("");
    setEquipmentInput("");
    onClose();
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
      onClose={handleClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="bg-blue-50 p-2 rounded-lg">
              <Icon
                className="text-blue-600 text-xl"
                icon="solar:dumbbell-bold"
              />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Añadir Ejercicio a la Biblioteca
              </h3>
              <p className="text-sm text-gray-500 font-normal">
                Completa la información del ejercicio
              </p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-6">
            {/* Category Selection */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Icon
                  className="text-blue-600"
                  icon="solar:tag-bold"
                  width={18}
                />
                Tipo de Ejercicio
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <button
                  className={`relative p-6 rounded-xl border-2 transition-all ${
                    formData.category === "strength"
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, category: "strength" })
                  }
                >
                  {formData.category === "strength" && (
                    <div className="absolute top-2 right-2">
                      <Icon
                        className="text-blue-500"
                        icon="solar:check-circle-bold"
                        width={24}
                      />
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className={`p-4 rounded-full ${
                        formData.category === "strength"
                          ? "bg-blue-100"
                          : "bg-gray-100"
                      }`}
                    >
                      <Icon
                        className={
                          formData.category === "strength"
                            ? "text-blue-600"
                            : "text-gray-400"
                        }
                        icon="solar:dumbbell-bold"
                        width={32}
                      />
                    </div>
                    <div className="text-center">
                      <p
                        className={`font-bold text-lg ${
                          formData.category === "strength"
                            ? "text-blue-900"
                            : "text-gray-700"
                        }`}
                      >
                        Fuerza
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Ejercicios con pesas, máquinas y resistencia
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  className={`relative p-6 rounded-xl border-2 transition-all ${
                    formData.category === "cardio"
                      ? "border-red-500 bg-red-50 shadow-md"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, category: "cardio" })
                  }
                >
                  {formData.category === "cardio" && (
                    <div className="absolute top-2 right-2">
                      <Icon
                        className="text-red-500"
                        icon="solar:check-circle-bold"
                        width={24}
                      />
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className={`p-4 rounded-full ${
                        formData.category === "cardio"
                          ? "bg-red-100"
                          : "bg-gray-100"
                      }`}
                    >
                      <Icon
                        className={
                          formData.category === "cardio"
                            ? "text-red-600"
                            : "text-gray-400"
                        }
                        icon="solar:heart-pulse-bold"
                        width={32}
                      />
                    </div>
                    <div className="text-center">
                      <p
                        className={`font-bold text-lg ${
                          formData.category === "cardio"
                            ? "text-red-900"
                            : "text-gray-700"
                        }`}
                      >
                        Cardio
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Ejercicios cardiovasculares y de resistencia
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Basic Information - Only show if category is selected */}
            {formData.category && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-blue-600"
                    icon="solar:clipboard-list-bold"
                    width={18}
                  />
                  Información Básica
                </h4>
                <div className="space-y-4">
                  <Input
                    isRequired
                    label="Nombre del Ejercicio"
                    placeholder={
                      formData.category === "strength"
                        ? "Ej: Sentadilla Hack"
                        : "Ej: Carrera Continua"
                    }
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
            )}

            {/* Media - Only show if category is selected */}
            {formData.category && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className={
                      formData.category === "strength"
                        ? "text-blue-600"
                        : "text-red-600"
                    }
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
                        <Button
                          isIconOnly
                          className="absolute top-2 right-2"
                          color="danger"
                          size="sm"
                          variant="solid"
                          onPress={handleRemoveImage}
                        >
                          <Icon icon="solar:trash-bin-trash-bold" width={18} />
                        </Button>
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
                      <p className="text-sm text-blue-600 mt-2">
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
            )}

            {/* Default Training Parameters - Show based on category */}
            {formData.category === "strength" && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-blue-600"
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
                      setFormData({
                        ...formData,
                        default_training_system: value,
                      })
                    }
                  />
                </div>
              </div>
            )}

            {formData.category === "cardio" && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-red-600"
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
                    label="Duración (minutos)"
                    placeholder="Ej: 30"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:clock-circle-linear"
                        width={18}
                      />
                    }
                    type="number"
                    value={formData.default_reps}
                    onValueChange={(value) =>
                      setFormData({ ...formData, default_reps: value })
                    }
                  />
                  <Input
                    label="Distancia (km)"
                    placeholder="Ej: 5"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:routing-linear"
                        width={18}
                      />
                    }
                    type="number"
                    value={formData.default_sets}
                    onValueChange={(value) =>
                      setFormData({ ...formData, default_sets: value })
                    }
                  />
                  <Select
                    label="Intensidad"
                    placeholder="Selecciona intensidad"
                    selectedKeys={
                      formData.default_tempo ? [formData.default_tempo] : []
                    }
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:speedometer-linear"
                        width={18}
                      />
                    }
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0] as string;

                      setFormData({ ...formData, default_tempo: value });
                    }}
                  >
                    <SelectItem key="Baja">Baja</SelectItem>
                    <SelectItem key="Moderada">Moderada</SelectItem>
                    <SelectItem key="Alta">Alta</SelectItem>
                    <SelectItem key="Intervalos">Intervalos</SelectItem>
                  </Select>
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
                    value={formData.default_training_system}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        default_training_system: value,
                      })
                    }
                  />
                </div>
              </div>
            )}

            {/* Additional Details - Show based on category */}
            {formData.category && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className={
                      formData.category === "strength"
                        ? "text-blue-600"
                        : "text-red-600"
                    }
                    icon="solar:notes-bold"
                    width={18}
                  />
                  Detalles Adicionales (Opcional)
                </h4>
                <div className="space-y-4">
                  {/* Muscle Groups - Only for strength */}
                  {formData.category === "strength" && (
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
                          color="primary"
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
                              className="bg-blue-100 text-blue-700"
                              endContent={
                                <button
                                  className="ml-1"
                                  type="button"
                                  onClick={() => handleRemoveMuscleGroup(group)}
                                >
                                  <Icon
                                    icon="solar:close-circle-bold"
                                    width={16}
                                  />
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
                  )}

                  {/* Equipment */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {formData.category === "strength"
                        ? "Equipamiento Necesario"
                        : "Equipamiento o Ubicación"}
                    </label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        placeholder={
                          formData.category === "strength"
                            ? "Ej: Máquina Hack, Barra"
                            : "Ej: Cinta de correr, Aire libre"
                        }
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
                        color={
                          formData.category === "strength"
                            ? "primary"
                            : "danger"
                        }
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
                            className={
                              formData.category === "strength"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-orange-100 text-orange-700"
                            }
                            endContent={
                              <button
                                className="ml-1"
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
                </div>
              </div>
            )}

            {/* Info Card - Show based on category */}
            {!formData.category && (
              <Card className="bg-yellow-50 border border-yellow-200">
                <CardBody className="p-4">
                  <div className="flex items-start gap-2">
                    <Icon
                      className="text-yellow-600 mt-0.5 flex-shrink-0"
                      icon="solar:lightbulb-bolt-bold"
                      width={18}
                    />
                    <div>
                      <p className="text-sm font-semibold text-yellow-900 mb-1">
                        Comienza seleccionando el tipo
                      </p>
                      <p className="text-sm text-yellow-700">
                        Elige si este es un ejercicio de Fuerza o Cardio para
                        continuar con los campos específicos.
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}
            {formData.category && (
              <Card
                className={
                  formData.category === "strength"
                    ? "bg-blue-50 border border-blue-100"
                    : "bg-red-50 border border-red-100"
                }
              >
                <CardBody className="p-4">
                  <div className="flex items-start gap-2">
                    <Icon
                      className={`${
                        formData.category === "strength"
                          ? "text-blue-600"
                          : "text-red-600"
                      } mt-0.5 flex-shrink-0`}
                      icon="solar:info-circle-bold"
                      width={18}
                    />
                    <div>
                      <p
                        className={`text-sm font-semibold ${
                          formData.category === "strength"
                            ? "text-blue-900"
                            : "text-red-900"
                        } mb-1`}
                      >
                        {formData.category === "strength"
                          ? "Ejercicio de Fuerza"
                          : "Ejercicio Cardiovascular"}
                      </p>
                      <p
                        className={`text-sm ${
                          formData.category === "strength"
                            ? "text-blue-700"
                            : "text-red-700"
                        }`}
                      >
                        Los parámetros por defecto se autocompletarán, cuando
                        añadas este ejercicio a un programa. Podrás modificarlos
                        posteriormente según sea necesario.
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={isSubmitting}
            variant="light"
            onPress={handleClose}
          >
            Cancelar
          </Button>
          <Button
            className="text-white font-semibold"
            color={formData.category === "cardio" ? "danger" : "primary"}
            isDisabled={isSubmitting || uploadingImage || !formData.category}
            isLoading={isSubmitting}
            startContent={
              !isSubmitting && <Icon icon="solar:add-circle-bold" width={18} />
            }
            onPress={handleSubmit}
          >
            {isSubmitting ? "Guardando..." : "Añadir Ejercicio"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

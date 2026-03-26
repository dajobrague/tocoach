"use client";

import type { Exercise } from "@/types/training";

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
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import AddExerciseLibraryModal from "./add-exercise-library-modal";
import EditExerciseLibraryModal from "./edit-exercise-library-modal";

import { formatRestTime, getCategoryLabel } from "@/lib/utils/exercise-utils";

export default function ExerciseLibraryContent() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("strength");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [viewingExercise, setViewingExercise] = useState<Exercise | null>(null);

  // Fetch exercises
  const fetchExercises = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();

      if (categoryFilter && categoryFilter !== "all") {
        params.append("category", categoryFilter);
      }
      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const response = await fetch(`/api/exercises?${params.toString()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      const result = await response.json();

      if (result.success) {
        setExercises(result.exercises);
      } else {
        console.error("Error fetching exercises:", result.error);
      }
    } catch (error) {
      console.error("Error fetching exercises:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExercises();
  }, [categoryFilter]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== "") {
        fetchExercises();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle delete
  const handleDelete = async (exerciseId: string, exerciseName: string) => {
    if (
      !confirm(
        `¿Estás seguro de que quieres eliminar "${exerciseName}"? Esta acción no se puede deshacer. El ejercicio no se puede eliminar si está siendo usado en programas activos.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/exercises/${exerciseId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        fetchExercises();
      } else {
        alert(result.error || "Error al eliminar ejercicio");
      }
    } catch (error) {
      console.error("Error deleting exercise:", error);
      alert("Error al eliminar ejercicio");
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Biblioteca de Ejercicios
            </h1>
            <p className="text-gray-500 mt-1">
              Gestiona tu catálogo personal de ejercicios
            </p>
          </div>
          <Button
            className="bg-black text-white hover:bg-slate-800 font-semibold"
            size="lg"
            startContent={<Icon icon="solar:add-circle-bold" width={20} />}
            onPress={() => setIsAddModalOpen(true)}
          >
            Añadir Ejercicio
          </Button>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2">
            <Button
              className={
                categoryFilter === "strength"
                  ? "font-semibold bg-black text-white hover:bg-slate-800"
                  : "font-semibold text-slate-700 bg-white"
              }
              size="lg"
              startContent={<Icon icon="solar:dumbbell-bold" width={20} />}
              variant={categoryFilter === "strength" ? "solid" : "bordered"}
              onPress={() => setCategoryFilter("strength")}
            >
              Fuerza
            </Button>
            <Button
              className={`font-semibold ${
                categoryFilter === "cardio"
                  ? "text-white"
                  : "text-red-600 bg-white"
              }`}
              color={categoryFilter === "cardio" ? "danger" : "default"}
              size="lg"
              startContent={<Icon icon="solar:heart-pulse-bold" width={20} />}
              variant={categoryFilter === "cardio" ? "solid" : "bordered"}
              onPress={() => setCategoryFilter("cardio")}
            >
              Cardio
            </Button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-2">
            <Button
              isIconOnly
              className={viewMode === "grid" ? "bg-black text-white" : ""}
              size="md"
              variant={viewMode === "grid" ? "solid" : "bordered"}
              onPress={() => setViewMode("grid")}
            >
              <Icon icon="solar:widget-4-bold" width={20} />
            </Button>
            <Button
              isIconOnly
              className={viewMode === "table" ? "bg-black text-white" : ""}
              size="md"
              variant={viewMode === "table" ? "solid" : "bordered"}
              onPress={() => setViewMode("table")}
            >
              <Icon icon="solar:list-bold" width={20} />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <Input
          classNames={{
            input: "text-sm",
            inputWrapper: "h-12",
          }}
          placeholder="Buscar ejercicios por nombre..."
          startContent={
            <Icon
              className="text-gray-400"
              icon="solar:magnifer-linear"
              width={20}
            />
          }
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardBody className="p-12">
            <div className="flex flex-col items-center justify-center">
              <Spinner color="primary" size="lg" />
              <p className="mt-4 text-gray-600">Cargando ejercicios...</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && exercises.length === 0 && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardBody className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="bg-gray-100 p-4 rounded-full mb-4">
                <Icon
                  className="text-gray-400 text-5xl"
                  icon="solar:dumbbell-linear"
                />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery
                  ? "No se encontraron ejercicios"
                  : `No hay ejercicios de ${
                      categoryFilter === "cardio" ? "cardio" : "fuerza"
                    }`}
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                {searchQuery
                  ? "Intenta con otros términos de búsqueda"
                  : `Comienza añadiendo ejercicios de ${
                      categoryFilter === "cardio" ? "cardio" : "fuerza"
                    } a tu biblioteca`}
              </p>
              {!searchQuery && (
                <Button
                  className="text-white font-semibold"
                  color="primary"
                  startContent={
                    <Icon icon="solar:add-circle-bold" width={20} />
                  }
                  onPress={() => setIsAddModalOpen(true)}
                >
                  Añadir Primer Ejercicio
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Exercise Grid View */}
      {!isLoading && exercises.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exercises.map((exercise) => (
            <Card
              key={exercise.id}
              className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <CardBody className="p-0">
                {/* Image Section - Clickable */}
                {exercise.image_url ? (
                  <div
                    className="relative w-full h-48 bg-gray-100 overflow-hidden cursor-pointer"
                    onClick={() => setViewingExercise(exercise)}
                  >
                    <img
                      alt={exercise.name}
                      className="w-full h-full object-cover"
                      src={exercise.image_url}
                    />
                  </div>
                ) : (
                  <div
                    className={`relative w-full h-48 bg-gradient-to-br cursor-pointer ${
                      exercise.category === "cardio"
                        ? "from-red-50 to-orange-50"
                        : "from-slate-50 to-purple-50"
                    } flex items-center justify-center`}
                    onClick={() => setViewingExercise(exercise)}
                  >
                    <Icon
                      className={
                        exercise.category === "cardio"
                          ? "text-red-300"
                          : "text-slate-300"
                      }
                      icon={
                        exercise.category === "cardio"
                          ? "solar:heart-pulse-bold"
                          : "solar:dumbbell-bold"
                      }
                      width={64}
                    />
                  </div>
                )}

                {/* Content Section */}
                <div
                  className="p-6 cursor-pointer"
                  onClick={() => setViewingExercise(exercise)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        {exercise.name}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <Chip
                          className="bg-slate-200 text-slate-800 border border-slate-300"
                          size="sm"
                          variant="flat"
                        >
                          {getCategoryLabel(exercise.category)}
                        </Chip>
                        {exercise.movement_pattern && (
                          <Chip
                            className="bg-purple-100 text-purple-700 border border-purple-200"
                            size="sm"
                            variant="flat"
                          >
                            Patrón: {exercise.movement_pattern}
                          </Chip>
                        )}
                        {exercise.uploaded_video_url && (
                          <Chip
                            className="bg-blue-100 text-blue-700 border border-blue-200"
                            size="sm"
                            startContent={
                              <Icon
                                icon="solar:videocamera-record-bold"
                                width={14}
                              />
                            }
                            variant="flat"
                          >
                            Video
                          </Chip>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {exercise.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {exercise.description}
                    </p>
                  )}

                  {/* Default Parameters */}
                  {(exercise.default_sets ||
                    exercise.default_reps ||
                    exercise.default_tempo ||
                    exercise.default_rest_seconds ||
                    exercise.default_training_system) && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                        Valores por Defecto
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {exercise.default_sets && (
                          <div>
                            <span className="text-gray-500">Series: </span>
                            <span className="font-semibold text-gray-900">
                              {exercise.default_sets}
                            </span>
                          </div>
                        )}
                        {exercise.default_reps && (
                          <div>
                            <span className="text-gray-500">Reps: </span>
                            <span className="font-semibold text-gray-900">
                              {exercise.default_reps}
                            </span>
                          </div>
                        )}
                        {exercise.default_tempo && (
                          <div className="col-span-2">
                            <span className="text-gray-500">Tempo: </span>
                            <span className="font-semibold text-gray-900">
                              {exercise.default_tempo}
                            </span>
                          </div>
                        )}
                        {exercise.default_rest_seconds && (
                          <div>
                            <span className="text-gray-500">Descanso: </span>
                            <span className="font-semibold text-gray-900">
                              {formatRestTime(exercise.default_rest_seconds)}
                            </span>
                          </div>
                        )}
                        {exercise.default_training_system && (
                          <div className="col-span-2">
                            <span className="text-gray-500">Sistema: </span>
                            <span className="font-semibold text-gray-900">
                              {exercise.default_training_system}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Muscle Groups & Equipment */}
                  <div className="space-y-2 mb-4">
                    {exercise.muscle_groups &&
                      exercise.muscle_groups.length > 0 && (
                        <div className="flex items-start gap-2">
                          <Icon
                            className="text-gray-400 flex-shrink-0 mt-0.5"
                            icon="solar:body-linear"
                            width={16}
                          />
                          <p className="text-xs text-gray-600">
                            {exercise.muscle_groups.join(", ")}
                          </p>
                        </div>
                      )}
                    {exercise.equipment && exercise.equipment.length > 0 && (
                      <div className="flex items-start gap-2">
                        <Icon
                          className="text-gray-400 flex-shrink-0 mt-0.5"
                          icon="solar:settings-linear"
                          width={16}
                        />
                        <p className="text-xs text-gray-600">
                          {exercise.equipment.join(", ")}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div
                    className="flex gap-2 pt-4 border-t border-gray-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {exercise.video_url && (
                      <Button
                        as="a"
                        className="flex-1"
                        href={exercise.video_url}
                        rel="noopener noreferrer"
                        size="sm"
                        startContent={
                          <Icon icon="solar:play-circle-linear" width={18} />
                        }
                        target="_blank"
                        variant="flat"
                        onPress={(e: any) => e.stopPropagation()}
                      >
                        Video
                      </Button>
                    )}
                    <Button
                      className="flex-1 text-white font-semibold"
                      color="primary"
                      size="sm"
                      startContent={<Icon icon="solar:pen-linear" width={18} />}
                      onPress={() => {
                        setEditingExercise(exercise);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      isIconOnly
                      color="danger"
                      size="sm"
                      variant="flat"
                      onPress={() => {
                        handleDelete(exercise.id, exercise.name);
                      }}
                    >
                      <Icon icon="solar:trash-bin-trash-linear" width={18} />
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Exercise Table View */}
      {!isLoading && exercises.length > 0 && viewMode === "table" && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Ejercicio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Categoría
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Parámetros
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Equipamiento
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {exercises.map((exercise) => (
                    <tr
                      key={exercise.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setViewingExercise(exercise)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              exercise.category === "cardio"
                                ? "bg-red-100"
                                : "bg-blue-100"
                            }`}
                          >
                            {exercise.image_url ? (
                              <img
                                alt={exercise.name}
                                className="w-full h-full object-cover rounded-lg"
                                src={exercise.image_url}
                              />
                            ) : (
                              <Icon
                                className={
                                  exercise.category === "cardio"
                                    ? "text-red-600"
                                    : "text-slate-700"
                                }
                                icon={
                                  exercise.category === "cardio"
                                    ? "solar:heart-pulse-bold"
                                    : "solar:dumbbell-bold"
                                }
                                width={24}
                              />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {exercise.name}
                            </p>
                            {exercise.description && (
                              <p className="text-sm text-gray-500 line-clamp-1">
                                {exercise.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Chip
                          className={
                            exercise.category === "cardio"
                              ? "bg-red-100 text-red-700 border border-red-200"
                              : "bg-blue-100 text-blue-700 border border-blue-200"
                          }
                          size="sm"
                          variant="flat"
                        >
                          {getCategoryLabel(exercise.category)}
                        </Chip>
                      </td>
                      <td className="px-6 py-4">
                        {exercise.category === "strength" ? (
                          <div className="text-sm text-gray-600">
                            {exercise.default_sets && exercise.default_reps
                              ? `${exercise.default_sets} × ${exercise.default_reps}`
                              : "Sin parámetros"}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600">
                            {exercise.default_reps
                              ? `${exercise.default_reps} min`
                              : "Sin duración"}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600">
                          {exercise.equipment && exercise.equipment.length > 0
                            ? exercise.equipment.join(", ")
                            : "Ninguno"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {exercise.video_url && (
                            <Button
                              isIconOnly
                              as="a"
                              className="min-w-0"
                              href={exercise.video_url}
                              rel="noopener noreferrer"
                              size="sm"
                              target="_blank"
                              variant="flat"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Icon
                                className="text-slate-700"
                                icon="solar:play-circle-bold"
                                width={18}
                              />
                            </Button>
                          )}
                          <Button
                            isIconOnly
                            className="text-white font-semibold"
                            color="primary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingExercise(exercise);
                            }}
                          >
                            <Icon icon="solar:pen-bold" width={18} />
                          </Button>
                          <Button
                            isIconOnly
                            color="danger"
                            size="sm"
                            variant="flat"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(exercise.id, exercise.name);
                            }}
                          >
                            <Icon
                              icon="solar:trash-bin-trash-bold"
                              width={18}
                            />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Add Exercise Modal */}
      <AddExerciseLibraryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchExercises();
        }}
      />

      {/* Edit Exercise Modal */}
      {editingExercise && (
        <EditExerciseLibraryModal
          exercise={editingExercise}
          isOpen={!!editingExercise}
          onClose={() => setEditingExercise(null)}
          onSuccess={() => {
            setEditingExercise(null);
            fetchExercises();
          }}
        />
      )}

      {/* View Exercise Detail Modal */}
      {viewingExercise && (
        <Modal
          classNames={{
            base: "max-h-[90vh]",
            header: "border-b border-gray-200",
            footer: "border-t border-gray-200",
            body: "py-6",
          }}
          isOpen={!!viewingExercise}
          scrollBehavior="inside"
          size="3xl"
          onClose={() => setViewingExercise(null)}
        >
          <ModalContent>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div
                  className={`${
                    viewingExercise.category === "cardio"
                      ? "bg-red-50"
                      : "bg-slate-100"
                  } p-2 rounded-lg`}
                >
                  <Icon
                    className={`${
                      viewingExercise.category === "cardio"
                        ? "text-red-600"
                        : "text-slate-700"
                    } text-xl`}
                    icon={
                      viewingExercise.category === "cardio"
                        ? "solar:heart-pulse-bold"
                        : "solar:dumbbell-bold"
                    }
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">
                    {viewingExercise.name}
                  </h3>
                  <div className="flex gap-2 mt-1">
                    <Chip
                      className={
                        viewingExercise.category === "cardio"
                          ? "bg-red-100 text-red-700 border border-red-200"
                          : "bg-slate-200 text-slate-800 border border-slate-300"
                      }
                      size="sm"
                      variant="flat"
                    >
                      {getCategoryLabel(viewingExercise.category)}
                    </Chip>
                    {viewingExercise.movement_pattern && (
                      <Chip
                        className="bg-slate-200 text-slate-800 border border-slate-300"
                        size="sm"
                        variant="flat"
                      >
                        Patrón: {viewingExercise.movement_pattern}
                      </Chip>
                    )}
                  </div>
                </div>
              </div>
            </ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-6">
                {/* Image/Video Section */}
                {(viewingExercise.image_url ||
                  viewingExercise.video_url ||
                  viewingExercise.uploaded_video_url) && (
                  <div className="space-y-3">
                    {viewingExercise.image_url && (
                      <div className="relative w-full h-64 rounded-lg overflow-hidden border-2 border-gray-200">
                        <img
                          alt={viewingExercise.name}
                          className="w-full h-full object-cover"
                          src={viewingExercise.image_url}
                        />
                      </div>
                    )}
                    {viewingExercise.uploaded_video_url && (
                      <div className="flex flex-col items-center">
                        <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                          <Icon icon="solar:smartphone-bold" width={14} />
                          Vista previa del cliente
                        </p>
                        <div
                          className="rounded-2xl overflow-hidden border-2 border-gray-300 bg-black shadow-lg"
                          style={{ width: 192, height: 341 }}
                        >
                          <video
                            controls
                            playsInline
                            className="w-full h-full object-cover"
                            src={viewingExercise.uploaded_video_url}
                          >
                            <track
                              kind="captions"
                              label="Spanish"
                              srcLang="es"
                            />
                          </video>
                        </div>
                      </div>
                    )}
                    {viewingExercise.video_url && (
                      <Button
                        as="a"
                        className="w-full bg-black text-white hover:bg-slate-800 font-semibold"
                        href={viewingExercise.video_url}
                        rel="noopener noreferrer"
                        size="lg"
                        startContent={
                          <Icon icon="solar:play-circle-bold" width={24} />
                        }
                        target="_blank"
                      >
                        Ver Video Tutorial
                      </Button>
                    )}
                  </div>
                )}

                {/* Description */}
                {viewingExercise.description && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                      Descripción
                    </h4>
                    <p className="text-gray-600">
                      {viewingExercise.description}
                    </p>
                  </div>
                )}

                {/* Default Parameters */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    Parámetros por Defecto
                  </h4>
                  {viewingExercise.default_sets ||
                  viewingExercise.default_reps ||
                  viewingExercise.default_tempo ||
                  viewingExercise.default_rest_seconds ||
                  viewingExercise.default_training_system ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {viewingExercise.category === "strength" ? (
                        <>
                          {viewingExercise.default_sets && (
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">
                                Series
                              </p>
                              <p className="text-lg font-semibold text-gray-900">
                                {viewingExercise.default_sets}
                              </p>
                            </div>
                          )}
                          {viewingExercise.default_reps && (
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">
                                Repeticiones
                              </p>
                              <p className="text-lg font-semibold text-gray-900">
                                {viewingExercise.default_reps}
                              </p>
                            </div>
                          )}
                          {viewingExercise.default_tempo && (
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">
                                Tempo
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {viewingExercise.default_tempo}
                              </p>
                            </div>
                          )}
                          {viewingExercise.default_rest_seconds && (
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">
                                Descanso
                              </p>
                              <p className="text-lg font-semibold text-gray-900">
                                {formatRestTime(
                                  viewingExercise.default_rest_seconds
                                )}
                              </p>
                            </div>
                          )}
                          {viewingExercise.default_training_system && (
                            <div className="bg-gray-50 p-3 rounded-lg col-span-2">
                              <p className="text-xs text-gray-500 mb-1">
                                Sistema de Entrenamiento
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {viewingExercise.default_training_system}
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {viewingExercise.default_reps && (
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">
                                Duración
                              </p>
                              <p className="text-lg font-semibold text-gray-900">
                                {viewingExercise.default_reps} min
                              </p>
                            </div>
                          )}
                          {viewingExercise.default_sets && (
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">
                                Distancia
                              </p>
                              <p className="text-lg font-semibold text-gray-900">
                                {viewingExercise.default_sets} km
                              </p>
                            </div>
                          )}
                          {viewingExercise.default_tempo && (
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">
                                Intensidad
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {viewingExercise.default_tempo}
                              </p>
                            </div>
                          )}
                          {viewingExercise.default_training_system && (
                            <div className="bg-gray-50 p-3 rounded-lg col-span-2">
                              <p className="text-xs text-gray-500 mb-1">
                                Tipo de Actividad
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {viewingExercise.default_training_system}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-6 text-center">
                      <Icon
                        className="text-gray-300 mx-auto mb-2"
                        icon="solar:settings-linear"
                        width={48}
                      />
                      <p className="text-sm text-gray-500">
                        No se han definido parámetros por defecto para este
                        ejercicio
                      </p>
                    </div>
                  )}
                </div>

                {/* Muscle Groups & Equipment */}
                {viewingExercise.category === "strength" && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                      Grupos Musculares
                    </h4>
                    {viewingExercise.muscle_groups &&
                    viewingExercise.muscle_groups.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {viewingExercise.muscle_groups.map((group) => (
                          <Chip
                            key={group}
                            className="bg-slate-200 text-slate-800"
                            size="sm"
                            variant="flat"
                          >
                            {group}
                          </Chip>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No especificado</p>
                    )}
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    {viewingExercise.category === "cardio"
                      ? "Equipamiento o Ubicación"
                      : "Equipamiento Necesario"}
                  </h4>
                  {viewingExercise.equipment &&
                  viewingExercise.equipment.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {viewingExercise.equipment.map((item) => (
                        <Chip
                          key={item}
                          className={
                            viewingExercise.category === "cardio"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-slate-200 text-slate-800"
                          }
                          size="sm"
                          variant="flat"
                        >
                          {item}
                        </Chip>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Ninguno especificado
                    </p>
                  )}
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setViewingExercise(null)}>
                Cerrar
              </Button>
              <Button
                className="bg-black text-white hover:bg-slate-800 font-semibold"
                startContent={<Icon icon="solar:pen-bold" width={18} />}
                onPress={() => {
                  setEditingExercise(viewingExercise);
                  setViewingExercise(null);
                }}
              >
                Editar Ejercicio
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </div>
  );
}

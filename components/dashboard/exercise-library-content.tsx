"use client";

import type { Exercise } from "@/types/training";

import {
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useRef, useState } from "react";

import AddExerciseLibraryModal from "./add-exercise-library-modal";
import EditExerciseLibraryModal from "./edit-exercise-library-modal";

import { MuscleMap } from "@/components/shared/muscle-map";
import { IconTile } from "@/components/shared/icon-tile";
import { OutlineChip } from "@/components/shared/outline-chip";
import {
  MuscleFilterSelect,
  type MuscleFilter,
} from "@/features/trainer/library/muscle-filter-select";
import { TagFilterSelect } from "@/features/trainer/library/tag-filter-select";
import { TagManagerButton } from "@/features/trainer/library/tag-manager-panel";
import { muscleLabel, type MuscleId } from "@/lib/training/muscles";
import { resolveRestLabel } from "@/lib/training/rest-label";
import { confirmAfterPress } from "@/lib/ui/native-dialog";
import { getCategoryLabel } from "@/lib/utils/exercise-utils";

const PAGE_SIZE = 50;

export default function ExerciseLibraryContent() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [lastLoadedPage, setLastLoadedPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("strength");
  // Combined tag filter (Sep 2 call, JC): every selected tag must match.
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [muscleFilter, setMuscleFilter] = useState<MuscleFilter>("");
  const [missingMuscles, setMissingMuscles] = useState(0);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [viewingExercise, setViewingExercise] = useState<Exercise | null>(null);
  const skipInitialSearchDebounceRef = useRef(true);
  const categoryFilterRef = useRef(categoryFilter);
  const searchQueryRef = useRef(searchQuery);
  const tagFilterRef = useRef(tagFilter);
  const muscleFilterRef = useRef(muscleFilter);
  const listEpochRef = useRef(0);

  categoryFilterRef.current = categoryFilter;
  searchQueryRef.current = searchQuery;
  tagFilterRef.current = tagFilter;
  muscleFilterRef.current = muscleFilter;

  const fetchExercisesPage = useCallback(
    async (page: number, mode: "replace" | "append") => {
      const epochBeforeList = listEpochRef.current;

      if (mode === "replace") {
        listEpochRef.current += 1;
      }
      const epochForReplace = listEpochRef.current;

      if (mode === "replace") {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      try {
        const params = new URLSearchParams();

        params.set("page", String(page));
        params.set("limit", String(PAGE_SIZE));
        const cat = categoryFilterRef.current;
        const search = searchQueryRef.current;

        if (cat && cat !== "all") {
          params.append("category", cat);
        }
        if (search.trim() !== "") {
          params.append("search", search.trim());
        }
        for (const tag of tagFilterRef.current) {
          params.append("tag", tag);
        }
        if (muscleFilterRef.current) {
          params.set("muscle", muscleFilterRef.current);
        }

        const response = await fetch(`/api/exercises?${params.toString()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
          },
        });
        const result = await response.json();

        if (result.success) {
          if (mode === "replace") {
            if (epochForReplace !== listEpochRef.current) {
              return;
            }
            setTotalCount(typeof result.total === "number" ? result.total : 0);
            setMissingMuscles(result.missing_muscles ?? 0);
            setExercises(result.exercises ?? []);
            setLastLoadedPage(1);
          } else {
            if (epochBeforeList !== listEpochRef.current) {
              return;
            }
            setTotalCount(typeof result.total === "number" ? result.total : 0);
            setExercises((prev) => [...prev, ...(result.exercises ?? [])]);
            setLastLoadedPage(page);
          }
        } else {
          console.error("Error fetching exercises:", result.error);
        }
      } catch (error) {
        console.error("Error fetching exercises:", error);
      } finally {
        if (mode === "replace") {
          if (epochForReplace === listEpochRef.current) {
            setIsLoading(false);
          }
        } else {
          setIsLoadingMore(false);
        }
      }
    },
    []
  );

  const fetchExercises = useCallback(() => {
    return fetchExercisesPage(1, "replace");
  }, [fetchExercisesPage]);

  const loadMoreExercises = useCallback(() => {
    if (isLoading || isLoadingMore || exercises.length >= totalCount) {
      return;
    }
    const nextPage = lastLoadedPage + 1;

    return fetchExercisesPage(nextPage, "append");
  }, [
    exercises.length,
    fetchExercisesPage,
    isLoading,
    isLoadingMore,
    lastLoadedPage,
    totalCount,
  ]);

  const hasMore = exercises.length < totalCount;

  useEffect(() => {
    fetchExercisesPage(1, "replace");
  }, [categoryFilter, tagFilter, muscleFilter, fetchExercisesPage]);

  // Debounced refetch when search changes (skip first run to avoid duplicating category initial fetch)
  useEffect(() => {
    if (skipInitialSearchDebounceRef.current) {
      skipInitialSearchDebounceRef.current = false;

      return;
    }
    const timer = setTimeout(() => {
      fetchExercisesPage(1, "replace");
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, fetchExercisesPage]);

  // Handle delete
  const handleDelete = async (exerciseId: string, exerciseName: string) => {
    if (
      !(await confirmAfterPress(
        `¿Estás seguro de que quieres eliminar "${exerciseName}"? Esta acción no se puede deshacer. El ejercicio no se puede eliminar si está siendo usado en programas activos.`
      ))
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

        {/* Search + filters: one row from tablet up (GHL iframe height is scarce). */}
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          <Input
            className="md:min-w-[240px] md:flex-1"
            classNames={{
              input: "text-sm",
            }}
            placeholder="Buscar ejercicios por nombre..."
            startContent={
              <Icon
                className="text-default-400"
                icon="solar:magnifer-linear"
                width={18}
              />
            }
            value={searchQuery}
            onValueChange={setSearchQuery}
          />

          <MuscleFilterSelect
            className="md:w-[220px]"
            missingCount={missingMuscles}
            value={muscleFilter}
            onChange={setMuscleFilter}
          />

          <TagFilterSelect
            className="md:w-[220px]"
            kind="exercise"
            value={tagFilter}
            onChange={setTagFilter}
          />

          {/* Renaming/removing a tag rewrites exercise arrays: reload page 1. */}
          <TagManagerButton
            className="self-start md:self-auto"
            kind="exercise"
            onChanged={() => fetchExercisesPage(1, "replace")}
          />
        </div>
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
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              onDelete={() => handleDelete(exercise.id, exercise.name)}
              onEdit={() => setEditingExercise(exercise)}
              onView={() => setViewingExercise(exercise)}
            />
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
                      Tipo
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
                            {(exercise.tags ?? []).length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(exercise.tags ?? []).map((tag) => (
                                  <Chip key={tag} size="sm" variant="flat">
                                    {tag}
                                  </Chip>
                                ))}
                              </div>
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
                          <div className="text-sm text-gray-600">—</div>
                        ) : (
                          <div className="text-sm text-gray-600">
                            {exercise.metadata?.cardio_type
                              ? exercise.metadata.cardio_type
                              : "Cardio"}
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

      {!isLoading && exercises.length > 0 && hasMore && (
        <div className="flex flex-col items-center gap-3 mt-8">
          <p className="text-sm text-gray-500">
            Mostrando {exercises.length} de {totalCount} ejercicios
          </p>
          <Button
            className="font-semibold border-gray-300"
            isLoading={isLoadingMore}
            size="lg"
            variant="bordered"
            onPress={() => {
              void loadMoreExercises();
            }}
          >
            Cargar más
          </Button>
        </div>
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
        <ExerciseDetailModal
          exercise={viewingExercise}
          onClose={() => setViewingExercise(null)}
          onEdit={() => {
            setEditingExercise(viewingExercise);
            setViewingExercise(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Library card. The media slot shows the photo when there is one and the
 * muscle map otherwise, so a card without a photo still says what it trains.
 * One tappable area opens the detail; actions live in the "⋯" menu.
 */
function ExerciseCard({
  exercise,
  onView,
  onEdit,
  onDelete,
}: {
  exercise: Exercise;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const primary = exercise.primary_muscles ?? [];
  const secondary = exercise.secondary_muscles ?? [];
  const isCardio = exercise.category === "cardio";
  const hasVideo = Boolean(exercise.uploaded_video_url || exercise.video_url);
  const meta = [
    isCardio ? exercise.metadata?.cardio_type : null,
    exercise.movement_pattern,
    (exercise.equipment ?? []).join(", "),
  ].filter(Boolean);
  const tags = exercise.tags ?? [];

  return (
    <Card
      className="h-full border border-default-200 bg-content1 transition-[border-color,box-shadow] duration-150 hover:border-default-300 hover:shadow-medium"
      shadow="none"
    >
      <CardBody className="relative flex h-full flex-col p-0">
        <button
          className="flex flex-1 flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          type="button"
          onClick={onView}
        >
          <div className="relative flex h-44 w-full items-center justify-center overflow-hidden bg-default-50">
            {exercise.image_url ? (
              <img
                alt={exercise.name}
                className="h-full w-full object-cover"
                src={exercise.image_url}
              />
            ) : isCardio && primary.length === 0 && secondary.length === 0 ? (
              <Icon
                className="text-default-300"
                icon="solar:heart-pulse-bold"
                width={56}
              />
            ) : (
              <MuscleMap
                className="w-[128px]"
                labels={false}
                outlineWidth={1}
                primary={primary}
                secondary={secondary}
              />
            )}
            {exercise.image_url &&
              (primary.length > 0 || secondary.length > 0) && (
                <span className="absolute bottom-2.5 left-2.5 rounded-lg bg-content1 px-1.5 py-1 shadow-small">
                  <MuscleMap
                    className="w-[46px] gap-0.5"
                    labels={false}
                    outlineWidth={0.5}
                    primary={primary}
                    secondary={secondary}
                  />
                </span>
              )}
            {hasVideo && (
              <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-content1 px-2 py-0.5 text-[11px] font-medium text-foreground shadow-small">
                <Icon icon="solar:videocamera-record-bold" width={13} />
                Vídeo
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-2 p-4">
            <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
              {exercise.name}
            </h3>
            {meta.length > 0 && (
              <p className="line-clamp-1 text-xs text-default-500">
                {meta.join(" · ")}
              </p>
            )}
            <MusclesSummary
              isCardio={isCardio}
              primary={primary}
              secondary={secondary}
            />
            <Prescription exercise={exercise} />
            {exercise.description && (
              <p className="line-clamp-2 text-sm text-default-600">
                {exercise.description}
              </p>
            )}
            {tags.length > 0 && (
              <div className="mt-auto flex flex-wrap gap-1 pt-1">
                {tags.slice(0, 3).map((tag) => (
                  <Chip key={tag} size="sm" variant="flat">
                    {tag}
                  </Chip>
                ))}
                {tags.length > 3 && (
                  <Chip size="sm" variant="light">
                    +{tags.length - 3}
                  </Chip>
                )}
              </div>
            )}
          </div>
        </button>

        {/* Actions live in one overflow menu (Mobbin: Airbnb, Sketch, Framer);
            the card itself opens the detail. Always visible: tablets have no hover. */}
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <Button
              isIconOnly
              aria-label={`Acciones de ${exercise.name}`}
              className="absolute right-2.5 top-2.5 h-8 w-8 min-w-8 bg-content1 text-foreground shadow-small"
              radius="full"
              size="sm"
              variant="flat"
            >
              <Icon icon="solar:menu-dots-bold" width={18} />
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label={`Acciones de ${exercise.name}`}
            onAction={(key) => {
              if (key === "edit") onEdit();
              if (key === "video" && exercise.video_url) {
                window.open(
                  exercise.video_url,
                  "_blank",
                  "noopener,noreferrer"
                );
              }
              if (key === "delete") onDelete();
            }}
          >
            <DropdownSection showDivider>
              <DropdownItem
                key="edit"
                startContent={<Icon icon="solar:pen-linear" width={18} />}
              >
                Editar
              </DropdownItem>
              {exercise.video_url ? (
                <DropdownItem
                  key="video"
                  startContent={
                    <Icon icon="solar:play-circle-linear" width={18} />
                  }
                >
                  Ver vídeo
                </DropdownItem>
              ) : null}
            </DropdownSection>
            <DropdownSection>
              <DropdownItem
                key="delete"
                className="text-danger"
                color="danger"
                startContent={
                  <Icon icon="solar:trash-bin-trash-linear" width={18} />
                }
              >
                Eliminar
              </DropdownItem>
            </DropdownSection>
          </DropdownMenu>
        </Dropdown>
      </CardBody>
    </Card>
  );
}

/** Primary muscles as brand-tinted chips, secondary as outlined ones;
 *  strength exercises still missing them get a warning chip (cardio may
 *  stay empty). */
function MusclesSummary({
  primary,
  secondary,
  isCardio,
}: {
  primary: readonly MuscleId[];
  secondary: readonly MuscleId[];
  isCardio: boolean;
}) {
  if (primary.length === 0 && secondary.length === 0) {
    return isCardio ? null : (
      <OutlineChip className="self-start" tone="warning">
        Sin músculos
      </OutlineChip>
    );
  }

  const shown = [
    ...primary.map((id) => ({ id, primary: true })),
    ...secondary.map((id) => ({ id, primary: false })),
  ];
  const visible = shown.slice(0, 4);

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map(({ id, primary: isPrimary }) =>
        isPrimary ? (
          <span
            key={id}
            className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
          >
            {muscleLabel(id)}
          </span>
        ) : (
          <OutlineChip key={id} tone="muted">
            {muscleLabel(id)}
          </OutlineChip>
        )
      )}
      {shown.length > visible.length && (
        <OutlineChip tone="muted">+{shown.length - visible.length}</OutlineChip>
      )}
    </div>
  );
}

/** The trainer's default prescription (sets, reps, rest, tempo), only the
 *  values they filled in. */
function Prescription({ exercise }: { exercise: Exercise }) {
  const rest = resolveRestLabel(null, exercise.default_rest_seconds);
  const cells = [
    ["Series", exercise.default_sets ? String(exercise.default_sets) : ""],
    ["Reps", exercise.default_reps?.trim() ?? ""],
    ["Descanso", rest],
    ["Tempo", exercise.default_tempo?.trim() ?? ""],
  ].filter(([, value]) => value);

  if (cells.length === 0) return null;

  return (
    <dl className="mt-1 grid auto-cols-fr grid-flow-col divide-x divide-default-200 rounded-lg border border-default-200">
      {cells.map(([label, value]) => (
        <div
          key={label}
          className="flex min-w-0 flex-col-reverse px-2 py-1.5 text-center"
        >
          <dt className="text-[10px] text-default-500">{label}</dt>
          <dd className="truncate text-sm font-semibold tabular-nums text-foreground">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Read-only exercise sheet, same language as the card: media on the left
 * (the client's video preview, else the photo, else the muscle map), facts
 * on the right in the order a trainer checks them — muscles, prescription,
 * how to do it, equipment.
 */
function ExerciseDetailModal({
  exercise,
  onClose,
  onEdit,
}: {
  exercise: Exercise;
  onClose: () => void;
  onEdit: () => void;
}) {
  const primary = exercise.primary_muscles ?? [];
  const secondary = exercise.secondary_muscles ?? [];
  const hasMuscles = primary.length > 0 || secondary.length > 0;
  const isCardio = exercise.category === "cardio";
  const mediaIsMap = !exercise.uploaded_video_url && !exercise.image_url;
  const meta = [
    getCategoryLabel(exercise.category),
    isCardio ? exercise.metadata?.cardio_type : null,
    exercise.movement_pattern,
  ].filter(Boolean);
  const equipment = exercise.equipment ?? [];
  const tags = exercise.tags ?? [];

  return (
    <Modal
      isOpen
      classNames={{
        base: "max-h-[90vh]",
        header: "border-b border-default-200",
        body: "py-6",
      }}
      scrollBehavior="inside"
      size="3xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-3 pr-14">
          <IconTile
            icon={isCardio ? "solar:heart-pulse-bold" : "solar:dumbbell-bold"}
            tone={isCardio ? "danger" : "primary"}
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold leading-tight text-foreground">
              {exercise.name}
            </h3>
            <p className="mt-0.5 text-sm font-normal text-default-500">
              {meta.join(" · ")}
            </p>
          </div>
          <Button
            className="shrink-0 font-medium text-default-700"
            size="sm"
            startContent={<Icon icon="solar:pen-linear" width={16} />}
            variant="light"
            onPress={onEdit}
          >
            Editar
          </Button>
        </ModalHeader>

        <ModalBody>
          <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
            {/* Media: photo and client video side by side in a small
                gallery (Mobbin: Etsy, Dribbble); the map when there is neither. */}
            <div className="flex flex-col gap-3">
              {mediaIsMap ? (
                <div className="flex w-full justify-center rounded-xl bg-default-50 px-6 py-5">
                  <MuscleMap
                    className="w-full max-w-[190px]"
                    outlineWidth={1}
                    primary={primary}
                    secondary={secondary}
                  />
                </div>
              ) : (
                <ExerciseMedia exercise={exercise} />
              )}
              {exercise.video_url && (
                <Button
                  as="a"
                  className="self-center text-default-600"
                  href={exercise.video_url}
                  rel="noopener noreferrer"
                  size="sm"
                  startContent={
                    <Icon icon="solar:play-circle-linear" width={18} />
                  }
                  target="_blank"
                  variant="light"
                >
                  Ver vídeo tutorial
                </Button>
              )}
            </div>

            {/* Facts */}
            <div className="flex min-w-0 flex-col gap-6">
              <DetailSection title="Músculos trabajados">
                {hasMuscles ? (
                  <div className="flex items-start gap-5">
                    {!mediaIsMap && (
                      <MuscleMap
                        className="w-[112px] shrink-0"
                        labels={false}
                        outlineWidth={1}
                        primary={primary}
                        secondary={secondary}
                      />
                    )}
                    <dl className="flex min-w-0 flex-col gap-3">
                      {primary.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <dt className="text-xs text-default-500">
                            Principal
                          </dt>
                          <dd className="flex flex-wrap gap-1.5">
                            {primary.map((id) => (
                              <span
                                key={id}
                                className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                              >
                                {muscleLabel(id)}
                              </span>
                            ))}
                          </dd>
                        </div>
                      )}
                      {secondary.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <dt className="text-xs text-default-500">
                            Secundarios
                          </dt>
                          <dd className="flex flex-wrap gap-1.5">
                            {secondary.map((id) => (
                              <OutlineChip
                                key={id}
                                className="px-2.5 py-1 text-xs"
                                tone="muted"
                              >
                                {muscleLabel(id)}
                              </OutlineChip>
                            ))}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                ) : (
                  <p className="text-sm text-default-500">
                    {isCardio
                      ? "Sin músculos (opcional en cardio)."
                      : "Sin músculos. Edita el ejercicio para elegirlos."}
                  </p>
                )}
              </DetailSection>

              {(exercise.default_sets ||
                exercise.default_reps ||
                exercise.default_rest_seconds ||
                exercise.default_tempo) && (
                <DetailSection title="Prescripción por defecto">
                  <Prescription exercise={exercise} />
                </DetailSection>
              )}

              {exercise.description && (
                <DetailSection title="Descripción">
                  <p className="max-w-[65ch] whitespace-pre-line text-sm leading-relaxed text-default-600">
                    {exercise.description}
                  </p>
                </DetailSection>
              )}

              {(equipment.length > 0 || tags.length > 0) && (
                <div className="grid gap-6 sm:grid-cols-2">
                  {equipment.length > 0 && (
                    <DetailSection
                      title={
                        isCardio ? "Equipamiento o ubicación" : "Equipamiento"
                      }
                    >
                      <div className="flex flex-wrap gap-1.5">
                        {equipment.map((item) => (
                          <Chip key={item} size="sm" variant="flat">
                            {item}
                          </Chip>
                        ))}
                      </div>
                    </DetailSection>
                  )}
                  {tags.length > 0 && (
                    <DetailSection title="Etiquetas">
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((tag) => (
                          <Chip key={tag} size="sm" variant="flat">
                            {tag}
                          </Chip>
                        ))}
                      </div>
                    </DetailSection>
                  )}
                </div>
              )}
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

/** Main view plus thumbnails when the exercise has both a photo and the
 *  client video; a single item shows on its own. */
function ExerciseMedia({ exercise }: { exercise: Exercise }) {
  const items = [
    exercise.image_url ? ("photo" as const) : null,
    exercise.uploaded_video_url ? ("video" as const) : null,
  ].filter((item) => item !== null);
  const [selected, setSelected] = useState(items[0] ?? "photo");

  return (
    <div className="flex flex-col gap-2.5">
      {selected === "photo" && exercise.image_url ? (
        <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-default-50">
          <img
            alt={exercise.name}
            className="h-full w-full object-cover"
            src={exercise.image_url}
          />
        </div>
      ) : exercise.uploaded_video_url ? (
        <div className="flex flex-col items-center gap-2">
          <div className="aspect-[9/16] w-[200px] max-w-full overflow-hidden rounded-2xl bg-black shadow-medium">
            <video
              controls
              playsInline
              className="h-full w-full object-cover"
              src={exercise.uploaded_video_url}
            >
              <track kind="captions" label="Spanish" srcLang="es" />
            </video>
          </div>
          <p className="flex items-center gap-1 text-xs text-default-500">
            <Icon icon="solar:smartphone-linear" width={14} />
            Así lo ve tu cliente
          </p>
        </div>
      ) : null}

      {items.length > 1 && (
        <div className="flex justify-center gap-2" role="tablist">
          {items.map((item) => (
            <button
              key={item}
              aria-label={item === "photo" ? "Ver foto" : "Ver vídeo"}
              aria-selected={selected === item}
              className={`relative h-14 w-14 overflow-hidden rounded-lg bg-default-100 outline-none ring-offset-2 ring-offset-content1 transition-[box-shadow,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-primary ${
                selected === item
                  ? "ring-2 ring-primary"
                  : "opacity-70 hover:opacity-100"
              }`}
              role="tab"
              type="button"
              onClick={() => setSelected(item)}
            >
              {item === "photo" ? (
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  src={exercise.image_url}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-foreground text-background">
                  <Icon icon="solar:play-bold" width={18} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {children}
    </section>
  );
}

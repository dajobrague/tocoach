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
  Select,
  SelectItem,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useRef, useState } from "react";

import AddExerciseLibraryModal from "./add-exercise-library-modal";
import { LibraryCatalogModal } from "./library-catalog-modal";
import EditExerciseLibraryModal from "./edit-exercise-library-modal";

import { setFigureSex, useFigureSex } from "@/lib/hooks/use-figure-sex";
import {
  useLibraryMedia,
  type LibraryMedia,
} from "@/lib/hooks/use-library-media";
import { MuscleMap } from "@/components/shared/muscle-map";
import { MuscleBody } from "@/components/shared/muscle-body";
import { IconTile } from "@/components/shared/icon-tile";
import { OutlineChip } from "@/components/shared/outline-chip";
import {
  MuscleFilterSelect,
  type MuscleFilter,
} from "@/features/trainer/library/muscle-filter-select";
import { MuscleAssistantReview } from "@/features/trainer/library/muscle-assistant-review";
import { TagFilterSelect } from "@/features/trainer/library/tag-filter-select";
import { TagManagerButton } from "@/features/trainer/library/tag-manager-panel";
import { muscleLabel, type MuscleId } from "@/lib/training/muscles";
import { resolveRestLabel } from "@/lib/training/rest-label";
import { confirmAfterPress } from "@/lib/ui/native-dialog";
import { getCategoryLabel } from "@/lib/utils/exercise-utils";

const PAGE_SIZE = 50;

const MUSCLES_INTRO_KEY = "topcoach:trainer:muscles-intro-dismissed";
const OPEN_REVIEW_KEY = "topcoach:trainer:open-muscle-review";

export default function ExerciseLibraryContent() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  // Pósters/animaciones del catálogo (URLs firmadas, aparte de image_url: la
  // foto propia del entrenador nunca se sustituye ni se guarda).
  const libraryMedia = useLibraryMedia(
    exercises.map((e) => e.library_exercise_id)
  );
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
  const [reviewOpen, setReviewOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  // Aviso de novedad (David, 28 oct): se cierra una vez por navegador.
  const [introDismissed, setIntroDismissed] = useState(true);

  useEffect(() => {
    try {
      setIntroDismissed(localStorage.getItem(MUSCLES_INTRO_KEY) === "1");
    } catch {
      setIntroDismissed(false);
    }
  }, []);

  // Desde el aviso de Inicio: abre la revisión directamente (bandera de un
  // solo uso; la URL de Next aún no está actualizada al montar).
  useEffect(() => {
    try {
      if (sessionStorage.getItem(OPEN_REVIEW_KEY) !== "1") return;
      sessionStorage.removeItem(OPEN_REVIEW_KEY);
      setReviewOpen(true);
    } catch {
      // Sin almacenamiento: el banner sigue ahí.
    }
  }, []);

  const dismissIntro = () => {
    setIntroDismissed(true);
    try {
      localStorage.setItem(MUSCLES_INTRO_KEY, "1");
    } catch {
      // Sin almacenamiento: vuelve a salir la próxima vez.
    }
  };
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const figureSex = useFigureSex();
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
      {/* Cabecera en un solo renglón: título y contador a la izquierda, las
          dos acciones a la derecha. */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="flex min-w-0 items-baseline gap-2.5 font-heading text-2xl font-semibold text-foreground">
            <span className="truncate">Biblioteca de ejercicios</span>
            {totalCount > 0 ? (
              <span className="shrink-0 text-base font-normal tabular-nums text-default-400">
                {totalCount}
                <span className="sr-only"> ejercicios en tu catálogo</span>
              </span>
            ) : null}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              aria-label="Explorar catálogo"
              startContent={<Icon icon="solar:library-linear" width={18} />}
              variant="bordered"
              onPress={() => setIsCatalogOpen(true)}
            >
              <span className="hidden sm:inline">Explorar catálogo</span>
            </Button>
            <Button
              color="primary"
              startContent={<Icon icon="solar:add-circle-bold" width={18} />}
              onPress={() => setIsAddModalOpen(true)}
            >
              Añadir ejercicio
            </Button>
          </div>
        </div>

        {/* Fuerza / Cardio son la navegación de la página (pestañas con
            subrayado); a la derecha, cuadrícula o lista. */}
        <div className="flex items-end justify-between gap-4 border-b border-default-200">
          <div
            aria-label="Tipo de ejercicio"
            className="flex gap-6"
            role="tablist"
          >
            {(
              [
                ["strength", "Fuerza"],
                ["cardio", "Cardio"],
              ] as const
            ).map(([key, label]) => {
              const active =
                (categoryFilter === "cardio" ? "cardio" : "strength") === key;

              return (
                <button
                  key={key}
                  aria-selected={active}
                  className={`-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors duration-150 ${
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-default-500 [@media(hover:hover)]:hover:text-foreground"
                  }`}
                  role="tab"
                  type="button"
                  onClick={() => setCategoryFilter(key)}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div
            aria-label="Vista"
            className="flex items-center gap-0.5 pb-1.5"
            role="group"
          >
            {(
              [
                ["grid", "solar:widget-4-bold", "Cuadrícula"],
                ["table", "solar:list-bold", "Lista"],
              ] as const
            ).map(([key, icon, label]) => (
              <button
                key={key}
                aria-label={label}
                aria-pressed={viewMode === key}
                className={`compact-control flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150 ${
                  viewMode === key
                    ? "bg-default-100 text-foreground"
                    : "text-default-500 [@media(hover:hover)]:hover:text-foreground"
                }`}
                title={label}
                type="button"
                onClick={() => setViewMode(key)}
              >
                <Icon icon={icon} width={18} />
              </button>
            ))}
          </div>
        </div>

        {/* Buscar y filtrar: una fila, mismo borde y misma altura. */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="basis-full xl:basis-0 xl:min-w-[200px] xl:flex-1"
            classNames={{ input: "text-sm", inputWrapper: "bg-content1" }}
            placeholder="Buscar ejercicio por nombre"
            startContent={
              <Icon
                className="text-default-400"
                icon="solar:magnifer-linear"
                width={18}
              />
            }
            value={searchQuery}
            variant="bordered"
            onValueChange={setSearchQuery}
          />
          <MuscleFilterSelect
            className="w-full sm:w-[200px]"
            missingCount={missingMuscles}
            value={muscleFilter}
            onChange={setMuscleFilter}
          />
          <TagFilterSelect
            className="w-full sm:w-[200px]"
            kind="exercise"
            value={tagFilter}
            onChange={setTagFilter}
          />
          {/* Figura de las animaciones y del mapa muscular: mismo lenguaje que
              los otros filtros. */}
          <Select
            disallowEmptySelection
            aria-label="Figura de las animaciones y del mapa muscular"
            className="w-full sm:w-[140px]"
            selectedKeys={[figureSex]}
            startContent={
              <Icon
                className="text-default-400"
                icon="solar:user-linear"
                width={16}
              />
            }
            variant="bordered"
            onSelectionChange={(keys) => {
              const [key] = keys === "all" ? [] : Array.from(keys);

              if (key === "male" || key === "female") setFigureSex(key);
            }}
          >
            <SelectItem key="male">Hombre</SelectItem>
            <SelectItem key="female">Mujer</SelectItem>
          </Select>
          {/* Renaming/removing a tag rewrites exercise arrays: reload page 1. */}
          <TagManagerButton
            iconOnly
            className="self-start"
            kind="exercise"
            onChanged={() => fetchExercisesPage(1, "replace")}
          />
        </div>

        {/* Aviso de una línea: lo que falta y cómo resolverlo. */}
        {missingMuscles > 0 && !introDismissed ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-primary/20 bg-primary/5 py-2 pl-3 pr-2">
            <Icon className="text-primary" icon="solar:body-bold" width={18} />
            <p className="min-w-0 flex-1 text-sm text-default-600">
              <span className="font-medium text-foreground">
                {missingMuscles === 1
                  ? "1 ejercicio sin músculos"
                  : `${missingMuscles} ejercicios sin músculos`}
              </span>{" "}
              · tus clientes verán el mapa al compartir sus entrenos.
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                color="primary"
                size="sm"
                startContent={
                  <Icon icon="solar:magic-stick-3-linear" width={16} />
                }
                variant="flat"
                onPress={() => setReviewOpen(true)}
              >
                Completar con el asistente
              </Button>
              <Button
                size="sm"
                variant="light"
                onPress={() => setMuscleFilter("none")}
              >
                Ver cuáles
              </Button>
              <Button
                isIconOnly
                aria-label="Cerrar aviso"
                radius="full"
                size="sm"
                variant="light"
                onPress={dismissIntro}
              >
                <Icon icon="solar:close-circle-linear" width={18} />
              </Button>
            </div>
          </div>
        ) : null}
        {savedNotice ? (
          <p className="text-sm text-success-700" role="status">
            {savedNotice}
          </p>
        ) : null}
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card className="border border-default-200 bg-content1 shadow-none">
          <CardBody className="p-12">
            <div className="flex flex-col items-center justify-center">
              <Spinner color="primary" size="lg" />
              <p className="mt-4 text-default-600">Cargando ejercicios…</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && exercises.length === 0 && (
        <Card className="border border-default-200 bg-content1 shadow-none">
          <CardBody className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="mb-4 rounded-full bg-default-100 p-4">
                <Icon
                  className="text-5xl text-default-400"
                  icon="solar:dumbbell-linear"
                />
              </div>
              <h3 className="mb-2 font-heading text-lg font-semibold text-foreground">
                {searchQuery
                  ? "No se encontraron ejercicios"
                  : `No hay ejercicios de ${
                      categoryFilter === "cardio" ? "cardio" : "fuerza"
                    }`}
              </h3>
              <p className="mb-4 text-sm text-default-500">
                {searchQuery
                  ? "Intenta con otros términos de búsqueda"
                  : `Comienza añadiendo ejercicios de ${
                      categoryFilter === "cardio" ? "cardio" : "fuerza"
                    } a tu biblioteca`}
              </p>
              {!searchQuery && (
                <Button
                  color="primary"
                  startContent={
                    <Icon icon="solar:add-circle-bold" width={20} />
                  }
                  onPress={() => setIsAddModalOpen(true)}
                >
                  Añadir el primer ejercicio
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Exercise Grid View */}
      {!isLoading && exercises.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              clip={libraryMedia[exercise.library_exercise_id ?? ""]?.video}
              exercise={exercise}
              poster={libraryMedia[exercise.library_exercise_id ?? ""]?.poster}
              onDelete={() => handleDelete(exercise.id, exercise.name)}
              onEdit={() => setEditingExercise(exercise)}
              onView={() => setViewingExercise(exercise)}
            />
          ))}
        </div>
      )}

      {/* Exercise Table View */}
      {!isLoading && exercises.length > 0 && viewMode === "table" && (
        <Card className="border border-default-200 bg-content1 shadow-none">
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-default-50 border-b border-default-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-default-500">
                      Ejercicio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-default-500">
                      Categoría
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-default-500">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-default-500">
                      Equipamiento
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-default-500">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default-200">
                  {exercises.map((exercise) => (
                    <tr
                      key={exercise.id}
                      className="hover:bg-default-50 transition-colors cursor-pointer"
                      onClick={() => setViewingExercise(exercise)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              exercise.category === "cardio"
                                ? "bg-danger-50"
                                : "bg-primary/10"
                            }`}
                          >
                            {exercise.image_url ||
                            libraryMedia[exercise.library_exercise_id ?? ""]
                              ?.poster ? (
                              <img
                                alt={exercise.name}
                                className="w-full h-full object-cover rounded-lg"
                                src={
                                  exercise.image_url ??
                                  libraryMedia[
                                    exercise.library_exercise_id ?? ""
                                  ]?.poster
                                }
                              />
                            ) : (
                              <Icon
                                className={
                                  exercise.category === "cardio"
                                    ? "text-danger"
                                    : "text-primary"
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
                            <p className="font-semibold text-foreground">
                              {exercise.name}
                            </p>
                            {exercise.description && (
                              <p className="text-sm text-default-500 line-clamp-1">
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
                              ? "bg-danger-50 text-danger border border-danger-200"
                              : "bg-primary/10 text-primary border border-primary/20"
                          }
                          size="sm"
                          variant="flat"
                        >
                          {getCategoryLabel(exercise.category)}
                        </Chip>
                      </td>
                      <td className="px-6 py-4">
                        {exercise.category === "strength" ? (
                          <div className="text-sm text-default-600">—</div>
                        ) : (
                          <div className="text-sm text-default-600">
                            {exercise.metadata?.cardio_type
                              ? exercise.metadata.cardio_type
                              : "Cardio"}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-default-600">
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
                                className="text-primary"
                                icon="solar:play-circle-bold"
                                width={18}
                              />
                            </Button>
                          )}
                          <Button
                            isIconOnly
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
          <p className="text-sm text-default-500">
            Mostrando {exercises.length} de {totalCount} ejercicios
          </p>
          <Button
            className="font-semibold border-default-300"
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

      <LibraryCatalogModal
        isOpen={isCatalogOpen}
        onAdded={fetchExercises}
        onClose={() => setIsCatalogOpen(false)}
      />

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

      <MuscleAssistantReview
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onSaved={(updated) => {
          setSavedNotice(
            `${updated} ejercicio${updated === 1 ? "" : "s"} con músculos guardado${updated === 1 ? "" : "s"}.`
          );
          fetchExercisesPage(1, "replace");
        }}
      />

      {/* View Exercise Detail Modal */}
      {viewingExercise && (
        <ExerciseDetailModal
          exercise={viewingExercise}
          libraryMedia={libraryMedia[viewingExercise.library_exercise_id ?? ""]}
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
  poster,
  clip,
  onView,
  onEdit,
  onDelete,
}: {
  exercise: Exercise;
  /** Póster del catálogo si el entrenador no subió foto. */
  poster?: string | undefined;
  /** Animación del catálogo: solo suena al pasar el ratón (no se carga antes). */
  clip?: string | undefined;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const primary = exercise.primary_muscles ?? [];
  const secondary = exercise.secondary_muscles ?? [];
  const isCardio = exercise.category === "cardio";
  const hasVideo = Boolean(exercise.uploaded_video_url || exercise.video_url);
  const [hovered, setHovered] = useState(false);
  // El clip es del catálogo: si el entrenador subió su propia foto, no se usa.
  const libraryOnly = !exercise.image_url && Boolean(poster);
  const meta = [
    isCardio ? exercise.metadata?.cardio_type : null,
    exercise.movement_pattern,
    (exercise.equipment ?? []).join(", "),
  ].filter(Boolean);
  const tags = exercise.tags ?? [];

  return (
    <Card
      className="group h-full border border-default-200 bg-content1 transition-[border-color,box-shadow,transform] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:transform-none [@media(hover:hover)]:hover:border-default-300 [@media(hover:hover)]:hover:shadow-medium"
      shadow="none"
    >
      <CardBody className="relative flex h-full flex-col p-0">
        <button
          className="flex flex-1 flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          type="button"
          onClick={onView}
        >
          <div
            className={`relative flex h-44 w-full items-center justify-center overflow-hidden ${libraryOnly ? "bg-white" /* the catalog art ships on white */ : "bg-default-50"}`}
            onPointerEnter={(e) =>
              e.pointerType === "mouse" && setHovered(true)
            }
            onPointerLeave={() => setHovered(false)}
          >
            {exercise.image_url || poster ? (
              <img
                alt={exercise.name}
                className={`h-full w-full ${libraryOnly ? "object-contain" : "object-cover"}`}
                src={exercise.image_url ?? poster}
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
            {libraryOnly && clip && hovered && (
              <video
                autoPlay
                loop
                muted
                playsInline
                aria-hidden="true"
                className="absolute inset-0 h-full w-full bg-white object-contain motion-reduce:hidden"
                poster={poster}
                src={clip}
              />
            )}
            {(exercise.image_url || poster) &&
              (primary.length > 0 || secondary.length > 0) && (
                <span className="absolute bottom-2.5 left-2.5 rounded-lg bg-content1 px-1.5 py-1 shadow-small">
                  <MuscleBody
                    className="w-[30px]"
                    flip={false}
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

        {/* Actions live in one overflow menu (Mobbin: Arcade, Customer.io): shown
            on hover/focus where there is a pointer, always on touch (tablets). */}
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <Button
              isIconOnly
              aria-label={`Acciones de ${exercise.name}`}
              className="absolute right-2.5 top-2.5 h-8 w-8 min-w-8 bg-content1 text-foreground shadow-small transition-opacity duration-150 focus-visible:opacity-100 data-[open=true]:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
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

/** The trainer's default prescription as one quiet line ("3 series · 12 reps
 *  · 90 s"), only the values they filled in. */
function Prescription({ exercise }: { exercise: Exercise }) {
  const rest = resolveRestLabel(null, exercise.default_rest_seconds);
  const sets = exercise.default_sets;
  const parts = [
    sets ? `${sets} ${sets === 1 ? "serie" : "series"}` : "",
    exercise.default_reps?.trim() ? `${exercise.default_reps.trim()} reps` : "",
    rest,
    exercise.default_tempo?.trim()
      ? `tempo ${exercise.default_tempo.trim()}`
      : "",
  ].filter(Boolean);

  if (parts.length === 0) return null;

  return (
    <p className="line-clamp-1 text-xs tabular-nums text-default-600">
      {parts.join(" · ")}
    </p>
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
  libraryMedia,
  onClose,
  onEdit,
}: {
  exercise: Exercise;
  libraryMedia?: LibraryMedia | undefined;
  onClose: () => void;
  onEdit: () => void;
}) {
  const primary = exercise.primary_muscles ?? [];
  const secondary = exercise.secondary_muscles ?? [];
  const hasMuscles = primary.length > 0 || secondary.length > 0;
  const isCardio = exercise.category === "cardio";
  const hasLibrary = Boolean(libraryMedia?.video || libraryMedia?.poster);
  const mediaIsMap =
    !exercise.uploaded_video_url && !exercise.image_url && !hasLibrary;
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
              {libraryMedia && hasLibrary && (
                <LibraryClip media={libraryMedia} name={exercise.name} />
              )}
              {mediaIsMap ? (
                <div className="flex w-full justify-center rounded-xl bg-default-50 px-6 py-5">
                  <MuscleMap
                    className="w-full max-w-[190px]"
                    outlineWidth={1}
                    primary={primary}
                    secondary={secondary}
                  />
                </div>
              ) : exercise.image_url || exercise.uploaded_video_url ? (
                <ExerciseMedia exercise={exercise} />
              ) : null}
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
                      <MuscleBody
                        className="w-[92px] shrink-0"
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
/** Clip del catálogo en bucle sobre blanco; con "reducir movimiento", el póster. */
function LibraryClip({ media, name }: { media: LibraryMedia; name: string }) {
  return (
    <div className="aspect-square w-full overflow-hidden rounded-xl border border-default-200 bg-white">
      {media.video ? (
        <video
          autoPlay
          loop
          muted
          playsInline
          aria-label={`Animación de ${name}`}
          className="h-full w-full object-contain motion-reduce:hidden"
          poster={media.poster}
          src={media.video}
        />
      ) : null}
      {media.poster ? (
        <img
          alt={name}
          className={`h-full w-full object-contain ${media.video ? "hidden motion-reduce:block" : ""}`}
          src={media.poster}
        />
      ) : null}
    </div>
  );
}

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

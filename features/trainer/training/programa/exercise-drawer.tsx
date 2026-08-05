"use client";

// Drawer de alta/edición de ejercicio del surface unificado "Programa".
// Flujo library-only: el trainer elige un ejercicio de su biblioteca y
// prescribe según la categoría de la sesión (fuerza o cardio). Sin toasts ni
// alerts: los errores se muestran inline (validación y TrainingApiError).

import type {
  ExercisePrescription,
  LibraryExercise,
  UpdateExerciseInput,
  WorkoutExercise,
} from "./training-api";
import type { JSX } from "react";

import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Input,
  Select,
  SelectItem,
  Spinner,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import { TrainingApiError } from "./training-api";
import { useExerciseLibrarySearch, useExerciseMutations } from "./use-training";

export interface ExerciseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  programId: string;
  sessionId: string;
  sessionCategory: "strength" | "cardio";
  sessionName: string;
  /** null = modo añadir; con valor = modo editar (prellenar del ejercicio). */
  exercise: WorkoutExercise | null;
  /** Lookup slot-aware de logs del cliente para el aviso de swap. */
  getLogsForSlot: (
    sessionExerciseId: string | null,
    exerciseId: string
  ) => unknown[];
  /** Llamado tras guardar OK (el padre cierra/festeja). */
  onSaved: () => void;
}

/** Ejercicio de biblioteca elegido — lo mínimo para pintar la tarjeta. */
interface SelectedExercise {
  id: string;
  name: string;
  imageUrl: string | null;
  subtitle: string | null;
  /** Categoría del EJERCICIO elegido — decide qué campos pedimos. */
  category: "strength" | "cardio";
}

/** Todos los campos como texto controlado; se parsean al guardar. */
interface FormState {
  sets: string;
  reps: string;
  rest: string;
  rir: string;
  tempo: string;
  trainingSystem: string;
  duration: string;
  distance: string;
  intensity: string;
  minHr: string;
  maxHr: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  sets: "",
  reps: "",
  rest: "",
  rir: "",
  tempo: "",
  trainingSystem: "",
  duration: "",
  distance: "",
  intensity: "",
  minHr: "",
  maxHr: "",
  notes: "",
};

// Valores canónicos en español para AMBOS modos (añadir y editar); los tabs
// antiguos guardaban claves EN en edición y ES en alta — no reproducir eso.
const INTENSITY_OPTIONS = ["Baja", "Moderada", "Alta", "Por intervalos"];

/** Mapea valores legacy (EN o con otra capitalización) al canónico ES. */
const INTENSITY_BY_LEGACY: Record<string, string> = {
  low: "Baja",
  baja: "Baja",
  moderate: "Moderada",
  moderada: "Moderada",
  high: "Alta",
  alta: "Alta",
  interval: "Por intervalos",
  "por intervalos": "Por intervalos",
};

function normalizeIntensity(value: string | undefined): string {
  if (value === undefined) return "";
  const trimmed = value.trim();

  if (trimmed === "") return "";

  // Valor libre no reconocido (prescripciones legacy): se PRESERVA tal cual
  // en vez de vaciarlo — vaciar lo perdía silenciosamente al guardar la
  // edición. El Select añade la opción extra cuando hace falta.
  return INTENSITY_BY_LEGACY[trimmed.toLowerCase()] ?? trimmed;
}

const CATEGORY_LABELS: Record<string, string> = {
  strength: "Fuerza",
  cardio: "Cardio",
  flexibility: "Flexibilidad",
  balance: "Equilibrio",
  plyometric: "Pliometría",
  olympic: "Olímpico",
  powerlifting: "Powerlifting",
  bodyweight: "Peso corporal",
  other: "Otro",
};

function numberToField(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? String(value)
    : "";
}

/** Prefill del form desde el ejercicio en edición (todo a texto). */
function formFromExercise(exercise: WorkoutExercise): FormState {
  return {
    sets: numberToField(exercise.sets),
    reps: exercise.reps,
    rest: exercise.rest,
    rir: exercise.rir ?? "",
    tempo: exercise.tempo,
    trainingSystem: exercise.trainingSystem,
    duration: numberToField(exercise.duration),
    distance: numberToField(exercise.distance),
    intensity: normalizeIntensity(exercise.intensity),
    minHr: numberToField(exercise.heartRateZone?.min),
    maxHr: numberToField(exercise.heartRateZone?.max),
    notes: exercise.notes ?? "",
  };
}

function positiveNumber(value: string): number | null {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function ExerciseDrawer({
  isOpen,
  onClose,
  clientId,
  programId,
  sessionId,
  sessionCategory,
  sessionName,
  exercise,
  getLogsForSlot,
  onSaved,
}: ExerciseDrawerProps): JSX.Element {
  const isEdit = exercise !== null;
  // Los campos siguen al EJERCICIO elegido, no a la sesión: una sesión puede
  // mezclar fuerza y cardio (un finisher de bici en un día de empujes).
  // Antes de elegir, el default es el tipo de la sesión.

  const [term, setTerm] = useState("");
  // Filtro rápido por categoría (chips bajo el buscador); null = todas.
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedExercise | null>(null);
  const isCardio =
    selected !== null
      ? selected.category === "cardio"
      : sessionCategory === "cardio";
  const [listOpen, setListOpen] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [swapArmed, setSwapArmed] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Biblioteca SIN acotar (corrección de David): la sesión puede mezclar
  // tipos, así que se puede elegir cualquier ejercicio y los campos pedidos
  // se adaptan al elegido.
  const library = useExerciseLibrarySearch(term, undefined);
  // Chips de filtro: categorías presentes en el resultado, por frecuencia.
  const availableCategories = useMemo(() => {
    const counts = new Map<string, number>();

    for (const item of library.exercises) {
      if (typeof item.category === "string" && item.category.length > 0) {
        counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([category]) => category);
  }, [library.exercises]);
  const visibleExercises = useMemo(
    () =>
      categoryFilter === null
        ? library.exercises
        : library.exercises.filter((item) => item.category === categoryFilter),
    [library.exercises, categoryFilter]
  );
  const { addExercise, updateExercise } = useExerciseMutations(
    clientId,
    programId,
    sessionId
  );
  const isSaving = addExercise.isPending || updateExercise.isPending;

  // Reset completo en cada apertura (y si cambia el ejercicio a editar): en
  // edición el ejercicio actual queda preseleccionado sin fetch (nombre de
  // props); en alta se abre directo el listado de biblioteca.
  useEffect(() => {
    if (isOpen === false) return;

    setTerm("");
    setCategoryFilter(null);
    setSwapArmed(false);
    setSubmitError(null);

    if (exercise !== null && exercise.exercise_id !== undefined) {
      setSelected({
        id: exercise.exercise_id,
        name: exercise.name,
        imageUrl: exercise.imageUrl ?? null,
        subtitle:
          exercise.category !== undefined
            ? (CATEGORY_LABELS[exercise.category] ?? exercise.category)
            : null,
        category: exercise.category === "cardio" ? "cardio" : "strength",
      });
      setListOpen(false);
      setForm(formFromExercise(exercise));
    } else {
      setSelected(null);
      setListOpen(true);
      setForm(exercise !== null ? formFromExercise(exercise) : EMPTY_FORM);
    }
  }, [isOpen, exercise]);

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Cambiar de ejercicio de biblioteca NO toca la prescripción ya escrita:
  // solo se reemplaza la identidad (mismo criterio que los tabs actuales).
  const pickExercise = (item: LibraryExercise) => {
    setSelected({
      id: item.id,
      name: item.name,
      imageUrl:
        typeof item.image_url === "string" && item.image_url.length > 0
          ? item.image_url
          : null,
      subtitle:
        item.category !== undefined
          ? (CATEGORY_LABELS[item.category] ?? item.category)
          : (item.description ?? null),
      category: item.category === "cardio" ? "cardio" : "strength",
    });
    setListOpen(false);
    setSwapArmed(false);
    setSubmitError(null);
  };

  // ── Validación inline ─────────────────────────────────────────────────
  const setsNum = positiveNumber(form.sets);
  const durationNum = positiveNumber(form.duration);

  const exerciseError =
    selected === null ? "Selecciona un ejercicio de tu biblioteca" : null;
  const setsError =
    isCardio === false && setsNum === null ? "Indica al menos 1 serie." : null;
  const repsError =
    isCardio === false && form.reps.trim().length === 0
      ? "Indica las repeticiones."
      : null;
  const durationError =
    isCardio && durationNum === null ? "Indica la duración en minutos." : null;

  const isValid =
    exerciseError === null &&
    setsError === null &&
    repsError === null &&
    durationError === null;

  // ── Aviso de swap (solo edición) ──────────────────────────────────────
  const swapRisk =
    exercise !== null &&
    selected !== null &&
    exercise.exercise_id !== undefined &&
    selected.id !== exercise.exercise_id &&
    getLogsForSlot(exercise.id ?? null, exercise.exercise_id).length > 0;

  const buildPrescription = (): ExercisePrescription => {
    if (isCardio === false) {
      return {
        sets: setsNum ?? 0,
        reps: form.reps.trim(),
        tempo: form.tempo.trim(),
        rest: form.rest.trim(),
        rir: form.rir.trim(),
        trainingSystem: form.trainingSystem.trim(),
        notes: form.notes.trim(),
      };
    }

    const distanceNum = positiveNumber(form.distance);
    const minHrNum = positiveNumber(form.minHr);
    const maxHrNum = positiveNumber(form.maxHr);

    return {
      duration: durationNum ?? 0,
      // distance SIEMPRE presente: 0 = campo vaciado, el PUT anula la
      // columna (si se omitiera, el valor viejo quedaría irrecuperable).
      distance: distanceNum ?? 0,
      notes: form.notes.trim(),
      ...(form.intensity !== "" ? { intensity: form.intensity } : {}),
      ...(minHrNum !== null ? { minHeartRate: minHrNum } : {}),
      ...(maxHrNum !== null ? { maxHeartRate: maxHrNum } : {}),
    };
  };

  const handleSave = async () => {
    if (selected === null || isValid === false || isSaving) return;

    // Confirmación en dos pasos para el swap con logs: la primera pulsación
    // arma el CTA ("Cambiar igualmente"); la segunda guarda de verdad.
    if (swapRisk && swapArmed === false) {
      setSwapArmed(true);

      return;
    }

    setSubmitError(null);

    const prescription = buildPrescription();

    try {
      if (exercise === null) {
        await addExercise.mutateAsync({
          exerciseId: selected.id,
          ...prescription,
        });
      } else if (exercise.id !== undefined) {
        const payload: UpdateExerciseInput = {
          ...prescription,
          // `exerciseId` distinto = swap; si no cambió, no se envía.
          ...(selected.id !== exercise.exercise_id
            ? { exerciseId: selected.id }
            : {}),
        };

        await updateExercise.mutateAsync({
          sessionExerciseId: exercise.id,
          payload,
        });
      } else {
        setSubmitError("Este ejercicio no se puede editar (falta su id).");

        return;
      }

      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof TrainingApiError
          ? error.message
          : "No se pudo guardar el ejercicio. Inténtalo de nuevo."
      );
    }
  };

  const ctaLabel =
    swapRisk && swapArmed
      ? "Cambiar igualmente"
      : isEdit
        ? "Guardar cambios"
        : `Añadir a ${sessionName}`;

  return (
    <Drawer
      classNames={{ base: "!max-w-full sm:!max-w-[600px]" }}
      isOpen={isOpen}
      placement="right"
      size="lg"
      onClose={onClose}
    >
      <DrawerContent>
        <DrawerHeader className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? "Editar ejercicio" : "Añadir ejercicio"}
          </h2>
          <p className="text-xs font-normal text-default-500">
            {sessionName} · {sessionCategory === "cardio" ? "Cardio" : "Fuerza"}
          </p>
        </DrawerHeader>

        <DrawerBody className="gap-5">
          {/* ── 1. Ejercicio de biblioteca ─────────────────────────── */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
              1. Ejercicio de tu biblioteca
            </p>

            {selected !== null && (
              <div className="flex items-center gap-3 rounded-large border border-blue-500 bg-blue-50/50 p-2.5 ring-1 ring-blue-500">
                <ExerciseThumb
                  fallbackIcon={
                    selected.category === "cardio"
                      ? "solar:heart-pulse-linear"
                      : "solar:dumbbell-linear"
                  }
                  imageUrl={selected.imageUrl}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {selected.name}
                  </p>
                  {selected.subtitle !== null && (
                    <p className="truncate text-xs text-default-500">
                      {selected.subtitle}
                    </p>
                  )}
                </div>
                {listOpen === false && (
                  <Button
                    size="sm"
                    startContent={
                      <Icon icon="solar:refresh-linear" width={14} />
                    }
                    variant="light"
                    onPress={() => setListOpen(true)}
                  >
                    Cambiar
                  </Button>
                )}
              </div>
            )}

            {(selected === null || listOpen) && (
              <div className="flex flex-col gap-2">
                <Input
                  isClearable
                  placeholder="Buscar ejercicios..."
                  startContent={
                    <Icon
                      className="text-gray-600"
                      icon="solar:magnifer-linear"
                      width={16}
                    />
                  }
                  value={term}
                  variant="bordered"
                  onClear={() => setTerm("")}
                  onValueChange={setTerm}
                />

                {availableCategories.length > 1 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {[null, ...availableCategories].map((cat) => {
                      const isActive = categoryFilter === cat;
                      const label =
                        cat === null ? "Todos" : (CATEGORY_LABELS[cat] ?? cat);

                      return (
                        <button
                          key={cat ?? "all"}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            isActive
                              ? cat === "cardio"
                                ? "border-rose-600 bg-rose-600 text-white"
                                : "border-slate-900 bg-slate-900 text-white"
                              : "border-gray-200 bg-white text-default-600 hover:border-gray-300 hover:text-gray-900"
                          }`}
                          type="button"
                          onClick={() =>
                            setCategoryFilter(isActive ? null : cat)
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {library.isLoading || library.isSearching ? (
                  <div className="flex justify-center py-6">
                    <Spinner size="sm" />
                  </div>
                ) : library.error !== null ? (
                  <p className="rounded-large bg-danger-50 p-3 text-xs text-danger">
                    No pudimos cargar tu biblioteca de ejercicios. Inténtalo de
                    nuevo.
                  </p>
                ) : visibleExercises.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-large border border-dashed border-gray-200 bg-gray-50/50 px-6 py-8 text-center">
                    <Icon
                      className="text-default-300"
                      icon="solar:magnifer-linear"
                      width={28}
                    />
                    <p className="text-sm text-default-500">
                      {term.trim().length > 0
                        ? "No encontramos ejercicios con ese nombre."
                        : "Tu biblioteca no tiene ejercicios todavía."}
                    </p>
                  </div>
                ) : (
                  <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-0.5">
                    {visibleExercises.map((item) => (
                      <LibraryRow
                        key={item.id}
                        fallbackIcon={
                          item.category === "cardio"
                            ? "solar:heart-pulse-linear"
                            : "solar:dumbbell-linear"
                        }
                        item={item}
                        selected={selected?.id === item.id}
                        onPick={() => pickExercise(item)}
                      />
                    ))}
                  </div>
                )}

                <a
                  className="text-xs text-default-500"
                  href="/trainer/dashboard/exercise-library"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  ¿No está en tu biblioteca?{" "}
                  <span className="font-medium text-gray-900 underline">
                    Gestiona tus ejercicios
                  </span>
                </a>
              </div>
            )}

            {exerciseError !== null && (
              <p className="text-xs text-danger">{exerciseError}</p>
            )}
          </div>

          {/* ── 2. Prescripción ────────────────────────────────────── */}
          <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
              2. Prescripción
            </p>

            {isCardio === false ? (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Series"
                  labelPlacement="outside"
                  min={1}
                  placeholder="Ej: 4"
                  size="sm"
                  type="number"
                  value={form.sets}
                  variant="bordered"
                  onValueChange={(value) => setField("sets", value)}
                />
                <Input
                  label="Repeticiones"
                  labelPlacement="outside"
                  placeholder="Ej: 10-12, AMRAP"
                  size="sm"
                  value={form.reps}
                  variant="bordered"
                  onValueChange={(value) => setField("reps", value)}
                />
                <Input
                  label="Descanso"
                  labelPlacement="outside"
                  placeholder="Ej: 90 s"
                  size="sm"
                  value={form.rest}
                  variant="bordered"
                  onValueChange={(value) => setField("rest", value)}
                />
                <Input
                  label="RIR"
                  labelPlacement="outside"
                  placeholder="Ej: 2"
                  size="sm"
                  value={form.rir}
                  variant="bordered"
                  onValueChange={(value) => setField("rir", value)}
                />
                <Input
                  label="Tempo"
                  labelPlacement="outside"
                  placeholder="Ej: 3-1-1"
                  size="sm"
                  value={form.tempo}
                  variant="bordered"
                  onValueChange={(value) => setField("tempo", value)}
                />
                <Input
                  label="Sistema de entrenamiento"
                  labelPlacement="outside"
                  placeholder="Ej: Series rectas"
                  size="sm"
                  value={form.trainingSystem}
                  variant="bordered"
                  onValueChange={(value) => setField("trainingSystem", value)}
                />
                <Textarea
                  className="col-span-2"
                  label="Notas"
                  labelPlacement="outside"
                  minRows={2}
                  placeholder="Indicaciones para el cliente (opcional)"
                  size="sm"
                  value={form.notes}
                  variant="bordered"
                  onValueChange={(value) => setField("notes", value)}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Duración (min)"
                  labelPlacement="outside"
                  min={1}
                  placeholder="Ej: 30"
                  size="sm"
                  type="number"
                  value={form.duration}
                  variant="bordered"
                  onValueChange={(value) => setField("duration", value)}
                />
                <Input
                  label="Distancia (km) — opcional"
                  labelPlacement="outside"
                  min={0}
                  placeholder="Ej: 5"
                  size="sm"
                  step={0.1}
                  type="number"
                  value={form.distance}
                  variant="bordered"
                  onValueChange={(value) => setField("distance", value)}
                />
                <Select
                  className="col-span-2"
                  label="Intensidad"
                  labelPlacement="outside"
                  placeholder="Selecciona la intensidad"
                  selectedKeys={form.intensity === "" ? [] : [form.intensity]}
                  size="sm"
                  variant="bordered"
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0];

                    setField(
                      "intensity",
                      typeof value === "string" ? value : ""
                    );
                  }}
                >
                  {(form.intensity !== "" &&
                  !INTENSITY_OPTIONS.includes(form.intensity)
                    ? [...INTENSITY_OPTIONS, form.intensity]
                    : INTENSITY_OPTIONS
                  ).map((option) => (
                    <SelectItem key={option}>{option}</SelectItem>
                  ))}
                </Select>
                <Input
                  label="BPM mín — opcional"
                  labelPlacement="outside"
                  min={0}
                  placeholder="Ej: 120"
                  size="sm"
                  type="number"
                  value={form.minHr}
                  variant="bordered"
                  onValueChange={(value) => setField("minHr", value)}
                />
                <Input
                  label="BPM máx — opcional"
                  labelPlacement="outside"
                  min={0}
                  placeholder="Ej: 150"
                  size="sm"
                  type="number"
                  value={form.maxHr}
                  variant="bordered"
                  onValueChange={(value) => setField("maxHr", value)}
                />
                <Textarea
                  className="col-span-2"
                  label="Notas"
                  labelPlacement="outside"
                  minRows={2}
                  placeholder="Indicaciones para el cliente (opcional)"
                  size="sm"
                  value={form.notes}
                  variant="bordered"
                  onValueChange={(value) => setField("notes", value)}
                />
              </div>
            )}

            {(setsError !== null ||
              repsError !== null ||
              durationError !== null) && (
              <div className="flex flex-col gap-0.5">
                {setsError !== null && (
                  <p className="text-xs text-danger">{setsError}</p>
                )}
                {repsError !== null && (
                  <p className="text-xs text-danger">{repsError}</p>
                )}
                {durationError !== null && (
                  <p className="text-xs text-danger">{durationError}</p>
                )}
              </div>
            )}
          </div>
        </DrawerBody>

        <DrawerFooter className="flex-col items-stretch gap-2">
          {swapRisk && (
            <div className="flex gap-2 rounded-large bg-amber-50 p-3 text-xs text-amber-800">
              <Icon
                className="mt-0.5 shrink-0 text-amber-500"
                icon="solar:danger-triangle-linear"
                width={16}
              />
              <p>
                Este cliente ya registró entrenamientos de este ejercicio. Esos
                registros quedarán ligados al ejercicio anterior; los nuevos
                serán del nuevo.
              </p>
            </div>
          )}

          {submitError !== null && (
            <div className="flex gap-2 rounded-large bg-danger-50 p-3 text-xs text-danger">
              <Icon
                className="mt-0.5 shrink-0"
                icon="solar:danger-circle-linear"
                width={16}
              />
              <p>{submitError}</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button isDisabled={isSaving} variant="light" onPress={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-slate-900 text-white"
              isDisabled={isValid === false}
              isLoading={isSaving}
              startContent={
                isSaving ? null : (
                  <Icon
                    icon={
                      isEdit
                        ? "solar:diskette-linear"
                        : "solar:add-circle-linear"
                    }
                    width={18}
                  />
                )
              }
              onPress={handleSave}
            >
              {ctaLabel}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function ExerciseThumb({
  imageUrl,
  fallbackIcon,
}: {
  imageUrl: string | null;
  fallbackIcon: string;
}) {
  if (imageUrl !== null) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        className="h-11 w-11 shrink-0 rounded-medium border border-gray-200 object-cover"
        loading="lazy"
        src={imageUrl}
      />
    );
  }

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-medium border border-gray-200 bg-gray-50">
      <Icon className="text-default-400" icon={fallbackIcon} width={18} />
    </span>
  );
}

function LibraryRow({
  item,
  selected,
  fallbackIcon,
  onPick,
}: {
  item: LibraryExercise;
  selected: boolean;
  fallbackIcon: string;
  onPick: () => void;
}) {
  const categoryLabel =
    item.category !== undefined
      ? (CATEGORY_LABELS[item.category] ?? item.category)
      : null;
  // description puede venir null desde la librería (el trainer nunca escribió
  // una) — antes se interpolaba y se veía "Cardio · null".
  const description =
    typeof item.description === "string" && item.description.trim().length > 0
      ? item.description
      : null;
  const subtitle =
    categoryLabel !== null && description !== null
      ? `${categoryLabel} · ${description}`
      : (categoryLabel ?? description);

  return (
    <button
      className={`flex items-center gap-3 rounded-large border p-2.5 text-left transition-all ${
        selected
          ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
      type="button"
      onClick={onPick}
    >
      <ExerciseThumb
        fallbackIcon={fallbackIcon}
        imageUrl={
          typeof item.image_url === "string" && item.image_url.length > 0
            ? item.image_url
            : null
        }
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {item.name}
        </p>
        {subtitle !== null && (
          <p className="truncate text-xs text-default-500">{subtitle}</p>
        )}
      </div>
      <Icon
        className="shrink-0 text-default-400"
        icon="solar:alt-arrow-right-linear"
        width={18}
      />
    </button>
  );
}

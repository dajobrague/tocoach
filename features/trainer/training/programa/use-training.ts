"use client";

// Hooks react-query del surface "Programa". Un solo cache de programas por
// cliente (ambas categorías, ya transformados en el servidor); mutaciones
// invalidan ese cache, y los reorders lo parchean optimistamente con rollback
// (mismo patrón onMutate/cancelQueries de use-cycles). Sin toasts ni alerts:
// los errores suben como TrainingApiError para que la UI decida.

import type {
  AddExerciseInput,
  CreateProgramInput,
  ExerciseOrderItem,
  LibraryExercise,
  ProgramCategory,
  ProgramTemplate,
  SessionOrderItem,
  UpdateExerciseInput,
  UpdateProgramInput,
  WorkoutProgram,
} from "./training-api";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  addExercise,
  addSession,
  applyExerciseReorder,
  applySessionReorder,
  createProgram,
  deleteExercise,
  deleteProgram,
  deleteSession,
  duplicateExercise,
  duplicateSession,
  fetchPrograms,
  listProgramTemplates,
  reorderExercises,
  reorderSessions,
  saveProgramAsTemplate,
  searchExerciseLibrary,
  updateExercise,
  updateProgram,
  updateSession,
} from "./training-api";

import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

const programsKey = (clientId: string) =>
  ["trainer", "programs", clientId] as const;
const templatesKey = (category?: ProgramCategory) =>
  ["trainer", "program-templates", category ?? "all"] as const;

/** Programas activos del cliente (fuerza + cardio), listos para render. */
export function usePrograms(clientId: string) {
  const query = useQuery<WorkoutProgram[]>({
    queryKey: programsKey(clientId),
    queryFn: () => fetchPrograms(clientId),
  });

  return {
    programs: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Alta/edición/borrado de programas + guardar como plantilla. */
export function useProgramMutations(clientId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: programsKey(clientId) });
  };

  const createProgramM = useMutation({
    mutationFn: (input: CreateProgramInput) => createProgram(clientId, input),
    onSuccess: invalidate,
  });
  const updateProgramM = useMutation({
    mutationFn: (vars: { programId: string; input: UpdateProgramInput }) =>
      updateProgram(clientId, vars.programId, vars.input),
    onSuccess: invalidate,
  });
  const deleteProgramM = useMutation({
    mutationFn: (programId: string) => deleteProgram(clientId, programId),
    onSuccess: invalidate,
  });
  const saveAsTemplateM = useMutation({
    mutationFn: (vars: { programId: string; templateName: string }) =>
      saveProgramAsTemplate(vars.programId, vars.templateName),
    // El programa no cambia; solo aparece una plantilla nueva en los listados.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trainer", "program-templates"] });
    },
  });

  return {
    createProgram: createProgramM,
    updateProgram: updateProgramM,
    deleteProgram: deleteProgramM,
    saveAsTemplate: saveAsTemplateM,
  };
}

/** Mutaciones de sesiones de un programa; reorder optimista con rollback. */
export function useSessionMutations(clientId: string, programId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: programsKey(clientId) });
  };

  const addSessionM = useMutation({
    mutationFn: (input: { name: string; daysOfWeek?: (string | number)[] }) =>
      addSession(clientId, programId, input),
    onSuccess: invalidate,
  });
  const updateSessionM = useMutation({
    mutationFn: (vars: {
      sessionId: string;
      patch: { name?: string; daysOfWeek?: (string | number)[] };
    }) => updateSession(clientId, programId, vars.sessionId, vars.patch),
    onSuccess: invalidate,
  });
  const deleteSessionM = useMutation({
    mutationFn: (sessionId: string) =>
      deleteSession(clientId, programId, sessionId),
    onSuccess: invalidate,
  });
  const duplicateSessionM = useMutation({
    mutationFn: (vars: { sessionId: string; name?: string }) =>
      duplicateSession(clientId, programId, vars.sessionId, vars.name),
    onSuccess: invalidate,
  });
  const reorderSessionsM = useMutation({
    mutationFn: (reorder: SessionOrderItem[]) =>
      reorderSessions(clientId, programId, reorder),
    // Reordena el cache al instante para que el drag no "rebote"; rollback en
    // error y reconciliación con el servidor al asentar.
    onMutate: async (reorder) => {
      await qc.cancelQueries({ queryKey: programsKey(clientId) });

      const previous = qc.getQueryData<WorkoutProgram[]>(programsKey(clientId));

      if (previous !== undefined) {
        qc.setQueryData<WorkoutProgram[]>(
          programsKey(clientId),
          applySessionReorder(previous, programId, reorder)
        );
      }

      return { previous };
    },
    onError: (_error, _reorder, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(programsKey(clientId), context.previous);
      }
    },
    onSettled: invalidate,
  });

  return {
    addSession: addSessionM,
    updateSession: updateSessionM,
    deleteSession: deleteSessionM,
    duplicateSession: duplicateSessionM,
    reorderSessions: reorderSessionsM,
  };
}

/** Mutaciones de ejercicios de una sesión; reorder optimista con rollback. */
export function useExerciseMutations(
  clientId: string,
  programId: string,
  sessionId: string
) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: programsKey(clientId) });
  };

  const addExerciseM = useMutation({
    mutationFn: (input: AddExerciseInput) =>
      addExercise(clientId, programId, sessionId, input),
    onSuccess: invalidate,
  });
  const updateExerciseM = useMutation({
    mutationFn: (vars: {
      sessionExerciseId: string;
      payload: UpdateExerciseInput;
    }) =>
      updateExercise(
        clientId,
        programId,
        sessionId,
        vars.sessionExerciseId,
        vars.payload
      ),
    onSuccess: invalidate,
  });
  const deleteExerciseM = useMutation({
    mutationFn: (sessionExerciseId: string) =>
      deleteExercise(clientId, programId, sessionId, sessionExerciseId),
    onSuccess: invalidate,
  });
  const duplicateExerciseM = useMutation({
    mutationFn: (sessionExerciseId: string) =>
      duplicateExercise(clientId, programId, sessionId, sessionExerciseId),
    onSuccess: invalidate,
  });
  const reorderExercisesM = useMutation({
    mutationFn: (reorder: ExerciseOrderItem[]) =>
      reorderExercises(clientId, programId, sessionId, reorder),
    onMutate: async (reorder) => {
      await qc.cancelQueries({ queryKey: programsKey(clientId) });

      const previous = qc.getQueryData<WorkoutProgram[]>(programsKey(clientId));

      if (previous !== undefined) {
        qc.setQueryData<WorkoutProgram[]>(
          programsKey(clientId),
          applyExerciseReorder(previous, programId, sessionId, reorder)
        );
      }

      return { previous };
    },
    onError: (_error, _reorder, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(programsKey(clientId), context.previous);
      }
    },
    onSettled: invalidate,
  });

  return {
    addExercise: addExerciseM,
    updateExercise: updateExerciseM,
    deleteExercise: deleteExerciseM,
    duplicateExercise: duplicateExerciseM,
    reorderExercises: reorderExercisesM,
  };
}

/**
 * Biblioteca de ejercicios con búsqueda en servidor. Sin término: lista de
 * "browse" (limit 500, sin filtrar fuerza por categoría — igual que los tabs
 * actuales). Con término: `?search=` debounced (250ms) limit 50. `category`
 * solo se pasa para cardio.
 */
export function useExerciseLibrarySearch(term: string, category?: "cardio") {
  const debounced = useDebouncedValue(term.trim(), 250);

  const query = useQuery<LibraryExercise[]>({
    queryKey: ["trainer", "exercise-library", category ?? "all", debounced],
    queryFn: () =>
      debounced.length > 0
        ? searchExerciseLibrary({
            search: debounced,
            limit: 50,
            ...(category !== undefined ? { category } : {}),
          })
        : searchExerciseLibrary({
            limit: 500,
            ...(category !== undefined ? { category } : {}),
          }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  return {
    exercises: query.data ?? [],
    isLoading: query.isLoading,
    isSearching: query.isFetching && debounced.length > 0,
    error: query.error,
  };
}

/** Plantillas de programa para el modal de creación (omitir category = todas). */
export function useProgramTemplates(category?: ProgramCategory) {
  const query = useQuery<ProgramTemplate[]>({
    queryKey: templatesKey(category),
    queryFn: () => listProgramTemplates(category),
  });

  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

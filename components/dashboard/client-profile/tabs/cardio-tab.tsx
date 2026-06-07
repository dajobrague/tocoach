/* eslint-disable no-console */
"use client";

import type { WorkoutProgram } from "@/types/training";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Spinner,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ExerciseProgressCard } from "./workouts/exercise-progress-card";
import { OrphanExercisesSection } from "./workouts/orphan-exercises-section";
import { useClientExerciseLogs } from "./workouts/use-client-exercise-logs";
import { useExerciseExpandedState } from "./workouts/use-exercise-expanded-state";

import SaveAsTemplateModal from "@/components/dashboard/save-as-template-modal";
import {
  TrainerExerciseVideoModal,
  type TrainerExerciseVideoHandle,
} from "@/components/trainer/trainer-exercise-video-modal";

// Sortable wrapper for session cards
function SortableSessionItem({
  id,
  children,
}: {
  id: string;
  children: (props: {
    dragHandleProps: Record<string, any>;
  }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
}

// Sortable wrapper for exercise items
function SortableExerciseItem({
  id,
  children,
}: {
  id: string;
  children: (props: {
    dragHandleProps: Record<string, any>;
  }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
}

interface CardioTabProps {
  clientId: string;
  clientName?: string;
}

export default function CardioTab({ clientId, clientName }: CardioTabProps) {
  const [programs, setPrograms] = useState<WorkoutProgram[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activePrograms = programs.filter((p) => p.status === "active");
  const activeProgram = activePrograms[0]; // For backwards compatibility with existing code

  // Helper function to get status display properties
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "active":
        return {
          label: "Activo",
          color: "success" as const,
          className: "text-white font-semibold",
        };
      case "completed":
        return {
          label: "Completado",
          color: "default" as const,
          className: "text-gray-700 font-semibold",
        };
      case "paused":
        return {
          label: "Pausado",
          color: "warning" as const,
          className: "text-white font-semibold",
        };
      case "cancelled":
        return {
          label: "Cancelado",
          color: "danger" as const,
          className: "text-white font-semibold",
        };
      default:
        return {
          label: "Activo",
          color: "success" as const,
          className: "text-white font-semibold",
        };
    }
  };
  const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);
  const [isEditExerciseModalOpen, setIsEditExerciseModalOpen] = useState(false);
  const [isAddProgramModalOpen, setIsAddProgramModalOpen] = useState(false);
  const [isEditProgramModalOpen, setIsEditProgramModalOpen] = useState(false);
  const [isAddSessionModalOpen, setIsAddSessionModalOpen] = useState(false);
  const [isEditSessionModalOpen, setIsEditSessionModalOpen] = useState(false);
  const [isSaveAsTemplateModalOpen, setIsSaveAsTemplateModalOpen] =
    useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(
    null
  );
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(
    new Set()
  );
  const [exerciseForm, setExerciseForm] = useState({
    name: "",
    type: "",
    duration: "",
    distance: "",
    intensity: "",
    minHeartRate: "",
    maxHeartRate: "",
    notes: "",
    exerciseId: "", // Store selected library exercise ID
  });
  const [libraryExercises, setLibraryExercises] = useState<any[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  // Controlled input text for the library Autocomplete. We own the input
  // value instead of letting React Aria auto-sync it from `selectedKey` —
  // otherwise pre-selecting an exercise on edit makes the combobox sync its
  // input to the item label, fire onInputChange, flip `items` away from the
  // selected item, and loop ("Maximum update depth exceeded"). Controlling
  // inputValue is the HeroUI/React-Aria controlled-combobox pattern.
  const [libraryInputValue, setLibraryInputValue] = useState("");
  // Server-side search state. The initial fetch caps the browse list, but
  // trainers with bigger libraries were missing items because the
  // Autocomplete filters `defaultItems` client-side and never re-queried.
  // We now debounce a server-search on `onInputChange` so anything in the
  // cardio library is discoverable regardless of size.
  const [librarySearchTerm, setLibrarySearchTerm] = useState("");
  const [librarySearchResults, setLibrarySearchResults] = useState<any[]>([]);
  const [isSearchingLibrary, setIsSearchingLibrary] = useState(false);
  // Remembers the library exercise the Edit modal opened with, so we can
  // detect a swap (new exerciseId !== original) and warn when the client
  // already logged the original exercise.
  const [editOriginalExerciseId, setEditOriginalExerciseId] =
    useState<string>("");
  const [programForm, setProgramForm] = useState({
    name: "",
    type: "",
    goal: "",
    startDate: "",
    sessionsPerWeek: "",
    notes: "",
    status: "active",
    templateId: "", // NEW: for template selection
  });
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  // Exercise progress integration: shared log fetching, video modal,
  // expansion state. Same hooks reused from Entrenamientos.
  const { getLogsForExercise, getOrphanGroups } =
    useClientExerciseLogs(clientId);
  const { isExpanded, toggle: toggleExerciseExpanded } =
    useExerciseExpandedState();
  const videoModalRef = useRef<TrainerExerciseVideoHandle>(null);
  const openExerciseVideo = useCallback(
    (url: string, name: string) => videoModalRef.current?.open(url, name),
    []
  );

  const [sessionForm, setSessionForm] = useState({
    name: "",
  });

  // Set of library exercise IDs prescribed across active cardio programs —
  // used by the orphan section to filter off-plan logged exercises.
  const prescribedExerciseIds = useMemo(() => {
    const ids = new Set<string>();

    for (const program of programs) {
      for (const session of program.sessions) {
        for (const exercise of session.exercises) {
          if (exercise.exercise_id) ids.add(exercise.exercise_id);
        }
      }
    }

    return ids;
  }, [programs]);

  const orphanGroups = getOrphanGroups(prescribedExerciseIds);

  // Fetch programs from API
  const fetchPrograms = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Only fetch active cardio programs for the client profile view
      const response = await fetch(
        `/api/clients/${clientId}/programs?category=cardio&status=active`
      );
      const data = await response.json();

      if (data.success) {
        setPrograms(data.programs || []);
      } else {
        setError(data.error || "Error al cargar programas de cardio");
      }
    } catch (err) {
      console.error("[CardioTab] Error fetching programs:", err);
      setError("Error al cargar programas de cardio");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, [clientId]);

  // Debounced server-side library search. Empty input falls back to the
  // initial `libraryExercises` browse list; non-empty input replaces it
  // with `?search=` results (scoped to the cardio category) so libraries
  // beyond the initial fetch cap are still searchable. 250ms keeps it
  // responsive without spamming the API.
  useEffect(() => {
    const term = librarySearchTerm.trim();

    if (!term) {
      setLibrarySearchResults([]);

      return;
    }

    setIsSearchingLibrary(true);
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          category: "cardio",
          search: term,
          limit: "50",
        });
        const res = await fetch(`/api/exercises?${params.toString()}`);
        const data = await res.json();

        if (data.success) {
          setLibrarySearchResults(data.exercises || []);
        }
      } catch (err) {
        console.error("Error searching cardio library:", err);
      } finally {
        setIsSearchingLibrary(false);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [librarySearchTerm]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Reorder sessions handler
  const handleSessionDragEnd = useCallback(
    async (programId: string, event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      const program = programs.find((p) => p.programId === programId);

      if (!program) return;

      const oldIndex = program.sessions.findIndex((s) => s.id === active.id);
      const newIndex = program.sessions.findIndex((s) => s.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const previousPrograms = programs.map((p) => ({
        ...p,
        sessions: [...p.sessions],
      }));

      const reordered = arrayMove(program.sessions, oldIndex, newIndex);

      setPrograms((prev) =>
        prev.map((p) =>
          p.programId === programId ? { ...p, sessions: reordered } : p
        )
      );

      const reorderPayload = reordered.map((s, idx) => ({
        id: s.id,
        session_order: idx + 1,
      }));

      try {
        const response = await fetch(
          `/api/clients/${clientId}/programs/${programId}/sessions`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reorder: reorderPayload }),
          }
        );
        const result = await response.json();

        if (!result.success) {
          setPrograms(previousPrograms);
          console.error("Error reordering sessions:", result.error);
        }
      } catch (error) {
        setPrograms(previousPrograms);
        console.error("Error reordering sessions:", error);
      }
    },
    [programs, clientId]
  );

  // Reorder exercises within a session handler
  const handleExerciseDragEnd = useCallback(
    async (programId: string, sessionId: string, event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      const program = programs.find((p) => p.programId === programId);

      if (!program) return;

      const session = program.sessions.find((s) => s.id === sessionId);

      if (!session) return;

      const oldIndex = session.exercises.findIndex(
        (e) => (e.id || `exercise-${e.order}`) === active.id
      );
      const newIndex = session.exercises.findIndex(
        (e) => (e.id || `exercise-${e.order}`) === over.id
      );

      if (oldIndex === -1 || newIndex === -1) return;

      const previousPrograms = programs.map((p) => ({
        ...p,
        sessions: p.sessions.map((s) => ({
          ...s,
          exercises: [...s.exercises],
        })),
      }));

      const reorderedExercises = arrayMove(
        session.exercises,
        oldIndex,
        newIndex
      );

      setPrograms((prev) =>
        prev.map((p) =>
          p.programId === programId
            ? {
                ...p,
                sessions: p.sessions.map((s) =>
                  s.id === sessionId
                    ? { ...s, exercises: reorderedExercises }
                    : s
                ),
              }
            : p
        )
      );

      const reorderPayload = reorderedExercises.map((e, idx) => ({
        id: e.id,
        exercise_order: idx + 1,
      }));

      try {
        const response = await fetch(
          `/api/clients/${clientId}/programs/${programId}/sessions/${sessionId}/exercises`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reorder: reorderPayload }),
          }
        );
        const result = await response.json();

        if (!result.success) {
          setPrograms(previousPrograms);
          console.error("Error reordering exercises:", result.error);
        }
      } catch (error) {
        setPrograms(previousPrograms);
        console.error("Error reordering exercises:", error);
      }
    },
    [programs, clientId]
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Fetch the cardio library browse list. Shared by both the Add and Edit
  // modals so each has items to render (the Edit modal needs them to display
  // its pre-selected entry). Bumped to 500 — comfortably above any current
  // library size — and the live `?search=` effect covers anything beyond it.
  const loadLibraryExercises = async () => {
    setIsLoadingLibrary(true);
    try {
      const response = await fetch("/api/exercises?category=cardio&limit=500");
      const result = await response.json();

      if (result.success) {
        setLibraryExercises(result.exercises || []);
      }
    } catch (error) {
      console.error("Error fetching library exercises:", error);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  const handleOpenAddExercise = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsAddExerciseModalOpen(true);
    setLibraryInputValue("");
    setLibrarySearchTerm("");

    await loadLibraryExercises();
  };

  const handleSelectLibraryExercise = (exerciseId: string) => {
    // Look in both the initial browse list and the live search results —
    // a trainer can pick from either depending on whether they were typing.
    const exercise =
      libraryExercises.find((ex) => ex.id === exerciseId) ??
      librarySearchResults.find((ex) => ex.id === exerciseId);

    if (exercise) {
      // Auto-fill form with exercise data
      // For cardio exercises, default_reps might be duration, default_tempo might be type, etc.
      setExerciseForm({
        name: exercise.name,
        type: exercise.metadata?.cardio_type || exercise.category || "",
        duration: exercise.default_reps || "", // Could repurpose for duration
        distance: "",
        intensity: exercise.metadata?.intensity || "",
        minHeartRate: "",
        maxHeartRate: "",
        notes: exercise.description || "",
        exerciseId: exercise.id,
      });
      // Keep the controlled input text in sync with the picked exercise.
      setLibraryInputValue(exercise.name);
    }
  };

  const handleCloseAddExercise = () => {
    setIsAddExerciseModalOpen(false);
    setSelectedSessionId(null);
    setLibraryInputValue("");
    setLibrarySearchTerm("");
    setExerciseForm({
      name: "",
      type: "",
      duration: "",
      distance: "",
      intensity: "",
      minHeartRate: "",
      maxHeartRate: "",
      notes: "",
      exerciseId: "",
    });
    setLibraryExercises([]);
  };

  const handleSaveExercise = async () => {
    if (!selectedSessionId || !selectedProgramId) return;

    // The API now requires a library exercise to anchor the slot.
    if (!exerciseForm.exerciseId) {
      alert("Selecciona un ejercicio de tu biblioteca");

      return;
    }

    setIsSaving(true);
    try {
      // Include exerciseId if selected from library
      const payload = {
        ...exerciseForm,
        exerciseId: exerciseForm.exerciseId || undefined, // Send exerciseId if available
      };

      const response = await fetch(
        `/api/clients/${clientId}/programs/${selectedProgramId}/sessions/${selectedSessionId}/exercises`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (data.success) {
        // Keep the session expanded
        setExpandedSessions((prev) => new Set(prev).add(selectedSessionId));
        // Refresh programs to show new exercise
        await fetchPrograms();
        handleCloseAddExercise();
      } else {
        alert(
          "Error al guardar ejercicio: " + (data.error || "Error desconocido")
        );
      }
    } catch (err) {
      console.error("[CardioTab] Error saving exercise:", err);
      alert("Error al guardar ejercicio");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAddProgram = async () => {
    setIsAddProgramModalOpen(true);
    // Fetch templates for cardio programs
    setIsLoadingTemplates(true);
    try {
      const response = await fetch(
        "/api/templates?type=programs&category=cardio"
      );
      const result = await response.json();

      if (result.success) {
        setTemplates(result.templates || []);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleCloseAddProgram = () => {
    setIsAddProgramModalOpen(false);
    setProgramForm({
      name: "",
      type: "",
      goal: "",
      startDate: "",
      sessionsPerWeek: "",
      notes: "",
      status: "active",
      templateId: "",
    });
  };

  const handleOpenEditProgram = (program?: any) => {
    const programToEdit = program || activeProgram;

    if (!programToEdit) return;

    // Populate form with current program data
    setProgramForm({
      name: programToEdit.name,
      type: programToEdit.type,
      goal: (programToEdit as any).goal || "",
      startDate: programToEdit.assignedDate,
      sessionsPerWeek: programToEdit.sessionsPerWeek.toString(),
      notes: "",
      status: programToEdit.status || "active",
      templateId: "",
    });
    setSelectedProgramId(programToEdit.programId);
    setIsEditProgramModalOpen(true);
  };

  const handleCloseEditProgram = () => {
    setIsEditProgramModalOpen(false);
    setSelectedProgramId(null);
    setProgramForm({
      name: "",
      type: "",
      goal: "",
      startDate: "",
      sessionsPerWeek: "",
      notes: "",
      status: "active",
      templateId: "",
    });
  };

  const handleSaveEditProgram = async () => {
    if (!selectedProgramId) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/clients/${clientId}/programs?programId=${selectedProgramId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...programForm,
            category: "cardio",
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        // Refresh programs to show updated program
        await fetchPrograms();
        handleCloseEditProgram();
      } else {
        alert(
          "Error al actualizar programa: " + (data.error || "Error desconocido")
        );
      }
    } catch (err) {
      console.error("[CardioTab] Error updating program:", err);
      alert("Error al actualizar programa");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProgram = async (
    programId: string,
    programName: string
  ) => {
    const confirmed = confirm(
      `¿Estás seguro que deseas eliminar el programa "${programName}"?\n\n` +
        "Esto eliminará permanentemente:\n" +
        "• Todas las sesiones del programa\n" +
        "• Todos los ejercicios asignados\n" +
        "• El historial de entrenamientos completados\n\n" +
        "Esta acción no se puede deshacer."
    );

    if (!confirmed) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/clients/${clientId}/programs?programId=${programId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (data.success) {
        // Refresh programs to show updated list
        await fetchPrograms();
      } else {
        alert(
          "Error al eliminar programa: " + (data.error || "Error desconocido")
        );
      }
    } catch (err) {
      console.error("[CardioTab] Error deleting program:", err);
      alert("Error al eliminar programa");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProgram = async () => {
    if (!programForm.name.trim()) {
      alert("El nombre del programa es obligatorio");

      return;
    }

    if (!programForm.startDate) {
      alert("La fecha de inicio es obligatoria");

      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/programs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...programForm,
          category: "cardio",
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Refresh programs to show new program
        await fetchPrograms();
        handleCloseAddProgram();
      } else {
        alert(
          "Error al crear programa: " + (data.error || "Error desconocido")
        );
      }
    } catch (err) {
      console.error("[CardioTab] Error saving program:", err);
      alert("Error al crear programa");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAddSession = (programId: string) => {
    setSelectedProgramId(programId);
    setIsAddSessionModalOpen(true);
  };

  const handleCloseAddSession = () => {
    setIsAddSessionModalOpen(false);
    setSelectedProgramId(null);
    setSessionForm({
      name: "",
    });
  };

  const handleSaveSession = async () => {
    if (!selectedProgramId) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/clients/${clientId}/programs/${selectedProgramId}/sessions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sessionForm),
        }
      );

      const data = await response.json();

      if (data.success) {
        // Add the new session to expanded sessions
        if (data.session?.id) {
          setExpandedSessions((prev) => new Set(prev).add(data.session.id));
        }
        // Refresh programs to show new session
        await fetchPrograms();
        handleCloseAddSession();
      } else {
        alert("Error al crear sesión: " + (data.error || "Error desconocido"));
      }
    } catch (err) {
      console.error("[CardioTab] Error saving session:", err);
      alert("Error al crear sesión");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSession = (sessionId: string) => {
    // Find the program that contains this session
    const program = activePrograms.find((p: any) =>
      p.sessions.some((s: any) => s.id === sessionId)
    );

    if (!program) return;

    // Find the session to edit
    const session = program.sessions.find((s: any) => s.id === sessionId);

    if (!session) return;

    // Populate form with session data
    setSessionForm({
      name: session.name,
    });
    setSelectedSessionId(sessionId);
    setSelectedProgramId(program.programId);
    setIsEditSessionModalOpen(true);
  };

  const handleCloseEditSession = () => {
    setIsEditSessionModalOpen(false);
    setSelectedSessionId(null);
    setSelectedProgramId(null);
    setSessionForm({
      name: "",
    });
  };

  const handleSaveEditSession = async () => {
    if (!selectedSessionId || !selectedProgramId) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/clients/${clientId}/programs/${selectedProgramId}/sessions?sessionId=${selectedSessionId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sessionForm),
        }
      );

      const data = await response.json();

      if (data.success) {
        // Keep the session expanded
        setExpandedSessions((prev) => new Set(prev).add(selectedSessionId));
        // Refresh programs to show updated session
        await fetchPrograms();
        handleCloseEditSession();
      } else {
        alert(
          "Error al actualizar sesión: " + (data.error || "Error desconocido")
        );
      }
    } catch (err) {
      console.error("[CardioTab] Error updating session:", err);
      alert("Error al actualizar sesión");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!activeProgram) return;

    const session = activeProgram.sessions.find((s) => s.id === sessionId);

    if (!session) return;

    const confirmed = confirm(
      `¿Estás seguro de que deseas eliminar la sesión "${session.name}"? Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/clients/${clientId}/programs/${activeProgram.programId}/sessions?sessionId=${sessionId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (data.success) {
        // Refresh programs to show updated list
        await fetchPrograms();
      } else {
        alert(
          "Error al eliminar sesión: " + (data.error || "Error desconocido")
        );
      }
    } catch (err) {
      console.error("[CardioTab] Error deleting session:", err);
      alert("Error al eliminar sesión");
    }
  };

  const handleEditExercise = async (sessionId: string, exercise: any) => {
    // Find the program that contains this session
    const program = activePrograms.find((p: any) =>
      p.sessions.some((s: any) => s.id === sessionId)
    );

    if (!program) return;

    // Populate form with exercise data. Pre-select the slot's current
    // library exercise so the Edit modal's Autocomplete opens on it.
    setExerciseForm({
      name: exercise.name,
      type: exercise.cardioType || "",
      duration: exercise.duration?.toString() || "",
      distance: exercise.distance?.toString() || "",
      intensity: exercise.intensity || "",
      minHeartRate: exercise.heartRateZone?.min?.toString() || "",
      maxHeartRate: exercise.heartRateZone?.max?.toString() || "",
      notes: exercise.notes || "",
      exerciseId: exercise.exercise_id ?? "",
    });
    setEditOriginalExerciseId(exercise.exercise_id ?? "");
    setSelectedExerciseId(exercise.id);
    setSelectedSessionId(sessionId);
    setSelectedProgramId(program.programId);
    setLibrarySearchTerm("");
    // Show the current exercise's name in the controlled input; the
    // Autocomplete renders the pre-selected entry without re-syncing.
    setLibraryInputValue(exercise.name ?? "");
    setIsEditExerciseModalOpen(true);

    // Load the browse list so the pre-selected entry has an item to render.
    await loadLibraryExercises();
  };

  const handleCloseEditExercise = () => {
    setIsEditExerciseModalOpen(false);
    setSelectedExerciseId(null);
    setSelectedSessionId(null);
    setSelectedProgramId(null);
    setEditOriginalExerciseId("");
    setLibrarySearchTerm("");
    setLibraryInputValue("");
    setExerciseForm({
      name: "",
      type: "",
      duration: "",
      distance: "",
      intensity: "",
      minHeartRate: "",
      maxHeartRate: "",
      notes: "",
      exerciseId: "",
    });
  };

  const handleSaveEditExercise = async () => {
    if (!selectedExerciseId || !selectedSessionId || !selectedProgramId) return;

    // The edit now swaps the slot's library exercise. Require an explicit
    // pick so we never PUT an empty exerciseId.
    if (!exerciseForm.exerciseId) {
      alert("Selecciona un ejercicio de tu biblioteca");

      return;
    }

    // Warn before a swap that orphans existing logs. The client's logs are
    // already loaded at tab scope (useClientExerciseLogs); a non-empty result
    // for the original exercise means switching will leave those logs tied to
    // the previous exercise.
    if (
      exerciseForm.exerciseId !== editOriginalExerciseId &&
      editOriginalExerciseId &&
      getLogsForExercise(editOriginalExerciseId).length > 0
    ) {
      const proceed = window.confirm(
        "Este cliente ya registró entrenamientos del ejercicio anterior. Esos registros quedarán ligados al ejercicio anterior; los nuevos serán del ejercicio nuevo. ¿Continuar?"
      );

      if (!proceed) {
        return;
      }
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/clients/${clientId}/programs/${selectedProgramId}/sessions/${selectedSessionId}/exercises?exerciseId=${selectedExerciseId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(exerciseForm),
        }
      );

      const data = await response.json();

      if (data.success) {
        // Keep the session expanded
        setExpandedSessions((prev) => new Set(prev).add(selectedSessionId));
        // Refresh programs to show updated exercise
        await fetchPrograms();
        handleCloseEditExercise();
      } else {
        alert(
          "Error al actualizar ejercicio: " +
            (data.error || "Error desconocido")
        );
      }
    } catch (err) {
      console.error("[CardioTab] Error updating exercise:", err);
      alert("Error al actualizar ejercicio");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExercise = async (sessionId: string, exercise: any) => {
    if (!activeProgram) return;

    const confirmed = confirm(
      `¿Estás seguro de que deseas eliminar el ejercicio "${exercise.name}"? Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/clients/${clientId}/programs/${activeProgram.programId}/sessions/${sessionId}/exercises?exerciseId=${exercise.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (data.success) {
        // Keep the session expanded
        setExpandedSessions((prev) => new Set(prev).add(sessionId));
        // Refresh programs to show updated list
        await fetchPrograms();
      } else {
        alert(
          "Error al eliminar ejercicio: " + (data.error || "Error desconocido")
        );
      }
    } catch (err) {
      console.error("[CardioTab] Error deleting exercise:", err);
      alert("Error al eliminar ejercicio");
    }
  };

  const toggleSession = (sessionId: string) => {
    setExpandedSessions((prev) => {
      const newSet = new Set(prev);

      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }

      return newSet;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Assign New Program Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Cardio</h2>
        <Button
          className="bg-black text-white font-semibold hover:bg-slate-800"
          isDisabled={isLoading}
          startContent={<Icon icon="solar:add-circle-bold" width={20} />}
          onPress={handleOpenAddProgram}
        >
          Asignar Nuevo Programa
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardBody className="p-12">
            <div className="flex flex-col items-center justify-center">
              <Spinner color="default" size="lg" />
              <p className="mt-4 text-gray-600">Cargando programas...</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Card className="bg-red-50 border border-red-200 shadow-sm">
          <CardBody className="p-6">
            <div className="flex items-center gap-3">
              <Icon
                className="text-red-600 text-2xl"
                icon="solar:danger-bold"
              />
              <div>
                <p className="font-semibold text-red-900">
                  Error al cargar programas
                </p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Active Programs */}
      {!isLoading && !error && activePrograms.length > 0 && (
        <div className="space-y-4">
          {activePrograms.map((program) => (
            <Card
              key={program.id}
              className="bg-white border border-gray-200 shadow-sm"
            >
              <CardBody className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">
                        {program.name}
                      </h3>
                      <Chip
                        className="bg-slate-100 text-gray-700 border border-slate-200 font-semibold"
                        size="sm"
                        variant="flat"
                      >
                        {program.type}
                      </Chip>
                      <Chip
                        classNames={{
                          content: getStatusConfig(program.status).className,
                        }}
                        color={getStatusConfig(program.status).color}
                        size="sm"
                        variant="solid"
                      >
                        {getStatusConfig(program.status).label}
                      </Chip>
                    </div>
                    <p className="text-sm text-gray-600">
                      Iniciado el {formatDate(program.assignedDate)}
                    </p>
                    {(program as any).goal && (
                      <p className="text-sm text-gray-700 mt-1 font-medium">
                        {(program as any).goal}
                      </p>
                    )}
                  </div>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button isIconOnly size="sm" variant="light">
                        <Icon icon="solar:menu-dots-bold" width={20} />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Acciones del programa">
                      <DropdownItem
                        key="template"
                        startContent={
                          <Icon
                            icon="solar:folder-with-files-linear"
                            width={18}
                          />
                        }
                        onPress={() => setIsSaveAsTemplateModalOpen(true)}
                      >
                        Guardar como Plantilla
                      </DropdownItem>
                      <DropdownItem
                        key="edit"
                        startContent={
                          <Icon icon="solar:pen-linear" width={18} />
                        }
                        onPress={() => handleOpenEditProgram(program)}
                      >
                        Editar
                      </DropdownItem>
                      <DropdownItem
                        key="delete"
                        className="text-danger"
                        color="danger"
                        startContent={
                          <Icon
                            icon="solar:trash-bin-trash-linear"
                            width={18}
                          />
                        }
                        onPress={() =>
                          handleDeleteProgram(program.programId, program.name)
                        }
                      >
                        Eliminar
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>

                {/* Sessions - Accordion */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Icon
                        className="text-slate-700 flex-shrink-0"
                        icon="solar:calendar-bold"
                        width={18}
                      />
                      <h4 className="text-sm font-semibold text-gray-700">
                        Sesiones del Programa
                      </h4>
                    </div>
                    <Button
                      className="bg-black text-white font-semibold hover:bg-slate-800"
                      size="sm"
                      startContent={
                        <Icon icon="solar:add-circle-bold" width={16} />
                      }
                      onPress={() => handleOpenAddSession(program.programId)}
                    >
                      Añadir Sesión
                    </Button>
                  </div>

                  <DndContext
                    collisionDetection={closestCenter}
                    sensors={sensors}
                    onDragEnd={(event) =>
                      handleSessionDragEnd(program.programId, event)
                    }
                  >
                    <SortableContext
                      items={program.sessions.map((s) => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
                        {program.sessions.map((session) => (
                          <SortableSessionItem key={session.id} id={session.id}>
                            {({ dragHandleProps }) => (
                              <div className="group">
                                {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                                <div
                                  className="flex items-center justify-between cursor-pointer p-4 bg-white border border-gray-200 rounded-lg hover:border-slate-300 transition-colors"
                                  onClick={() => toggleSession(session.id)}
                                >
                                  <div className="flex items-center gap-4 flex-1">
                                    {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                                    <div
                                      {...dragHandleProps}
                                      className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-100"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Icon
                                        className="text-gray-400"
                                        icon="solar:hamburger-menu-linear"
                                        width={18}
                                      />
                                    </div>
                                    <div className="bg-slate-100 p-2 rounded-lg">
                                      <Icon
                                        className="text-slate-700"
                                        icon="solar:heart-pulse-bold"
                                        width={20}
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className="font-bold text-gray-900">
                                          {session.name}
                                        </p>
                                        <span className="text-xs font-medium text-gray-500">
                                          •{" "}
                                          {Array.isArray(session.dayOfWeek)
                                            ? session.dayOfWeek.join(", ")
                                            : session.dayOfWeek}
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-600">
                                        {session.exercises.length} ejercicios
                                      </p>
                                    </div>
                                    {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                                    <div
                                      className="flex items-center gap-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Button
                                        className="bg-black text-white font-semibold hover:bg-slate-800"
                                        size="sm"
                                        startContent={
                                          <Icon
                                            icon="solar:add-circle-bold"
                                            width={16}
                                          />
                                        }
                                        onPress={() => {
                                          setSelectedProgramId(
                                            program.programId
                                          );
                                          handleOpenAddExercise(session.id);
                                        }}
                                      >
                                        Añadir Ejercicio
                                      </Button>
                                      <Button
                                        isIconOnly
                                        size="sm"
                                        variant="flat"
                                        onPress={(e: any) => {
                                          e?.preventDefault?.();
                                          handleEditSession(session.id);
                                        }}
                                      >
                                        <Icon
                                          className="text-gray-600"
                                          icon="solar:pen-linear"
                                          width={18}
                                        />
                                      </Button>
                                      <Button
                                        isIconOnly
                                        size="sm"
                                        variant="flat"
                                        onPress={(e: any) => {
                                          e?.preventDefault?.();
                                          handleDeleteSession(session.id);
                                        }}
                                      >
                                        <Icon
                                          className="text-gray-600"
                                          icon="solar:trash-bin-trash-linear"
                                          width={18}
                                        />
                                      </Button>
                                      <Icon
                                        className={`text-gray-400 transition-transform ${expandedSessions.has(session.id) ? "rotate-180" : ""}`}
                                        icon="solar:alt-arrow-down-linear"
                                        width={20}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {expandedSessions.has(session.id) && (
                                  <div className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                                    <DndContext
                                      collisionDetection={closestCenter}
                                      sensors={sensors}
                                      onDragEnd={(event) =>
                                        handleExerciseDragEnd(
                                          program.programId,
                                          session.id,
                                          event
                                        )
                                      }
                                    >
                                      <SortableContext
                                        items={session.exercises.map(
                                          (e) => e.id || `exercise-${e.order}`
                                        )}
                                        strategy={verticalListSortingStrategy}
                                      >
                                        {session.exercises.map((exercise) => (
                                          <SortableExerciseItem
                                            key={
                                              exercise.id ||
                                              `exercise-${exercise.order}`
                                            }
                                            id={
                                              exercise.id ||
                                              `exercise-${exercise.order}`
                                            }
                                          >
                                            {({
                                              dragHandleProps:
                                                exerciseDragHandleProps,
                                            }) => (
                                              <div className="flex items-start gap-2">
                                                <span className="text-xs font-semibold text-gray-400 w-5 text-right mt-4 shrink-0 tabular-nums">
                                                  {exercise.order}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                  <ExerciseProgressCard
                                                    actions={
                                                      <>
                                                        <Button
                                                          isIconOnly
                                                          size="sm"
                                                          variant="light"
                                                          onPress={() =>
                                                            handleEditExercise(
                                                              session.id,
                                                              exercise
                                                            )
                                                          }
                                                        >
                                                          <Icon
                                                            className="text-gray-400 hover:text-gray-600"
                                                            icon="solar:pen-linear"
                                                            width={16}
                                                          />
                                                        </Button>
                                                        <Button
                                                          isIconOnly
                                                          size="sm"
                                                          variant="light"
                                                          onPress={() =>
                                                            handleDeleteExercise(
                                                              session.id,
                                                              exercise
                                                            )
                                                          }
                                                        >
                                                          <Icon
                                                            className="text-gray-400 hover:text-red-600"
                                                            icon="solar:trash-bin-trash-linear"
                                                            width={16}
                                                          />
                                                        </Button>
                                                      </>
                                                    }
                                                    dragHandleProps={
                                                      exerciseDragHandleProps
                                                    }
                                                    isExpanded={
                                                      exercise.id
                                                        ? isExpanded(
                                                            exercise.id
                                                          )
                                                        : false
                                                    }
                                                    logs={getLogsForExercise(
                                                      exercise.exercise_id ?? ""
                                                    )}
                                                    prescribed={exercise}
                                                    variant="cardio"
                                                    onPlayVideo={
                                                      openExerciseVideo
                                                    }
                                                    onToggle={() => {
                                                      if (exercise.id)
                                                        toggleExerciseExpanded(
                                                          exercise.id
                                                        );
                                                    }}
                                                  />
                                                </div>
                                              </div>
                                            )}
                                          </SortableExerciseItem>
                                        ))}
                                      </SortableContext>
                                    </DndContext>
                                  </div>
                                )}
                              </div>
                            )}
                          </SortableSessionItem>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* No Active Program State */}
      {!isLoading && !error && activePrograms.length === 0 && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardBody className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="bg-gray-100 p-4 rounded-full mb-4">
                <Icon
                  className="text-gray-400 text-5xl"
                  icon="solar:heart-pulse-linear"
                />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay programa de cardio activo
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Asigna un programa cardiovascular para comenzar
              </p>
              <Button
                className="bg-black text-white font-semibold hover:bg-slate-800"
                startContent={<Icon icon="solar:add-circle-bold" width={20} />}
                onPress={handleOpenAddProgram}
              >
                Asignar Programa
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Add Exercise Modal */}
      <Modal
        classNames={{
          base: "max-h-[90vh]",
          header: "border-b border-gray-200",
          footer: "border-t border-gray-200",
          body: "py-6",
        }}
        isOpen={isAddExerciseModalOpen}
        scrollBehavior="inside"
        size="3xl"
        onClose={handleCloseAddExercise}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="bg-slate-100 p-2 rounded-lg">
                <Icon
                  className="text-slate-700 text-xl"
                  icon="solar:heart-pulse-bold"
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Añadir Ejercicio de Cardio
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  Complete la información del ejercicio
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-6">
              {/* Exercise Library Selection */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:folder-with-files-linear"
                    width={18}
                  />
                  Biblioteca de Ejercicios
                </h4>
                <Autocomplete
                  classNames={{
                    base: "w-full",
                  }}
                  inputProps={{
                    classNames: {
                      inputWrapper: "h-12",
                    },
                  }}
                  // Switch between the initial browse list (empty input)
                  // and live server-search results (non-empty input). HeroUI
                  // skips its built-in client-side filter when `items` is
                  // controlled, so we own filtering via the API.
                  inputValue={libraryInputValue}
                  isLoading={isLoadingLibrary || isSearchingLibrary}
                  items={
                    librarySearchTerm.trim().length > 0
                      ? librarySearchResults
                      : libraryExercises
                  }
                  label="Buscar ejercicio en tu biblioteca"
                  placeholder="Escribe para buscar..."
                  selectedKey={exerciseForm.exerciseId || null}
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:book-linear"
                      width={20}
                    />
                  }
                  onInputChange={(value) => {
                    // We own the input text (controlled). Only genuine user
                    // typing reaches here now — never the selectedKey→label
                    // auto-sync — so updating the search term can't loop.
                    setLibraryInputValue(value);
                    setLibrarySearchTerm(value);
                  }}
                  onSelectionChange={(key) => {
                    if (key) {
                      handleSelectLibraryExercise(key as string);
                    }
                  }}
                >
                  {(exercise: any) => (
                    <AutocompleteItem
                      key={exercise.id}
                      startContent={
                        exercise.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={exercise.name}
                            className="w-10 h-10 rounded-md object-cover"
                            src={exercise.image_url}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-red-100 flex items-center justify-center">
                            <Icon
                              className="text-red-600"
                              icon="solar:heart-pulse-bold"
                              width={20}
                            />
                          </div>
                        )
                      }
                      textValue={exercise.name}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">
                          {exercise.name}
                        </span>
                        {exercise.description && (
                          <span className="text-xs text-gray-500 line-clamp-1">
                            {exercise.description}
                          </span>
                        )}
                      </div>
                    </AutocompleteItem>
                  )}
                </Autocomplete>
                <p className="text-xs text-gray-500 mt-2">
                  Selecciona un ejercicio de tu biblioteca para auto-completar
                  los campos.
                </p>
                <a
                  className="text-xs text-primary hover:underline"
                  href="/trainer/dashboard/exercise-library"
                  rel="noreferrer"
                  target="_blank"
                >
                  ¿No está en tu biblioteca? Gestiona tus ejercicios
                </a>
              </div>

              {/* Duración y Distancia */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:graph-bold"
                    width={18}
                  />
                  Duración y Distancia
                </h4>
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
                    value={exerciseForm.duration}
                    onValueChange={(value) =>
                      setExerciseForm({ ...exerciseForm, duration: value })
                    }
                  />
                  <Input
                    label="Distancia (km) - Opcional"
                    placeholder="Ej: 5.5"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:route-linear"
                        width={18}
                      />
                    }
                    step="0.1"
                    type="number"
                    value={exerciseForm.distance}
                    onValueChange={(value) =>
                      setExerciseForm({ ...exerciseForm, distance: value })
                    }
                  />
                </div>
              </div>

              {/* Intensidad y Frecuencia Cardíaca */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:fire-bold"
                    width={18}
                  />
                  Intensidad y Frecuencia Cardíaca
                </h4>
                <div className="space-y-4">
                  <Select
                    isRequired
                    label="Intensidad"
                    placeholder="Selecciona la intensidad"
                    selectedKeys={
                      exerciseForm.intensity ? [exerciseForm.intensity] : []
                    }
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:fire-linear"
                        width={18}
                      />
                    }
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0] as string;

                      setExerciseForm({ ...exerciseForm, intensity: value });
                    }}
                  >
                    <SelectItem key="Baja">Baja</SelectItem>
                    <SelectItem key="Moderada">Moderada</SelectItem>
                    <SelectItem key="Alta">Alta</SelectItem>
                    <SelectItem key="Por Intervalos">Por Intervalos</SelectItem>
                  </Select>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="BPM Mínimo - Opcional"
                      placeholder="Ej: 120"
                      startContent={
                        <Icon
                          className="text-gray-400"
                          icon="solar:heart-pulse-linear"
                          width={18}
                        />
                      }
                      type="number"
                      value={exerciseForm.minHeartRate}
                      onValueChange={(value) =>
                        setExerciseForm({
                          ...exerciseForm,
                          minHeartRate: value,
                        })
                      }
                    />
                    <Input
                      label="BPM Máximo - Opcional"
                      placeholder="Ej: 150"
                      startContent={
                        <Icon
                          className="text-gray-400"
                          icon="solar:heart-pulse-linear"
                          width={18}
                        />
                      }
                      type="number"
                      value={exerciseForm.maxHeartRate}
                      onValueChange={(value) =>
                        setExerciseForm({
                          ...exerciseForm,
                          maxHeartRate: value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:notes-bold"
                    width={18}
                  />
                  Notas del Entrenador (Opcional)
                </h4>
                <Textarea
                  label="Observaciones"
                  minRows={3}
                  placeholder="Ej: Mantener ritmo constante, enfocarse en respiración..."
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:clipboard-text-linear"
                      width={18}
                    />
                  }
                  value={exerciseForm.notes}
                  onValueChange={(value) =>
                    setExerciseForm({ ...exerciseForm, notes: value })
                  }
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={isSaving}
              variant="light"
              onPress={handleCloseAddExercise}
            >
              Cancelar
            </Button>
            <Button
              className="bg-black text-white font-semibold hover:bg-slate-800"
              isDisabled={isSaving}
              isLoading={isSaving}
              startContent={
                !isSaving && <Icon icon="solar:add-circle-bold" width={18} />
              }
              onPress={handleSaveExercise}
            >
              {isSaving ? "Guardando..." : "Añadir Ejercicio"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Exercise Modal - Similar structure to Add */}
      <Modal
        classNames={{
          base: "max-h-[90vh]",
          header: "border-b border-gray-200",
          footer: "border-t border-gray-200",
          body: "py-6",
        }}
        isOpen={isEditExerciseModalOpen}
        scrollBehavior="inside"
        size="3xl"
        onClose={handleCloseEditExercise}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="bg-slate-100 p-2 rounded-lg">
                <Icon
                  className="text-slate-700 text-xl"
                  icon="solar:heart-pulse-bold"
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Editar Ejercicio de Cardio
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  Actualiza la información del ejercicio
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-6">
              {/* Exercise Library Selection */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:folder-with-files-linear"
                    width={18}
                  />
                  Biblioteca de Ejercicios
                </h4>
                <Autocomplete
                  classNames={{
                    base: "w-full",
                  }}
                  inputProps={{
                    classNames: {
                      inputWrapper: "h-12",
                    },
                  }}
                  // Switch between the initial browse list (empty input)
                  // and live server-search results (non-empty input). HeroUI
                  // skips its built-in client-side filter when `items` is
                  // controlled, so we own filtering via the API.
                  inputValue={libraryInputValue}
                  isLoading={isLoadingLibrary || isSearchingLibrary}
                  items={
                    librarySearchTerm.trim().length > 0
                      ? librarySearchResults
                      : libraryExercises
                  }
                  label="Buscar ejercicio en tu biblioteca"
                  placeholder="Escribe para buscar..."
                  selectedKey={exerciseForm.exerciseId || null}
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:book-linear"
                      width={20}
                    />
                  }
                  onInputChange={(value) => {
                    // We own the input text (controlled). Only genuine user
                    // typing reaches here now — never the selectedKey→label
                    // auto-sync — so updating the search term can't loop.
                    setLibraryInputValue(value);
                    setLibrarySearchTerm(value);
                  }}
                  onSelectionChange={(key) => {
                    if (key) {
                      handleSelectLibraryExercise(key as string);
                    }
                  }}
                >
                  {(exercise: any) => (
                    <AutocompleteItem
                      key={exercise.id}
                      startContent={
                        exercise.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={exercise.name}
                            className="w-10 h-10 rounded-md object-cover"
                            src={exercise.image_url}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-red-100 flex items-center justify-center">
                            <Icon
                              className="text-red-600"
                              icon="solar:heart-pulse-bold"
                              width={20}
                            />
                          </div>
                        )
                      }
                      textValue={exercise.name}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">
                          {exercise.name}
                        </span>
                        {exercise.description && (
                          <span className="text-xs text-gray-500 line-clamp-1">
                            {exercise.description}
                          </span>
                        )}
                      </div>
                    </AutocompleteItem>
                  )}
                </Autocomplete>
                <p className="text-xs text-gray-500 mt-2">
                  Selecciona un ejercicio de tu biblioteca para auto-completar
                  los campos.
                </p>
                <a
                  className="text-xs text-primary hover:underline"
                  href="/trainer/dashboard/exercise-library"
                  rel="noreferrer"
                  target="_blank"
                >
                  ¿No está en tu biblioteca? Gestiona tus ejercicios
                </a>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:graph-bold"
                    width={18}
                  />
                  Duración y Distancia
                </h4>
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
                    value={exerciseForm.duration}
                    onValueChange={(value) =>
                      setExerciseForm({ ...exerciseForm, duration: value })
                    }
                  />
                  <Input
                    label="Distancia (km) - Opcional"
                    placeholder="Ej: 5.5"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:route-linear"
                        width={18}
                      />
                    }
                    step="0.1"
                    type="number"
                    value={exerciseForm.distance}
                    onValueChange={(value) =>
                      setExerciseForm({ ...exerciseForm, distance: value })
                    }
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:fire-bold"
                    width={18}
                  />
                  Intensidad y Frecuencia Cardíaca
                </h4>
                <div className="space-y-4">
                  <Select
                    isRequired
                    label="Intensidad"
                    placeholder="Selecciona la intensidad"
                    selectedKeys={
                      exerciseForm.intensity ? [exerciseForm.intensity] : []
                    }
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:fire-linear"
                        width={18}
                      />
                    }
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0] as string;

                      setExerciseForm({ ...exerciseForm, intensity: value });
                    }}
                  >
                    <SelectItem key="Low">Low (Baja)</SelectItem>
                    <SelectItem key="Moderate">Moderate (Moderada)</SelectItem>
                    <SelectItem key="High">High (Alta)</SelectItem>
                    <SelectItem key="Interval">
                      Interval (Por Intervalos)
                    </SelectItem>
                  </Select>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="BPM Mínimo - Opcional"
                      placeholder="Ej: 120"
                      startContent={
                        <Icon
                          className="text-gray-400"
                          icon="solar:heart-pulse-linear"
                          width={18}
                        />
                      }
                      type="number"
                      value={exerciseForm.minHeartRate}
                      onValueChange={(value) =>
                        setExerciseForm({
                          ...exerciseForm,
                          minHeartRate: value,
                        })
                      }
                    />
                    <Input
                      label="BPM Máximo - Opcional"
                      placeholder="Ej: 150"
                      startContent={
                        <Icon
                          className="text-gray-400"
                          icon="solar:heart-pulse-linear"
                          width={18}
                        />
                      }
                      type="number"
                      value={exerciseForm.maxHeartRate}
                      onValueChange={(value) =>
                        setExerciseForm({
                          ...exerciseForm,
                          maxHeartRate: value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:notes-bold"
                    width={18}
                  />
                  Notas del Entrenador (Opcional)
                </h4>
                <Textarea
                  label="Observaciones"
                  minRows={3}
                  placeholder="Ej: Mantener ritmo constante, enfocarse en respiración..."
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:clipboard-text-linear"
                      width={18}
                    />
                  }
                  value={exerciseForm.notes}
                  onValueChange={(value) =>
                    setExerciseForm({ ...exerciseForm, notes: value })
                  }
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={isSaving}
              variant="light"
              onPress={handleCloseEditExercise}
            >
              Cancelar
            </Button>
            <Button
              className="bg-black text-white font-semibold hover:bg-slate-800"
              isDisabled={isSaving}
              isLoading={isSaving}
              startContent={
                !isSaving && <Icon icon="solar:save-bold" width={18} />
              }
              onPress={handleSaveEditExercise}
            >
              {isSaving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Program Modal */}
      <Modal
        classNames={{
          base: "max-h-[90vh]",
          header: "border-b border-gray-200",
          footer: "border-t border-gray-200",
          body: "py-6",
        }}
        isOpen={isAddProgramModalOpen}
        scrollBehavior="inside"
        size="2xl"
        onClose={handleCloseAddProgram}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="bg-slate-100 p-2 rounded-lg">
                <Icon
                  className="text-slate-700 text-xl"
                  icon="solar:clipboard-list-bold"
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Asignar Nuevo Programa de Cardio
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  Complete la información del programa cardiovascular
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-6">
              {/* Use Template (Optional) */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:folder-with-files-linear"
                    width={18}
                  />
                  Usar Plantilla (Opcional)
                </h4>
                {isLoadingTemplates ? (
                  <div className="flex items-center justify-center h-12 bg-gray-50 rounded-lg">
                    <Spinner size="sm" />
                    <span className="ml-2 text-sm text-gray-500">
                      Cargando plantillas...
                    </span>
                  </div>
                ) : templates.length > 0 ? (
                  <Select
                    label="Plantilla"
                    placeholder="Selecciona una plantilla o crea desde cero"
                    selectedKeys={
                      programForm.templateId
                        ? new Set([programForm.templateId])
                        : new Set<string>()
                    }
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:folder-with-files-linear"
                        width={18}
                      />
                    }
                    onSelectionChange={(keys) => {
                      const templateId = Array.from(keys)[0] as string;
                      const selectedTemplate = templates.find(
                        (t) => t.id === templateId
                      );

                      if (selectedTemplate) {
                        const autoName = clientName
                          ? `${selectedTemplate.name} - ${clientName}`
                          : selectedTemplate.name;

                        setProgramForm({
                          ...programForm,
                          name: autoName,
                          templateId,
                          type: selectedTemplate.type,
                          goal: selectedTemplate.goal || "",
                          sessionsPerWeek:
                            selectedTemplate.sessionsPerWeek?.toString() || "3",
                        });
                      } else {
                        setProgramForm({
                          ...programForm,
                          templateId: "",
                        });
                      }
                    }}
                  >
                    {templates.map((template) => (
                      <SelectItem key={template.id} textValue={template.name}>
                        {template.name} ({template.sessionCount} sesiones,{" "}
                        {template.exerciseCount} ejercicios)
                      </SelectItem>
                    ))}
                  </Select>
                ) : (
                  <div className="flex flex-col items-center justify-center h-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <Icon
                      className="text-gray-300 mb-1"
                      icon="solar:folder-with-files-linear"
                      width={24}
                    />
                    <p className="text-xs text-gray-500">
                      No hay plantillas de cardio disponibles
                    </p>
                  </div>
                )}
              </div>

              {/* Información Básica */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:clipboard-list-bold"
                    width={18}
                  />
                  Información del Programa
                </h4>
                <div className="space-y-4">
                  <Input
                    isRequired
                    label="Nombre del Programa"
                    placeholder="Ej: Cardiovascular Base - Carlos Ramirez"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:document-text-linear"
                        width={18}
                      />
                    }
                    value={programForm.name}
                    onValueChange={(value) =>
                      setProgramForm({ ...programForm, name: value })
                    }
                  />
                  <Input
                    isRequired
                    label="Tipo de Programa"
                    placeholder="Ej: Resistencia, HIIT, Mixto, Pérdida de Grasa..."
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:tag-linear"
                        width={18}
                      />
                    }
                    value={programForm.type}
                    onValueChange={(value) =>
                      setProgramForm({ ...programForm, type: value })
                    }
                  />
                  <Input
                    isRequired
                    label="Objetivo del Programa"
                    placeholder="Ej: Mejorar resistencia cardiovascular"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:target-linear"
                        width={18}
                      />
                    }
                    value={programForm.goal}
                    onValueChange={(value) =>
                      setProgramForm({ ...programForm, goal: value })
                    }
                  />
                </div>
              </div>

              {/* Configuración */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:settings-bold"
                    width={18}
                  />
                  Configuración del Programa
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    isRequired
                    label="Fecha de Inicio"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:calendar-linear"
                        width={18}
                      />
                    }
                    type="date"
                    value={programForm.startDate}
                    onValueChange={(value) =>
                      setProgramForm({ ...programForm, startDate: value })
                    }
                  />
                  <Input
                    isRequired
                    label="Sesiones por Semana"
                    max="7"
                    min="1"
                    placeholder="Ej: 2, 3, 4..."
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:calendar-mark-linear"
                        width={18}
                      />
                    }
                    type="number"
                    value={programForm.sessionsPerWeek}
                    onValueChange={(value) =>
                      setProgramForm({ ...programForm, sessionsPerWeek: value })
                    }
                  />
                </div>
              </div>

              {/* Notas */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:notes-bold"
                    width={18}
                  />
                  Notas Adicionales (Opcional)
                </h4>
                <Textarea
                  label="Notas del Programa"
                  minRows={3}
                  placeholder="Ej: Programa enfocado en mejorar capacidad aeróbica..."
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:clipboard-text-linear"
                      width={18}
                    />
                  }
                  value={programForm.notes}
                  onValueChange={(value) =>
                    setProgramForm({ ...programForm, notes: value })
                  }
                />
              </div>

              {/* Info Card */}
              <Card className="bg-slate-100 border border-slate-200">
                <CardBody className="p-4">
                  <div className="flex items-start gap-2">
                    <Icon
                      className="text-slate-700 mt-0.5 flex-shrink-0"
                      icon="solar:info-circle-bold"
                      width={18}
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-1">
                        Nota Importante
                      </p>
                      <p className="text-sm text-gray-700">
                        Una vez creado el programa, podrás añadir sesiones y
                        ejercicios de cardio específicos. Asegúrate de completar
                        toda la información requerida.
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={isSaving}
              variant="light"
              onPress={handleCloseAddProgram}
            >
              Cancelar
            </Button>
            <Button
              className="bg-black text-white font-semibold hover:bg-slate-800"
              isDisabled={isSaving}
              isLoading={isSaving}
              startContent={
                !isSaving && <Icon icon="solar:add-circle-bold" width={18} />
              }
              onPress={handleSaveProgram}
            >
              {isSaving ? "Creando..." : "Crear Programa"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Program Modal */}
      <Modal
        classNames={{
          base: "max-h-[90vh]",
          header: "border-b border-gray-200",
          footer: "border-t border-gray-200",
          body: "py-6",
        }}
        isOpen={isEditProgramModalOpen}
        scrollBehavior="inside"
        size="2xl"
        onClose={handleCloseEditProgram}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="bg-slate-100 p-2 rounded-lg">
                <Icon
                  className="text-slate-700 text-xl"
                  icon="solar:clipboard-list-bold"
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Editar Programa de Cardio
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  Actualiza la información del programa cardiovascular
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-6">
              {/* Same structure as Add Program Modal */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:clipboard-list-bold"
                    width={18}
                  />
                  Información del Programa
                </h4>
                <div className="space-y-4">
                  <Input
                    isRequired
                    label="Nombre del Programa"
                    placeholder="Ej: Cardiovascular Base - Carlos Ramirez"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:document-text-linear"
                        width={18}
                      />
                    }
                    value={programForm.name}
                    onValueChange={(value) =>
                      setProgramForm({ ...programForm, name: value })
                    }
                  />
                  <Input
                    isRequired
                    label="Tipo de Programa"
                    placeholder="Ej: Resistencia, HIIT, Mixto, Pérdida de Grasa..."
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:tag-linear"
                        width={18}
                      />
                    }
                    value={programForm.type}
                    onValueChange={(value) =>
                      setProgramForm({ ...programForm, type: value })
                    }
                  />
                  <Input
                    isRequired
                    label="Objetivo del Programa"
                    placeholder="Ej: Mejorar resistencia cardiovascular"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:target-linear"
                        width={18}
                      />
                    }
                    value={programForm.goal}
                    onValueChange={(value) =>
                      setProgramForm({ ...programForm, goal: value })
                    }
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:settings-bold"
                    width={18}
                  />
                  Configuración del Programa
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    isRequired
                    label="Fecha de Inicio"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:calendar-linear"
                        width={18}
                      />
                    }
                    type="date"
                    value={programForm.startDate}
                    onValueChange={(value) =>
                      setProgramForm({ ...programForm, startDate: value })
                    }
                  />
                  <Input
                    isRequired
                    label="Sesiones por Semana"
                    max="7"
                    min="1"
                    placeholder="Ej: 2, 3, 4..."
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:calendar-mark-linear"
                        width={18}
                      />
                    }
                    type="number"
                    value={programForm.sessionsPerWeek}
                    onValueChange={(value) =>
                      setProgramForm({ ...programForm, sessionsPerWeek: value })
                    }
                  />
                </div>
              </div>

              {/* Estado del Programa */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:shield-check-bold"
                    width={18}
                  />
                  Estado del Programa
                </h4>
                <Select
                  isRequired
                  label="Estado"
                  placeholder="Seleccionar estado"
                  selectedKeys={programForm.status ? [programForm.status] : []}
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:flag-linear"
                      width={18}
                    />
                  }
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string;

                    setProgramForm({ ...programForm, status: value });
                  }}
                >
                  <SelectItem
                    key="active"
                    startContent={
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                      </div>
                    }
                  >
                    Activo
                  </SelectItem>
                  <SelectItem
                    key="paused"
                    startContent={
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      </div>
                    }
                  >
                    Pausado
                  </SelectItem>
                  <SelectItem
                    key="completed"
                    startContent={
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-500" />
                      </div>
                    }
                  >
                    Completado
                  </SelectItem>
                  <SelectItem
                    key="cancelled"
                    startContent={
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                      </div>
                    }
                  >
                    Cancelado
                  </SelectItem>
                </Select>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:notes-bold"
                    width={18}
                  />
                  Notas Adicionales (Opcional)
                </h4>
                <Textarea
                  label="Notas del Programa"
                  minRows={3}
                  placeholder="Ej: Programa enfocado en mejorar capacidad aeróbica..."
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:clipboard-text-linear"
                      width={18}
                    />
                  }
                  value={programForm.notes}
                  onValueChange={(value) =>
                    setProgramForm({ ...programForm, notes: value })
                  }
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={isSaving}
              variant="light"
              onPress={handleCloseEditProgram}
            >
              Cancelar
            </Button>
            <Button
              className="bg-black text-white font-semibold hover:bg-slate-800"
              isDisabled={isSaving}
              isLoading={isSaving}
              startContent={
                !isSaving && <Icon icon="solar:save-bold" width={18} />
              }
              onPress={handleSaveEditProgram}
            >
              {isSaving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Session Modal */}
      <Modal
        classNames={{
          header: "border-b border-gray-200",
          footer: "border-t border-gray-200",
          body: "py-6",
        }}
        isOpen={isAddSessionModalOpen}
        size="lg"
        onClose={handleCloseAddSession}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="bg-slate-100 p-2 rounded-lg">
                <Icon
                  className="text-slate-700 text-xl"
                  icon="solar:calendar-add-bold"
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Añadir Sesión
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  Complete la información de la sesión de cardio
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-6">
              {/* Información de la Sesión */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:clipboard-list-bold"
                    width={18}
                  />
                  Información de la Sesión
                </h4>
                <div className="space-y-4">
                  <Input
                    isRequired
                    label="Nombre de la Sesión"
                    placeholder="Ej: Cardio Ligero - Recuperación"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:document-text-linear"
                        width={18}
                      />
                    }
                    value={sessionForm.name}
                    onValueChange={(value) =>
                      setSessionForm({ ...sessionForm, name: value })
                    }
                  />
                </div>
              </div>

              {/* Info Card */}
              <Card className="bg-slate-100 border border-slate-200">
                <CardBody className="p-4">
                  <div className="flex items-start gap-2">
                    <Icon
                      className="text-slate-700 mt-0.5 flex-shrink-0"
                      icon="solar:info-circle-bold"
                      width={18}
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 mb-1">
                        Nota Importante
                      </p>
                      <p className="text-sm text-gray-700">
                        Puedes asignar la sesión a múltiples días de la semana.
                        Una vez creada, podrás añadir ejercicios de cardio
                        específicos.
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={isSaving}
              variant="light"
              onPress={handleCloseAddSession}
            >
              Cancelar
            </Button>
            <Button
              className="bg-black text-white font-semibold hover:bg-slate-800"
              isDisabled={isSaving}
              isLoading={isSaving}
              startContent={
                !isSaving && <Icon icon="solar:add-circle-bold" width={18} />
              }
              onPress={handleSaveSession}
            >
              {isSaving ? "Creando..." : "Crear Sesión"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Session Modal */}
      <Modal
        classNames={{
          header: "border-b border-gray-200",
          footer: "border-t border-gray-200",
          body: "py-6",
        }}
        isOpen={isEditSessionModalOpen}
        size="lg"
        onClose={handleCloseEditSession}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="bg-slate-100 p-2 rounded-lg">
                <Icon
                  className="text-slate-700 text-xl"
                  icon="solar:calendar-add-bold"
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Editar Sesión
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  Actualiza la información de la sesión de cardio
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-6">
              {/* Información de la Sesión */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:clipboard-list-bold"
                    width={18}
                  />
                  Información de la Sesión
                </h4>
                <div className="space-y-4">
                  <Input
                    isRequired
                    label="Nombre de la Sesión"
                    placeholder="Ej: Cardio Ligero - Recuperación"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:document-text-linear"
                        width={18}
                      />
                    }
                    value={sessionForm.name}
                    onValueChange={(value) =>
                      setSessionForm({ ...sessionForm, name: value })
                    }
                  />
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={isSaving}
              variant="light"
              onPress={handleCloseEditSession}
            >
              Cancelar
            </Button>
            <Button
              className="bg-black text-white font-semibold hover:bg-slate-800"
              isDisabled={isSaving}
              isLoading={isSaving}
              startContent={
                !isSaving && <Icon icon="solar:save-bold" width={18} />
              }
              onPress={handleSaveEditSession}
            >
              {isSaving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Save as Template Modal */}
      {activeProgram && (
        <SaveAsTemplateModal
          isOpen={isSaveAsTemplateModalOpen}
          programId={activeProgram.programId}
          programName={activeProgram.name}
          onClose={() => setIsSaveAsTemplateModalOpen(false)}
          onSuccess={() => {
            setIsSaveAsTemplateModalOpen(false);
          }}
        />
      )}

      {/* Off-plan logged cardio exercises */}
      <OrphanExercisesSection
        groups={orphanGroups}
        variant="cardio"
        onPlayVideo={openExerciseVideo}
      />

      <TrainerExerciseVideoModal ref={videoModalRef} />
    </div>
  );
}

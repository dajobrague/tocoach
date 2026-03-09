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
import { useCallback, useEffect, useState } from "react";

import SaveAsTemplateModal from "@/components/dashboard/save-as-template-modal";

interface WorkoutsTabProps {
  clientId: string;
  clientName?: string;
}

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

export default function WorkoutsTab({
  clientId,
  clientName,
}: WorkoutsTabProps) {
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
    sets: "",
    reps: "",
    tempo: "",
    rest: "",
    trainingSystem: "",
    videoUrl: "",
    exerciseId: "", // Store selected library exercise ID
    notes: "", // Exercise-specific notes
  });
  const [libraryExercises, setLibraryExercises] = useState<any[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [programForm, setProgramForm] = useState({
    name: "",
    division: "",
    type: "",
    category: "strength", // Default to strength, can be changed
    startDate: "",
    sessionsPerWeek: "",
    notes: "",
    status: "active",
    templateId: "", // NEW: for template selection
  });
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    name: "",
    daysOfWeek: [] as string[],
  });

  // Fetch programs from API
  const fetchPrograms = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch only active strength programs for the client
      const response = await fetch(
        `/api/clients/${clientId}/programs?category=strength&status=active`
      );
      const data = await response.json();

      if (data.success) {
        setPrograms(data.programs || []);
      } else {
        setError(data.error || "Error al cargar programas de entrenamiento");
      }
    } catch (err) {
      console.error("[WorkoutsTab] Error fetching programs:", err);
      setError("Error al cargar programas de entrenamiento");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, [clientId]);

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

      // Capture previous state before optimistic update
      const previousPrograms = programs.map((p) => ({
        ...p,
        sessions: [...p.sessions],
      }));

      const reordered = arrayMove(program.sessions, oldIndex, newIndex);

      // Optimistic update
      setPrograms((prev) =>
        prev.map((p) =>
          p.programId === programId ? { ...p, sessions: reordered } : p
        )
      );

      // Build reorder payload
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

      // Capture previous state before optimistic update
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

      // Optimistic update
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

      // Build reorder payload
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

  const handleOpenAddExercise = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsAddExerciseModalOpen(true);

    // Fetch library exercises (strength category only for workouts)
    setIsLoadingLibrary(true);
    try {
      const response = await fetch(
        "/api/exercises?category=strength&limit=100"
      );
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

  const handleSelectLibraryExercise = (exerciseId: string) => {
    const exercise = libraryExercises.find((ex) => ex.id === exerciseId);

    if (exercise) {
      // Auto-fill form with exercise defaults
      setExerciseForm({
        name: exercise.name,
        sets: exercise.default_sets?.toString() || "",
        reps: exercise.default_reps || "",
        tempo: exercise.default_tempo || "",
        rest: exercise.default_rest_seconds
          ? `${exercise.default_rest_seconds}s`
          : "",
        trainingSystem: exercise.default_training_system || "",
        videoUrl: exercise.video_url || "",
        exerciseId: exercise.id,
        notes: "",
      });
    }
  };

  const handleCloseAddExercise = () => {
    setIsAddExerciseModalOpen(false);
    setSelectedSessionId(null);
    setExerciseForm({
      name: "",
      sets: "",
      reps: "",
      tempo: "",
      rest: "",
      trainingSystem: "",
      videoUrl: "",
      exerciseId: "",
      notes: "",
    });
    setLibraryExercises([]);
  };

  const handleSaveExercise = async () => {
    if (!selectedSessionId || !selectedProgramId) return;

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
      console.error("[WorkoutsTab] Error saving exercise:", err);
      alert("Error al guardar ejercicio");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAddProgram = async () => {
    setIsAddProgramModalOpen(true);
    // Fetch templates for strength programs
    setIsLoadingTemplates(true);
    try {
      const response = await fetch("/api/templates?type=programs");
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
      division: "",
      type: "",
      category: "strength",
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
      division: programToEdit.division,
      type: programToEdit.type,
      category: programToEdit.category || "strength", // Default to strength if not set
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
      division: "",
      type: "",
      category: "strength",
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
          body: JSON.stringify(programForm),
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
      console.error("[WorkoutsTab] Error updating program:", err);
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
      console.error("[WorkoutsTab] Error deleting program:", err);
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
        body: JSON.stringify(programForm),
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
      console.error("[WorkoutsTab] Error saving program:", err);
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
      daysOfWeek: [],
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
      console.error("[WorkoutsTab] Error saving session:", err);
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
      daysOfWeek: Array.isArray(session.dayOfWeek)
        ? session.dayOfWeek
        : [session.dayOfWeek],
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
      daysOfWeek: [],
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
      console.error("[WorkoutsTab] Error updating session:", err);
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
      console.error("[WorkoutsTab] Error deleting session:", err);
      alert("Error al eliminar sesión");
    }
  };

  const handleEditExercise = (sessionId: string, exercise: any) => {
    // Find the program that contains this session
    const program = activePrograms.find((p: any) =>
      p.sessions.some((s: any) => s.id === sessionId)
    );

    if (!program) return;

    // Populate form with exercise data
    setExerciseForm({
      name: exercise.name,
      sets: exercise.sets.toString(),
      reps: exercise.reps,
      tempo: exercise.tempo,
      rest: exercise.rest,
      trainingSystem: exercise.trainingSystem,
      videoUrl: exercise.videoUrl || "",
      exerciseId: "",
      notes: exercise.notes || "",
    });
    setSelectedExerciseId(exercise.id);
    setSelectedSessionId(sessionId);
    setSelectedProgramId(program.programId);
    setIsEditExerciseModalOpen(true);
  };

  const handleCloseEditExercise = () => {
    setIsEditExerciseModalOpen(false);
    setSelectedExerciseId(null);
    setSelectedSessionId(null);
    setSelectedProgramId(null);
    setExerciseForm({
      name: "",
      sets: "",
      reps: "",
      tempo: "",
      rest: "",
      trainingSystem: "",
      videoUrl: "",
      exerciseId: "",
      notes: "",
    });
  };

  const handleSaveEditExercise = async () => {
    if (!selectedExerciseId || !selectedSessionId || !selectedProgramId) return;

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
      console.error("[WorkoutsTab] Error updating exercise:", err);
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
      console.error("[WorkoutsTab] Error deleting exercise:", err);
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
        <h2 className="text-2xl font-bold text-gray-900">Entrenamientos</h2>
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
                        className="bg-slate-200 text-slate-800 border border-slate-300 font-semibold"
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
                    {program.notes && (
                      <div className="mt-3 p-3 bg-slate-100 rounded-lg border border-slate-200">
                        <div className="flex items-start gap-2">
                          <Icon
                            className="text-slate-700 mt-0.5 flex-shrink-0"
                            icon="solar:notes-bold"
                            width={16}
                          />
                          <p className="text-sm text-slate-900">
                            {program.notes}
                          </p>
                        </div>
                      </div>
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
                                        icon="solar:dumbbell-bold"
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
                                              <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                {/* Drag handle */}
                                                <div
                                                  className="flex items-center justify-center mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                                                  {...exerciseDragHandleProps}
                                                >
                                                  <Icon
                                                    icon="solar:hamburger-menu-linear"
                                                    width={16}
                                                  />
                                                </div>
                                                <span className="text-sm font-semibold text-gray-500 min-w-[24px] mt-1">
                                                  {exercise.order}.
                                                </span>
                                                {/* Exercise Image */}
                                                {exercise.imageUrl ? (
                                                  // eslint-disable-next-line @next/next/no-img-element
                                                  <img
                                                    alt={exercise.name}
                                                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                                                    src={exercise.imageUrl}
                                                  />
                                                ) : (
                                                  <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                                    <Icon
                                                      className="text-gray-400"
                                                      icon="solar:dumbbell-bold"
                                                      width={28}
                                                    />
                                                  </div>
                                                )}
                                                <div className="flex-1">
                                                  <div className="flex items-center gap-2">
                                                    <p className="font-medium text-gray-900">
                                                      {exercise.name}
                                                    </p>
                                                    {exercise.videoUrl && (
                                                      <Button
                                                        isIconOnly
                                                        as="a"
                                                        className="h-6 w-6 min-w-6"
                                                        href={exercise.videoUrl}
                                                        size="sm"
                                                        target="_blank"
                                                        variant="flat"
                                                      >
                                                        <Icon
                                                          className="text-slate-700"
                                                          icon="solar:play-circle-bold"
                                                          width={16}
                                                        />
                                                      </Button>
                                                    )}
                                                  </div>
                                                  <div className="text-sm text-gray-600 mt-1">
                                                    {exercise.sets &&
                                                      exercise.reps && (
                                                        <span>
                                                          {exercise.sets} series
                                                          × {exercise.reps} reps
                                                        </span>
                                                      )}
                                                    {exercise.rest && (
                                                      <span className="ml-2">
                                                        • {exercise.rest}{" "}
                                                        descanso
                                                      </span>
                                                    )}
                                                    {exercise.trainingSystem && (
                                                      <span className="ml-2">
                                                        •{" "}
                                                        {
                                                          exercise.trainingSystem
                                                        }
                                                      </span>
                                                    )}
                                                    {exercise.tempo && (
                                                      <span className="ml-2">
                                                        • Tempo:{" "}
                                                        {exercise.tempo}
                                                      </span>
                                                    )}
                                                  </div>
                                                  {exercise.notes && (
                                                    <p className="text-gray-500 mt-1 text-xs italic">
                                                      Notas: {exercise.notes}
                                                    </p>
                                                  )}
                                                </div>
                                                {/* Actions */}
                                                <div className="flex items-center gap-1">
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
                  icon="solar:dumbbell-linear"
                />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay programa activo
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Asigna un programa de entrenamiento para comenzar
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
                  icon="solar:dumbbell-bold"
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Añadir Ejercicio
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
                  Biblioteca de Ejercicios (Opcional)
                </h4>
                <Autocomplete
                  classNames={{
                    base: "w-full",
                  }}
                  defaultItems={libraryExercises}
                  inputProps={{
                    classNames: {
                      inputWrapper: "h-12",
                    },
                  }}
                  isLoading={isLoadingLibrary}
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
                          <div className="w-10 h-10 rounded-md bg-slate-200 flex items-center justify-center">
                            <Icon
                              className="text-slate-700"
                              icon="solar:dumbbell-bold"
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
                        {exercise.default_sets && exercise.default_reps && (
                          <span className="text-xs text-gray-500">
                            {exercise.default_sets} series ×{" "}
                            {exercise.default_reps} reps
                          </span>
                        )}
                      </div>
                    </AutocompleteItem>
                  )}
                </Autocomplete>
                <p className="text-xs text-gray-500 mt-2">
                  Selecciona un ejercicio de tu biblioteca para auto-completar
                  los campos, o completa manualmente para crear uno nuevo.
                </p>
              </div>

              {/* Información Básica */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:dumbbell-bold"
                    width={18}
                  />
                  Información del Ejercicio
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
                    value={exerciseForm.name}
                    onValueChange={(value) =>
                      setExerciseForm({ ...exerciseForm, name: value })
                    }
                  />
                  <Input
                    label="URL Video Tutorial (Opcional)"
                    placeholder="https://example.com/video"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:video-library-linear"
                        width={18}
                      />
                    }
                    value={exerciseForm.videoUrl}
                    onValueChange={(value) =>
                      setExerciseForm({ ...exerciseForm, videoUrl: value })
                    }
                  />
                </div>
              </div>

              {/* Parámetros de Entrenamiento */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:graph-bold"
                    width={18}
                  />
                  Parámetros de Entrenamiento
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    isRequired
                    label="Series"
                    placeholder="Ej: 4"
                    size="lg"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:copy-linear"
                        width={18}
                      />
                    }
                    type="number"
                    value={exerciseForm.sets}
                    onValueChange={(value) =>
                      setExerciseForm({ ...exerciseForm, sets: value })
                    }
                  />
                  <Input
                    isRequired
                    label="Repeticiones"
                    placeholder="Ej: 8 o 30"
                    size="lg"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:hashtag-linear"
                        width={18}
                      />
                    }
                    value={exerciseForm.reps}
                    onValueChange={(value) =>
                      setExerciseForm({ ...exerciseForm, reps: value })
                    }
                  />
                  <Input
                    isRequired
                    label="Sistema de Entrenamiento"
                    placeholder="Ej: Series Rectas, Drop Sets..."
                    size="lg"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:chart-linear"
                        width={18}
                      />
                    }
                    value={exerciseForm.trainingSystem}
                    onValueChange={(value) =>
                      setExerciseForm({
                        ...exerciseForm,
                        trainingSystem: value,
                      })
                    }
                  />
                  <Input
                    isRequired
                    label="Tempo"
                    placeholder="Ej: Explosivo, Normal..."
                    size="lg"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:speedometer-linear"
                        width={18}
                      />
                    }
                    value={exerciseForm.tempo}
                    onValueChange={(value) =>
                      setExerciseForm({ ...exerciseForm, tempo: value })
                    }
                  />
                  <Input
                    isRequired
                    label="Tiempo de Descanso"
                    placeholder="Ej: 90s, 2 min..."
                    size="lg"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:time-linear"
                        width={18}
                      />
                    }
                    value={exerciseForm.rest}
                    onValueChange={(value) =>
                      setExerciseForm({ ...exerciseForm, rest: value })
                    }
                  />
                </div>
              </div>

              {/* Notas del Ejercicio */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:notes-bold"
                    width={18}
                  />
                  Notas Personalizadas (Opcional)
                </h4>
                <Textarea
                  label="Notas del ejercicio"
                  minRows={2}
                  placeholder="Ej: Enfocar en el rango de movimiento completo, mantener tensión constante..."
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:document-text-linear"
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

      {/* Edit Exercise Modal */}
      <Modal
        classNames={{
          base: "max-h-[90vh]",
          header: "border-b border-gray-200",
          footer: "border-t border-gray-200",
          body: "py-6",
        }}
        isOpen={isEditExerciseModalOpen}
        scrollBehavior="inside"
        size="2xl"
        onClose={handleCloseEditExercise}
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
              {/* Información Básica */}
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
                    value={exerciseForm.name}
                    onValueChange={(value) =>
                      setExerciseForm({ ...exerciseForm, name: value })
                    }
                  />
                  <Input
                    label="URL Video Tutorial (Opcional)"
                    placeholder="https://example.com/video"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:video-library-linear"
                        width={18}
                      />
                    }
                    value={exerciseForm.videoUrl}
                    onValueChange={(value) =>
                      setExerciseForm({ ...exerciseForm, videoUrl: value })
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
                  Configuración del Ejercicio
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    isRequired
                    label="Series"
                    placeholder="Ej: 4"
                    size="lg"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:copy-linear"
                        width={18}
                      />
                    }
                    type="number"
                    value={exerciseForm.sets}
                    onValueChange={(value) =>
                      setExerciseForm({ ...exerciseForm, sets: value })
                    }
                  />
                  <Input
                    isRequired
                    label="Repeticiones"
                    placeholder="Ej: 8 o 30"
                    size="lg"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:hashtag-linear"
                        width={18}
                      />
                    }
                    value={exerciseForm.reps}
                    onValueChange={(value) =>
                      setExerciseForm({ ...exerciseForm, reps: value })
                    }
                  />
                  <Input
                    isRequired
                    label="Sistema de Entrenamiento"
                    placeholder="Ej: Series Rectas, Drop Sets..."
                    size="lg"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:chart-linear"
                        width={18}
                      />
                    }
                    value={exerciseForm.trainingSystem}
                    onValueChange={(value) =>
                      setExerciseForm({
                        ...exerciseForm,
                        trainingSystem: value,
                      })
                    }
                  />
                  <Input
                    isRequired
                    label="Tempo"
                    placeholder="Ej: Explosivo, Normal..."
                    size="lg"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:speedometer-linear"
                        width={18}
                      />
                    }
                    value={exerciseForm.tempo}
                    onValueChange={(value) =>
                      setExerciseForm({ ...exerciseForm, tempo: value })
                    }
                  />
                  <Input
                    isRequired
                    label="Tiempo de Descanso"
                    placeholder="Ej: 90s, 2 min..."
                    size="lg"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:time-linear"
                        width={18}
                      />
                    }
                    value={exerciseForm.rest}
                    onValueChange={(value) =>
                      setExerciseForm({ ...exerciseForm, rest: value })
                    }
                  />
                </div>
              </div>

              {/* Notas del Ejercicio */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-slate-700"
                    icon="solar:notes-bold"
                    width={18}
                  />
                  Notas Personalizadas (Opcional)
                </h4>
                <Textarea
                  label="Notas del ejercicio"
                  minRows={2}
                  placeholder="Ej: Enfocar en el rango de movimiento completo, mantener tensión constante..."
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:document-text-linear"
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
                  Asignar Nuevo Programa
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  Complete la información del programa de entrenamiento
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
                          templateId,
                          name: autoName,
                          type: selectedTemplate.type || "",
                          category: selectedTemplate.category || "strength",
                          division: selectedTemplate.division || "",
                          sessionsPerWeek:
                            selectedTemplate.sessionsPerWeek?.toString() || "3",
                        });
                      } else {
                        setProgramForm({
                          ...programForm,
                          templateId: "",
                          name: "",
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
                      No hay plantillas de fuerza disponibles
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
                    placeholder="Ej: Full Body - Carlos Ramirez"
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      isRequired
                      label="Categoría del Programa"
                      placeholder="Selecciona una categoría"
                      selectedKeys={[programForm.category]}
                      startContent={
                        <Icon
                          className="text-gray-400"
                          icon="solar:widget-linear"
                          width={18}
                        />
                      }
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys)[0] as string;

                        setProgramForm({ ...programForm, category: selected });
                      }}
                    >
                      <SelectItem key="strength">Fuerza</SelectItem>
                      <SelectItem key="cardio">Cardio</SelectItem>
                    </Select>
                    <Input
                      isRequired
                      label="Tipo de Programa"
                      placeholder="Ej: Fuerza, Hipertrofia, HIIT..."
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
                  </div>
                  {programForm.category === "strength" && (
                    <Input
                      isRequired
                      label="División de la Rutina"
                      placeholder="Ej: Full Body, Upper/Lower, Push/Pull/Legs..."
                      startContent={
                        <Icon
                          className="text-gray-400"
                          icon="solar:layers-linear"
                          width={18}
                        />
                      }
                      value={programForm.division}
                      onValueChange={(value) =>
                        setProgramForm({ ...programForm, division: value })
                      }
                    />
                  )}
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
                    placeholder="Ej: 2, 3, 4, 5..."
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
                  placeholder="Ej: Programa enfocado en desarrollo de fuerza base con énfasis en movimientos compuestos..."
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
                      <p className="text-sm font-semibold text-slate-900 mb-1">
                        Nota Importante
                      </p>
                      <p className="text-sm text-slate-700">
                        Una vez creado el programa, podrás añadir sesiones y
                        ejercicios específicos. Asegúrate de completar toda la
                        información requerida.
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
                  Editar Programa
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  Actualiza la información del programa de entrenamiento
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-6">
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
                    placeholder="Ej: Full Body - Carlos Ramirez"
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      isRequired
                      label="Categoría del Programa"
                      placeholder="Selecciona una categoría"
                      selectedKeys={[programForm.category]}
                      startContent={
                        <Icon
                          className="text-gray-400"
                          icon="solar:widget-linear"
                          width={18}
                        />
                      }
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys)[0] as string;

                        setProgramForm({ ...programForm, category: selected });
                      }}
                    >
                      <SelectItem key="strength">Fuerza</SelectItem>
                      <SelectItem key="cardio">Cardio</SelectItem>
                    </Select>
                    <Input
                      isRequired
                      label="Tipo de Programa"
                      placeholder="Ej: Fuerza, Hipertrofia, HIIT..."
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
                  </div>
                  {programForm.category === "strength" && (
                    <Input
                      isRequired
                      label="División de la Rutina"
                      placeholder="Ej: Full Body, Upper/Lower, Push/Pull/Legs..."
                      startContent={
                        <Icon
                          className="text-gray-400"
                          icon="solar:layers-linear"
                          width={18}
                        />
                      }
                      value={programForm.division}
                      onValueChange={(value) =>
                        setProgramForm({ ...programForm, division: value })
                      }
                    />
                  )}
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
                    placeholder="Ej: 2, 3, 4, 5..."
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
                  placeholder="Ej: Programa enfocado en desarrollo de fuerza base con énfasis en movimientos compuestos..."
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
                  Complete la información de la sesión de entrenamiento
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
                    placeholder="Ej: Full Body A"
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
                  <Select
                    isRequired
                    label="Días de la Semana"
                    placeholder="Selecciona uno o más días"
                    selectedKeys={sessionForm.daysOfWeek}
                    selectionMode="multiple"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:calendar-linear"
                        width={18}
                      />
                    }
                    onSelectionChange={(keys) => {
                      const values = Array.from(keys) as string[];

                      setSessionForm({ ...sessionForm, daysOfWeek: values });
                    }}
                  >
                    <SelectItem key="Lun">Lunes</SelectItem>
                    <SelectItem key="Mar">Martes</SelectItem>
                    <SelectItem key="Mie">Miércoles</SelectItem>
                    <SelectItem key="Jue">Jueves</SelectItem>
                    <SelectItem key="Vie">Viernes</SelectItem>
                    <SelectItem key="Sab">Sábado</SelectItem>
                    <SelectItem key="Dom">Domingo</SelectItem>
                  </Select>
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
                      <p className="text-sm font-semibold text-slate-900 mb-1">
                        Nota Importante
                      </p>
                      <p className="text-sm text-slate-700">
                        Puedes asignar la sesión a múltiples días de la semana.
                        Una vez creada, podrás añadir ejercicios específicos.
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
                  Actualiza la información de la sesión de entrenamiento
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
                    placeholder="Ej: Full Body A"
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
                  <Select
                    isRequired
                    label="Días de la Semana"
                    placeholder="Selecciona uno o más días"
                    selectedKeys={sessionForm.daysOfWeek}
                    selectionMode="multiple"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:calendar-linear"
                        width={18}
                      />
                    }
                    onSelectionChange={(keys) => {
                      const values = Array.from(keys) as string[];

                      setSessionForm({ ...sessionForm, daysOfWeek: values });
                    }}
                  >
                    <SelectItem key="Lun">Lunes</SelectItem>
                    <SelectItem key="Mar">Martes</SelectItem>
                    <SelectItem key="Mie">Miércoles</SelectItem>
                    <SelectItem key="Jue">Jueves</SelectItem>
                    <SelectItem key="Vie">Viernes</SelectItem>
                    <SelectItem key="Sab">Sábado</SelectItem>
                    <SelectItem key="Dom">Domingo</SelectItem>
                  </Select>
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
    </div>
  );
}

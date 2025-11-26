"use client";

import type { WorkoutProgram } from "@/types/training";

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
  Progress,
  Select,
  SelectItem,
  Spinner,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

interface CardioTabProps {
  clientId: string;
}

export default function CardioTab({ clientId }: CardioTabProps) {
  const [programs, setPrograms] = useState<WorkoutProgram[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeProgram = programs.find((p) => p.status === "active");
  const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);
  const [isEditExerciseModalOpen, setIsEditExerciseModalOpen] = useState(false);
  const [isAddProgramModalOpen, setIsAddProgramModalOpen] = useState(false);
  const [isEditProgramModalOpen, setIsEditProgramModalOpen] = useState(false);
  const [isAddSessionModalOpen, setIsAddSessionModalOpen] = useState(false);
  const [isEditSessionModalOpen, setIsEditSessionModalOpen] = useState(false);
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
  });
  const [programForm, setProgramForm] = useState({
    name: "",
    type: "",
    goal: "",
    startDate: "",
    sessionsPerWeek: "",
    notes: "",
  });
  const [sessionForm, setSessionForm] = useState({
    name: "",
    dayOfWeek: "",
  });

  // Fetch programs from API
  const fetchPrograms = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/clients/${clientId}/programs?category=cardio`
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Running":
        return "solar:running-bold";
      case "Cycling":
        return "solar:bicycle-bold";
      case "Swimming":
        return "solar:water-sun-bold";
      case "Walking":
        return "solar:walking-bold";
      case "Rowing":
        return "solar:water-bold";
      case "HIIT":
        return "solar:fire-bold";
      case "Elliptical":
        return "solar:graph-new-up-bold";
      case "Stairmaster":
        return "solar:stairs-bold";
      default:
        return "solar:heart-pulse-bold";
    }
  };

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case "Low":
        return "text-green-600";
      case "Moderate":
        return "text-yellow-600";
      case "High":
        return "text-orange-600";
      case "Interval":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const handleOpenAddExercise = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsAddExerciseModalOpen(true);
  };

  const handleCloseAddExercise = () => {
    setIsAddExerciseModalOpen(false);
    setSelectedSessionId(null);
    setExerciseForm({
      name: "",
      type: "",
      duration: "",
      distance: "",
      intensity: "",
      minHeartRate: "",
      maxHeartRate: "",
      notes: "",
    });
  };

  const handleSaveExercise = async () => {
    if (!selectedSessionId || !selectedProgramId) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/clients/${clientId}/programs/${selectedProgramId}/sessions/${selectedSessionId}/exercises`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(exerciseForm),
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

  const handleOpenAddProgram = () => {
    setIsAddProgramModalOpen(true);
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
    });
  };

  const handleOpenEditProgram = () => {
    if (!activeProgram) return;

    // Populate form with current program data
    setProgramForm({
      name: activeProgram.name,
      type: activeProgram.type,
      goal: (activeProgram as any).goal || "",
      startDate: activeProgram.assignedDate,
      sessionsPerWeek: activeProgram.sessionsPerWeek.toString(),
      notes: "",
    });
    setSelectedProgramId(activeProgram.programId);
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

  const handleSaveProgram = async () => {
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
      dayOfWeek: "",
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
    if (!activeProgram) return;

    // Find the session to edit
    const session = activeProgram.sessions.find((s) => s.id === sessionId);

    if (!session) return;

    // Populate form with session data
    setSessionForm({
      name: session.name,
      dayOfWeek: session.dayOfWeek,
    });
    setSelectedSessionId(sessionId);
    setSelectedProgramId(activeProgram.programId);
    setIsEditSessionModalOpen(true);
  };

  const handleCloseEditSession = () => {
    setIsEditSessionModalOpen(false);
    setSelectedSessionId(null);
    setSelectedProgramId(null);
    setSessionForm({
      name: "",
      dayOfWeek: "",
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

  const handleEditExercise = (sessionId: string, exercise: any) => {
    if (!activeProgram) return;

    // Populate form with exercise data
    setExerciseForm({
      name: exercise.name,
      type: exercise.cardioType || "",
      duration: exercise.duration?.toString() || "",
      distance: exercise.distance?.toString() || "",
      intensity: exercise.intensity || "",
      minHeartRate: exercise.heartRateZone?.min?.toString() || "",
      maxHeartRate: exercise.heartRateZone?.max?.toString() || "",
      notes: exercise.notes || "",
    });
    setSelectedExerciseId(exercise.id);
    setSelectedSessionId(sessionId);
    setSelectedProgramId(activeProgram.programId);
    setIsEditExerciseModalOpen(true);
  };

  const handleCloseEditExercise = () => {
    setIsEditExerciseModalOpen(false);
    setSelectedExerciseId(null);
    setSelectedSessionId(null);
    setSelectedProgramId(null);
    setExerciseForm({
      name: "",
      type: "",
      duration: "",
      distance: "",
      intensity: "",
      minHeartRate: "",
      maxHeartRate: "",
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
          className="text-white font-semibold"
          color="primary"
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
              <Spinner color="primary" size="lg" />
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

      {/* Active Program */}
      {!isLoading && !error && activeProgram && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardBody className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-gray-900">
                    {activeProgram.name}
                  </h3>
                  <Chip
                    className="bg-blue-100 text-blue-700 border border-blue-200 font-semibold"
                    size="sm"
                    variant="flat"
                  >
                    {activeProgram.type}
                  </Chip>
                  <Chip
                    classNames={{
                      content: "text-white font-semibold",
                    }}
                    color="success"
                    size="sm"
                    variant="solid"
                  >
                    Activo
                  </Chip>
                </div>
                <p className="text-sm text-gray-600">
                  Iniciado el {formatDate(activeProgram.assignedDate)}
                </p>
                {(activeProgram as any).goal && (
                  <p className="text-sm text-gray-700 mt-1 font-medium">
                    {(activeProgram as any).goal}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                startContent={<Icon icon="solar:pen-linear" width={18} />}
                variant="bordered"
                onPress={handleOpenEditProgram}
              >
                Editar
              </Button>
            </div>

            {/* Program Info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Semana Actual</p>
                <p className="text-lg font-semibold text-gray-900">
                  {activeProgram.currentWeek}
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Frecuencia</p>
                <p className="text-lg font-semibold text-gray-900">
                  {activeProgram.sessionsPerWeek}x por semana
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">
                  Última Modificación
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatDate(activeProgram.lastModified)}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">
                  Progreso General
                </p>
                <p className="text-sm font-bold text-blue-600">
                  {activeProgram.progress}%
                </p>
              </div>
              <Progress
                className="max-w-full"
                color="primary"
                size="md"
                value={activeProgram.progress}
              />
            </div>

            {/* Sessions - Accordion */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon
                    className="text-blue-600 flex-shrink-0"
                    icon="solar:calendar-bold"
                    width={18}
                  />
                  <h4 className="text-sm font-semibold text-gray-700">
                    Sesiones del Programa
                  </h4>
                </div>
                <Button
                  className="text-white font-semibold"
                  color="primary"
                  size="sm"
                  startContent={
                    <Icon icon="solar:add-circle-bold" width={16} />
                  }
                  onPress={() => handleOpenAddSession(activeProgram.programId)}
                >
                  Añadir Sesión
                </Button>
              </div>

              <div className="space-y-3">
                {activeProgram.sessions.map((session) => (
                  <details
                    key={session.id}
                    className="group"
                    open={expandedSessions.has(session.id)}
                  >
                    <summary
                      className="flex items-center justify-between cursor-pointer list-none p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        toggleSession(session.id);
                      }}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="bg-blue-50 p-2 rounded-lg">
                          <Icon
                            className="text-blue-600"
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
                              • {session.dayOfWeek}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {session.exercises.length} ejercicios
                          </p>
                        </div>
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            className="text-white font-semibold"
                            color="primary"
                            size="sm"
                            startContent={
                              <Icon icon="solar:add-circle-bold" width={16} />
                            }
                            onPress={() => {
                              setSelectedProgramId(activeProgram.programId);
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
                            className="text-gray-400 group-open:rotate-180 transition-transform"
                            icon="solar:alt-arrow-down-linear"
                            width={20}
                          />
                        </div>
                      </div>
                    </summary>

                    <div className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                      {session.exercises.map((exercise) => (
                        <div
                          key={exercise.order}
                          className="p-4 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-bold text-white">
                                  {exercise.order}
                                </span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-3">
                                  <p className="text-sm font-bold text-gray-900">
                                    {exercise.name}
                                  </p>
                                  {exercise.cardioType && (
                                    <Chip
                                      className="bg-gray-100 text-gray-600 border border-gray-200"
                                      size="sm"
                                      variant="flat"
                                    >
                                      <div className="flex items-center gap-1">
                                        <Icon
                                          icon={getTypeIcon(
                                            exercise.cardioType
                                          )}
                                          width={12}
                                        />
                                        <span className="text-xs font-medium">
                                          {exercise.cardioType}
                                        </span>
                                      </div>
                                    </Chip>
                                  )}
                                </div>

                                {/* Exercise Details */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                  {exercise.duration && (
                                    <div className="flex items-center gap-1.5">
                                      <Icon
                                        className="text-blue-500 flex-shrink-0"
                                        icon="solar:clock-circle-bold"
                                        width={14}
                                      />
                                      <span className="text-xs text-gray-600">
                                        <span className="font-semibold text-gray-900">
                                          {exercise.duration}
                                        </span>{" "}
                                        min
                                      </span>
                                    </div>
                                  )}
                                  {exercise.distance && (
                                    <div className="flex items-center gap-1.5">
                                      <Icon
                                        className="text-purple-500 flex-shrink-0"
                                        icon="solar:route-bold"
                                        width={14}
                                      />
                                      <span className="text-xs text-gray-600">
                                        <span className="font-semibold text-gray-900">
                                          {exercise.distance}
                                        </span>{" "}
                                        km
                                      </span>
                                    </div>
                                  )}
                                  {exercise.intensity && (
                                    <div className="flex items-center gap-1.5">
                                      <Icon
                                        className={`${getIntensityColor(exercise.intensity)} flex-shrink-0`}
                                        icon="solar:fire-bold"
                                        width={14}
                                      />
                                      <span className="text-xs text-gray-700 font-medium">
                                        {exercise.intensity}
                                      </span>
                                    </div>
                                  )}
                                  {exercise.heartRateZone && (
                                    <div className="flex items-center gap-1.5">
                                      <Icon
                                        className="text-red-500 flex-shrink-0"
                                        icon="solar:heart-pulse-bold"
                                        width={14}
                                      />
                                      <span className="text-xs text-gray-700">
                                        {exercise.heartRateZone.min}-
                                        {exercise.heartRateZone.max} bpm
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Notes */}
                                {exercise.notes && (
                                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                    <div className="flex items-start gap-2">
                                      <Icon
                                        className="text-blue-600 mt-0.5 flex-shrink-0"
                                        icon="solar:notes-bold"
                                        width={16}
                                      />
                                      <p className="text-xs text-blue-700">
                                        {exercise.notes}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-1">
                              <Button
                                isIconOnly
                                size="sm"
                                variant="flat"
                                onPress={() =>
                                  handleEditExercise(session.id, exercise)
                                }
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
                                onPress={() =>
                                  handleDeleteExercise(session.id, exercise)
                                }
                              >
                                <Icon
                                  className="text-gray-600"
                                  icon="solar:trash-bin-trash-linear"
                                  width={18}
                                />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* No Active Program State */}
      {!isLoading && !error && !activeProgram && (
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
                className="text-white font-semibold"
                color="primary"
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
              <div className="bg-blue-50 p-2 rounded-lg">
                <Icon
                  className="text-blue-600 text-xl"
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
              {/* Información Básica */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-blue-600"
                    icon="solar:running-bold"
                    width={18}
                  />
                  Información del Ejercicio
                </h4>
                <div className="space-y-4">
                  <Input
                    isRequired
                    label="Nombre del Ejercicio"
                    placeholder="Ej: Carrera Continua"
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
                  <Select
                    isRequired
                    label="Tipo de Actividad"
                    placeholder="Selecciona el tipo"
                    selectedKeys={exerciseForm.type ? [exerciseForm.type] : []}
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:heart-pulse-linear"
                        width={18}
                      />
                    }
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0] as string;

                      setExerciseForm({ ...exerciseForm, type: value });
                    }}
                  >
                    <SelectItem key="Running">Running (Correr)</SelectItem>
                    <SelectItem key="Cycling">Cycling (Ciclismo)</SelectItem>
                    <SelectItem key="Swimming">Swimming (Natación)</SelectItem>
                    <SelectItem key="Walking">Walking (Caminar)</SelectItem>
                    <SelectItem key="Rowing">Rowing (Remo)</SelectItem>
                    <SelectItem key="HIIT">HIIT</SelectItem>
                    <SelectItem key="Elliptical">
                      Elliptical (Elíptica)
                    </SelectItem>
                    <SelectItem key="Stairmaster">
                      Stairmaster (Escaladora)
                    </SelectItem>
                  </Select>
                </div>
              </div>

              {/* Duración y Distancia */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-blue-600"
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
                    className="text-blue-600"
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
                    className="text-blue-600"
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
              className="text-white font-semibold"
              color="primary"
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
              <div className="bg-blue-50 p-2 rounded-lg">
                <Icon
                  className="text-blue-600 text-xl"
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
              {/* Same structure as Add Exercise Modal */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-blue-600"
                    icon="solar:running-bold"
                    width={18}
                  />
                  Información del Ejercicio
                </h4>
                <div className="space-y-4">
                  <Input
                    isRequired
                    label="Nombre del Ejercicio"
                    placeholder="Ej: Carrera Continua"
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
                  <Select
                    isRequired
                    label="Tipo de Actividad"
                    placeholder="Selecciona el tipo"
                    selectedKeys={exerciseForm.type ? [exerciseForm.type] : []}
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:heart-pulse-linear"
                        width={18}
                      />
                    }
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0] as string;

                      setExerciseForm({ ...exerciseForm, type: value });
                    }}
                  >
                    <SelectItem key="Running">Running (Correr)</SelectItem>
                    <SelectItem key="Cycling">Cycling (Ciclismo)</SelectItem>
                    <SelectItem key="Swimming">Swimming (Natación)</SelectItem>
                    <SelectItem key="Walking">Walking (Caminar)</SelectItem>
                    <SelectItem key="Rowing">Rowing (Remo)</SelectItem>
                    <SelectItem key="HIIT">HIIT</SelectItem>
                    <SelectItem key="Elliptical">
                      Elliptical (Elíptica)
                    </SelectItem>
                    <SelectItem key="Stairmaster">
                      Stairmaster (Escaladora)
                    </SelectItem>
                  </Select>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-blue-600"
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
                    className="text-blue-600"
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
                    className="text-blue-600"
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
              className="text-white font-semibold"
              color="primary"
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
              <div className="bg-blue-50 p-2 rounded-lg">
                <Icon
                  className="text-blue-600 text-xl"
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
              {/* Información Básica */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-blue-600"
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
                    className="text-blue-600"
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
                    className="text-blue-600"
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
              <Card className="bg-blue-50 border border-blue-100">
                <CardBody className="p-4">
                  <div className="flex items-start gap-2">
                    <Icon
                      className="text-blue-600 mt-0.5 flex-shrink-0"
                      icon="solar:info-circle-bold"
                      width={18}
                    />
                    <div>
                      <p className="text-sm font-semibold text-blue-900 mb-1">
                        Nota Importante
                      </p>
                      <p className="text-sm text-blue-700">
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
              className="text-white font-semibold"
              color="primary"
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
              <div className="bg-blue-50 p-2 rounded-lg">
                <Icon
                  className="text-blue-600 text-xl"
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
                    className="text-blue-600"
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
                    className="text-blue-600"
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

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Icon
                    className="text-blue-600"
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
              className="text-white font-semibold"
              color="primary"
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
              <div className="bg-blue-50 p-2 rounded-lg">
                <Icon
                  className="text-blue-600 text-xl"
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
                    className="text-blue-600"
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
                  <Select
                    isRequired
                    label="Día de la Semana"
                    placeholder="Selecciona el día"
                    selectedKeys={
                      sessionForm.dayOfWeek ? [sessionForm.dayOfWeek] : []
                    }
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:calendar-linear"
                        width={18}
                      />
                    }
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0] as string;

                      setSessionForm({ ...sessionForm, dayOfWeek: value });
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
              <Card className="bg-blue-50 border border-blue-100">
                <CardBody className="p-4">
                  <div className="flex items-start gap-2">
                    <Icon
                      className="text-blue-600 mt-0.5 flex-shrink-0"
                      icon="solar:info-circle-bold"
                      width={18}
                    />
                    <div>
                      <p className="text-sm font-semibold text-blue-900 mb-1">
                        Nota Importante
                      </p>
                      <p className="text-sm text-blue-700">
                        Una vez creada la sesión, podrás añadir ejercicios de
                        cardio específicos a esta sesión.
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
              className="text-white font-semibold"
              color="primary"
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
              <div className="bg-blue-50 p-2 rounded-lg">
                <Icon
                  className="text-blue-600 text-xl"
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
                    className="text-blue-600"
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
                  <Select
                    isRequired
                    label="Día de la Semana"
                    placeholder="Selecciona el día"
                    selectedKeys={
                      sessionForm.dayOfWeek ? [sessionForm.dayOfWeek] : []
                    }
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:calendar-linear"
                        width={18}
                      />
                    }
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0] as string;

                      setSessionForm({ ...sessionForm, dayOfWeek: value });
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
              className="text-white font-semibold"
              color="primary"
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
    </div>
  );
}

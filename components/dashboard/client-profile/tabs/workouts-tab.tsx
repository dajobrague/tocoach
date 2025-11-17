"use client";

import { getMockWorkoutPrograms } from "@/lib/mock-data/client-profile-mock";
import { Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Progress, Select, SelectItem, Textarea } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

interface WorkoutsTabProps {
    clientId: string;
}

export default function WorkoutsTab({ clientId }: WorkoutsTabProps) {
    const programs = getMockWorkoutPrograms(clientId);
    const activeProgram = programs.find(p => p.status === 'active');
    const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);
    const [isAddProgramModalOpen, setIsAddProgramModalOpen] = useState(false);
    const [isAddSessionModalOpen, setIsAddSessionModalOpen] = useState(false);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [exerciseForm, setExerciseForm] = useState({
        name: '',
        sets: '',
        reps: '',
        tempo: '',
        rest: '',
        trainingSystem: '',
        videoUrl: ''
    });
    const [programForm, setProgramForm] = useState({
        name: '',
        division: '',
        type: '',
        startDate: '',
        sessionsPerWeek: '',
        notes: ''
    });
    const [sessionForm, setSessionForm] = useState({
        name: '',
        dayOfWeek: ''
    });

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const handleOpenAddExercise = (sessionId: string) => {
        setSelectedSessionId(sessionId);
        setIsAddExerciseModalOpen(true);
    };

    const handleCloseAddExercise = () => {
        setIsAddExerciseModalOpen(false);
        setSelectedSessionId(null);
        setExerciseForm({
            name: '',
            sets: '',
            reps: '',
            tempo: '',
            rest: '',
            trainingSystem: '',
            videoUrl: ''
        });
    };

    const handleSaveExercise = () => {
        // TODO: Implementar guardado del ejercicio
        console.log('Guardando ejercicio:', exerciseForm, 'para sesión:', selectedSessionId);
        handleCloseAddExercise();
    };

    const handleOpenAddProgram = () => {
        setIsAddProgramModalOpen(true);
    };

    const handleCloseAddProgram = () => {
        setIsAddProgramModalOpen(false);
        setProgramForm({
            name: '',
            division: '',
            type: '',
            startDate: '',
            sessionsPerWeek: '',
            notes: ''
        });
    };

    const handleSaveProgram = () => {
        // TODO: Implementar guardado del programa
        console.log('Guardando programa:', programForm);
        handleCloseAddProgram();
    };

    const handleOpenAddSession = () => {
        setIsAddSessionModalOpen(true);
    };

    const handleCloseAddSession = () => {
        setIsAddSessionModalOpen(false);
        setSessionForm({
            name: '',
            dayOfWeek: ''
        });
    };

    const handleSaveSession = () => {
        // TODO: Implementar guardado de la sesión
        console.log('Guardando sesión:', sessionForm);
        handleCloseAddSession();
    };

    const handleEditSession = (sessionId: string) => {
        // TODO: Implementar edición de la sesión
        console.log('Editando sesión:', sessionId);
    };

    const handleDeleteSession = (sessionId: string) => {
        // TODO: Implementar eliminación de la sesión
        console.log('Eliminando sesión:', sessionId);
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Assign New Program Button */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Entrenamientos</h2>
                <Button
                    color="primary"
                    startContent={<Icon icon="solar:add-circle-bold" width={20} />}
                    className="text-white font-semibold"
                    onPress={handleOpenAddProgram}
                >
                    Asignar Nuevo Programa
                </Button>
            </div>

            {/* Active Program */}
            {activeProgram && (
                <Card className="bg-white border border-gray-200 shadow-sm">
                    <CardBody className="p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <h3 className="text-xl font-bold text-gray-900">{activeProgram.name}</h3>
                                    <Chip
                                        size="sm"
                                        variant="flat"
                                        className="bg-blue-100 text-blue-700 border border-blue-200 font-semibold"
                                    >
                                        {activeProgram.type}
                                    </Chip>
                                    <Chip color="success" size="sm" variant="solid" classNames={{
                                        content: "text-white font-semibold"
                                    }}>
                                        Activo
                                    </Chip>
                                </div>
                                <p className="text-sm text-gray-600">
                                    Iniciado el {formatDate(activeProgram.assignedDate)}
                                </p>
                            </div>
                            <Button
                                variant="bordered"
                                size="sm"
                                startContent={<Icon icon="solar:pen-linear" width={18} />}
                            >
                                Editar
                            </Button>
                        </div>

                        {/* Program Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-500 mb-1">División</p>
                                <p className="text-lg font-semibold text-gray-900">{activeProgram.division}</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-500 mb-1">Semana Actual</p>
                                <p className="text-lg font-semibold text-gray-900">{activeProgram.currentWeek}</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-500 mb-1">Frecuencia</p>
                                <p className="text-lg font-semibold text-gray-900">{activeProgram.sessionsPerWeek}x por semana</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-500 mb-1">Última Modificación</p>
                                <p className="text-sm font-semibold text-gray-900">{formatDate(activeProgram.lastModified)}</p>
                            </div>
                        </div>

                        {/* Progress */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-gray-700">Progreso General</p>
                                <p className="text-sm font-bold text-blue-600">{activeProgram.progress}%</p>
                            </div>
                            <Progress
                                value={activeProgram.progress}
                                color="primary"
                                size="md"
                                className="max-w-full"
                            />
                        </div>

                        {/* Sessions - Accordion */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Icon icon="solar:calendar-bold" className="text-blue-600 flex-shrink-0" width={18} />
                                    <h4 className="text-sm font-semibold text-gray-700">Sesiones del Programa</h4>
                                </div>
                                <Button
                                    size="sm"
                                    color="primary"
                                    startContent={<Icon icon="solar:add-circle-bold" width={16} />}
                                    className="text-white font-semibold"
                                    onPress={handleOpenAddSession}
                                >
                                    Añadir Sesión
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {activeProgram.sessions.map((session) => (
                                    <details key={session.id} className="group">
                                        <summary className="flex items-center justify-between cursor-pointer list-none p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="bg-blue-50 p-2 rounded-lg">
                                                    <Icon icon="solar:dumbbell-bold" className="text-blue-600" width={20} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-bold text-gray-900">{session.name}</p>
                                                        <span className="text-xs font-medium text-gray-500">• {session.dayOfWeek}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-600">{session.exercises.length} ejercicios</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        color="primary"
                                                        startContent={<Icon icon="solar:add-circle-bold" width={16} />}
                                                        className="text-white font-semibold"
                                                        onPress={() => handleOpenAddExercise(session.id)}
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
                                                        <Icon icon="solar:pen-linear" className="text-gray-600" width={18} />
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
                                                        <Icon icon="solar:trash-bin-trash-linear" className="text-gray-600" width={18} />
                                                    </Button>
                                                    <Icon
                                                        icon="solar:alt-arrow-down-linear"
                                                        className="text-gray-400 group-open:rotate-180 transition-transform"
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
                                                                <span className="text-sm font-bold text-white">{exercise.order}</span>
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <p className="text-sm font-bold text-gray-900">{exercise.name}</p>
                                                                    {exercise.videoUrl && (
                                                                        <Button
                                                                            isIconOnly
                                                                            size="sm"
                                                                            variant="flat"
                                                                            className="h-6 w-6 min-w-6"
                                                                            as="a"
                                                                            href={exercise.videoUrl}
                                                                            target="_blank"
                                                                        >
                                                                            <Icon icon="solar:play-circle-bold" className="text-blue-600" width={16} />
                                                                        </Button>
                                                                    )}
                                                                </div>

                                                                {/* Exercise Details */}
                                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Icon icon="solar:copy-bold" className="text-gray-400 flex-shrink-0" width={14} />
                                                                        <span className="text-xs text-gray-600">
                                                                            <span className="font-semibold text-gray-900">{exercise.sets}</span> series
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Icon icon="solar:hashtag-bold" className="text-gray-400 flex-shrink-0" width={14} />
                                                                        <span className="text-xs text-gray-600">
                                                                            <span className="font-semibold text-gray-900">{exercise.reps}</span> reps
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Icon icon="solar:graph-bold" className="text-blue-500 flex-shrink-0" width={14} />
                                                                        <span className="text-xs text-gray-700 font-medium truncate" title={exercise.trainingSystem}>
                                                                            {exercise.trainingSystem}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Icon icon="solar:speedometer-bold" className="text-purple-500 flex-shrink-0" width={14} />
                                                                        <span className="text-xs text-gray-700 truncate" title={exercise.tempo}>
                                                                            {exercise.tempo}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Icon icon="solar:clock-circle-bold" className="text-orange-500 flex-shrink-0" width={14} />
                                                                        <span className="text-xs text-gray-700 truncate" title={exercise.rest}>
                                                                            {exercise.rest}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex flex-col gap-1">
                                                            <Button
                                                                isIconOnly
                                                                size="sm"
                                                                variant="flat"
                                                            >
                                                                <Icon icon="solar:pen-linear" className="text-gray-600" width={18} />
                                                            </Button>
                                                            <Button
                                                                isIconOnly
                                                                size="sm"
                                                                variant="flat"
                                                            >
                                                                <Icon icon="solar:trash-bin-trash-linear" className="text-gray-600" width={18} />
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
            {!activeProgram && (
                <Card className="bg-white border border-gray-200 shadow-sm">
                    <CardBody className="p-12">
                        <div className="flex flex-col items-center justify-center text-center">
                            <div className="bg-gray-100 p-4 rounded-full mb-4">
                                <Icon icon="solar:dumbbell-linear" className="text-gray-400 text-5xl" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay programa activo</h3>
                            <p className="text-gray-500 text-sm mb-4">Asigna un programa de entrenamiento para comenzar</p>
                            <Button
                                color="primary"
                                startContent={<Icon icon="solar:add-circle-bold" width={20} />}
                                className="text-white font-semibold"
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
                isOpen={isAddExerciseModalOpen}
                onClose={handleCloseAddExercise}
                size="3xl"
                scrollBehavior="inside"
                classNames={{
                    base: "max-h-[90vh]",
                    header: "border-b border-gray-200",
                    footer: "border-t border-gray-200",
                    body: "py-6"
                }}
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <div className="bg-blue-50 p-2 rounded-lg">
                                <Icon icon="solar:dumbbell-bold" className="text-blue-600 text-xl" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Añadir Ejercicio</h3>
                                <p className="text-sm text-gray-500 font-normal">Complete la información del ejercicio</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <div className="flex flex-col gap-6">
                            {/* Información Básica */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <Icon icon="solar:dumbbell-bold" className="text-blue-600" width={18} />
                                    Información del Ejercicio
                                </h4>
                                <div className="space-y-4">
                                    <Input
                                        label="Nombre del Ejercicio"
                                        placeholder="Ej: Sentadilla Hack"
                                        value={exerciseForm.name}
                                        onValueChange={(value) => setExerciseForm({ ...exerciseForm, name: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:clipboard-text-linear" className="text-gray-400" width={18} />}
                                    />
                                    <Input
                                        label="URL Video Tutorial (Opcional)"
                                        placeholder="https://example.com/video"
                                        value={exerciseForm.videoUrl}
                                        onValueChange={(value) => setExerciseForm({ ...exerciseForm, videoUrl: value })}
                                        startContent={<Icon icon="solar:video-library-linear" className="text-gray-400" width={18} />}
                                    />
                                </div>
                            </div>

                            {/* Parámetros de Entrenamiento */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <Icon icon="solar:graph-bold" className="text-blue-600" width={18} />
                                    Parámetros de Entrenamiento
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Series"
                                        placeholder="Ej: 4"
                                        value={exerciseForm.sets}
                                        onValueChange={(value) => setExerciseForm({ ...exerciseForm, sets: value })}
                                        isRequired
                                        type="number"
                                        startContent={<Icon icon="solar:copy-linear" className="text-gray-400" width={18} />}
                                    />
                                    <Input
                                        label="Repeticiones"
                                        placeholder="Ej: 8 o 30"
                                        value={exerciseForm.reps}
                                        onValueChange={(value) => setExerciseForm({ ...exerciseForm, reps: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:hashtag-linear" className="text-gray-400" width={18} />}
                                    />
                                    <Select
                                        label="Sistema de Entrenamiento"
                                        placeholder="Selecciona un sistema"
                                        selectedKeys={exerciseForm.trainingSystem ? [exerciseForm.trainingSystem] : []}
                                        onSelectionChange={(keys) => {
                                            const value = Array.from(keys)[0] as string;
                                            setExerciseForm({ ...exerciseForm, trainingSystem: value });
                                        }}
                                        isRequired
                                        startContent={<Icon icon="solar:chart-linear" className="text-gray-400" width={18} />}
                                    >
                                        <SelectItem key="Series Rectas">Series Rectas</SelectItem>
                                        <SelectItem key="Repeticiones Totales">Repeticiones Totales</SelectItem>
                                        <SelectItem key="Drop Sets">Drop Sets</SelectItem>
                                        <SelectItem key="Super Series">Super Series</SelectItem>
                                        <SelectItem key="Pirámide">Pirámide</SelectItem>
                                    </Select>
                                    <Input
                                        label="Tempo"
                                        placeholder="Ej: Pausa Final Excéntrica, Explosivo, Normal..."
                                        value={exerciseForm.tempo}
                                        onValueChange={(value) => setExerciseForm({ ...exerciseForm, tempo: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:speedometer-linear" className="text-gray-400" width={18} />}
                                    />
                                </div>
                            </div>

                            {/* Descanso */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <Icon icon="solar:clock-circle-bold" className="text-blue-600" width={18} />
                                    Descanso
                                </h4>
                                <Textarea
                                    label="Tiempo de Descanso"
                                    placeholder="Ej: El necesario para rendir al 100%"
                                    value={exerciseForm.rest}
                                    onValueChange={(value) => setExerciseForm({ ...exerciseForm, rest: value })}
                                    isRequired
                                    minRows={2}
                                    startContent={<Icon icon="solar:time-linear" className="text-gray-400" width={18} />}
                                />
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="light"
                            onPress={handleCloseAddExercise}
                        >
                            Cancelar
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleSaveExercise}
                            startContent={<Icon icon="solar:add-circle-bold" width={18} />}
                            className="text-white font-semibold"
                        >
                            Añadir Ejercicio
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Add Program Modal */}
            <Modal
                isOpen={isAddProgramModalOpen}
                onClose={handleCloseAddProgram}
                size="2xl"
                scrollBehavior="inside"
                classNames={{
                    base: "max-h-[90vh]",
                    header: "border-b border-gray-200",
                    footer: "border-t border-gray-200",
                    body: "py-6"
                }}
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <div className="bg-blue-50 p-2 rounded-lg">
                                <Icon icon="solar:clipboard-list-bold" className="text-blue-600 text-xl" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Asignar Nuevo Programa</h3>
                                <p className="text-sm text-gray-500 font-normal">Complete la información del programa de entrenamiento</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <div className="flex flex-col gap-6">
                            {/* Información Básica */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <Icon icon="solar:clipboard-list-bold" className="text-blue-600" width={18} />
                                    Información del Programa
                                </h4>
                                <div className="space-y-4">
                                    <Input
                                        label="Nombre del Programa"
                                        placeholder="Ej: Full Body - Carlos Ramirez"
                                        value={programForm.name}
                                        onValueChange={(value) => setProgramForm({ ...programForm, name: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:document-text-linear" className="text-gray-400" width={18} />}
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label="División de la Rutina"
                                            placeholder="Ej: Full Body, Upper/Lower, Push/Pull/Legs..."
                                            value={programForm.division}
                                            onValueChange={(value) => setProgramForm({ ...programForm, division: value })}
                                            isRequired
                                            startContent={<Icon icon="solar:layers-linear" className="text-gray-400" width={18} />}
                                        />
                                        <Input
                                            label="Tipo de Programa"
                                            placeholder="Ej: Strength, Hypertrophy, HIIT..."
                                            value={programForm.type}
                                            onValueChange={(value) => setProgramForm({ ...programForm, type: value })}
                                            isRequired
                                            startContent={<Icon icon="solar:tag-linear" className="text-gray-400" width={18} />}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Configuración */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <Icon icon="solar:settings-bold" className="text-blue-600" width={18} />
                                    Configuración del Programa
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Fecha de Inicio"
                                        type="date"
                                        value={programForm.startDate}
                                        onValueChange={(value) => setProgramForm({ ...programForm, startDate: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:calendar-linear" className="text-gray-400" width={18} />}
                                    />
                                    <Input
                                        label="Sesiones por Semana"
                                        placeholder="Ej: 2, 3, 4, 5..."
                                        type="number"
                                        value={programForm.sessionsPerWeek}
                                        onValueChange={(value) => setProgramForm({ ...programForm, sessionsPerWeek: value })}
                                        isRequired
                                        min="1"
                                        max="7"
                                        startContent={<Icon icon="solar:calendar-mark-linear" className="text-gray-400" width={18} />}
                                    />
                                </div>
                            </div>

                            {/* Notas */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <Icon icon="solar:notes-bold" className="text-blue-600" width={18} />
                                    Notas Adicionales (Opcional)
                                </h4>
                                <Textarea
                                    label="Notas del Programa"
                                    placeholder="Ej: Programa enfocado en desarrollo de fuerza base con énfasis en movimientos compuestos..."
                                    value={programForm.notes}
                                    onValueChange={(value) => setProgramForm({ ...programForm, notes: value })}
                                    minRows={3}
                                    startContent={<Icon icon="solar:clipboard-text-linear" className="text-gray-400" width={18} />}
                                />
                            </div>

                            {/* Info Card */}
                            <Card className="bg-blue-50 border border-blue-100">
                                <CardBody className="p-4">
                                    <div className="flex items-start gap-2">
                                        <Icon icon="solar:info-circle-bold" className="text-blue-600 mt-0.5 flex-shrink-0" width={18} />
                                        <div>
                                            <p className="text-sm font-semibold text-blue-900 mb-1">Nota Importante</p>
                                            <p className="text-sm text-blue-700">
                                                Una vez creado el programa, podrás añadir sesiones y ejercicios específicos.
                                                Asegúrate de completar toda la información requerida.
                                            </p>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="light"
                            onPress={handleCloseAddProgram}
                        >
                            Cancelar
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleSaveProgram}
                            startContent={<Icon icon="solar:add-circle-bold" width={18} />}
                            className="text-white font-semibold"
                        >
                            Crear Programa
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Add Session Modal */}
            <Modal
                isOpen={isAddSessionModalOpen}
                onClose={handleCloseAddSession}
                size="lg"
                classNames={{
                    header: "border-b border-gray-200",
                    footer: "border-t border-gray-200",
                    body: "py-6"
                }}
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <div className="bg-blue-50 p-2 rounded-lg">
                                <Icon icon="solar:calendar-add-bold" className="text-blue-600 text-xl" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Añadir Sesión</h3>
                                <p className="text-sm text-gray-500 font-normal">Complete la información de la sesión de entrenamiento</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <div className="flex flex-col gap-6">
                            {/* Información de la Sesión */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <Icon icon="solar:clipboard-list-bold" className="text-blue-600" width={18} />
                                    Información de la Sesión
                                </h4>
                                <div className="space-y-4">
                                    <Input
                                        label="Nombre de la Sesión"
                                        placeholder="Ej: Full Body A"
                                        value={sessionForm.name}
                                        onValueChange={(value) => setSessionForm({ ...sessionForm, name: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:document-text-linear" className="text-gray-400" width={18} />}
                                    />
                                    <Select
                                        label="Día de la Semana"
                                        placeholder="Selecciona el día"
                                        selectedKeys={sessionForm.dayOfWeek ? [sessionForm.dayOfWeek] : []}
                                        onSelectionChange={(keys) => {
                                            const value = Array.from(keys)[0] as string;
                                            setSessionForm({ ...sessionForm, dayOfWeek: value });
                                        }}
                                        isRequired
                                        startContent={<Icon icon="solar:calendar-linear" className="text-gray-400" width={18} />}
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
                                        <Icon icon="solar:info-circle-bold" className="text-blue-600 mt-0.5 flex-shrink-0" width={18} />
                                        <div>
                                            <p className="text-sm font-semibold text-blue-900 mb-1">Nota Importante</p>
                                            <p className="text-sm text-blue-700">
                                                Una vez creada la sesión, podrás añadir ejercicios específicos a esta sesión.
                                            </p>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="light"
                            onPress={handleCloseAddSession}
                        >
                            Cancelar
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleSaveSession}
                            startContent={<Icon icon="solar:add-circle-bold" width={18} />}
                            className="text-white font-semibold"
                        >
                            Crear Sesión
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}


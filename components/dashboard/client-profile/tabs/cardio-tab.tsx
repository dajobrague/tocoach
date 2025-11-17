"use client";

import { getMockCardioPrograms } from "@/lib/mock-data/client-profile-mock";
import { Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Progress, Select, SelectItem, Textarea } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

interface CardioTabProps {
    clientId: string;
}

export default function CardioTab({ clientId }: CardioTabProps) {
    const programs = getMockCardioPrograms(clientId);
    const activeProgram = programs.find(p => p.status === 'active');
    const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);
    const [isAddProgramModalOpen, setIsAddProgramModalOpen] = useState(false);
    const [isAddSessionModalOpen, setIsAddSessionModalOpen] = useState(false);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [exerciseForm, setExerciseForm] = useState({
        name: '',
        type: '',
        duration: '',
        distance: '',
        intensity: '',
        minHeartRate: '',
        maxHeartRate: '',
        notes: ''
    });
    const [programForm, setProgramForm] = useState({
        name: '',
        type: '',
        goal: '',
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

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'Running':
                return 'solar:running-bold';
            case 'Cycling':
                return 'solar:bicycle-bold';
            case 'Swimming':
                return 'solar:water-sun-bold';
            case 'Walking':
                return 'solar:walking-bold';
            case 'Rowing':
                return 'solar:water-bold';
            case 'HIIT':
                return 'solar:fire-bold';
            case 'Elliptical':
                return 'solar:graph-new-up-bold';
            case 'Stairmaster':
                return 'solar:stairs-bold';
            default:
                return 'solar:heart-pulse-bold';
        }
    };

    const getIntensityColor = (intensity: string) => {
        switch (intensity) {
            case 'Low':
                return 'text-green-600';
            case 'Moderate':
                return 'text-yellow-600';
            case 'High':
                return 'text-orange-600';
            case 'Interval':
                return 'text-red-600';
            default:
                return 'text-gray-600';
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
            name: '',
            type: '',
            duration: '',
            distance: '',
            intensity: '',
            minHeartRate: '',
            maxHeartRate: '',
            notes: ''
        });
    };

    const handleSaveExercise = () => {
        // TODO: Implementar guardado del ejercicio
        console.log('Guardando ejercicio de cardio:', exerciseForm, 'para sesión:', selectedSessionId);
        handleCloseAddExercise();
    };

    const handleOpenAddProgram = () => {
        setIsAddProgramModalOpen(true);
    };

    const handleCloseAddProgram = () => {
        setIsAddProgramModalOpen(false);
        setProgramForm({
            name: '',
            type: '',
            goal: '',
            startDate: '',
            sessionsPerWeek: '',
            notes: ''
        });
    };

    const handleSaveProgram = () => {
        // TODO: Implementar guardado del programa
        console.log('Guardando programa de cardio:', programForm);
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
        console.log('Guardando sesión de cardio:', sessionForm);
        handleCloseAddSession();
    };

    const handleEditSession = (sessionId: string) => {
        // TODO: Implementar edición de la sesión
        console.log('Editando sesión de cardio:', sessionId);
    };

    const handleDeleteSession = (sessionId: string) => {
        // TODO: Implementar eliminación de la sesión
        console.log('Eliminando sesión de cardio:', sessionId);
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Assign New Program Button */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Cardio</h2>
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
                                <p className="text-sm text-gray-700 mt-1 font-medium">
                                    {activeProgram.goal}
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
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
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
                                                    <Icon icon="solar:heart-pulse-bold" className="text-blue-600" width={20} />
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
                                                                    <Chip size="sm" variant="flat" className="bg-gray-100 text-gray-600 border border-gray-200">
                                                                        <div className="flex items-center gap-1">
                                                                            <Icon icon={getTypeIcon(exercise.type)} width={12} />
                                                                            <span className="text-xs font-medium">{exercise.type}</span>
                                                                        </div>
                                                                    </Chip>
                                                                </div>

                                                                {/* Exercise Details */}
                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                                                    {exercise.duration && (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <Icon icon="solar:clock-circle-bold" className="text-blue-500 flex-shrink-0" width={14} />
                                                                            <span className="text-xs text-gray-600">
                                                                                <span className="font-semibold text-gray-900">{exercise.duration}</span> min
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    {exercise.distance && (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <Icon icon="solar:route-bold" className="text-purple-500 flex-shrink-0" width={14} />
                                                                            <span className="text-xs text-gray-600">
                                                                                <span className="font-semibold text-gray-900">{exercise.distance}</span> km
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Icon icon="solar:fire-bold" className={`${getIntensityColor(exercise.intensity)} flex-shrink-0`} width={14} />
                                                                        <span className="text-xs text-gray-700 font-medium">
                                                                            {exercise.intensity}
                                                                        </span>
                                                                    </div>
                                                                    {exercise.targetHeartRate && (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <Icon icon="solar:heart-pulse-bold" className="text-red-500 flex-shrink-0" width={14} />
                                                                            <span className="text-xs text-gray-700">
                                                                                {exercise.targetHeartRate.min}-{exercise.targetHeartRate.max} bpm
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Notes */}
                                                                {exercise.notes && (
                                                                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                                                        <div className="flex items-start gap-2">
                                                                            <Icon icon="solar:notes-bold" className="text-blue-600 mt-0.5 flex-shrink-0" width={16} />
                                                                            <p className="text-xs text-blue-700">{exercise.notes}</p>
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
                                <Icon icon="solar:heart-pulse-linear" className="text-gray-400 text-5xl" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay programa de cardio activo</h3>
                            <p className="text-gray-500 text-sm mb-4">Asigna un programa cardiovascular para comenzar</p>
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
                                <Icon icon="solar:heart-pulse-bold" className="text-blue-600 text-xl" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Añadir Ejercicio de Cardio</h3>
                                <p className="text-sm text-gray-500 font-normal">Complete la información del ejercicio</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <div className="flex flex-col gap-6">
                            {/* Información Básica */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <Icon icon="solar:running-bold" className="text-blue-600" width={18} />
                                    Información del Ejercicio
                                </h4>
                                <div className="space-y-4">
                                    <Input
                                        label="Nombre del Ejercicio"
                                        placeholder="Ej: Carrera Continua"
                                        value={exerciseForm.name}
                                        onValueChange={(value) => setExerciseForm({ ...exerciseForm, name: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:clipboard-text-linear" className="text-gray-400" width={18} />}
                                    />
                                    <Select
                                        label="Tipo de Actividad"
                                        placeholder="Selecciona el tipo"
                                        selectedKeys={exerciseForm.type ? [exerciseForm.type] : []}
                                        onSelectionChange={(keys) => {
                                            const value = Array.from(keys)[0] as string;
                                            setExerciseForm({ ...exerciseForm, type: value });
                                        }}
                                        isRequired
                                        startContent={<Icon icon="solar:heart-pulse-linear" className="text-gray-400" width={18} />}
                                    >
                                        <SelectItem key="Running">Running (Correr)</SelectItem>
                                        <SelectItem key="Cycling">Cycling (Ciclismo)</SelectItem>
                                        <SelectItem key="Swimming">Swimming (Natación)</SelectItem>
                                        <SelectItem key="Walking">Walking (Caminar)</SelectItem>
                                        <SelectItem key="Rowing">Rowing (Remo)</SelectItem>
                                        <SelectItem key="HIIT">HIIT</SelectItem>
                                        <SelectItem key="Elliptical">Elliptical (Elíptica)</SelectItem>
                                        <SelectItem key="Stairmaster">Stairmaster (Escaladora)</SelectItem>
                                    </Select>
                                </div>
                            </div>

                            {/* Duración y Distancia */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <Icon icon="solar:graph-bold" className="text-blue-600" width={18} />
                                    Duración y Distancia
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Duración (minutos)"
                                        placeholder="Ej: 30"
                                        type="number"
                                        value={exerciseForm.duration}
                                        onValueChange={(value) => setExerciseForm({ ...exerciseForm, duration: value })}
                                        startContent={<Icon icon="solar:clock-circle-linear" className="text-gray-400" width={18} />}
                                    />
                                    <Input
                                        label="Distancia (km) - Opcional"
                                        placeholder="Ej: 5.5"
                                        type="number"
                                        step="0.1"
                                        value={exerciseForm.distance}
                                        onValueChange={(value) => setExerciseForm({ ...exerciseForm, distance: value })}
                                        startContent={<Icon icon="solar:route-linear" className="text-gray-400" width={18} />}
                                    />
                                </div>
                            </div>

                            {/* Intensidad y Frecuencia Cardíaca */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <Icon icon="solar:fire-bold" className="text-blue-600" width={18} />
                                    Intensidad y Frecuencia Cardíaca
                                </h4>
                                <div className="space-y-4">
                                    <Select
                                        label="Intensidad"
                                        placeholder="Selecciona la intensidad"
                                        selectedKeys={exerciseForm.intensity ? [exerciseForm.intensity] : []}
                                        onSelectionChange={(keys) => {
                                            const value = Array.from(keys)[0] as string;
                                            setExerciseForm({ ...exerciseForm, intensity: value });
                                        }}
                                        isRequired
                                        startContent={<Icon icon="solar:fire-linear" className="text-gray-400" width={18} />}
                                    >
                                        <SelectItem key="Low">Low (Baja)</SelectItem>
                                        <SelectItem key="Moderate">Moderate (Moderada)</SelectItem>
                                        <SelectItem key="High">High (Alta)</SelectItem>
                                        <SelectItem key="Interval">Interval (Por Intervalos)</SelectItem>
                                    </Select>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label="BPM Mínimo - Opcional"
                                            placeholder="Ej: 120"
                                            type="number"
                                            value={exerciseForm.minHeartRate}
                                            onValueChange={(value) => setExerciseForm({ ...exerciseForm, minHeartRate: value })}
                                            startContent={<Icon icon="solar:heart-pulse-linear" className="text-gray-400" width={18} />}
                                        />
                                        <Input
                                            label="BPM Máximo - Opcional"
                                            placeholder="Ej: 150"
                                            type="number"
                                            value={exerciseForm.maxHeartRate}
                                            onValueChange={(value) => setExerciseForm({ ...exerciseForm, maxHeartRate: value })}
                                            startContent={<Icon icon="solar:heart-pulse-linear" className="text-gray-400" width={18} />}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Notas */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <Icon icon="solar:notes-bold" className="text-blue-600" width={18} />
                                    Notas del Entrenador (Opcional)
                                </h4>
                                <Textarea
                                    label="Observaciones"
                                    placeholder="Ej: Mantener ritmo constante, enfocarse en respiración..."
                                    value={exerciseForm.notes}
                                    onValueChange={(value) => setExerciseForm({ ...exerciseForm, notes: value })}
                                    minRows={3}
                                    startContent={<Icon icon="solar:clipboard-text-linear" className="text-gray-400" width={18} />}
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
                                <h3 className="text-xl font-bold text-gray-900">Asignar Nuevo Programa de Cardio</h3>
                                <p className="text-sm text-gray-500 font-normal">Complete la información del programa cardiovascular</p>
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
                                        placeholder="Ej: Cardiovascular Base - Carlos Ramirez"
                                        value={programForm.name}
                                        onValueChange={(value) => setProgramForm({ ...programForm, name: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:document-text-linear" className="text-gray-400" width={18} />}
                                    />
                                    <Select
                                        label="Tipo de Programa"
                                        placeholder="Selecciona un tipo"
                                        selectedKeys={programForm.type ? [programForm.type] : []}
                                        onSelectionChange={(keys) => {
                                            const value = Array.from(keys)[0] as string;
                                            setProgramForm({ ...programForm, type: value });
                                        }}
                                        isRequired
                                        startContent={<Icon icon="solar:tag-linear" className="text-gray-400" width={18} />}
                                    >
                                        <SelectItem key="Endurance">Endurance (Resistencia)</SelectItem>
                                        <SelectItem key="HIIT">HIIT (Alta Intensidad)</SelectItem>
                                        <SelectItem key="Mixed">Mixed (Mixto)</SelectItem>
                                        <SelectItem key="Fat Loss">Fat Loss (Pérdida de Grasa)</SelectItem>
                                    </Select>
                                    <Input
                                        label="Objetivo del Programa"
                                        placeholder="Ej: Mejorar resistencia cardiovascular"
                                        value={programForm.goal}
                                        onValueChange={(value) => setProgramForm({ ...programForm, goal: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:target-linear" className="text-gray-400" width={18} />}
                                    />
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
                                        placeholder="Ej: 2, 3, 4..."
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
                                    placeholder="Ej: Programa enfocado en mejorar capacidad aeróbica..."
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
                                                Una vez creado el programa, podrás añadir sesiones y ejercicios de cardio específicos.
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
                                <p className="text-sm text-gray-500 font-normal">Complete la información de la sesión de cardio</p>
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
                                        placeholder="Ej: Cardio Ligero - Recuperación"
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
                                                Una vez creada la sesión, podrás añadir ejercicios de cardio específicos a esta sesión.
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

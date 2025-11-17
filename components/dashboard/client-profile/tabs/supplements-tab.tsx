"use client";

import { getMockSupplements } from "@/lib/mock-data/client-profile-mock";
import { Button, Card, CardBody, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

interface SupplementsTabProps {
    clientId: string;
}

export default function SupplementsTab({ clientId }: SupplementsTabProps) {
    const supplements = getMockSupplements(clientId);
    const [isAddSupplementModalOpen, setIsAddSupplementModalOpen] = useState(false);
    const [supplementForm, setSupplementForm] = useState({
        name: '',
        dosage: '',
        frequency: '',
        timing: '',
        notes: ''
    });

    const getTimingIcon = (timing: string) => {
        if (timing.toLowerCase().includes('post')) return 'solar:dumbbell-bold';
        if (timing.toLowerCase().includes('pre')) return 'solar:alarm-bold';
        if (timing.toLowerCase().includes('desayuno')) return 'solar:cup-hot-bold';
        if (timing.toLowerCase().includes('cena') || timing.toLowerCase().includes('dormir')) return 'solar:moon-bold';
        return 'solar:clock-circle-bold';
    };

    const handleOpenAddSupplement = () => {
        setIsAddSupplementModalOpen(true);
    };

    const handleCloseAddSupplement = () => {
        setIsAddSupplementModalOpen(false);
        setSupplementForm({
            name: '',
            dosage: '',
            frequency: '',
            timing: '',
            notes: ''
        });
    };

    const handleSaveSupplement = () => {
        console.log('Guardando suplemento:', supplementForm);
        handleCloseAddSupplement();
    };

    const handleEditSupplement = (supplementId: string) => {
        console.log('Editando suplemento:', supplementId);
    };

    const handleDeleteSupplement = (supplementId: string) => {
        console.log('Eliminando suplemento:', supplementId);
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Suplementación</h2>
                <Button
                    color="primary"
                    startContent={<Icon icon="solar:add-circle-bold" width={20} />}
                    className="text-white font-semibold"
                    onPress={handleOpenAddSupplement}
                >
                    Añadir Suplemento
                </Button>
            </div>

            {/* Info Card */}
            <Card className="bg-blue-50 border border-blue-100">
                <CardBody className="p-5">
                    <div className="flex items-start gap-3">
                        <Icon icon="solar:info-circle-bold" className="text-blue-600 mt-0.5 flex-shrink-0" width={20} />
                        <div>
                            <p className="text-sm font-semibold text-blue-900 mb-1">
                                Protocolo de Suplementación Actual
                            </p>
                            <p className="text-sm text-blue-700">
                                Este cliente tiene {supplements.length} suplementos en su protocolo.
                                Asegúrate de que el cliente entienda la importancia de la consistencia y el timing adecuado.
                            </p>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Supplements List */}
            <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Suplementos Actuales ({supplements.length})
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {supplements.map((supplement) => (
                        <Card key={supplement.id} className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <CardBody className="p-5">
                                {/* Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-start gap-3 flex-1">
                                        <div className="bg-blue-100 p-3 rounded-xl flex-shrink-0">
                                            <Icon icon="solar:health-bold" className="text-blue-600 text-2xl" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-lg font-bold text-gray-900 mb-1">
                                                {supplement.name}
                                            </h4>
                                            <p className="text-sm text-gray-500">
                                                {supplement.dosage} • {supplement.frequency}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            isIconOnly
                                            variant="light"
                                            size="sm"
                                            onPress={() => handleEditSupplement(supplement.id)}
                                        >
                                            <Icon icon="solar:pen-linear" className="text-gray-600" width={18} />
                                        </Button>
                                        <Button
                                            isIconOnly
                                            variant="light"
                                            size="sm"
                                            onPress={() => handleDeleteSupplement(supplement.id)}
                                        >
                                            <Icon icon="solar:trash-bin-trash-linear" className="text-gray-600" width={18} />
                                        </Button>
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="space-y-3">
                                    {/* Timing */}
                                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                                        <Icon
                                            icon={getTimingIcon(supplement.timing)}
                                            className="text-gray-600"
                                            width={20}
                                        />
                                        <div className="flex-1">
                                            <p className="text-xs text-gray-500 font-medium">Timing</p>
                                            <p className="text-sm font-semibold text-gray-900">{supplement.timing}</p>
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    {supplement.notes && (
                                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                            <div className="flex items-start gap-2">
                                                <Icon
                                                    icon="solar:clipboard-text-bold"
                                                    className="text-blue-600 mt-0.5 flex-shrink-0"
                                                    width={16}
                                                />
                                                <div>
                                                    <p className="text-xs text-blue-600 font-medium mb-0.5">Nota</p>
                                                    <p className="text-sm text-blue-900">{supplement.notes}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Empty State (if no supplements) */}
            {supplements.length === 0 && (
                <Card className="bg-white border border-gray-200 shadow-sm">
                    <CardBody className="p-12">
                        <div className="flex flex-col items-center justify-center text-center">
                            <div className="bg-gray-100 p-4 rounded-full mb-4">
                                <Icon icon="solar:health-linear" className="text-gray-400 text-5xl" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay suplementos asignados</h3>
                            <p className="text-gray-500 text-sm mb-4">Añade el primer suplemento al protocolo del cliente</p>
                            <Button
                                color="primary"
                                startContent={<Icon icon="solar:add-circle-bold" width={20} />}
                                className="text-white font-semibold"
                                onPress={handleOpenAddSupplement}
                            >
                                Añadir Suplemento
                            </Button>
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* Add Supplement Modal */}
            <Modal
                isOpen={isAddSupplementModalOpen}
                onClose={handleCloseAddSupplement}
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
                                <Icon icon="solar:health-bold" className="text-blue-600 text-xl" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Añadir Suplemento</h3>
                                <p className="text-sm text-gray-500 font-normal">Completa la información del suplemento</p>
                            </div>
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        <div className="flex flex-col gap-6">
                            {/* Información Básica */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <Icon icon="solar:health-bold" className="text-blue-600" width={18} />
                                    Información del Suplemento
                                </h4>
                                <div className="space-y-4">
                                    <Input
                                        label="Nombre del Suplemento"
                                        placeholder="Ej: Creatina Monohidrato"
                                        value={supplementForm.name}
                                        onValueChange={(value) => setSupplementForm({ ...supplementForm, name: value })}
                                        isRequired
                                        startContent={<Icon icon="solar:bag-linear" className="text-gray-400" width={18} />}
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label="Dosificación"
                                            placeholder="Ej: 5g"
                                            value={supplementForm.dosage}
                                            onValueChange={(value) => setSupplementForm({ ...supplementForm, dosage: value })}
                                            isRequired
                                            startContent={<Icon icon="solar:scale-linear" className="text-gray-400" width={18} />}
                                        />
                                        <Input
                                            label="Frecuencia"
                                            placeholder="Ej: Diario, 2x día, 3x semana..."
                                            value={supplementForm.frequency}
                                            onValueChange={(value) => setSupplementForm({ ...supplementForm, frequency: value })}
                                            isRequired
                                            startContent={<Icon icon="solar:calendar-linear" className="text-gray-400" width={18} />}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Timing */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <Icon icon="solar:clock-circle-bold" className="text-blue-600" width={18} />
                                    Timing
                                </h4>
                                <Input
                                    label="Cuándo tomar"
                                    placeholder="Ej: Post-entrenamiento, Con desayuno, Antes de dormir..."
                                    value={supplementForm.timing}
                                    onValueChange={(value) => setSupplementForm({ ...supplementForm, timing: value })}
                                    isRequired
                                    startContent={<Icon icon="solar:alarm-linear" className="text-gray-400" width={18} />}
                                />
                            </div>

                            {/* Notas */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <Icon icon="solar:notes-bold" className="text-blue-600" width={18} />
                                    Notas Adicionales (Opcional)
                                </h4>
                                <Textarea
                                    label="Notas"
                                    placeholder="Ej: Mezclar con batido de proteína, tomar con agua..."
                                    value={supplementForm.notes}
                                    onValueChange={(value) => setSupplementForm({ ...supplementForm, notes: value })}
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
                                            <p className="text-sm font-semibold text-blue-900 mb-1">Importante</p>
                                            <p className="text-sm text-blue-700">
                                                Asegúrate de que el cliente entienda la dosificación correcta y el timing óptimo para cada suplemento.
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
                            onPress={handleCloseAddSupplement}
                        >
                            Cancelar
                        </Button>
                        <Button
                            color="primary"
                            onPress={handleSaveSupplement}
                            startContent={<Icon icon="solar:add-circle-bold" width={18} />}
                            className="text-white font-semibold"
                        >
                            Añadir Suplemento
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}


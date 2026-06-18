"use client";

import {
  Button,
  Card,
  CardBody,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { alertAfterPress, confirmAfterPress } from "@/lib/ui/native-dialog";
import {
  ClientSupplementAssignment,
  SupplementInventoryItem,
} from "@/types/supplements";

interface SupplementsTabProps {
  clientId: string;
}

export default function SupplementsTab({ clientId }: SupplementsTabProps) {
  const [assignments, setAssignments] = useState<ClientSupplementAssignment[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isInventoryPickerOpen, setIsInventoryPickerOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedSupplement, setSelectedSupplement] =
    useState<SupplementInventoryItem | null>(null);
  const [editingAssignment, setEditingAssignment] =
    useState<ClientSupplementAssignment | null>(null);
  const [assignmentForm, setAssignmentForm] = useState({
    dosage: "",
    frequency: "",
    timing: "",
    notes: "",
  });

  // Fetch assignments
  const fetchAssignments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/supplements/assignments?client_id=${clientId}`
      );
      const result = await response.json();

      if (result.success) {
        setAssignments(result.data);
      } else {
        console.error("Error fetching assignments:", result.error);
      }
    } catch (error) {
      console.error("Error fetching assignments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [clientId]);

  const getTimingIcon = (timing: string) => {
    if (timing.toLowerCase().includes("post")) return "solar:dumbbell-bold";
    if (timing.toLowerCase().includes("pre")) return "solar:alarm-bold";
    if (timing.toLowerCase().includes("desayuno")) return "solar:cup-hot-bold";
    if (
      timing.toLowerCase().includes("cena") ||
      timing.toLowerCase().includes("dormir")
    )
      return "solar:moon-bold";

    return "solar:clock-circle-bold";
  };

  const handleOpenInventoryPicker = () => {
    setIsInventoryPickerOpen(true);
  };

  const handleSelectSupplement = (supplement: SupplementInventoryItem) => {
    setSelectedSupplement(supplement);
    setIsInventoryPickerOpen(false);
    setIsAssignmentModalOpen(true);
    setAssignmentForm({
      dosage: "",
      frequency: "",
      timing: "",
      notes: "",
    });
  };

  const handleSaveAssignment = async () => {
    if (!selectedSupplement) return;

    try {
      const response = await fetch("/api/supplements/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          supplement_id: selectedSupplement.id,
          ...assignmentForm,
        }),
      });

      const result = await response.json();

      if (result.success) {
        fetchAssignments();
        setIsAssignmentModalOpen(false);
        setSelectedSupplement(null);
      } else {
        await alertAfterPress(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Error creating assignment:", error);
      await alertAfterPress(
        "Error al asignar suplemento. Por favor intenta de nuevo."
      );
    }
  };

  const handleEditAssignment = (assignment: ClientSupplementAssignment) => {
    setEditingAssignment(assignment);
    setAssignmentForm({
      dosage: assignment.dosage,
      frequency: assignment.frequency,
      timing: assignment.timing,
      notes: assignment.notes || "",
    });
  };

  const handleUpdateAssignment = async () => {
    if (!editingAssignment) return;

    try {
      const response = await fetch(
        `/api/supplements/assignments/${editingAssignment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(assignmentForm),
        }
      );

      const result = await response.json();

      if (result.success) {
        fetchAssignments();
        setEditingAssignment(null);
      } else {
        await alertAfterPress(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Error updating assignment:", error);
      await alertAfterPress(
        "Error al actualizar asignación. Por favor intenta de nuevo."
      );
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (
      !(await confirmAfterPress(
        "¿Estás seguro de que quieres eliminar esta asignación?"
      ))
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/supplements/assignments/${assignmentId}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (result.success) {
        fetchAssignments();
      } else {
        await alertAfterPress(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Error deleting assignment:", error);
      await alertAfterPress(
        "Error al eliminar asignación. Por favor intenta de nuevo."
      );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Suplementación</h2>
        <Button
          className="text-white font-semibold"
          color="primary"
          startContent={<Icon icon="solar:add-circle-bold" width={20} />}
          onPress={handleOpenInventoryPicker}
        >
          Añadir Suplemento
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-slate-100 border border-slate-200">
        <CardBody className="p-5">
          <div className="flex items-start gap-3">
            <Icon
              className="text-slate-700 mt-0.5 flex-shrink-0"
              icon="solar:info-circle-bold"
              width={20}
            />
            <div>
              <p className="text-sm font-semibold text-slate-900 mb-1">
                Protocolo de Suplementación Actual
              </p>
              <p className="text-sm text-slate-700">
                Este cliente tiene {assignments.length} suplementos en su
                protocolo. Asegúrate de que el cliente entienda la importancia
                de la consistencia y el timing adecuado.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {/* Supplements List */}
      {!isLoading && assignments.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Suplementos Actuales ({assignments.length})
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {assignments.map((assignment) => {
              const supplement = assignment.supplement;
              const productImage = supplement?.images?.[0];

              return (
                <Card
                  key={assignment.id}
                  className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <CardBody className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Product Image */}
                        <div className="flex-shrink-0 w-16 h-16 bg-slate-200 rounded-xl overflow-hidden">
                          {productImage ? (
                            <img
                              alt={assignment.supplement_name}
                              className="w-full h-full object-cover"
                              src={productImage}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Icon
                                className="text-slate-700 text-2xl"
                                icon="solar:health-bold"
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-lg font-bold text-gray-900 mb-1 truncate">
                            {assignment.supplement_name}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {assignment.dosage} • {assignment.frequency}
                          </p>
                          {assignment.supplement_description && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                              {assignment.supplement_description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          onPress={() => handleEditAssignment(assignment)}
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
                          variant="light"
                          onPress={() => handleDeleteAssignment(assignment.id)}
                        >
                          <Icon
                            className="text-gray-600"
                            icon="solar:trash-bin-trash-linear"
                            width={18}
                          />
                        </Button>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-3">
                      {/* Timing */}
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <Icon
                          className="text-gray-600"
                          icon={getTimingIcon(assignment.timing)}
                          width={20}
                        />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 font-medium">
                            Timing
                          </p>
                          <p className="text-sm font-semibold text-gray-900">
                            {assignment.timing}
                          </p>
                        </div>
                      </div>

                      {/* Notes */}
                      {assignment.notes && (
                        <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                          <div className="flex items-start gap-2">
                            <Icon
                              className="text-slate-700 mt-0.5 flex-shrink-0"
                              icon="solar:clipboard-text-bold"
                              width={16}
                            />
                            <div>
                              <p className="text-xs text-slate-700 font-medium mb-0.5">
                                Nota
                              </p>
                              <p className="text-sm text-slate-900">
                                {assignment.notes}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && assignments.length === 0 && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardBody className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="bg-gray-100 p-4 rounded-full mb-4">
                <Icon
                  className="text-gray-400 text-5xl"
                  icon="solar:health-linear"
                />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay suplementos asignados
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Añade el primer suplemento al protocolo del cliente
              </p>
              <Button
                className="text-white font-semibold"
                color="primary"
                startContent={<Icon icon="solar:add-circle-bold" width={20} />}
                onPress={handleOpenInventoryPicker}
              >
                Añadir Suplemento
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Inventory Picker Modal */}
      <InventoryPickerModal
        isOpen={isInventoryPickerOpen}
        onClose={() => setIsInventoryPickerOpen(false)}
        onSelect={handleSelectSupplement}
      />

      {/* Assignment Details Modal */}
      {isAssignmentModalOpen && selectedSupplement && (
        <AssignmentDetailsModal
          assignmentForm={assignmentForm}
          isOpen={isAssignmentModalOpen}
          supplement={selectedSupplement}
          onChangeForm={setAssignmentForm}
          onClose={() => {
            setIsAssignmentModalOpen(false);
            setSelectedSupplement(null);
          }}
          onSave={handleSaveAssignment}
        />
      )}

      {/* Edit Assignment Modal */}
      {editingAssignment && (
        <EditAssignmentModal
          assignment={editingAssignment}
          assignmentForm={assignmentForm}
          isOpen={true}
          onChangeForm={setAssignmentForm}
          onClose={() => setEditingAssignment(null)}
          onSave={handleUpdateAssignment}
        />
      )}
    </div>
  );
}

// Inventory Picker Modal Component
interface InventoryPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (supplement: SupplementInventoryItem) => void;
}

function InventoryPickerModal({
  isOpen,
  onClose,
  onSelect,
}: InventoryPickerModalProps) {
  const [inventory, setInventory] = useState<SupplementInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchInventory();
    }
  }, [isOpen]);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        "/api/supplements/inventory?include_archived=false"
      );
      const result = await response.json();

      if (result.success) {
        setInventory(result.data);
      }
    } catch (error) {
      console.error("Error fetching inventory:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredInventory = inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description &&
        item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Modal
      classNames={{
        base: "max-h-[90vh]",
        header: "border-b border-gray-200",
        body: "py-6",
      }}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="3xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-2 rounded-lg">
              <Icon
                className="text-slate-700 text-xl"
                icon="solar:box-linear"
              />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Seleccionar Suplemento
              </h3>
              <p className="text-sm text-gray-500 font-normal">
                Elige un producto de tu inventario
              </p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            {/* Search */}
            <Input
              placeholder="Buscar suplemento..."
              startContent={
                <Icon
                  className="text-gray-400"
                  icon="solar:magnifer-linear"
                  width={20}
                />
              }
              value={searchQuery}
              onValueChange={setSearchQuery}
            />

            {/* Loading */}
            {isLoading && (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
              </div>
            )}

            {/* Inventory Grid */}
            {!isLoading && filteredInventory.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredInventory.map((item) => (
                  <Card
                    key={item.id}
                    isPressable
                    className="bg-white border border-gray-200 hover:border-slate-400 hover:shadow-md transition-all"
                    onPress={() => onSelect(item)}
                  >
                    <CardBody className="p-4">
                      <div className="flex gap-3">
                        {/* Image */}
                        <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                          {item.images?.[0] ? (
                            <img
                              alt={item.name}
                              className="w-full h-full object-cover"
                              src={item.images[0]}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Icon
                                className="text-gray-400 text-2xl"
                                icon="solar:box-linear"
                              />
                            </div>
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 mb-1 truncate">
                            {item.name}
                          </h4>
                          {item.description && (
                            <p className="text-xs text-gray-400 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredInventory.length === 0 && (
              <div className="text-center py-8">
                <Icon
                  className="text-gray-400 text-5xl mx-auto mb-3"
                  icon="solar:box-linear"
                />
                <p className="text-gray-600 font-medium">
                  {searchQuery
                    ? "No se encontraron suplementos"
                    : "No hay suplementos en el inventario"}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {searchQuery
                    ? "Intenta con otro término de búsqueda"
                    : "Añade productos al inventario primero"}
                </p>
              </div>
            )}
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

// Assignment Details Modal Component
interface AssignmentDetailsModalProps {
  isOpen: boolean;
  supplement: SupplementInventoryItem;
  assignmentForm: {
    dosage: string;
    frequency: string;
    timing: string;
    notes: string;
  };
  onChangeForm: (form: any) => void;
  onClose: () => void;
  onSave: () => void;
}

function AssignmentDetailsModal({
  isOpen,
  supplement,
  assignmentForm,
  onChangeForm,
  onClose,
  onSave,
}: AssignmentDetailsModalProps) {
  return (
    <Modal
      classNames={{
        base: "max-h-[90vh]",
        header: "border-b border-gray-200",
        footer: "border-t border-gray-200",
        body: "py-6",
      }}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="2xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-2 rounded-lg">
              <Icon
                className="text-slate-700 text-xl"
                icon="solar:health-bold"
              />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Detalles de Asignación
              </h3>
              <p className="text-sm text-gray-500 font-normal">
                Configura la dosificación y timing
              </p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-6">
            {/* Product Info (Readonly) */}
            <Card className="bg-gray-50 border border-gray-200">
              <CardBody className="p-4">
                <div className="flex gap-3">
                  {/* Product Image */}
                  {supplement.images?.[0] && (
                    <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        alt={supplement.name}
                        className="w-full h-full object-cover"
                        src={supplement.images[0]}
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 mb-1">
                      {supplement.name}
                    </h4>
                    {supplement.description && (
                      <p className="text-sm text-gray-600 mb-2">
                        {supplement.description}
                      </p>
                    )}
                    {supplement.product_url && (
                      <a
                        className="text-xs text-slate-700 hover:text-slate-800 flex items-center gap-1"
                        href={supplement.product_url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <Icon icon="solar:link-linear" width={14} />
                        Ver producto
                      </a>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Assignment Fields */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Configuración de Toma
              </h4>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    isRequired
                    label="Dosificación"
                    placeholder="Ej: 5g"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:scale-linear"
                        width={18}
                      />
                    }
                    value={assignmentForm.dosage}
                    onValueChange={(value) =>
                      onChangeForm({ ...assignmentForm, dosage: value })
                    }
                  />
                  <Input
                    isRequired
                    label="Frecuencia"
                    placeholder="Ej: Diario, 2x día..."
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:calendar-linear"
                        width={18}
                      />
                    }
                    value={assignmentForm.frequency}
                    onValueChange={(value) =>
                      onChangeForm({ ...assignmentForm, frequency: value })
                    }
                  />
                </div>
                <Input
                  isRequired
                  label="Timing"
                  placeholder="Ej: Post-entrenamiento, Con desayuno..."
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:alarm-linear"
                      width={18}
                    />
                  }
                  value={assignmentForm.timing}
                  onValueChange={(value) =>
                    onChangeForm({ ...assignmentForm, timing: value })
                  }
                />
                <Textarea
                  label="Notas (Opcional)"
                  minRows={3}
                  placeholder="Ej: Mezclar con batido de proteína..."
                  value={assignmentForm.notes}
                  onValueChange={(value) =>
                    onChangeForm({ ...assignmentForm, notes: value })
                  }
                />
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Cancelar
          </Button>
          <Button
            className="text-white font-semibold"
            color="primary"
            isDisabled={
              !assignmentForm.dosage ||
              !assignmentForm.frequency ||
              !assignmentForm.timing
            }
            startContent={<Icon icon="solar:add-circle-bold" width={18} />}
            onPress={onSave}
          >
            Asignar Suplemento
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// Edit Assignment Modal Component
interface EditAssignmentModalProps {
  isOpen: boolean;
  assignment: ClientSupplementAssignment;
  assignmentForm: {
    dosage: string;
    frequency: string;
    timing: string;
    notes: string;
  };
  onChangeForm: (form: any) => void;
  onClose: () => void;
  onSave: () => void;
}

function EditAssignmentModal({
  isOpen,
  assignment,
  assignmentForm,
  onChangeForm,
  onClose,
  onSave,
}: EditAssignmentModalProps) {
  const supplement = assignment.supplement;
  const productImage = supplement?.images?.[0];

  return (
    <Modal
      classNames={{
        base: "max-h-[90vh]",
        header: "border-b border-gray-200",
        footer: "border-t border-gray-200",
        body: "py-6",
      }}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="2xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="bg-blue-50 p-2 rounded-lg">
              <Icon className="text-blue-600 text-xl" icon="solar:pen-bold" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Editar Asignación
              </h3>
              <p className="text-sm text-gray-500 font-normal">
                Actualiza la dosificación y timing
              </p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-6">
            {/* Product Info (Readonly) */}
            <Card className="bg-gray-50 border border-gray-200">
              <CardBody className="p-4">
                <div className="flex gap-3">
                  {/* Product Image */}
                  {productImage && (
                    <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        alt={assignment.supplement_name}
                        className="w-full h-full object-cover"
                        src={productImage}
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 mb-1">
                      {assignment.supplement_name}
                    </h4>
                    {assignment.supplement_description && (
                      <p className="text-sm text-gray-600">
                        {assignment.supplement_description}
                      </p>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Assignment Fields */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Configuración de Toma
              </h4>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    isRequired
                    label="Dosificación"
                    placeholder="Ej: 5g"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:scale-linear"
                        width={18}
                      />
                    }
                    value={assignmentForm.dosage}
                    onValueChange={(value) =>
                      onChangeForm({ ...assignmentForm, dosage: value })
                    }
                  />
                  <Input
                    isRequired
                    label="Frecuencia"
                    placeholder="Ej: Diario, 2x día..."
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:calendar-linear"
                        width={18}
                      />
                    }
                    value={assignmentForm.frequency}
                    onValueChange={(value) =>
                      onChangeForm({ ...assignmentForm, frequency: value })
                    }
                  />
                </div>
                <Input
                  isRequired
                  label="Timing"
                  placeholder="Ej: Post-entrenamiento, Con desayuno..."
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:alarm-linear"
                      width={18}
                    />
                  }
                  value={assignmentForm.timing}
                  onValueChange={(value) =>
                    onChangeForm({ ...assignmentForm, timing: value })
                  }
                />
                <Textarea
                  label="Notas (Opcional)"
                  minRows={3}
                  placeholder="Ej: Mezclar con batido de proteína..."
                  value={assignmentForm.notes}
                  onValueChange={(value) =>
                    onChangeForm({ ...assignmentForm, notes: value })
                  }
                />
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Cancelar
          </Button>
          <Button
            className="text-white font-semibold"
            color="primary"
            isDisabled={
              !assignmentForm.dosage ||
              !assignmentForm.frequency ||
              !assignmentForm.timing
            }
            startContent={<Icon icon="solar:diskette-bold" width={18} />}
            onPress={onSave}
          >
            Guardar Cambios
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

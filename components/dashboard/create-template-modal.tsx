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
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateTemplateModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateTemplateModalProps) {
  const [templateType, setTemplateType] = useState<
    "program" | "nutrition" | null
  >(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "",
    category: "",
    division: "",
    goal: "",
    sessionsPerWeek: "3",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name) {
      alert("Por favor completa todos los campos requeridos");

      return;
    }

    // Validate based on template type
    if (templateType === "program" && (!formData.type || !formData.category)) {
      alert("Por favor completa todos los campos requeridos");

      return;
    }

    setIsSubmitting(true);

    try {
      let response;

      if (templateType === "nutrition") {
        // Create nutrition template
        response = await fetch("/api/nutrition/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            notes: formData.description,
            is_template: true,
          }),
        });
      } else {
        // Create program template
        response = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      }

      const result = await response.json();

      if (result.success) {
        onSuccess();
        // Reset form
        setTemplateType(null);
        setFormData({
          name: "",
          description: "",
          type: "",
          category: "",
          division: "",
          goal: "",
          sessionsPerWeek: "3",
        });
      } else {
        console.error("Error creating template:", result.error);
        alert("Error al crear la plantilla");
      }
    } catch (error) {
      console.error("Error creating template:", error);
      alert("Error al crear la plantilla");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setTemplateType(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      scrollBehavior="inside"
      size="2xl"
      onClose={handleClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          {!templateType
            ? "Crear Nueva Plantilla"
            : templateType === "nutrition"
              ? "Nueva Plantilla de Nutrición"
              : "Nueva Plantilla de Entrenamiento"}
        </ModalHeader>
        <ModalBody>
          {!templateType ? (
            // Step 1: Choose template type
            <div className="space-y-4">
              <p className="text-gray-600 mb-4">
                Selecciona el tipo de plantilla que deseas crear:
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Card
                  isPressable
                  className="border-2 border-transparent hover:border-primary transition-all cursor-pointer"
                  onPress={() => setTemplateType("program")}
                >
                  <CardBody className="p-6 text-center">
                    <Icon
                      className="mx-auto mb-3 text-primary"
                      icon="solar:dumbbell-bold"
                      width={48}
                    />
                    <h3 className="text-lg font-bold mb-2">
                      Programa de Entrenamiento
                    </h3>
                    <p className="text-sm text-gray-600">
                      Crea plantillas para rutinas de ejercicio, fuerza y cardio
                    </p>
                  </CardBody>
                </Card>

                <Card
                  isPressable
                  className="border-2 border-transparent hover:border-success transition-all cursor-pointer"
                  onPress={() => setTemplateType("nutrition")}
                >
                  <CardBody className="p-6 text-center">
                    <Icon
                      className="mx-auto mb-3 text-success"
                      icon="fluent:food-20-filled"
                      width={48}
                    />
                    <h3 className="text-lg font-bold mb-2">Plan Nutricional</h3>
                    <p className="text-sm text-gray-600">
                      Crea plantillas para dietas y planes de alimentación
                    </p>
                  </CardBody>
                </Card>
              </div>
            </div>
          ) : (
            // Step 2: Fill in details
            <div className="space-y-4">
              <Input
                isRequired
                label="Nombre de la Plantilla"
                placeholder={
                  templateType === "nutrition"
                    ? "Ej: Dieta Hipercalórica"
                    : "Ej: Hipertrofia 4 días"
                }
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />

              <Textarea
                label="Descripción (Opcional)"
                placeholder="Describe el objetivo y características de esta plantilla"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />

              {templateType === "program" && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Categoría <span className="text-danger">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <Card
                        isPressable
                        className={`border-2 transition-all cursor-pointer ${
                          formData.category === "strength"
                            ? "border-primary bg-primary-50"
                            : "border-gray-200 hover:border-primary"
                        }`}
                        onPress={() =>
                          setFormData({ ...formData, category: "strength" })
                        }
                      >
                        <CardBody className="p-4 text-center">
                          <Icon
                            className={`mx-auto mb-2 ${
                              formData.category === "strength"
                                ? "text-primary"
                                : "text-gray-600"
                            }`}
                            icon="solar:dumbbell-bold"
                            width={32}
                          />
                          <p
                            className={`font-semibold ${
                              formData.category === "strength"
                                ? "text-primary"
                                : "text-gray-700"
                            }`}
                          >
                            Fuerza
                          </p>
                        </CardBody>
                      </Card>

                      <Card
                        isPressable
                        className={`border-2 transition-all cursor-pointer ${
                          formData.category === "cardio"
                            ? "border-warning bg-warning-50"
                            : "border-gray-200 hover:border-warning"
                        }`}
                        onPress={() =>
                          setFormData({ ...formData, category: "cardio" })
                        }
                      >
                        <CardBody className="p-4 text-center">
                          <Icon
                            className={`mx-auto mb-2 ${
                              formData.category === "cardio"
                                ? "text-warning"
                                : "text-gray-600"
                            }`}
                            icon="solar:heart-pulse-bold"
                            width={32}
                          />
                          <p
                            className={`font-semibold ${
                              formData.category === "cardio"
                                ? "text-warning"
                                : "text-gray-700"
                            }`}
                          >
                            Cardio
                          </p>
                        </CardBody>
                      </Card>
                    </div>
                  </div>

                  {formData.category === "strength" && (
                    <>
                      <Select
                        isRequired
                        label="Tipo de Programa"
                        placeholder="Selecciona el tipo"
                        selectedKeys={formData.type ? [formData.type] : []}
                        onSelectionChange={(keys) => {
                          const type = Array.from(keys)[0] as string;

                          setFormData({ ...formData, type });
                        }}
                      >
                        <SelectItem key="Strength">Strength</SelectItem>
                        <SelectItem key="Hypertrophy">Hypertrophy</SelectItem>
                        <SelectItem key="HIIT">HIIT</SelectItem>
                        <SelectItem key="Functional">Functional</SelectItem>
                        <SelectItem key="Endurance">Endurance</SelectItem>
                        <SelectItem key="Fat Loss">Fat Loss</SelectItem>
                        <SelectItem key="Mixed">Mixed</SelectItem>
                      </Select>

                      <Select
                        label="División (Opcional)"
                        placeholder="Ej: Full Body, Upper/Lower"
                        selectedKeys={
                          formData.division ? [formData.division] : []
                        }
                        onSelectionChange={(keys) => {
                          const division = Array.from(keys)[0] as string;

                          setFormData({ ...formData, division });
                        }}
                      >
                        <SelectItem key="Full Body">Full Body</SelectItem>
                        <SelectItem key="Upper/Lower">Upper/Lower</SelectItem>
                        <SelectItem key="Push/Pull/Legs">
                          Push/Pull/Legs
                        </SelectItem>
                        <SelectItem key="Bro Split">Bro Split</SelectItem>
                        <SelectItem key="Custom">Custom</SelectItem>
                      </Select>
                    </>
                  )}

                  {formData.category === "cardio" && (
                    <>
                      <Select
                        isRequired
                        label="Tipo de Programa"
                        placeholder="Selecciona el tipo"
                        selectedKeys={formData.type ? [formData.type] : []}
                        onSelectionChange={(keys) => {
                          const type = Array.from(keys)[0] as string;

                          setFormData({ ...formData, type });
                        }}
                      >
                        <SelectItem key="HIIT">HIIT</SelectItem>
                        <SelectItem key="Endurance">Endurance</SelectItem>
                        <SelectItem key="Fat Loss">Fat Loss</SelectItem>
                        <SelectItem key="Mixed">Mixed</SelectItem>
                      </Select>

                      <Input
                        label="Objetivo (Opcional)"
                        placeholder="Ej: Mejorar resistencia cardiovascular"
                        value={formData.goal}
                        onChange={(e) =>
                          setFormData({ ...formData, goal: e.target.value })
                        }
                      />
                    </>
                  )}

                  <Input
                    label="Sesiones por Semana"
                    placeholder="3"
                    type="number"
                    value={formData.sessionsPerWeek}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sessionsPerWeek: e.target.value,
                      })
                    }
                  />
                </>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {templateType && (
            <Button
              variant="light"
              onPress={() => {
                setTemplateType(null);
                setFormData({
                  name: "",
                  description: "",
                  type: "",
                  category: "",
                  division: "",
                  goal: "",
                  sessionsPerWeek: "3",
                });
              }}
            >
              Atrás
            </Button>
          )}
          <Button color="danger" variant="light" onPress={handleClose}>
            Cancelar
          </Button>
          {templateType && (
            <Button
              className="text-white"
              color="primary"
              isLoading={isSubmitting}
              onPress={handleSubmit}
            >
              Crear Plantilla
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

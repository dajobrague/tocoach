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
  Progress,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { QuestionConfig } from "@/lib/forms/types";

interface DynamicFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  formType: "checkins" | "habits";
  onSuccess?: () => void;
}

export function DynamicFormModal({
  isOpen,
  onClose,
  clientId,
  formType,
  onSuccess,
}: DynamicFormModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [questions, setQuestions] = useState<QuestionConfig[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [existingResponseDate, setExistingResponseDate] = useState<string>("");
  const [hasNeatCards, setHasNeatCards] = useState(true); // default to true to avoid flickering

  // Load form configuration and check for existing response
  useEffect(() => {
    if (isOpen) {
      checkNeatCards();
      fetchFormConfig();
      checkExistingResponse();
    }
  }, [isOpen, clientId, formType]);

  const checkNeatCards = async () => {
    try {
      const response = await fetch("/api/client/neat");
      const data = await response.json();

      if (data.success) {
        setHasNeatCards((data.cards || []).length > 0);
      }
    } catch (error) {
      console.error("Error checking NEAT cards:", error);
      // Default to true on error to avoid hiding questions unnecessarily
      setHasNeatCards(true);
    }
  };

  const checkExistingResponse = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await fetch(
        `/api/forms/responses/${clientId}?form_type=${formType}&start_date=${today}`
      );
      const data = await response.json();

      if (data.success && data.responses && data.responses.length > 0) {
        // Found existing response for today/this week
        const existingResponse = data.responses[0];

        setAnswers(existingResponse.answers || {});
        setExistingResponseDate(existingResponse.response_date);
        setIsViewMode(true);
      } else {
        setIsViewMode(false);
        setAnswers({});
      }
    } catch (error) {
      console.error("Error checking existing response:", error);
      setIsViewMode(false);
    }
  };

  const fetchFormConfig = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/forms/configs/${clientId}?form_type=${formType}`
      );
      const data = await response.json();

      if (data.success && data.config) {
        // Filter to only enabled questions
        let enabledQuestions = data.config.questions_config.filter(
          (q: QuestionConfig) => q.enabled
        );

        // For habits form, filter out steps question if client has no NEAT cards
        if (formType === "habits" && !hasNeatCards) {
          enabledQuestions = enabledQuestions.filter(
            (q: QuestionConfig) => q.id !== "steps" && q.id !== "pasos"
          );
          console.log(
            "[DynamicFormModal] Filtered out steps question - no NEAT cards configured"
          );
        }

        setQuestions(enabledQuestions);
      } else {
        console.error("Error loading form config");
      }
    } catch (error) {
      console.error("Error fetching form config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if question should be shown based on conditional logic
  const shouldShowQuestion = (question: QuestionConfig): boolean => {
    if (!question.conditionalOn) return true;

    const conditionalAnswer = answers[question.conditionalOn];

    if (typeof question.conditionalValue === "boolean") {
      return conditionalAnswer === question.conditionalValue;
    }

    if (typeof question.conditionalValue === "number") {
      return conditionalAnswer <= question.conditionalValue;
    }

    return !!conditionalAnswer;
  };

  // Get visible questions for current view
  const visibleQuestions = questions.filter(shouldShowQuestion);

  // Organize questions into sections (for multi-step)
  const sections = [
    {
      title:
        formType === "checkins" ? "Progreso y Logros" : "Energía y Bienestar",
      questions: visibleQuestions.slice(
        0,
        Math.ceil(visibleQuestions.length / 3)
      ),
    },
    {
      title: formType === "checkins" ? "Desafíos y Metas" : "Nutrición",
      questions: visibleQuestions.slice(
        Math.ceil(visibleQuestions.length / 3),
        Math.ceil((visibleQuestions.length * 2) / 3)
      ),
    },
    {
      title: formType === "checkins" ? "Mediciones" : "Descanso",
      questions: visibleQuestions.slice(
        Math.ceil((visibleQuestions.length * 2) / 3)
      ),
    },
  ].filter((section) => section.questions.length > 0);

  const currentSection = sections[currentStep] || { title: "", questions: [] };
  const totalSteps = sections.length;

  const handleNext = () => {
    // Validate current section
    const currentErrors: Record<string, string> = {};

    currentSection.questions.forEach((question) => {
      if (question.required && !shouldShowQuestion(question)) return;

      if (
        question.required &&
        (answers[question.id] === undefined ||
          answers[question.id] === "" ||
          answers[question.id] === null)
      ) {
        currentErrors[question.id] = "Este campo es obligatorio";
      }
    });

    if (Object.keys(currentErrors).length > 0) {
      setErrors(currentErrors);

      return;
    }

    setErrors({});

    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/forms/responses/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_type: formType,
          response_date: new Date().toISOString().split("T")[0],
          answers,
          metadata: {
            submitted_from: "mobile",
            completion_time: new Date().toISOString(),
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert("Formulario enviado exitosamente");
        setAnswers({});
        setCurrentStep(0);
        onClose();
        if (onSuccess) onSuccess();
      } else {
        alert(data.error || "Error al enviar formulario");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("Error de conexión al enviar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestionInput = (question: QuestionConfig) => {
    const value = answers[question.id];
    const error = errors[question.id];

    switch (question.type) {
      case "rating":
        return (
          <div className="space-y-2">
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  className={`p-3 rounded-lg transition-all ${
                    value >= rating
                      ? "bg-yellow-400 scale-110"
                      : "bg-gray-100 hover:bg-gray-200"
                  } ${isViewMode ? "cursor-default" : "cursor-pointer"}`}
                  disabled={isViewMode}
                  type="button"
                  onClick={() =>
                    !isViewMode &&
                    setAnswers({ ...answers, [question.id]: rating })
                  }
                >
                  <Icon
                    className={value >= rating ? "text-white" : "text-gray-400"}
                    icon={
                      value >= rating ? "solar:star-bold" : "solar:star-linear"
                    }
                    width={28}
                  />
                </button>
              ))}
            </div>
            {value && (
              <p className="text-center text-sm text-gray-600">
                {value} de 5 estrellas
              </p>
            )}
          </div>
        );

      case "number":
        return (
          <Input
            classNames={{
              input: "text-base",
            }}
            endContent={
              question.unit && (
                <span className="text-sm text-gray-400">{question.unit}</span>
              )
            }
            errorMessage={error}
            isInvalid={!!error}
            isReadOnly={isViewMode}
            placeholder={`Ingresa el valor`}
            type="number"
            value={value || ""}
            onChange={(e) =>
              !isViewMode &&
              setAnswers({
                ...answers,
                [question.id]: parseFloat(e.target.value) || "",
              })
            }
          />
        );

      case "boolean":
        return (
          <div className="flex gap-3">
            <Button
              className="flex-1"
              color={value === true ? "success" : "default"}
              isDisabled={isViewMode}
              size="lg"
              startContent={<Icon icon="solar:check-circle-bold" width={20} />}
              variant={value === true ? "solid" : "bordered"}
              onPress={() =>
                !isViewMode && setAnswers({ ...answers, [question.id]: true })
              }
            >
              Sí
            </Button>
            <Button
              className="flex-1"
              color={value === false ? "danger" : "default"}
              isDisabled={isViewMode}
              size="lg"
              startContent={<Icon icon="solar:close-circle-bold" width={20} />}
              variant={value === false ? "solid" : "bordered"}
              onPress={() =>
                !isViewMode && setAnswers({ ...answers, [question.id]: false })
              }
            >
              No
            </Button>
          </div>
        );

      case "text":
        return (
          <Textarea
            classNames={{
              input: "text-base",
            }}
            errorMessage={error}
            isInvalid={!!error}
            isReadOnly={isViewMode}
            minRows={3}
            placeholder="Escribe tu respuesta..."
            value={value || ""}
            onChange={(e) =>
              !isViewMode &&
              setAnswers({ ...answers, [question.id]: e.target.value })
            }
          />
        );

      case "photo":
        return (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Icon
              className="text-gray-400 mx-auto mb-3"
              icon="solar:camera-bold"
              width={48}
            />
            <p className="text-sm text-gray-500 mb-3">
              Función de fotos disponible próximamente
            </p>
          </div>
        );

      default:
        return (
          <p className="text-sm text-gray-500">Tipo de pregunta no soportado</p>
        );
    }
  };

  return (
    <Modal
      hideCloseButton={isSubmitting}
      isDismissable={!isSubmitting}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="2xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader>
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon
                  className="text-primary"
                  icon={
                    formType === "checkins"
                      ? "solar:clipboard-check-bold"
                      : "solar:calendar-mark-bold"
                  }
                  width={24}
                />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900">
                  {formType === "checkins"
                    ? "Seguimiento Semanal"
                    : "Registro Diario"}
                  {isViewMode && (
                    <span className="text-success"> ✓ Completado</span>
                  )}
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  {isViewMode
                    ? `Enviado el ${new Date(existingResponseDate).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}`
                    : `${currentSection.title} (${currentStep + 1} de ${totalSteps})`}
                </p>
              </div>
            </div>
            {totalSteps > 1 && !isViewMode && (
              <Progress
                className="w-full"
                color="primary"
                size="sm"
                value={((currentStep + 1) / totalSteps) * 100}
              />
            )}
          </div>
        </ModalHeader>

        <ModalBody>
          {isLoading ? (
            <div className="flex justify-center items-center p-12">
              <div className="text-center">
                <Icon
                  className="text-primary text-4xl animate-spin mx-auto mb-3"
                  icon="solar:loading-linear"
                  width={48}
                />
                <p className="text-sm text-gray-600">Cargando formulario...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {(isViewMode ? visibleQuestions : currentSection.questions).map(
                (question) => (
                  <Card
                    key={question.id}
                    className="bg-gray-50 border border-gray-200"
                  >
                    <CardBody className="p-5">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="bg-white p-2 rounded-lg flex-shrink-0">
                          <Icon
                            className="text-gray-600"
                            icon={question.icon}
                            width={20}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-900 mb-1">
                            {question.fullQuestion || question.label}
                            {question.required && !isViewMode && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </p>
                          {!isViewMode && (
                            <p className="text-xs text-gray-500">
                              {question.type === "rating" &&
                                "Califica del 1 al 5"}
                              {question.type === "number" &&
                                `Ingresa el valor${question.unit ? ` en ${question.unit}` : ""}`}
                              {question.type === "text" &&
                                "Escribe tu respuesta"}
                              {question.type === "boolean" &&
                                "Selecciona una opción"}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="ml-0">
                        {renderQuestionInput(question)}
                      </div>
                    </CardBody>
                  </Card>
                )
              )}

              {currentSection.questions.length === 0 && !isViewMode && (
                <div className="text-center p-6">
                  <Icon
                    className="text-success text-5xl mx-auto mb-3"
                    icon="solar:check-circle-bold"
                    width={64}
                  />
                  <p className="text-gray-600">
                    ¡Todas las preguntas contestadas!
                  </p>
                </div>
              )}
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          {isViewMode ? (
            <div className="flex justify-end w-full">
              <Button color="primary" onPress={onClose}>
                Cerrar
              </Button>
            </div>
          ) : (
            <div className="flex justify-between w-full">
              {currentStep > 0 && (
                <Button
                  isDisabled={isSubmitting}
                  startContent={
                    <Icon icon="solar:alt-arrow-left-linear" width={20} />
                  }
                  variant="light"
                  onPress={handleBack}
                >
                  Anterior
                </Button>
              )}
              <div className="flex-1" />
              <div className="flex gap-2">
                <Button
                  isDisabled={isSubmitting}
                  variant="light"
                  onPress={onClose}
                >
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  endContent={
                    !isSubmitting &&
                    (currentStep < totalSteps - 1 ? (
                      <Icon icon="solar:alt-arrow-right-linear" width={20} />
                    ) : (
                      <Icon icon="solar:check-circle-bold" width={20} />
                    ))
                  }
                  isLoading={isSubmitting}
                  onPress={handleNext}
                >
                  {isSubmitting
                    ? "Enviando..."
                    : currentStep < totalSteps - 1
                      ? "Siguiente"
                      : "Enviar"}
                </Button>
              </div>
            </div>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

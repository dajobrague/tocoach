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
  Textarea,
  Chip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

interface CheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CheckinModal({ isOpen, onClose }: CheckinModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Secciones del formulario de hábitos diarios
  const sections = [
    {
      title: "Energía y Bienestar",
      icon: "solar:bolt-bold",
      color: "primary",
      questions: [
        {
          id: "energy_levels",
          label: "Niveles de Energía",
          question: "¿Cómo han sido tus niveles de energía durante el día?",
          icon: "solar:bolt-bold",
          type: "rating",
          required: false,
        },
        {
          id: "stress_levels",
          label: "Manejo del Estrés",
          question: "¿Qué tal has sobrellevado el estrés?",
          icon: "solar:shield-warning-bold",
          type: "rating",
          required: false,
        },
        {
          id: "illness_signs",
          label: "Signos de Enfermedad",
          question: "¿Has tenido algún signo de enfermedad, infección o dolor?",
          icon: "solar:heart-pulse-bold",
          type: "boolean",
          required: false,
        },
        {
          id: "illness_details",
          label: "Detalles",
          question: "Cuéntanos más sobre cómo te sientes",
          icon: "solar:notes-bold",
          type: "text",
          required: false,
          conditionalOn: "illness_signs",
          conditionalValue: true,
          placeholder: "Describe los síntomas o molestias...",
        },
      ],
    },
    {
      title: "Actividad Física",
      icon: "solar:walking-bold",
      color: "success",
      questions: [
        {
          id: "steps",
          label: "Pasos",
          question: "¿Cuántos pasos has hecho hoy?",
          icon: "solar:walking-bold",
          type: "number",
          unit: "pasos",
          required: false,
          placeholder: "10000",
        },
        {
          id: "other_activity",
          label: "Otra Actividad",
          question: "¿Realizaste otra actividad física exigente?",
          icon: "solar:running-bold",
          type: "boolean",
          required: false,
        },
        {
          id: "other_activity_details",
          label: "Detalles",
          question: "Cuéntanos qué actividad realizaste",
          icon: "solar:notes-bold",
          type: "text",
          required: false,
          conditionalOn: "other_activity",
          conditionalValue: true,
          placeholder: "Ej: Ciclismo 30 min, natación, fútbol...",
        },
        {
          id: "sun_exposure",
          label: "Exposición Solar",
          question: "¿Cuántas horas de exposición al sol tuviste hoy?",
          icon: "solar:sun-bold",
          type: "number",
          unit: "horas",
          required: false,
          placeholder: "2",
        },
      ],
    },
    {
      title: "Nutrición",
      icon: "solar:fire-bold",
      color: "danger",
      questions: [
        {
          id: "calories",
          label: "Calorías",
          question: "¿Cuántas calorías totales consumiste hoy?",
          icon: "solar:fire-bold",
          type: "number",
          unit: "kcal",
          required: false,
          placeholder: "2000",
        },
        {
          id: "protein",
          label: "Proteína",
          question: "¿Cuántos gramos de proteína consumiste?",
          icon: "solar:bone-bold",
          type: "number",
          unit: "g",
          required: false,
          placeholder: "150",
        },
        {
          id: "carbs",
          label: "Carbohidratos",
          question: "¿Cuántos gramos de carbohidratos?",
          icon: "solar:leaf-bold",
          type: "number",
          unit: "g",
          required: false,
          placeholder: "200",
        },
        {
          id: "fats",
          label: "Grasas",
          question: "¿Cuántos gramos de grasas?",
          icon: "solar:widget-2-bold",
          type: "number",
          unit: "g",
          required: false,
          placeholder: "60",
        },
        {
          id: "hunger_levels",
          label: "Niveles de Hambre",
          question: "¿Cómo han sido tus niveles de hambre hoy?",
          icon: "solar:chef-hat-bold",
          type: "rating",
          required: false,
        },
        {
          id: "adherence",
          label: "Adherencia al Plan",
          question: "¿Cómo ha sido tu adherencia al plan nutricional?",
          icon: "solar:check-circle-bold",
          type: "rating",
          required: false,
        },
        {
          id: "adherence_reason",
          label: "Razón",
          question: "¿Por qué no pudiste ceñirte al plan?",
          icon: "solar:question-circle-bold",
          type: "text",
          required: false,
          conditionalOn: "adherence",
          placeholder: "Ej: Comida social, antojos, falta de tiempo...",
        },
        {
          id: "caffeine",
          label: "Cafeína",
          question: "¿Cuánta cafeína consumiste?",
          icon: "solar:cup-hot-bold",
          type: "number",
          unit: "mg",
          required: false,
          placeholder: "200",
        },
        {
          id: "supplementation",
          label: "Suplementación",
          question: "¿Qué suplementos tomaste hoy?",
          icon: "solar:pill-bold",
          type: "text",
          required: false,
          placeholder: "Ej: Creatina, proteína, vitaminas...",
        },
      ],
    },
    {
      title: "Descanso",
      icon: "solar:moon-sleep-bold",
      color: "secondary",
      questions: [
        {
          id: "bedtime",
          label: "Hora de Acostar",
          question: "¿A qué hora te acostaste ayer?",
          icon: "solar:moon-stars-bold",
          type: "text",
          required: false,
          placeholder: "23:00",
        },
        {
          id: "wake_time",
          label: "Hora de Despertar",
          question: "¿A qué hora te despertaste hoy?",
          icon: "solar:sun-fog-bold",
          type: "text",
          required: false,
          placeholder: "07:00",
        },
        {
          id: "sleep_hours",
          label: "Horas de Sueño",
          question: "¿Cuántas horas dormiste en total?",
          icon: "solar:moon-sleep-bold",
          type: "number",
          unit: "horas",
          required: false,
          placeholder: "7.5",
        },
        {
          id: "morning_feeling",
          label: "Sensación al Despertar",
          question: "Al salir de la cama esta mañana, ¿cómo te sentías?",
          icon: "solar:smile-circle-bold",
          type: "rating",
          required: false,
        },
        {
          id: "morning_feeling_details",
          label: "Detalles",
          question: "Cuéntanos más sobre cómo te sentiste",
          icon: "solar:notes-bold",
          type: "text",
          required: false,
          conditionalOn: "morning_feeling",
          placeholder: "Ej: Me sentí cansado, con poca energía...",
        },
      ],
    },
  ];

  const totalSteps = sections.length;
  const currentSection = sections[currentStep];
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    // Clear error when user starts typing
    if (errors[questionId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };

        delete newErrors[questionId];

        return newErrors;
      });
    }
  };

  const validateStep = () => {
    if (!currentSection) return true;

    const newErrors: Record<string, string> = {};

    currentSection.questions.forEach((q) => {
      // Check if question should be shown (conditional logic)
      if (q.conditionalOn) {
        const parentAnswer = answers[q.conditionalOn];

        if (
          "conditionalValue" in q &&
          q.conditionalValue !== undefined &&
          parentAnswer !== q.conditionalValue
        ) {
          return; // Skip validation for hidden conditional questions
        }
      }

      // Validate required fields
      if (q.required && !answers[q.id]) {
        newErrors[q.id] = "Este campo es obligatorio";
      }
    });

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      if (currentStep < totalSteps - 1) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    if (validateStep()) {
      console.log("Check-in submitted:", answers);
      // Aquí enviarías los datos al backend
      onClose();
      // Reset form
      setAnswers({});
      setCurrentStep(0);
      setErrors({});
    }
  };

  const shouldShowQuestion = (question: any) => {
    if (!question.conditionalOn) return true;
    const parentAnswer = answers[question.conditionalOn];

    if (question.conditionalValue !== undefined) {
      return parentAnswer === question.conditionalValue;
    }

    return !!parentAnswer; // Show if parent has any value
  };

  if (!currentSection) {
    return null;
  }

  return (
    <Modal
      classNames={{
        base: "max-h-[100vh] m-0",
        wrapper: "items-end sm:items-center",
        backdrop: "bg-black/80",
      }}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="full"
      onClose={onClose}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 border-b border-default-200">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary">
                  <Icon
                    className="text-white text-2xl"
                    icon={currentSection.icon}
                  />
                </div>
                <div>
                  <h2 className="text-xl font-bold font-heading text-foreground">
                    {currentSection.title}
                  </h2>
                  <p className="text-sm text-foreground/60 font-normal">
                    Paso {currentStep + 1} de {totalSteps}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-default-100 rounded-full overflow-hidden mt-4">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </ModalHeader>

            <ModalBody className="py-6">
              <div className="max-w-2xl mx-auto w-full space-y-6">
                {currentSection.questions.map((question) => {
                  if (!shouldShowQuestion(question)) return null;

                  return (
                    <Card
                      key={question.id}
                      className="border-2 border-default-200 hover:border-primary/50 transition-colors"
                    >
                      <CardBody className="p-6">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="bg-primary p-3 rounded-xl flex-shrink-0">
                            <Icon
                              className="text-white text-2xl"
                              icon={question.icon}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-base font-bold text-foreground font-heading">
                                {question.question}
                              </h3>
                              {question.required && (
                                <Chip
                                  className="h-5"
                                  color="danger"
                                  size="sm"
                                  variant="flat"
                                >
                                  Obligatorio
                                </Chip>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Input based on type */}
                        <div className="space-y-2">
                          {question.type === "text" && (
                            <Textarea
                              classNames={{
                                input: "text-base",
                                inputWrapper: errors[question.id]
                                  ? "border-2 border-danger"
                                  : "border-2 border-default-200 hover:border-primary/50",
                              }}
                              minRows={3}
                              placeholder={question.placeholder || ""}
                              value={answers[question.id] || ""}
                              onValueChange={(value) =>
                                handleAnswerChange(question.id, value)
                              }
                            />
                          )}

                          {question.type === "boolean" && (
                            <div className="flex gap-3">
                              <Button
                                className={`flex-1 h-16 ${
                                  answers[question.id] === true
                                    ? "bg-success text-white"
                                    : "bg-default-100 text-foreground"
                                }`}
                                size="lg"
                                startContent={
                                  <Icon
                                    className="text-2xl"
                                    icon="solar:check-circle-bold"
                                  />
                                }
                                onPress={() =>
                                  handleAnswerChange(question.id, true)
                                }
                              >
                                <span className="text-lg font-semibold">
                                  Sí
                                </span>
                              </Button>
                              <Button
                                className={`flex-1 h-16 ${
                                  answers[question.id] === false
                                    ? "bg-danger text-white"
                                    : "bg-default-100 text-foreground"
                                }`}
                                size="lg"
                                startContent={
                                  <Icon
                                    className="text-2xl"
                                    icon="solar:close-circle-bold"
                                  />
                                }
                                onPress={() =>
                                  handleAnswerChange(question.id, false)
                                }
                              >
                                <span className="text-lg font-semibold">
                                  No
                                </span>
                              </Button>
                            </div>
                          )}

                          {question.type === "rating" && (
                            <div className="flex justify-center gap-2 py-4">
                              {[1, 2, 3, 4, 5].map((rating) => (
                                <button
                                  key={rating}
                                  className="p-2 rounded-xl hover:bg-default-100 transition-all transform hover:scale-110"
                                  type="button"
                                  onClick={() =>
                                    handleAnswerChange(question.id, rating)
                                  }
                                >
                                  <Icon
                                    className={`text-4xl transition-colors ${
                                      answers[question.id] >= rating
                                        ? "text-warning"
                                        : "text-default-300"
                                    }`}
                                    icon="solar:star-bold"
                                  />
                                </button>
                              ))}
                            </div>
                          )}

                          {question.type === "number" && (
                            <Input
                              classNames={{
                                input: "text-lg",
                                inputWrapper: errors[question.id]
                                  ? "border-2 border-danger h-14"
                                  : "border-2 border-default-200 hover:border-primary/50 h-14",
                              }}
                              endContent={
                                <span className="text-sm text-foreground/60 font-semibold">
                                  {question.unit}
                                </span>
                              }
                              placeholder={question.placeholder || ""}
                              step="0.1"
                              type="number"
                              value={answers[question.id] || ""}
                              onValueChange={(value) =>
                                handleAnswerChange(question.id, value)
                              }
                            />
                          )}

                          {errors[question.id] && (
                            <p className="text-sm text-danger flex items-center gap-1 mt-1">
                              <Icon
                                className="text-base"
                                icon="solar:info-circle-bold"
                              />
                              {errors[question.id]}
                            </p>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            </ModalBody>

            <ModalFooter className="border-t border-default-200">
              <div className="flex gap-3 w-full">
                {currentStep > 0 && (
                  <Button
                    className="flex-1"
                    size="lg"
                    startContent={
                      <Icon
                        className="text-xl"
                        icon="solar:alt-arrow-left-bold"
                      />
                    }
                    variant="bordered"
                    onPress={handlePrevious}
                  >
                    Anterior
                  </Button>
                )}
                {currentStep < totalSteps - 1 ? (
                  <Button
                    className="flex-1"
                    color="primary"
                    endContent={
                      <Icon
                        className="text-xl"
                        icon="solar:alt-arrow-right-bold"
                      />
                    }
                    size="lg"
                    onPress={handleNext}
                  >
                    Siguiente
                  </Button>
                ) : (
                  <Button
                    className="flex-1 text-white"
                    color="success"
                    endContent={
                      <Icon
                        className="text-xl"
                        icon="solar:check-circle-bold"
                      />
                    }
                    size="lg"
                    onPress={handleSubmit}
                  >
                    Guardar Registro
                  </Button>
                )}
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

"use client";

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
  Spinner,
  Switch,
  Tab,
  Tabs,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import {
  FormResponse as FormResponseType,
  QuestionConfig,
} from "@/lib/forms/types";

interface FormsTabProps {
  clientId: string;
}

export default function FormsTab({ clientId }: FormsTabProps) {
  const [selectedFormType, setSelectedFormType] = useState<
    "checkins" | "habits"
  >("checkins");
  const [selectedView, setSelectedView] = useState("responses"); // "responses" o "configuration"
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isAddQuestionModalOpen, setIsAddQuestionModalOpen] = useState(false);
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null);

  // New question form state
  const [newQuestion, setNewQuestion] = useState({
    label: "",
    fullQuestion: "",
    type: "text" as "text" | "number" | "rating" | "boolean",
    unit: "",
    enabled: true,
    required: false,
  });

  // Loading states
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isLoadingResponses, setIsLoadingResponses] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Configuración de preguntas
  const [checkinQuestions, setCheckinQuestions] = useState<QuestionConfig[]>([
    {
      id: "personal_life",
      label: "Vida Personal",
      fullQuestion: "¿Cómo va todo a nivel personal?",
      icon: "solar:user-heart-bold",
      type: "text",
      enabled: true,
      required: true,
    },
    {
      id: "gym_achievement",
      label: "Triunfo en el Gimnasio",
      fullQuestion:
        "Triunfo que has conseguido en el gimnasio desde última revisión",
      icon: "solar:cup-star-bold",
      type: "text",
      enabled: true,
      required: true,
    },
    {
      id: "other_victory",
      label: "Otra Victoria",
      fullQuestion: "¿Alguna otra victoria que celebrar?",
      icon: "solar:star-circle-bold",
      type: "text",
      enabled: true,
      required: false,
    },
    {
      id: "biggest_challenge",
      label: "Mayor Desafío",
      fullQuestion: "¿Cuál ha sido el mayor desafío al que te has enfrentado?",
      icon: "solar:shield-warning-bold",
      type: "text",
      enabled: true,
      required: true,
    },
    {
      id: "goals_completed",
      label: "Objetivos Cumplidos",
      fullQuestion:
        "¿Has cumplido objetivos que te marcaste en nuestra última revisión?",
      icon: "solar:check-square-bold",
      type: "boolean",
      enabled: true,
      required: true,
    },
    {
      id: "goals_impediment",
      label: "Impedimentos",
      fullQuestion: "¿Qué te lo ha impedido?",
      icon: "solar:close-circle-bold",
      type: "text",
      enabled: true,
      required: false,
      conditionalOn: "goals_completed",
      conditionalValue: false,
    },
    {
      id: "focus_next_weeks",
      label: "Enfoque Próximas Semanas",
      fullQuestion:
        "¿En qué quieres enfocarte especialmente para mejorar en estas próximas semanas?",
      icon: "solar:target-bold",
      type: "text",
      enabled: true,
      required: true,
    },
    {
      id: "service_rating",
      label: "Valoración del Servicio",
      fullQuestion: "¿Cómo valoras el servicio que te estamos dando?",
      icon: "solar:star-bold",
      type: "rating",
      enabled: true,
      required: true,
    },
    {
      id: "service_details",
      label: "Detalles del Servicio",
      fullQuestion: "¿Me puedes dar más detalles?",
      icon: "solar:chat-round-dots-bold",
      type: "text",
      enabled: true,
      required: false,
      conditionalOn: "service_rating",
      conditionalValue: true, // Se muestra si hay cualquier rating
    },
    {
      id: "photos",
      label: "Fotos de Progreso",
      icon: "solar:camera-bold",
      type: "group",
      enabled: true,
      required: false,
      subQuestions: [
        {
          id: "photo_front",
          label: "Foto de Frente",
          icon: "solar:user-bold",
          type: "photo",
          enabled: true,
          required: false,
        },
        {
          id: "photo_side",
          label: "Foto de Perfil",
          icon: "solar:user-bold",
          type: "photo",
          enabled: true,
          required: false,
        },
        {
          id: "photo_back",
          label: "Foto de Espaldas",
          icon: "solar:user-bold",
          type: "photo",
          enabled: true,
          required: false,
        },
      ],
    },
    {
      id: "body_measurements",
      label: "Medidas Corporales",
      icon: "solar:ruler-bold",
      type: "group",
      enabled: true,
      required: false,
      subQuestions: [
        {
          id: "chest",
          label: "Pecho",
          icon: "solar:ruler-cross-pen-bold",
          type: "number",
          unit: "cm",
          enabled: true,
          required: false,
        },
        {
          id: "shoulders",
          label: "Hombros",
          icon: "solar:ruler-cross-pen-bold",
          type: "number",
          unit: "cm",
          enabled: true,
          required: false,
        },
        {
          id: "arm",
          label: "Brazo",
          icon: "solar:ruler-cross-pen-bold",
          type: "number",
          unit: "cm",
          enabled: true,
          required: false,
        },
        {
          id: "above_navel",
          label: "Sobre el Ombligo 3cm",
          icon: "solar:ruler-cross-pen-bold",
          type: "number",
          unit: "cm",
          enabled: true,
          required: false,
        },
        {
          id: "below_navel",
          label: "Bajo el Ombligo 3cm",
          icon: "solar:ruler-cross-pen-bold",
          type: "number",
          unit: "cm",
          enabled: true,
          required: false,
        },
        {
          id: "groin",
          label: "Ingle",
          icon: "solar:ruler-cross-pen-bold",
          type: "number",
          unit: "cm",
          enabled: true,
          required: false,
        },
        {
          id: "thigh",
          label: "Muslo",
          icon: "solar:ruler-cross-pen-bold",
          type: "number",
          unit: "cm",
          enabled: true,
          required: false,
        },
        {
          id: "calf",
          label: "Gemelo",
          icon: "solar:ruler-cross-pen-bold",
          type: "number",
          unit: "cm",
          enabled: true,
          required: false,
        },
      ],
    },
    {
      id: "body_weight",
      label: "Peso Corporal",
      icon: "solar:scale-bold",
      type: "number",
      unit: "kg",
      enabled: true,
      required: true,
    },
  ]);
  const [habitQuestions, setHabitQuestions] = useState<QuestionConfig[]>([]);
  const [responses, setResponses] = useState<FormResponseType[]>([]);

  // Fetch form configuration when clientId or formType changes
  useEffect(() => {
    async function fetchConfig() {
      setIsLoadingConfig(true);
      try {
        const response = await fetch(
          `/api/forms/configs/${clientId}?form_type=${selectedFormType}`
        );
        const data = await response.json();

        if (data.success && data.config) {
          const questions = data.config.questions_config;

          if (selectedFormType === "checkins") {
            setCheckinQuestions(questions);
          } else {
            setHabitQuestions(questions);
          }
        } else if (data.error !== "No config found") {
          // Only log actual errors, not missing configs (which is normal for new clients)
          console.debug(
            "No form config found for this client (expected for new clients)"
          );
        }
      } catch (error) {
        // Silently handle errors for missing configs (normal for new clients)
        console.debug("Form config fetch:", error);
      } finally {
        setIsLoadingConfig(false);
      }
    }

    fetchConfig();
  }, [clientId, selectedFormType]);

  // Fetch responses when viewing responses tab
  useEffect(() => {
    if (selectedView === "responses") {
      async function fetchResponses() {
        setIsLoadingResponses(true);
        try {
          const response = await fetch(
            `/api/forms/responses/${clientId}?form_type=${selectedFormType}`
          );
          const data = await response.json();

          if (data.success) {
            setResponses(data.responses || []);
          } else {
            // No responses yet is normal for new clients
            setResponses([]);
          }
        } catch (error) {
          // Silently handle errors for missing responses (normal for new clients)
          console.debug("Form responses fetch:", error);
          setResponses([]);
        } finally {
          setIsLoadingResponses(false);
        }
      }

      fetchResponses();
    }
  }, [clientId, selectedFormType, selectedView]);

  // Save configuration handler
  const handleSaveConfiguration = async () => {
    setIsSavingConfig(true);
    try {
      const questions =
        selectedFormType === "checkins" ? checkinQuestions : habitQuestions;

      const response = await fetch(`/api/forms/configs/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_type: selectedFormType,
          questions_config: questions,
          uses_template: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert("Configuración guardada exitosamente");
      } else {
        alert(data.error || "Error al guardar configuración");
      }
    } catch (error) {
      console.error("Error saving config:", error);
      alert("Error de conexión al guardar");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const toggleCheckinQuestion = (questionId: string, parentId?: string) => {
    setCheckinQuestions(
      checkinQuestions.map((q) => {
        if (parentId && q.id === parentId && q.subQuestions) {
          // Toggle sub-pregunta
          return {
            ...q,
            subQuestions: q.subQuestions.map((sq) =>
              sq.id === questionId ? { ...sq, enabled: !sq.enabled } : sq
            ),
          };
        } else if (q.id === questionId) {
          // Toggle pregunta principal
          return { ...q, enabled: !q.enabled };
        }

        return q;
      })
    );
  };

  const toggleCheckinRequired = (questionId: string, parentId?: string) => {
    setCheckinQuestions(
      checkinQuestions.map((q) => {
        if (parentId && q.id === parentId && q.subQuestions) {
          // Toggle required en sub-pregunta
          return {
            ...q,
            subQuestions: q.subQuestions.map((sq) =>
              sq.id === questionId ? { ...sq, required: !sq.required } : sq
            ),
          };
        } else if (q.id === questionId) {
          // Toggle required en pregunta principal
          return { ...q, required: !q.required };
        }

        return q;
      })
    );
  };

  const toggleHabitQuestion = (questionId: string, parentId?: string) => {
    setHabitQuestions(
      habitQuestions.map((q) => {
        if (parentId && q.id === parentId && q.subQuestions) {
          // Toggle sub-pregunta
          return {
            ...q,
            subQuestions: q.subQuestions.map((sq) =>
              sq.id === questionId ? { ...sq, enabled: !sq.enabled } : sq
            ),
          };
        } else if (q.id === questionId) {
          // Toggle pregunta principal
          return { ...q, enabled: !q.enabled };
        }

        return q;
      })
    );
  };

  // Add custom question
  const handleAddCustomQuestion = () => {
    if (!newQuestion.label || !newQuestion.fullQuestion) {
      alert("Por favor completa la etiqueta y la pregunta");

      return;
    }

    // Generate unique ID for custom question
    const customId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const customQuestion: QuestionConfig = {
      id: customId,
      label: newQuestion.label,
      fullQuestion: newQuestion.fullQuestion,
      icon: getIconForType(newQuestion.type),
      type: newQuestion.type,
      ...(newQuestion.unit && { unit: newQuestion.unit }),
      enabled: newQuestion.enabled,
      required: newQuestion.required,
    };

    // Add to the appropriate form
    if (selectedFormType === "checkins") {
      setCheckinQuestions([...checkinQuestions, customQuestion]);
    } else {
      setHabitQuestions([...habitQuestions, customQuestion]);
    }

    // Reset form and close modal
    setNewQuestion({
      label: "",
      fullQuestion: "",
      type: "text",
      unit: "",
      enabled: true,
      required: false,
    });
    setIsAddQuestionModalOpen(false);

    alert("Pregunta agregada. No olvides guardar la configuración.");
  };

  // Get default icon based on question type
  const getIconForType = (type: string): string => {
    switch (type) {
      case "text":
        return "solar:text-bold";
      case "number":
        return "solar:hashtag-bold";
      case "rating":
        return "solar:star-bold";
      case "boolean":
        return "solar:check-circle-bold";
      default:
        return "solar:question-circle-bold";
    }
  };

  // Delete custom question
  const handleDeleteCustomQuestion = (questionId: string) => {
    if (!questionId.startsWith("custom_")) {
      alert("Solo puedes eliminar preguntas personalizadas");

      return;
    }

    if (!confirm("¿Seguro que quieres eliminar esta pregunta personalizada?")) {
      return;
    }

    if (selectedFormType === "checkins") {
      setCheckinQuestions(checkinQuestions.filter((q) => q.id !== questionId));
    } else {
      setHabitQuestions(habitQuestions.filter((q) => q.id !== questionId));
    }

    alert("Pregunta eliminada. No olvides guardar la configuración.");
  };

  const toggleHabitRequired = (questionId: string, parentId?: string) => {
    setHabitQuestions(
      habitQuestions.map((q) => {
        if (parentId && q.id === parentId && q.subQuestions) {
          // Toggle required en sub-pregunta
          return {
            ...q,
            subQuestions: q.subQuestions.map((sq) =>
              sq.id === questionId ? { ...sq, required: !sq.required } : sq
            ),
          };
        } else if (q.id === questionId) {
          // Toggle required en pregunta principal
          return { ...q, required: !q.required };
        }

        return q;
      })
    );
  };

  const enabledCheckinQuestions = checkinQuestions.filter((q) => q.enabled);
  const enabledHabitQuestions = habitQuestions.filter((q) => q.enabled);

  // Transform responses for display
  const displayResponses = responses.map((r) => ({
    id: r.id,
    date: r.response_date,
    type: r.form_type,
    answers: r.answers,
  }));

  // OLD Mock data - now replaced by API
  const mockCheckinResponses_OLD: any[] = [
    {
      id: "1",
      date: "2025-10-13",
      type: "checkin",
      answers: {
        weight: 82.5,
        energy: 4,
        sleep: 5,
        stress: 2,
        mood: 4,
        progress:
          "Muy buena semana, he visto mejoras en mi fuerza y resistencia.",
        challenges:
          "Me costó un poco mantener la dieta durante el fin de semana.",
        achievements:
          "Logré completar todos los entrenamientos programados y mejoré mi PR en sentadillas.",
      },
    },
    {
      id: "2",
      date: "2025-10-06",
      type: "checkin",
      answers: {
        weight: 83.0,
        energy: 3,
        sleep: 4,
        stress: 3,
        mood: 3,
        progress: "Semana normal, avanzando constantemente.",
        challenges: "Tuve mucho trabajo y me sentí cansado algunos días.",
        achievements: "Mantuve la consistencia a pesar de la carga de trabajo.",
      },
    },
    {
      id: "3",
      date: "2025-09-29",
      type: "checkin",
      answers: {
        weight: 83.5,
        energy: 4,
        sleep: 4,
        stress: 2,
        mood: 5,
        progress: "Excelente semana, me siento muy motivado.",
        challenges: "Ningún reto significativo.",
        achievements:
          "Completé todas las sesiones y mejoré mi técnica en peso muerto.",
      },
    },
  ];

  // OLD Mock data - now replaced by API
  const mockHabitResponses_OLD: any[] = [
    {
      id: "1",
      date: "2025-10-15",
      type: "habit",
      answers: {
        steps: 12500,
        sleep_hours: 7.5,
        water: 8,
      },
    },
    {
      id: "2",
      date: "2025-10-14",
      type: "habit",
      answers: {
        steps: 10200,
        sleep_hours: 7,
        water: 7,
      },
    },
    {
      id: "3",
      date: "2025-10-13",
      type: "habit",
      answers: {
        steps: 9800,
        sleep_hours: 6.5,
        water: 6,
      },
    },
  ];

  const renderRatingInput = () => {
    return (
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            type="button"
          >
            <Icon
              className="text-gray-300 hover:text-yellow-400"
              icon="solar:star-linear"
              width={28}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs de tipos de formularios */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Tabs
          classNames={{
            tabList: "px-6",
            cursor: "bg-blue-600",
            tab: "h-12",
            tabContent: "group-data-[selected=true]:text-blue-600",
          }}
          selectedKey={selectedFormType}
          variant="underlined"
          onSelectionChange={(key) =>
            setSelectedFormType(key as "checkins" | "habits")
          }
        >
          <Tab
            key="checkins"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:clipboard-check-bold" width={18} />
                <span className="font-medium">Check-ins Semanales</span>
              </div>
            }
          />
          <Tab
            key="habits"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:calendar-mark-bold" width={18} />
                <span className="font-medium">Hábitos Diarios</span>
              </div>
            }
          />
        </Tabs>
      </div>

      {/* Sub-tabs: Respuestas vs Configuración */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Tabs
          classNames={{
            tabList: "px-6",
            cursor: "bg-blue-600",
            tab: "h-12",
            tabContent: "group-data-[selected=true]:text-blue-600",
          }}
          selectedKey={selectedView}
          variant="underlined"
          onSelectionChange={(key) => setSelectedView(key as string)}
        >
          <Tab
            key="responses"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:document-text-bold" width={18} />
                <span className="font-medium">Respuestas</span>
              </div>
            }
          />
          <Tab
            key="configuration"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:settings-bold" width={18} />
                <span className="font-medium">Configuración</span>
              </div>
            }
          />
        </Tabs>
      </div>

      {/* RESPUESTAS VIEW */}
      {selectedView === "responses" && (
        <div className="space-y-4">
          {/* Loading state */}
          {isLoadingResponses && (
            <div className="flex justify-center items-center p-12">
              <Spinner label="Cargando respuestas..." size="lg" />
            </div>
          )}

          {/* Lista de respuestas */}
          {!isLoadingResponses &&
            displayResponses.map((response) => {
              const isExpanded = expandedResponse === response.id;
              const questions =
                selectedFormType === "checkins"
                  ? checkinQuestions
                  : habitQuestions;
              const formattedDate = new Date(
                response.date + "T12:00:00"
              ).toLocaleDateString("es-ES", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              });

              return (
                <Card
                  key={response.id}
                  className="bg-white border border-gray-200 shadow-sm"
                >
                  <CardBody className="p-0">
                    <details
                      open={isExpanded}
                      onToggle={(e) => {
                        const details = e.currentTarget as HTMLDetailsElement;

                        setExpandedResponse(details.open ? response.id : null);
                      }}
                    >
                      <summary className="cursor-pointer list-none p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-50">
                              <Icon
                                className="text-blue-600"
                                icon={
                                  selectedFormType === "checkins"
                                    ? "solar:clipboard-check-bold"
                                    : "solar:calendar-mark-bold"
                                }
                                width={24}
                              />
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900 capitalize">
                                {formattedDate}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {selectedFormType === "checkins"
                                  ? "Check-in Semanal"
                                  : "Hábitos Diarios"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Chip
                              color="success"
                              size="sm"
                              startContent={
                                <Icon
                                  icon="solar:check-circle-bold"
                                  width={16}
                                />
                              }
                              variant="flat"
                            >
                              Completado
                            </Chip>
                            <Icon
                              className="text-gray-400"
                              icon={
                                isExpanded
                                  ? "solar:alt-arrow-up-linear"
                                  : "solar:alt-arrow-down-linear"
                              }
                              width={24}
                            />
                          </div>
                        </div>
                      </summary>

                      {/* Respuestas del formulario */}
                      <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-4">
                        {questions
                          .filter((q) => response.answers[q.id] !== undefined)
                          .map((question) => {
                            const answer = response.answers[question.id];

                            return (
                              <Card
                                key={question.id}
                                className="bg-gray-50 border border-gray-200"
                              >
                                <CardBody className="p-3">
                                  <div className="flex items-start gap-3">
                                    <div className="bg-white p-2 rounded-lg flex-shrink-0">
                                      <Icon
                                        className="text-gray-600"
                                        icon={question.icon}
                                        width={20}
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm font-semibold text-gray-700 mb-1">
                                        {question.label}
                                      </p>
                                      <div className="text-sm text-gray-900">
                                        {question.type === "rating" && (
                                          <div className="flex gap-1">
                                            {Array.from({ length: 5 }).map(
                                              (_, i) => (
                                                <Icon
                                                  key={i}
                                                  className={
                                                    i < (answer as number)
                                                      ? "text-yellow-400"
                                                      : "text-gray-300"
                                                  }
                                                  icon="solar:star-bold"
                                                  width={20}
                                                />
                                              )
                                            )}
                                            <span className="ml-2 font-semibold text-gray-700">
                                              {answer}/5
                                            </span>
                                          </div>
                                        )}
                                        {question.type === "number" && (
                                          <p className="font-semibold">
                                            {answer} {question.unit}
                                          </p>
                                        )}
                                        {question.type === "text" && (
                                          <p className="text-gray-800 whitespace-pre-line">
                                            {answer}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </CardBody>
                              </Card>
                            );
                          })}
                      </div>
                    </details>
                  </CardBody>
                </Card>
              );
            })}

          {/* Empty state */}
          {!isLoadingResponses && displayResponses.length === 0 && (
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardBody className="p-12">
                <div className="text-center">
                  <div className="bg-gray-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <Icon
                      className="text-gray-400 text-3xl"
                      icon="solar:document-text-linear"
                    />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Sin respuestas aún
                  </h3>
                  <p className="text-sm text-gray-500">
                    No hay respuestas registradas para este formulario
                  </p>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* CHECK-INS CONFIGURATION */}
      {selectedView === "configuration" && selectedFormType === "checkins" && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardBody className="p-6">
            {/* Loading state */}
            {isLoadingConfig && (
              <div className="flex justify-center items-center p-12">
                <Spinner label="Cargando configuración..." size="lg" />
              </div>
            )}

            {!isLoadingConfig && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Preguntas del Check-in Semanal
                    </h3>
                    <p className="text-sm text-gray-500">
                      Activa/desactiva preguntas y marca las obligatorias
                    </p>
                  </div>
                  <Chip
                    className="text-white"
                    color="primary"
                    size="lg"
                    variant="solid"
                  >
                    {enabledCheckinQuestions.length} preguntas activas
                  </Chip>
                </div>

                <div className="mb-4">
                  <Button
                    color="default"
                    startContent={
                      <Icon icon="solar:add-circle-bold" width={20} />
                    }
                    variant="bordered"
                    onPress={() => setIsAddQuestionModalOpen(true)}
                  >
                    Agregar Pregunta Personalizada
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {checkinQuestions.map((question) => (
                    <Card
                      key={question.id}
                      className={`border-2 transition-all ${
                        question.enabled
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <CardBody className="p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <div
                            className={`p-2 rounded-lg flex-shrink-0 ${
                              question.enabled ? "bg-blue-100" : "bg-gray-200"
                            }`}
                          >
                            <Icon
                              className={
                                question.enabled
                                  ? "text-blue-600"
                                  : "text-gray-400"
                              }
                              icon={question.icon}
                              width={20}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`text-sm font-bold mb-1 ${
                                  question.enabled
                                    ? "text-gray-900"
                                    : "text-gray-500"
                                }`}
                              >
                                {question.label}
                              </p>
                              {question.id.startsWith("custom_") && (
                                <button
                                  className="text-red-500 hover:text-red-700 transition-colors"
                                  title="Eliminar pregunta personalizada"
                                  onClick={() =>
                                    handleDeleteCustomQuestion(question.id)
                                  }
                                >
                                  <Icon
                                    icon="solar:trash-bin-trash-bold"
                                    width={16}
                                  />
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              {question.type === "rating" && (
                                <>
                                  <Icon icon="solar:star-bold" width={12} />
                                  <span>Escala 1-5</span>
                                </>
                              )}
                              {question.type === "number" && (
                                <>
                                  <Icon icon="solar:hashtag-bold" width={12} />
                                  <span>Número ({question.unit})</span>
                                </>
                              )}
                              {question.type === "text" && (
                                <>
                                  <Icon icon="solar:text-bold" width={12} />
                                  <span>Texto</span>
                                </>
                              )}
                              {question.type === "boolean" && (
                                <>
                                  <Icon
                                    icon="solar:check-circle-bold"
                                    width={12}
                                  />
                                  <span>Sí/No</span>
                                </>
                              )}
                              {question.type === "photo" && (
                                <>
                                  <Icon icon="solar:camera-bold" width={12} />
                                  <span>Foto</span>
                                </>
                              )}
                              {question.type === "group" && (
                                <>
                                  <Icon icon="solar:folder-bold" width={12} />
                                  <span>
                                    Grupo ({question.subQuestions?.length || 0}{" "}
                                    items)
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="flex gap-1 mt-1">
                              {question.conditionalOn && (
                                <Chip color="warning" size="sm" variant="flat">
                                  Condicional
                                </Chip>
                              )}
                              {question.id.startsWith("custom_") && (
                                <Chip
                                  color="secondary"
                                  size="sm"
                                  variant="flat"
                                >
                                  Personalizada
                                </Chip>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-blue-200">
                          <div className="flex items-center gap-2">
                            <Switch
                              classNames={{
                                wrapper:
                                  "group-data-[selected=true]:bg-blue-600 bg-gray-300",
                              }}
                              color="primary"
                              isSelected={question.enabled}
                              size="sm"
                              onValueChange={() =>
                                toggleCheckinQuestion(question.id)
                              }
                            />
                            <span className="text-xs font-semibold text-gray-700">
                              {question.enabled ? "Activa" : "Inactiva"}
                            </span>
                          </div>
                          {question.enabled && !question.conditionalOn && (
                            <div className="flex items-center gap-2">
                              <Switch
                                classNames={{
                                  wrapper:
                                    "group-data-[selected=true]:bg-blue-600 bg-gray-300",
                                }}
                                color="primary"
                                isSelected={question.required}
                                size="sm"
                                onValueChange={() =>
                                  toggleCheckinRequired(question.id)
                                }
                              />
                              <span
                                className={`text-xs font-semibold ${question.required ? "text-blue-700" : "text-gray-500"}`}
                              >
                                {question.required
                                  ? "★ Obligatorio"
                                  : "Opcional"}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Sub-preguntas dentro de la tarjeta */}
                        {question.type === "group" &&
                          question.enabled &&
                          question.subQuestions && (
                            <div className="mt-3 pt-3 border-t border-blue-200 space-y-2">
                              <p className="text-xs font-bold text-gray-700 mb-2">
                                Elementos del grupo:
                              </p>
                              {question.subQuestions.map((subQuestion) => (
                                <div
                                  key={subQuestion.id}
                                  className={`flex items-center gap-2 p-2 rounded-lg ${
                                    subQuestion.enabled
                                      ? "bg-blue-100"
                                      : "bg-gray-100"
                                  }`}
                                >
                                  <Icon
                                    className={
                                      subQuestion.enabled
                                        ? "text-blue-600"
                                        : "text-gray-400"
                                    }
                                    icon={subQuestion.icon}
                                    width={14}
                                  />
                                  <span
                                    className={`text-xs flex-1 ${
                                      subQuestion.enabled
                                        ? "text-gray-900"
                                        : "text-gray-500"
                                    }`}
                                  >
                                    {subQuestion.label}
                                  </span>
                                  <Switch
                                    classNames={{
                                      wrapper:
                                        "group-data-[selected=true]:bg-blue-600 bg-gray-300",
                                    }}
                                    color="primary"
                                    isSelected={subQuestion.enabled}
                                    size="sm"
                                    onValueChange={() =>
                                      toggleCheckinQuestion(
                                        subQuestion.id,
                                        question.id
                                      )
                                    }
                                  />
                                  {subQuestion.enabled && (
                                    <>
                                      <Switch
                                        classNames={{
                                          wrapper:
                                            "group-data-[selected=true]:bg-blue-600 bg-gray-300",
                                        }}
                                        color="primary"
                                        isSelected={subQuestion.required}
                                        size="sm"
                                        onValueChange={() =>
                                          toggleCheckinRequired(
                                            subQuestion.id,
                                            question.id
                                          )
                                        }
                                      />
                                      <span
                                        className={`text-xs font-semibold ${subQuestion.required ? "text-blue-700" : "text-gray-500"}`}
                                      >
                                        {subQuestion.required
                                          ? "★ Obligatorio"
                                          : "Opcional"}
                                      </span>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                      </CardBody>
                    </Card>
                  ))}
                </div>

                {/* Info Card */}
                <Card className="bg-blue-50 border border-blue-100 mt-6">
                  <CardBody className="p-4">
                    <div className="flex items-start gap-2">
                      <Icon
                        className="text-blue-600 mt-0.5 flex-shrink-0"
                        icon="solar:info-circle-bold"
                        width={18}
                      />
                      <div>
                        <p className="text-sm font-semibold text-blue-900 mb-1">
                          Frecuencia del Check-in
                        </p>
                        <p className="text-sm text-blue-700">
                          Este formulario se enviará automáticamente cada
                          semana. El cliente recibirá una notificación para
                          completarlo.
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6">
                  <Button
                    className="text-white font-semibold"
                    color="primary"
                    isLoading={isSavingConfig}
                    startContent={
                      !isSavingConfig && (
                        <Icon icon="solar:diskette-bold" width={18} />
                      )
                    }
                    onPress={handleSaveConfiguration}
                  >
                    {isSavingConfig ? "Guardando..." : "Guardar Configuración"}
                  </Button>
                  <Button
                    startContent={<Icon icon="solar:eye-linear" width={18} />}
                    variant="bordered"
                    onPress={() => setIsPreviewModalOpen(true)}
                  >
                    Vista Previa del Formulario
                  </Button>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {/* HABITS CONFIGURATION */}
      {selectedView === "configuration" && selectedFormType === "habits" && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardBody className="p-6">
            {/* Loading state */}
            {isLoadingConfig && (
              <div className="flex justify-center items-center p-12">
                <Spinner label="Cargando configuración..." size="lg" />
              </div>
            )}

            {!isLoadingConfig && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Métricas de Hábitos Diarios
                    </h3>
                    <p className="text-sm text-gray-500">
                      Activa/desactiva métricas y marca las obligatorias
                    </p>
                  </div>
                  <Chip
                    className="text-white"
                    color="primary"
                    size="lg"
                    variant="solid"
                  >
                    {enabledHabitQuestions.length} métricas activas
                  </Chip>
                </div>

                <div className="mb-4">
                  <Button
                    color="default"
                    startContent={
                      <Icon icon="solar:add-circle-bold" width={20} />
                    }
                    variant="bordered"
                    onPress={() => setIsAddQuestionModalOpen(true)}
                  >
                    Agregar Pregunta Personalizada
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {habitQuestions.map((question) => (
                    <Card
                      key={question.id}
                      className={`border-2 transition-all ${
                        question.enabled
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <CardBody className="p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <div
                            className={`p-2 rounded-lg flex-shrink-0 ${
                              question.enabled ? "bg-blue-100" : "bg-gray-200"
                            }`}
                          >
                            <Icon
                              className={
                                question.enabled
                                  ? "text-blue-600"
                                  : "text-gray-400"
                              }
                              icon={question.icon}
                              width={20}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`text-sm font-bold mb-1 ${
                                  question.enabled
                                    ? "text-gray-900"
                                    : "text-gray-500"
                                }`}
                              >
                                {question.label}
                              </p>
                              {question.id.startsWith("custom_") && (
                                <button
                                  className="text-red-500 hover:text-red-700 transition-colors"
                                  title="Eliminar pregunta personalizada"
                                  onClick={() =>
                                    handleDeleteCustomQuestion(question.id)
                                  }
                                >
                                  <Icon
                                    icon="solar:trash-bin-trash-bold"
                                    width={16}
                                  />
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              {question.type === "rating" && (
                                <>
                                  <Icon icon="solar:star-bold" width={12} />
                                  <span>Escala 1-5</span>
                                </>
                              )}
                              {question.type === "number" && (
                                <>
                                  <Icon icon="solar:hashtag-bold" width={12} />
                                  <span>Número ({question.unit})</span>
                                </>
                              )}
                              {question.type === "text" && (
                                <>
                                  <Icon icon="solar:text-bold" width={12} />
                                  <span>Texto</span>
                                </>
                              )}
                              {question.type === "boolean" && (
                                <>
                                  <Icon
                                    icon="solar:check-circle-bold"
                                    width={12}
                                  />
                                  <span>Sí/No</span>
                                </>
                              )}
                              {question.type === "group" && (
                                <>
                                  <Icon icon="solar:folder-bold" width={12} />
                                  <span>
                                    Grupo ({question.subQuestions?.length || 0}{" "}
                                    items)
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="flex gap-1 mt-1">
                              {question.conditionalOn && (
                                <Chip color="warning" size="sm" variant="flat">
                                  Condicional
                                </Chip>
                              )}
                              {question.id.startsWith("custom_") && (
                                <Chip
                                  color="secondary"
                                  size="sm"
                                  variant="flat"
                                >
                                  Personalizada
                                </Chip>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-blue-200">
                          <div className="flex items-center gap-2">
                            <Switch
                              classNames={{
                                wrapper:
                                  "group-data-[selected=true]:bg-blue-600 bg-gray-300",
                              }}
                              color="primary"
                              isSelected={question.enabled}
                              size="sm"
                              onValueChange={() =>
                                toggleHabitQuestion(question.id)
                              }
                            />
                            <span className="text-xs font-semibold text-gray-700">
                              {question.enabled ? "Activa" : "Inactiva"}
                            </span>
                          </div>
                          {question.enabled && !question.conditionalOn && (
                            <div className="flex items-center gap-2">
                              <Switch
                                classNames={{
                                  wrapper:
                                    "group-data-[selected=true]:bg-blue-600 bg-gray-300",
                                }}
                                color="primary"
                                isSelected={question.required}
                                size="sm"
                                onValueChange={() =>
                                  toggleHabitRequired(question.id)
                                }
                              />
                              <span
                                className={`text-xs font-semibold ${question.required ? "text-blue-700" : "text-gray-500"}`}
                              >
                                {question.required
                                  ? "★ Obligatorio"
                                  : "Opcional"}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Sub-preguntas dentro de la tarjeta */}
                        {question.type === "group" &&
                          question.enabled &&
                          question.subQuestions && (
                            <div className="mt-3 pt-3 border-t border-blue-200 space-y-2">
                              <p className="text-xs font-bold text-gray-700 mb-2">
                                Elementos del grupo:
                              </p>
                              {question.subQuestions.map((subQuestion) => (
                                <div
                                  key={subQuestion.id}
                                  className={`flex items-center gap-2 p-2 rounded-lg ${
                                    subQuestion.enabled
                                      ? "bg-blue-100"
                                      : "bg-gray-100"
                                  }`}
                                >
                                  <Icon
                                    className={
                                      subQuestion.enabled
                                        ? "text-blue-600"
                                        : "text-gray-400"
                                    }
                                    icon={subQuestion.icon}
                                    width={14}
                                  />
                                  <span
                                    className={`text-xs flex-1 ${
                                      subQuestion.enabled
                                        ? "text-gray-900"
                                        : "text-gray-500"
                                    }`}
                                  >
                                    {subQuestion.label}
                                  </span>
                                  <Switch
                                    classNames={{
                                      wrapper:
                                        "group-data-[selected=true]:bg-blue-600 bg-gray-300",
                                    }}
                                    color="primary"
                                    isSelected={subQuestion.enabled}
                                    size="sm"
                                    onValueChange={() =>
                                      toggleHabitQuestion(
                                        subQuestion.id,
                                        question.id
                                      )
                                    }
                                  />
                                  {subQuestion.enabled && (
                                    <>
                                      <Switch
                                        classNames={{
                                          wrapper:
                                            "group-data-[selected=true]:bg-blue-600 bg-gray-300",
                                        }}
                                        color="primary"
                                        isSelected={subQuestion.required}
                                        size="sm"
                                        onValueChange={() =>
                                          toggleHabitRequired(
                                            subQuestion.id,
                                            question.id
                                          )
                                        }
                                      />
                                      <span
                                        className={`text-xs font-semibold ${subQuestion.required ? "text-blue-700" : "text-gray-500"}`}
                                      >
                                        {subQuestion.required
                                          ? "★ Obligatorio"
                                          : "Opcional"}
                                      </span>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                      </CardBody>
                    </Card>
                  ))}
                </div>

                {/* Info Card */}
                <Card className="bg-blue-50 border border-blue-100 mt-6">
                  <CardBody className="p-4">
                    <div className="flex items-start gap-2">
                      <Icon
                        className="text-blue-600 mt-0.5 flex-shrink-0"
                        icon="solar:info-circle-bold"
                        width={18}
                      />
                      <div>
                        <p className="text-sm font-semibold text-blue-900 mb-1">
                          Seguimiento Diario
                        </p>
                        <p className="text-sm text-blue-700">
                          Estas métricas se pueden registrar todos los días. El
                          cliente puede completarlas cuando lo desee.
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6">
                  <Button
                    className="text-white font-semibold"
                    color="primary"
                    isLoading={isSavingConfig}
                    startContent={
                      !isSavingConfig && (
                        <Icon icon="solar:diskette-bold" width={18} />
                      )
                    }
                    onPress={handleSaveConfiguration}
                  >
                    {isSavingConfig ? "Guardando..." : "Guardar Configuración"}
                  </Button>
                  <Button
                    startContent={<Icon icon="solar:eye-linear" width={18} />}
                    variant="bordered"
                    onPress={() => setIsPreviewModalOpen(true)}
                  >
                    Vista Previa del Formulario
                  </Button>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {/* Preview Modal */}
      <Modal
        classNames={{
          base: "max-h-[90vh]",
          header: "border-b border-gray-200",
          body: "py-6",
          footer: "border-t border-gray-200",
        }}
        isOpen={isPreviewModalOpen}
        scrollBehavior="inside"
        size="3xl"
        onClose={() => setIsPreviewModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Icon
                  className="text-blue-600"
                  icon={
                    selectedFormType === "checkins"
                      ? "solar:clipboard-check-bold"
                      : "solar:calendar-mark-bold"
                  }
                  width={24}
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Vista Previa:{" "}
                  {selectedFormType === "checkins"
                    ? "Check-in Semanal"
                    : "Hábitos Diarios"}
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  Así verá el cliente el formulario
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-6">
              {/* Client View Header */}
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardBody className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon
                      className="text-blue-600"
                      icon="solar:info-circle-bold"
                      width={20}
                    />
                    <div>
                      <p className="text-sm font-semibold mb-1 text-blue-900">
                        {selectedFormType === "checkins"
                          ? "Check-in Semanal"
                          : "Registro de Hábitos"}
                      </p>
                      <p className="text-sm text-blue-700">
                        {selectedFormType === "checkins"
                          ? "Completa este formulario para que tu entrenador pueda hacer seguimiento de tu progreso."
                          : "Registra tus hábitos diarios para mantener un seguimiento constante."}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Form Questions */}
              {(selectedFormType === "checkins"
                ? enabledCheckinQuestions
                : enabledHabitQuestions
              ).map((question) => (
                <Card
                  key={question.id}
                  className="bg-white border border-gray-200"
                >
                  <CardBody className="p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="bg-gray-100 p-2 rounded-lg flex-shrink-0">
                        <Icon
                          className="text-gray-600"
                          icon={question.icon}
                          width={20}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900 mb-1">
                          {question.label}
                        </p>
                        <p className="text-xs text-gray-500">
                          {question.type === "rating" && "Califica del 1 al 5"}
                          {question.type === "number" &&
                            `Ingresa el valor en ${question.unit}`}
                          {question.type === "text" &&
                            "Escribe tus comentarios"}
                          {question.type === "boolean" && "Selecciona Sí o No"}
                          {question.type === "photo" && "Sube una foto"}
                        </p>
                      </div>
                    </div>

                    {/* Input based on question type */}
                    <div className="ml-14">
                      {question.type === "rating" && renderRatingInput()}
                      {question.type === "number" && (
                        <Input
                          classNames={{
                            input: "text-base",
                          }}
                          endContent={
                            <span className="text-sm text-gray-400">
                              {question.unit}
                            </span>
                          }
                          placeholder={`Ej: 75`}
                          type="number"
                        />
                      )}
                      {question.type === "text" && (
                        <Textarea
                          classNames={{
                            input: "text-base",
                          }}
                          minRows={3}
                          placeholder="Escribe aquí..."
                        />
                      )}
                      {question.type === "boolean" && (
                        <div className="flex gap-3">
                          <Button
                            className="flex-1"
                            color="success"
                            startContent={
                              <Icon icon="solar:check-circle-bold" width={20} />
                            }
                            variant="flat"
                          >
                            Sí
                          </Button>
                          <Button
                            className="flex-1"
                            color="danger"
                            startContent={
                              <Icon icon="solar:close-circle-bold" width={20} />
                            }
                            variant="flat"
                          >
                            No
                          </Button>
                        </div>
                      )}
                      {question.type === "photo" && (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <Icon
                            className="text-gray-400 mx-auto mb-2"
                            icon="solar:camera-bold"
                            width={32}
                          />
                          <p className="text-sm text-gray-500">
                            Toca para subir una foto
                          </p>
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              ))}

              {/* Submit Button Preview */}
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
                <CardBody className="p-4">
                  <Button
                    className="w-full text-white font-semibold"
                    color="primary"
                    size="lg"
                    startContent={
                      <Icon icon="solar:check-circle-bold" width={20} />
                    }
                  >
                    Enviar Formulario
                  </Button>
                </CardBody>
              </Card>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => setIsPreviewModalOpen(false)}
            >
              Cerrar Vista Previa
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Custom Question Modal */}
      <Modal
        isOpen={isAddQuestionModalOpen}
        scrollBehavior="inside"
        size="2xl"
        onClose={() => setIsAddQuestionModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Icon
                  className="text-blue-600"
                  icon="solar:add-circle-bold"
                  width={24}
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Agregar Pregunta Personalizada
                </h3>
                <p className="text-sm text-gray-500 font-normal">
                  Crea una nueva pregunta para el formulario
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                description="Nombre corto de la pregunta"
                label="Etiqueta"
                placeholder="Ej: Mi Pregunta"
                value={newQuestion.label}
                onChange={(e) =>
                  setNewQuestion({ ...newQuestion, label: e.target.value })
                }
              />
              <Textarea
                description="Texto completo que verá el cliente"
                label="Pregunta Completa"
                minRows={2}
                placeholder="Ej: ¿Cuál es tu respuesta a esta pregunta?"
                value={newQuestion.fullQuestion}
                onChange={(e) =>
                  setNewQuestion({
                    ...newQuestion,
                    fullQuestion: e.target.value,
                  })
                }
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="text-sm font-medium text-gray-700 mb-2 block"
                    htmlFor="question-type"
                  >
                    Tipo de Pregunta
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    id="question-type"
                    value={newQuestion.type}
                    onChange={(e) =>
                      setNewQuestion({
                        ...newQuestion,
                        type: e.target.value as any,
                      })
                    }
                  >
                    <option value="text">Texto</option>
                    <option value="number">Número</option>
                    <option value="rating">Calificación (1-5)</option>
                    <option value="boolean">Sí/No</option>
                  </select>
                </div>
                <Input
                  description="Para preguntas numéricas"
                  isDisabled={newQuestion.type !== "number"}
                  label="Unidad (opcional)"
                  placeholder="Ej: kg, cm, horas"
                  value={newQuestion.unit}
                  onChange={(e) =>
                    setNewQuestion({ ...newQuestion, unit: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-4">
                <Switch
                  isSelected={newQuestion.enabled}
                  size="sm"
                  onValueChange={(val) =>
                    setNewQuestion({ ...newQuestion, enabled: val })
                  }
                >
                  <span className="text-sm">Pregunta activa</span>
                </Switch>
                <Switch
                  isSelected={newQuestion.required}
                  size="sm"
                  onValueChange={(val) =>
                    setNewQuestion({ ...newQuestion, required: val })
                  }
                >
                  <span className="text-sm">Obligatoria</span>
                </Switch>
              </div>
              <Card className="bg-blue-50 border border-blue-200">
                <CardBody className="p-3">
                  <div className="flex items-start gap-2">
                    <Icon
                      className="text-blue-600 mt-0.5"
                      icon="solar:info-circle-bold"
                      width={18}
                    />
                    <div>
                      <p className="text-sm font-semibold text-blue-900">
                        Pregunta personalizada
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Esta pregunta será única para este cliente. Podrás
                        editarla o eliminarla después de guardar.
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
              onPress={() => {
                setIsAddQuestionModalOpen(false);
                setNewQuestion({
                  label: "",
                  fullQuestion: "",
                  type: "text",
                  unit: "",
                  enabled: true,
                  required: false,
                });
              }}
            >
              Cancelar
            </Button>
            <Button
              className="text-white"
              color="primary"
              isDisabled={!newQuestion.label || !newQuestion.fullQuestion}
              onPress={handleAddCustomQuestion}
            >
              Agregar Pregunta
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

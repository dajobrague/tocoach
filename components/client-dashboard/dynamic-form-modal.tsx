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
  Textarea,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  QuestionConfig,
  FormPage,
  FormConfigData,
  isStructuredConfig,
  normalizeFormConfig,
} from "@/lib/forms/types";

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
  const [hasNeatCards, setHasNeatCards] = useState(true);
  const [uploadingPhotos, setUploadingPhotos] = useState<Set<string>>(
    new Set()
  );
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Upload a photo for a question and store the URL in answers
  const handlePhotoUpload = useCallback(
    async (questionId: string, file: File) => {
      setUploadingPhotos((prev) => new Set(prev).add(questionId));

      try {
        const fd = new FormData();

        fd.append("file", file);
        fd.append("question_id", questionId);
        fd.append("form_type", formType);

        const res = await fetch("/api/forms/upload-photo", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();

        if (data.success && data.url) {
          setAnswers((prev) => ({ ...prev, [questionId]: data.url }));
          // Clear any error
          setErrors((prev) => {
            const next = { ...prev };

            delete next[questionId];

            return next;
          });
        } else {
          addToast({
            title: "Error al subir foto",
            description: data.error || "No se pudo subir la imagen",
            color: "danger",
          });
        }
      } catch (err) {
        console.error("Photo upload error:", err);
        addToast({
          title: "Error de conexión",
          description: "No se pudo subir la imagen",
          color: "danger",
        });
      } finally {
        setUploadingPhotos((prev) => {
          const next = new Set(prev);

          next.delete(questionId);

          return next;
        });
      }
    },
    [formType]
  );

  const triggerFileInput = (questionId: string) => {
    fileInputRefs.current[questionId]?.click();
  };

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

  const [configError, setConfigError] = useState<string | null>(null);
  const [pages, setPages] = useState<FormPage[]>([]);

  const fetchFormConfig = async () => {
    setIsLoading(true);
    setConfigError(null);
    try {
      const response = await fetch(
        `/api/forms/configs/${clientId}?form_type=${formType}`
      );
      const data = await response.json();

      if (data.success && data.config) {
        const raw = data.config.questions_config;

        // Normalize into structured format
        const structured: FormConfigData = isStructuredConfig(raw)
          ? raw
          : normalizeFormConfig(Array.isArray(raw) ? raw : []);

        // Filter to only enabled questions
        let enabledQuestions = structured.questions.filter(
          (q: QuestionConfig) => q.enabled
        );

        // For habits form, filter out steps question if client has no NEAT cards
        if (formType === "habits" && !hasNeatCards) {
          enabledQuestions = enabledQuestions.filter(
            (q: QuestionConfig) => q.id !== "steps" && q.id !== "pasos"
          );
        }

        setQuestions(enabledQuestions);
        setPages(structured.pages.sort((a, b) => a.order - b.order));
      } else if (response.status === 404) {
        setConfigError(
          "Tu entrenador aún no ha configurado este formulario. Contacta con tu entrenador para activarlo."
        );
      } else {
        setConfigError(
          data.error || "Error al cargar la configuración del formulario."
        );
      }
    } catch (error) {
      console.error("Error fetching form config:", error);
      setConfigError("Error de conexión al cargar el formulario.");
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

  // Organize questions into sections based on pages
  const sections = (() => {
    if (
      pages.length > 1 ||
      (pages.length === 1 && pages[0]?.id !== "default")
    ) {
      // Structured format: group visible questions by page
      return pages
        .map((page) => ({
          title: page.title,
          icon: page.icon,
          questions: visibleQuestions.filter(
            (q) => (q.pageId || pages[0]?.id) === page.id
          ),
        }))
        .filter((section) => section.questions.length > 0);
    }

    // Legacy fallback: split into thirds
    return [
      {
        title:
          formType === "checkins" ? "Progreso y Logros" : "Energía y Bienestar",
        icon:
          formType === "checkins" ? "solar:cup-star-bold" : "solar:bolt-bold",
        questions: visibleQuestions.slice(
          0,
          Math.ceil(visibleQuestions.length / 3)
        ),
      },
      {
        title: formType === "checkins" ? "Desafíos y Metas" : "Nutrición",
        icon:
          formType === "checkins" ? "solar:target-bold" : "solar:plate-bold",
        questions: visibleQuestions.slice(
          Math.ceil(visibleQuestions.length / 3),
          Math.ceil((visibleQuestions.length * 2) / 3)
        ),
      },
      {
        title: formType === "checkins" ? "Mediciones" : "Descanso",
        icon:
          formType === "checkins"
            ? "solar:ruler-bold"
            : "solar:moon-sleep-bold",
        questions: visibleQuestions.slice(
          Math.ceil((visibleQuestions.length * 2) / 3)
        ),
      },
    ].filter((section) => section.questions.length > 0);
  })();

  const currentSection = sections[currentStep] || {
    title: "",
    icon: "",
    questions: [],
  };
  const totalSteps = sections.length;
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  const handleNext = () => {
    // Validate current section
    const currentErrors: Record<string, string> = {};

    currentSection.questions.forEach((question) => {
      if (question.required && !shouldShowQuestion(question)) return;

      if (question.type === "group" && question.subQuestions) {
        // Validate required sub-questions
        question.subQuestions
          .filter((sq) => sq.enabled && sq.required)
          .forEach((sq) => {
            if (
              answers[sq.id] === undefined ||
              answers[sq.id] === "" ||
              answers[sq.id] === null
            ) {
              currentErrors[sq.id] = "Este campo es obligatorio";
            }
          });
      } else if (
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
        if (onSuccess) onSuccess();
        setAnswers({});
        setCurrentStep(0);
        onClose();
        addToast({
          title: "Formulario enviado",
          description: "Tus respuestas se han guardado correctamente",
          color: "success",
        });
      } else {
        addToast({
          title: "Error",
          description: data.error || "Error al enviar formulario",
          color: "danger",
        });
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      addToast({
        title: "Error de conexión",
        description: "No se pudo enviar el formulario",
        color: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnswerChange = (id: string, value: any) => {
    if (isViewMode) return;
    setAnswers((prev) => ({ ...prev, [id]: value }));
    // Clear error on change
    if (errors[id]) {
      setErrors((prev) => {
        const next = { ...prev };

        delete next[id];

        return next;
      });
    }
  };

  // ── Render a single question input ────────────────────────────────
  const renderQuestionInput = (question: QuestionConfig) => {
    const value = answers[question.id];
    const error = errors[question.id];

    switch (question.type) {
      case "rating":
        return (
          <div className="space-y-2">
            <div className="flex justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  className="p-2 rounded-xl hover:bg-default-100 transition-all transform hover:scale-110"
                  disabled={isViewMode}
                  type="button"
                  onClick={() => handleAnswerChange(question.id, rating)}
                >
                  <Icon
                    className={`text-3xl transition-colors ${
                      value >= rating ? "text-warning" : "text-default-300"
                    }`}
                    icon="solar:star-bold"
                  />
                </button>
              ))}
            </div>
            {value && (
              <p className="text-center text-sm text-foreground/60 font-body">
                {value} de 5 estrellas
              </p>
            )}
          </div>
        );

      case "number":
        return (
          <Input
            classNames={{
              input: "text-lg font-body",
              inputWrapper: error
                ? "border-2 border-danger h-14"
                : "border-2 border-default-200 hover:border-primary/50 h-14",
            }}
            endContent={
              question.unit && (
                <span className="text-sm text-foreground/60 font-semibold">
                  {question.unit}
                </span>
              )
            }
            errorMessage={error}
            isInvalid={!!error}
            isReadOnly={isViewMode}
            placeholder="Ingresa el valor"
            step="0.1"
            type="number"
            value={value?.toString() || ""}
            onValueChange={(v) =>
              handleAnswerChange(question.id, v ? parseFloat(v) || v : "")
            }
          />
        );

      case "boolean":
        return (
          <div className="flex gap-3">
            <Button
              className={`flex-1 h-16 ${
                value === true
                  ? "bg-success text-white"
                  : "bg-default-100 text-foreground"
              }`}
              isDisabled={isViewMode}
              size="lg"
              startContent={
                <Icon className="text-2xl" icon="solar:check-circle-bold" />
              }
              onPress={() => handleAnswerChange(question.id, true)}
            >
              <span className="text-lg font-semibold">Sí</span>
            </Button>
            <Button
              className={`flex-1 h-16 ${
                value === false
                  ? "bg-danger text-white"
                  : "bg-default-100 text-foreground"
              }`}
              isDisabled={isViewMode}
              size="lg"
              startContent={
                <Icon className="text-2xl" icon="solar:close-circle-bold" />
              }
              onPress={() => handleAnswerChange(question.id, false)}
            >
              <span className="text-lg font-semibold">No</span>
            </Button>
          </div>
        );

      case "text":
        return (
          <Textarea
            classNames={{
              input: "text-base font-body",
              inputWrapper: error
                ? "border-2 border-danger"
                : "border-2 border-default-200 hover:border-primary/50",
            }}
            errorMessage={error}
            isInvalid={!!error}
            isReadOnly={isViewMode}
            minRows={3}
            placeholder="Escribe tu respuesta..."
            value={value || ""}
            onValueChange={(v) => handleAnswerChange(question.id, v)}
          />
        );

      case "photo": {
        const photoUrl = value as string | undefined;
        const isUploading = uploadingPhotos.has(question.id);

        return (
          <div className="space-y-3">
            {/* Hidden file input */}
            <input
              ref={(el) => {
                fileInputRefs.current[question.id] = el;
              }}
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0];

                if (f) handlePhotoUpload(question.id, f);
                e.target.value = ""; // Reset so same file can be re-selected
              }}
            />

            {/* Photo preview or upload area */}
            {photoUrl ? (
              <div className="relative rounded-xl overflow-hidden border-2 border-default-200">
                <Image
                  alt={question.label}
                  className="w-full h-48 object-cover"
                  height={192}
                  src={photoUrl}
                  width={384}
                />
                {!isViewMode && (
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                    <Button
                      className="text-white"
                      size="sm"
                      variant="flat"
                      onPress={() => triggerFileInput(question.id)}
                    >
                      <Icon icon="solar:camera-bold" width={16} />
                      Cambiar foto
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <button
                className="w-full border-2 border-dashed border-default-300 rounded-xl p-8 text-center hover:border-primary/50 hover:bg-default-50 transition-all disabled:opacity-50"
                disabled={isViewMode || isUploading}
                type="button"
                onClick={() => triggerFileInput(question.id)}
              >
                {isUploading ? (
                  <>
                    <Icon
                      className="text-primary mx-auto mb-3 animate-spin"
                      icon="solar:loading-linear"
                      width={40}
                    />
                    <p className="text-sm font-semibold text-foreground/60 font-body">
                      Subiendo foto...
                    </p>
                  </>
                ) : (
                  <>
                    <Icon
                      className="text-default-400 mx-auto mb-3"
                      icon="solar:camera-bold"
                      width={40}
                    />
                    <p className="text-sm font-semibold text-foreground font-body mb-1">
                      Toca para tomar o subir una foto
                    </p>
                    <p className="text-xs text-foreground/60 font-body">
                      PNG, JPG o WebP · Máx. 5MB
                    </p>
                  </>
                )}
              </button>
            )}
          </div>
        );
      }

      case "group":
        return (
          <div className="space-y-3">
            {question.subQuestions
              ?.filter((sq) => sq.enabled)
              .map((sub) => {
                if (!shouldShowQuestion(sub)) return null;
                const subValue = answers[sub.id];
                const subError = errors[sub.id];

                return (
                  <div
                    key={sub.id}
                    className="bg-default-50 border border-default-200 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-primary/10 p-1.5 rounded-lg flex-shrink-0">
                        <Icon
                          className="text-primary"
                          icon={sub.icon}
                          width={16}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground font-heading">
                          {sub.fullQuestion || sub.label}
                          {sub.required && !isViewMode && (
                            <span className="text-danger ml-1">*</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Sub-question input */}
                    {sub.type === "number" && (
                      <Input
                        classNames={{
                          input: "text-base font-body",
                          inputWrapper: subError
                            ? "border-2 border-danger"
                            : "border-2 border-default-200 hover:border-primary/50",
                        }}
                        endContent={
                          sub.unit && (
                            <span className="text-xs text-foreground/60 font-semibold">
                              {sub.unit}
                            </span>
                          )
                        }
                        errorMessage={subError}
                        isInvalid={!!subError}
                        isReadOnly={isViewMode}
                        placeholder="0"
                        step="0.1"
                        type="number"
                        value={subValue?.toString() || ""}
                        onValueChange={(v) =>
                          handleAnswerChange(
                            sub.id,
                            v ? parseFloat(v) || v : ""
                          )
                        }
                      />
                    )}
                    {sub.type === "text" && (
                      <Textarea
                        classNames={{
                          input: "text-sm font-body",
                          inputWrapper: subError
                            ? "border-2 border-danger"
                            : "border-2 border-default-200 hover:border-primary/50",
                        }}
                        errorMessage={subError}
                        isInvalid={!!subError}
                        isReadOnly={isViewMode}
                        minRows={2}
                        placeholder="Escribe aquí..."
                        value={subValue || ""}
                        onValueChange={(v) => handleAnswerChange(sub.id, v)}
                      />
                    )}
                    {sub.type === "boolean" && (
                      <div className="flex gap-2">
                        <Button
                          className={`flex-1 ${
                            subValue === true
                              ? "bg-success text-white"
                              : "bg-default-100 text-foreground"
                          }`}
                          isDisabled={isViewMode}
                          size="sm"
                          onPress={() => handleAnswerChange(sub.id, true)}
                        >
                          Sí
                        </Button>
                        <Button
                          className={`flex-1 ${
                            subValue === false
                              ? "bg-danger text-white"
                              : "bg-default-100 text-foreground"
                          }`}
                          isDisabled={isViewMode}
                          size="sm"
                          onPress={() => handleAnswerChange(sub.id, false)}
                        >
                          No
                        </Button>
                      </div>
                    )}
                    {sub.type === "rating" && (
                      <div className="flex justify-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((r) => (
                          <button
                            key={r}
                            className="p-1.5 rounded-lg hover:bg-default-100 transition-all"
                            disabled={isViewMode}
                            type="button"
                            onClick={() => handleAnswerChange(sub.id, r)}
                          >
                            <Icon
                              className={`text-xl ${
                                subValue >= r
                                  ? "text-warning"
                                  : "text-default-300"
                              }`}
                              icon="solar:star-bold"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    {sub.type === "photo" &&
                      (() => {
                        const subPhotoUrl = subValue as string | undefined;
                        const subIsUploading = uploadingPhotos.has(sub.id);

                        return (
                          <div className="space-y-2">
                            <input
                              ref={(el) => {
                                fileInputRefs.current[sub.id] = el;
                              }}
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              className="hidden"
                              type="file"
                              onChange={(e) => {
                                const f = e.target.files?.[0];

                                if (f) handlePhotoUpload(sub.id, f);
                                e.target.value = "";
                              }}
                            />
                            {subPhotoUrl ? (
                              <div className="relative rounded-lg overflow-hidden border border-default-200">
                                <Image
                                  alt={sub.label}
                                  className="w-full h-32 object-cover"
                                  height={128}
                                  src={subPhotoUrl}
                                  width={384}
                                />
                                {!isViewMode && (
                                  <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                                    <Button
                                      className="text-white"
                                      size="sm"
                                      variant="flat"
                                      onPress={() => triggerFileInput(sub.id)}
                                    >
                                      <Icon
                                        icon="solar:camera-bold"
                                        width={14}
                                      />
                                      Cambiar
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                className="w-full border-2 border-dashed border-default-300 rounded-lg p-4 text-center hover:border-primary/50 hover:bg-default-50 transition-all disabled:opacity-50"
                                disabled={isViewMode || subIsUploading}
                                type="button"
                                onClick={() => triggerFileInput(sub.id)}
                              >
                                {subIsUploading ? (
                                  <Icon
                                    className="text-primary mx-auto animate-spin"
                                    icon="solar:loading-linear"
                                    width={24}
                                  />
                                ) : (
                                  <>
                                    <Icon
                                      className="text-default-400 mx-auto mb-1"
                                      icon="solar:camera-bold"
                                      width={28}
                                    />
                                    <p className="text-xs text-foreground/60 font-body">
                                      Tomar o subir foto
                                    </p>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })()}

                    {subError && (
                      <p className="text-sm text-danger flex items-center gap-1 mt-1">
                        <Icon
                          className="text-base"
                          icon="solar:info-circle-bold"
                        />
                        {subError}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        );

      default:
        return (
          <p className="text-sm text-foreground/60 font-body">
            Tipo de pregunta no soportado
          </p>
        );
    }
  };

  // ── Main render ───────────────────────────────────────────────────
  return (
    <Modal
      classNames={{
        base: "max-h-[100vh] m-0",
        wrapper: "items-end sm:items-center",
        backdrop: "bg-black/80",
      }}
      hideCloseButton={isSubmitting}
      isDismissable={!isSubmitting}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="full"
      onClose={onClose}
    >
      <ModalContent>
        {(onModalClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 border-b border-default-200">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary">
                  <Icon
                    className="text-white text-2xl"
                    icon={
                      currentSection.icon ||
                      (formType === "checkins"
                        ? "solar:clipboard-check-bold"
                        : "solar:calendar-mark-bold")
                    }
                  />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold font-heading text-foreground">
                    {isViewMode
                      ? formType === "checkins"
                        ? "Seguimiento Semanal"
                        : "Registro Diario"
                      : currentSection.title || "Formulario"}
                    {isViewMode && <span className="text-success"> ✓</span>}
                  </h2>
                  <p className="text-sm text-foreground/60 font-normal font-body">
                    {isViewMode
                      ? `Enviado el ${new Date(existingResponseDate).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}`
                      : `Paso ${currentStep + 1} de ${totalSteps}`}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              {totalSteps > 1 && !isViewMode && (
                <div className="w-full h-1.5 bg-default-100 rounded-full overflow-hidden mt-4">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </ModalHeader>

            <ModalBody className="py-6">
              {isLoading ? (
                <div className="flex justify-center items-center p-12">
                  <div className="text-center">
                    <Icon
                      className="text-primary text-4xl animate-spin mx-auto mb-3"
                      icon="solar:loading-linear"
                      width={48}
                    />
                    <p className="text-sm text-foreground/60 font-body">
                      Cargando formulario...
                    </p>
                  </div>
                </div>
              ) : configError ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mb-4">
                    <Icon
                      className="text-warning text-3xl"
                      icon="solar:info-circle-bold"
                    />
                  </div>
                  <p className="text-sm text-foreground/60 font-body max-w-xs">
                    {configError}
                  </p>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto w-full space-y-6">
                  {(isViewMode
                    ? visibleQuestions
                    : currentSection.questions
                  ).map((question) => {
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
                                  {question.fullQuestion || question.label}
                                  {question.required && !isViewMode && (
                                    <span className="text-danger ml-1">*</span>
                                  )}
                                </h3>
                                {question.required && !isViewMode && (
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
                              {!isViewMode && question.type !== "group" && (
                                <p className="text-xs text-foreground/60 font-body">
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
                              {!isViewMode && question.type === "group" && (
                                <p className="text-xs text-foreground/60 font-body">
                                  {question.subQuestions?.filter(
                                    (sq) => sq.enabled
                                  ).length || 0}{" "}
                                  campos a completar
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            {renderQuestionInput(question)}

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

                  {currentSection.questions.length === 0 && !isViewMode && (
                    <div className="text-center p-6">
                      <Icon
                        className="text-success text-5xl mx-auto mb-3"
                        icon="solar:check-circle-bold"
                        width={64}
                      />
                      <p className="text-foreground/60 font-body">
                        ¡Todas las preguntas contestadas!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </ModalBody>

            <ModalFooter className="border-t border-default-200">
              {isViewMode ? (
                <div className="flex justify-end w-full">
                  <Button color="primary" onPress={onModalClose}>
                    Cerrar
                  </Button>
                </div>
              ) : (
                <div className="flex gap-3 w-full">
                  {currentStep > 0 && (
                    <Button
                      className="flex-1"
                      isDisabled={isSubmitting}
                      size="lg"
                      startContent={
                        <Icon
                          className="text-xl"
                          icon="solar:alt-arrow-left-bold"
                        />
                      }
                      variant="bordered"
                      onPress={handleBack}
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
                      isDisabled={isSubmitting}
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
                        !isSubmitting && (
                          <Icon
                            className="text-xl"
                            icon="solar:check-circle-bold"
                          />
                        )
                      }
                      isDisabled={isSubmitting}
                      isLoading={isSubmitting}
                      size="lg"
                      onPress={handleNext}
                    >
                      {isSubmitting ? "Enviando..." : "Enviar"}
                    </Button>
                  )}
                </div>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

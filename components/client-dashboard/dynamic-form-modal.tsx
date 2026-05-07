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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { clientFetch } from "@/lib/auth/client-token-storage";
import { getLocalTodayYmd } from "@/lib/forms/client-helpers";
import { shouldShowQuestion as sharedShouldShowQuestion } from "@/lib/forms/conditional";
import { getScheduleOrDefault } from "@/lib/forms/schedule";
import { isEmptyAnswer } from "@/lib/forms/validation";
import {
  QuestionConfig,
  FormPage,
  FormConfigData,
  hasStructuredPages,
  isStructuredConfig,
  normalizeFormConfig,
  type CheckInSchedule,
} from "@/lib/forms/types";

interface DynamicFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  formType: "checkins" | "habits";
  /** Resolved from dashboard; merged with API schedule when modal opens. */
  schedule?: CheckInSchedule | null;
  /**
   * Callback que el modal invoca tras un submit exitoso. Soporta
   * versión async — el modal espera a que termine ANTES de cerrarse,
   * para que el padre tenga tiempo de invalidar/refetchear sus
   * queries. Si esto fuera fire-and-forget, el cliente cerraba la app
   * antes de que el refetch llegara y al volver veía datos viejos.
   */
  onSuccess?: () => void | Promise<void>;
  /** YYYY-MM-DD date to fill/edit. Defaults to today when omitted. */
  targetDate?: string | undefined;
}

export function DynamicFormModal({
  isOpen,
  onClose,
  clientId,
  formType,
  schedule: scheduleProp,
  onSuccess,
  targetDate,
}: DynamicFormModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [questions, setQuestions] = useState<QuestionConfig[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
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

        const res = await clientFetch("/api/forms/upload-photo", {
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
  }, [isOpen, clientId, formType, targetDate]);

  const checkNeatCards = async () => {
    try {
      const response = await clientFetch("/api/client/neat");
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
      // `getLocalTodayYmd` usa el huso local del navegador. Con
      // `new Date().toISOString()` un cliente en LATAM a las 22h local queda
      // buscando "el día de mañana" en UTC y no encontraba el registro
      // recién enviado.
      const dateToCheck = targetDate || getLocalTodayYmd();
      const response = await clientFetch(
        `/api/forms/responses/${clientId}?form_type=${formType}&start_date=${dateToCheck}&end_date=${dateToCheck}`
      );
      const data = await response.json();

      if (data.success && data.responses && data.responses.length > 0) {
        const existingResponse = data.responses[0];

        setAnswers(existingResponse.answers || {});
        setExistingResponseDate(existingResponse.response_date);

        // Both habits and check-in forms are editable when a response already
        // exists. This allows clients to update their answers during a coaching
        // call or if they need to correct a previous submission.
        setIsEditingExisting(true);
        setIsViewMode(false);
      } else {
        setIsEditingExisting(false);
        setIsViewMode(false);
        setAnswers({});
      }
    } catch (error) {
      console.error("Error checking existing response:", error);
      setIsEditingExisting(false);
      setIsViewMode(false);
    }
  };

  const [configError, setConfigError] = useState<string | null>(null);
  const [pages, setPages] = useState<FormPage[]>([]);
  const [fetchedCheckinSchedule, setFetchedCheckinSchedule] =
    useState<CheckInSchedule | null>(null);

  const effectiveCheckinSchedule = useMemo(() => {
    if (formType !== "checkins") {
      return null;
    }

    return getScheduleOrDefault(scheduleProp ?? fetchedCheckinSchedule ?? null);
  }, [formType, scheduleProp, fetchedCheckinSchedule]);

  const fetchFormConfig = async () => {
    setIsLoading(true);
    setConfigError(null);
    try {
      const response = await clientFetch(
        `/api/forms/configs/${clientId}?form_type=${formType}`
      );
      const data = await response.json();

      if (data.success && data.config) {
        if (formType === "checkins") {
          setFetchedCheckinSchedule(
            getScheduleOrDefault(data.schedule ?? null)
          );
        } else {
          setFetchedCheckinSchedule(null);
        }

        const raw = data.config.questions_config;

        // Normalize into structured format
        const structured: FormConfigData = isStructuredConfig(raw)
          ? raw
          : normalizeFormConfig(Array.isArray(raw) ? raw : []);

        // Filter to only enabled questions. NEAT-based filtering (steps
        // question for clients without NEAT cards) is NOT applied here —
        // `hasNeatCards` is resolved asynchronously and applying the filter
        // at fetch time would race (initial state is `true` so the filter
        // would become a no-op). Instead, we filter at render time in
        // `visibleQuestions` below, which re-runs whenever `hasNeatCards`
        // changes.
        const enabledQuestionsRaw = structured.questions.filter(
          (q: QuestionConfig) => q.enabled
        );

        // Defensa contra padres condicionales desactivados: si un hijo tiene
        // `conditionalOn` apuntando a una pregunta que el trainer desactivó
        // (o eliminó), el fallback `Boolean(undefined)` del matcher dejaría
        // al hijo permanentemente oculto — aunque el trainer lo vea como
        // enabled en el editor. Despojamos la condición en memoria (no
        // mutamos el config guardado) para que el hijo se muestre como
        // incondicional. El mismo patrón se aplica a subquestions dentro
        // de grupos.
        const enabledMainIds = new Set(enabledQuestionsRaw.map((q) => q.id));
        const stripOrphanConditional = (
          q: QuestionConfig,
          allowedParentIds: Set<string>
        ): QuestionConfig => {
          if (!q.conditionalOn) return q;
          if (allowedParentIds.has(q.conditionalOn)) return q;

          // Copia shallow y retiramos la condición. `delete` es seguro porque
          // ambas keys son opcionales en `QuestionConfig` (ver
          // `exactOptionalPropertyTypes: true` en tsconfig).
          const cleaned: QuestionConfig = { ...q };

          delete cleaned.conditionalOn;
          delete cleaned.conditionalValue;

          return cleaned;
        };

        const enabledQuestions = enabledQuestionsRaw.map((q) => {
          const normalized = stripOrphanConditional(q, enabledMainIds);

          if (normalized.type === "group" && normalized.subQuestions) {
            const enabledSubIds = new Set(
              normalized.subQuestions
                .filter((sq) => sq.enabled)
                .map((sq) => sq.id)
            );
            // Los hijos condicionales de un grupo pueden referenciar
            // subquestions hermanos O preguntas main — ambos son válidos.
            const subParentIds = new Set([...enabledMainIds, ...enabledSubIds]);
            const cleanedSubs = normalized.subQuestions.map((sq) =>
              stripOrphanConditional(sq, subParentIds)
            );

            return { ...normalized, subQuestions: cleanedSubs };
          }

          return normalized;
        });

        setQuestions(enabledQuestions);
        setPages(structured.pages.sort((a, b) => a.order - b.order));
      } else if (response.status === 404) {
        if (formType === "checkins") {
          setFetchedCheckinSchedule(getScheduleOrDefault(null));
        }

        setConfigError(
          "Tu entrenador aún no ha configurado este formulario. Contacta con tu entrenador para activarlo."
        );
      } else {
        if (formType === "checkins") {
          setFetchedCheckinSchedule(
            getScheduleOrDefault(data.schedule ?? null)
          );
        }

        setConfigError(
          data.error || "Error al cargar la configuración del formulario."
        );
      }
    } catch (error) {
      console.error("Error fetching form config:", error);
      if (formType === "checkins") {
        setFetchedCheckinSchedule(getScheduleOrDefault(null));
      }

      setConfigError("Error de conexión al cargar el formulario.");
    } finally {
      setIsLoading(false);
    }
  };

  // Delegado a lib/forms/conditional.ts para evitar divergencia con el
  // validador del servidor (ver `validateFormResponse`).
  const shouldShowQuestion = (question: QuestionConfig): boolean =>
    sharedShouldShowQuestion(question, answers);

  /**
   * Heurística para detectar la pregunta "de pasos" del formulario de hábitos.
   * Se usa para ocultarla cuando el cliente no tiene NEAT cards configuradas.
   *
   * Históricamente sólo se comprobaba `id === "steps" || id === "pasos"`, pero
   * trainers que renombran la pregunta (p.ej. `daily_steps`, `pasos_diarios`)
   * bypassaban el filtro. Ampliamos a label/unit/id-contains para atrapar más
   * casos sin falsos positivos evidentes. Mantenemos los ids canónicos como
   * match exacto por compatibilidad.
   */
  const isStepsQuestion = (q: QuestionConfig): boolean => {
    const id = q.id.toLowerCase();

    if (id === "steps" || id === "pasos") return true;
    if (id.includes("step") || id.includes("paso")) return true;
    if (q.unit && /^(pasos|steps)$/i.test(q.unit)) return true;

    return false;
  };

  // Get visible questions for current view. NEAT filter applies at render
  // time so it reacts to `hasNeatCards` resolving after mount.
  const visibleQuestions = questions.filter((q) => {
    if (!shouldShowQuestion(q)) return false;
    if (formType === "habits" && !hasNeatCards && isStepsQuestion(q)) {
      return false;
    }

    return true;
  });

  // Organize questions into sections based on pages
  const sections = (() => {
    if (hasStructuredPages(pages)) {
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

    // Legacy fallback: split into thirds.
    //
    // IMPORTANTE: el particionado se hace sobre la lista COMPLETA de preguntas
    // (incluyendo las que hoy están ocultas por condicionales), no sobre
    // `visibleQuestions`. Antes se slice-aba `visibleQuestions` directamente
    // y cuando un condicional activaba una pregunta su longitud cambiaba —
    // las preguntas "saltaban" de sección en vivo mientras el cliente
    // respondía.
    //
    // Con esta versión, cada pregunta queda asignada a una sección fija
    // (derivada de su posición en `questions`), y cada sección filtra
    // `visibleQuestions` para mostrar sólo las que pasan el condicional.
    // La asignación sección→pregunta es estable.
    const habitsTotal = questions.length;
    const firstCut = Math.ceil(habitsTotal / 3);
    const secondCut = Math.ceil((habitsTotal * 2) / 3);
    const idSection1 = new Set(questions.slice(0, firstCut).map((q) => q.id));
    const idSection2 = new Set(
      questions.slice(firstCut, secondCut).map((q) => q.id)
    );

    return [
      {
        title:
          formType === "checkins" ? "Progreso y Logros" : "Energía y Bienestar",
        icon:
          formType === "checkins" ? "solar:cup-star-bold" : "solar:bolt-bold",
        questions: visibleQuestions.filter((q) => idSection1.has(q.id)),
      },
      {
        title: formType === "checkins" ? "Desafíos y Metas" : "Nutrición",
        icon:
          formType === "checkins" ? "solar:target-bold" : "solar:plate-bold",
        questions: visibleQuestions.filter((q) => idSection2.has(q.id)),
      },
      {
        title: formType === "checkins" ? "Mediciones" : "Descanso",
        icon:
          formType === "checkins"
            ? "solar:ruler-bold"
            : "solar:moon-sleep-bold",
        questions: visibleQuestions.filter(
          (q) => !idSection1.has(q.id) && !idSection2.has(q.id)
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
            if (isEmptyAnswer(sq.type, answers[sq.id])) {
              currentErrors[sq.id] = "Este campo es obligatorio";
            }
          });
      } else if (
        question.required &&
        isEmptyAnswer(question.type, answers[question.id])
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
      const response = await clientFetch(`/api/forms/responses/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_type: formType,
          response_date: targetDate || getLocalTodayYmd(),
          answers,
          metadata: {
            submitted_from: "mobile",
            completion_time: new Date().toISOString(),
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Toast inmediato para feedback visible aunque el await del
        // refetch tarde 0.5–1s.
        addToast({
          title: isEditingExisting
            ? "Registro actualizado"
            : "Formulario enviado",
          description: isEditingExisting
            ? "Tus respuestas se han actualizado correctamente"
            : "Tus respuestas se han guardado correctamente",
          color: "success",
        });

        // Esperamos a que el padre termine sus invalidaciones/refetches
        // ANTES de cerrar el modal. Antes era fire-and-forget: si el
        // cliente cerraba la app o navegaba inmediatamente después del
        // submit, el refetch nunca terminaba y al volver veía las
        // gráficas con datos viejos. Si onSuccess falla (rare), no
        // tumbamos la UI — el form SÍ se guardó server-side; el cache
        // se refrescará por window-focus o el staleTime.
        if (onSuccess) {
          try {
            await onSuccess();
          } catch (err) {
            console.error(
              "[DynamicFormModal] post-save invalidation failed",
              err
            );
          }
        }

        setAnswers({});
        setCurrentStep(0);
        setIsEditingExisting(false);
        onClose();
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
              accept="image/*"
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
                    <div className="flex items-start gap-3 mb-3">
                      <div className="bg-primary/10 p-1.5 rounded-lg flex-shrink-0">
                        <Icon
                          className="text-primary"
                          icon={sub.icon}
                          width={16}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground font-heading leading-relaxed break-words">
                          {sub.label}
                          {sub.required && !isViewMode && (
                            <span className="text-danger ml-1">*</span>
                          )}
                        </p>
                        {sub.fullQuestion && sub.fullQuestion !== sub.label && (
                          <p className="text-xs text-foreground/60 font-body mt-0.5 break-words">
                            {sub.fullQuestion}
                          </p>
                        )}
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
                    {sub.type === "choice" &&
                      (() => {
                        const subChoices = sub.choices ?? [];
                        const subSelectedId =
                          typeof subValue === "string" ? subValue : null;
                        const subSelectedExists =
                          subSelectedId !== null &&
                          subChoices.some((c) => c.id === subSelectedId);

                        return (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              {subChoices.map((choice) => {
                                const isSelected = subSelectedId === choice.id;

                                return (
                                  <button
                                    key={choice.id}
                                    className={`min-h-12 rounded-lg border-2 px-2 py-1.5 flex flex-col items-center justify-center gap-0.5 transition-all text-xs font-semibold font-body ${
                                      isSelected
                                        ? "border-primary bg-primary text-white"
                                        : "border-default-200 bg-background text-foreground hover:border-primary/50"
                                    } ${isViewMode ? "cursor-default" : ""}`}
                                    disabled={isViewMode}
                                    type="button"
                                    onClick={() =>
                                      handleAnswerChange(sub.id, choice.id)
                                    }
                                  >
                                    {choice.icon && (
                                      <Icon
                                        className={`text-lg ${
                                          isSelected
                                            ? "text-white"
                                            : "text-primary"
                                        }`}
                                        icon={choice.icon}
                                      />
                                    )}
                                    <span className="text-center leading-tight">
                                      {choice.label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                            {subSelectedId !== null && !subSelectedExists && (
                              <div className="flex items-center gap-2 text-xs text-foreground/60 bg-default-100 rounded-lg px-2 py-1.5">
                                <Icon
                                  icon="solar:info-circle-linear"
                                  width={12}
                                />
                                <span>
                                  Respuesta original:{" "}
                                  <strong>opción eliminada</strong>
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    {sub.type === "multi_choice" &&
                      (() => {
                        const subChoices = sub.choices ?? [];
                        const subSelectedIds: string[] = Array.isArray(subValue)
                          ? subValue
                          : [];
                        const subMissingIds = subSelectedIds.filter(
                          (id) => !subChoices.some((c) => c.id === id)
                        );

                        return (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              {subChoices.map((choice) => {
                                const isSelected = subSelectedIds.includes(
                                  choice.id
                                );

                                return (
                                  <button
                                    key={choice.id}
                                    className={`min-h-12 rounded-lg border-2 px-2 py-1.5 flex flex-col items-center justify-center gap-0.5 transition-all text-xs font-semibold font-body relative ${
                                      isSelected
                                        ? "border-primary bg-primary text-white"
                                        : "border-default-200 bg-background text-foreground hover:border-primary/50"
                                    } ${isViewMode ? "cursor-default" : ""}`}
                                    disabled={isViewMode}
                                    type="button"
                                    onClick={() => {
                                      if (isViewMode) return;
                                      const next = isSelected
                                        ? subSelectedIds.filter(
                                            (id) => id !== choice.id
                                          )
                                        : [...subSelectedIds, choice.id];

                                      handleAnswerChange(sub.id, next);
                                    }}
                                  >
                                    {isSelected && (
                                      <Icon
                                        className="absolute top-0.5 right-0.5 text-white"
                                        icon="solar:check-circle-bold"
                                        width={12}
                                      />
                                    )}
                                    {choice.icon && (
                                      <Icon
                                        className={`text-lg ${
                                          isSelected
                                            ? "text-white"
                                            : "text-primary"
                                        }`}
                                        icon={choice.icon}
                                      />
                                    )}
                                    <span className="text-center leading-tight">
                                      {choice.label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                            {subMissingIds.length > 0 && (
                              <div className="flex items-center gap-2 text-xs text-foreground/60 bg-default-100 rounded-lg px-2 py-1.5">
                                <Icon
                                  icon="solar:info-circle-linear"
                                  width={12}
                                />
                                <span>
                                  {subMissingIds.length === 1
                                    ? "1 opción previamente seleccionada fue eliminada"
                                    : `${subMissingIds.length} opciones previamente seleccionadas fueron eliminadas`}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
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
                              accept="image/*"
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

      case "choice": {
        const choices = question.choices ?? [];
        const selectedId = typeof value === "string" ? value : null;
        const selectedExists =
          selectedId !== null && choices.some((c) => c.id === selectedId);

        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {choices.map((choice) => {
                const isSelected = selectedId === choice.id;

                return (
                  <button
                    key={choice.id}
                    className={`min-h-14 rounded-xl border-2 px-3 py-2 flex flex-col items-center justify-center gap-1 transition-all text-sm font-semibold font-body ${
                      isSelected
                        ? "border-primary bg-primary text-white"
                        : "border-default-200 bg-background text-foreground hover:border-primary/50"
                    } ${isViewMode ? "cursor-default" : ""}`}
                    disabled={isViewMode}
                    type="button"
                    onClick={() => handleAnswerChange(question.id, choice.id)}
                  >
                    {choice.icon && (
                      <Icon
                        className={`text-xl ${
                          isSelected ? "text-white" : "text-primary"
                        }`}
                        icon={choice.icon}
                      />
                    )}
                    <span className="text-center leading-tight">
                      {choice.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Historic fallback: stored id no longer exists in choices. */}
            {selectedId !== null && !selectedExists && (
              <div className="flex items-center gap-2 text-xs text-foreground/60 bg-default-100 rounded-lg px-3 py-2">
                <Icon icon="solar:info-circle-linear" width={14} />
                <span>
                  Respuesta original: <strong>opción eliminada</strong>
                </span>
              </div>
            )}
          </div>
        );
      }

      case "multi_choice": {
        const choices = question.choices ?? [];
        const selectedIds: string[] = Array.isArray(value) ? value : [];
        const missingIds = selectedIds.filter(
          (id) => !choices.some((c) => c.id === id)
        );

        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {choices.map((choice) => {
                const isSelected = selectedIds.includes(choice.id);

                return (
                  <button
                    key={choice.id}
                    className={`min-h-14 rounded-xl border-2 px-3 py-2 flex flex-col items-center justify-center gap-1 transition-all text-sm font-semibold font-body relative ${
                      isSelected
                        ? "border-primary bg-primary text-white"
                        : "border-default-200 bg-background text-foreground hover:border-primary/50"
                    } ${isViewMode ? "cursor-default" : ""}`}
                    disabled={isViewMode}
                    type="button"
                    onClick={() => {
                      if (isViewMode) return;
                      const next = isSelected
                        ? selectedIds.filter((id) => id !== choice.id)
                        : [...selectedIds, choice.id];

                      handleAnswerChange(question.id, next);
                    }}
                  >
                    {isSelected && (
                      <Icon
                        className="absolute top-1 right-1 text-white"
                        icon="solar:check-circle-bold"
                        width={14}
                      />
                    )}
                    {choice.icon && (
                      <Icon
                        className={`text-xl ${
                          isSelected ? "text-white" : "text-primary"
                        }`}
                        icon={choice.icon}
                      />
                    )}
                    <span className="text-center leading-tight">
                      {choice.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {missingIds.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-foreground/60 bg-default-100 rounded-lg px-3 py-2">
                <Icon icon="solar:info-circle-linear" width={14} />
                <span>
                  {missingIds.length === 1
                    ? "1 opción previamente seleccionada fue eliminada"
                    : `${missingIds.length} opciones previamente seleccionadas fueron eliminadas`}
                </span>
              </div>
            )}
          </div>
        );
      }

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
                        ? (effectiveCheckinSchedule?.custom_name ?? "Check-in")
                        : "Registro Diario"
                      : targetDate
                        ? `Registro del ${new Date(targetDate + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`
                        : currentSection.title || "Formulario"}
                    {isViewMode && <span className="text-success"> ✓</span>}
                  </h2>
                  <p className="text-sm text-foreground/60 font-normal font-body">
                    {isViewMode
                      ? `Enviado el ${new Date(existingResponseDate).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}`
                      : isEditingExisting
                        ? "Editando registro enviado"
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
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2 mb-1">
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-base font-bold text-foreground font-heading leading-relaxed break-words">
                                    {question.label}
                                    {question.required && !isViewMode && (
                                      <span className="text-danger ml-1">
                                        *
                                      </span>
                                    )}
                                  </h3>
                                  {question.fullQuestion &&
                                    question.fullQuestion !==
                                      question.label && (
                                      <p className="text-xs text-foreground/60 font-body mt-0.5 break-words">
                                        {question.fullQuestion}
                                      </p>
                                    )}
                                </div>
                                {question.required && !isViewMode && (
                                  <Chip
                                    className="h-5 flex-shrink-0"
                                    color="danger"
                                    size="sm"
                                    variant="flat"
                                  >
                                    Obligatorio
                                  </Chip>
                                )}
                              </div>
                              {!isViewMode &&
                                question.type !== "group" &&
                                (question.type === "rating" ||
                                  question.type === "number" ||
                                  question.type === "boolean") && (
                                  <p className="text-xs text-foreground/60 font-body">
                                    {question.type === "rating" &&
                                      "Califica del 1 al 5"}
                                    {question.type === "number" &&
                                      `Ingresa el valor${question.unit ? ` en ${question.unit}` : ""}`}
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
                      isDisabled={isSubmitting || uploadingPhotos.size > 0}
                      size="lg"
                      onPress={handleNext}
                    >
                      {uploadingPhotos.size > 0
                        ? "Subiendo fotos..."
                        : "Siguiente"}
                    </Button>
                  ) : (
                    <Button
                      className="flex-1 text-white"
                      color="success"
                      endContent={
                        !isSubmitting &&
                        uploadingPhotos.size === 0 && (
                          <Icon
                            className="text-xl"
                            icon="solar:check-circle-bold"
                          />
                        )
                      }
                      isDisabled={isSubmitting || uploadingPhotos.size > 0}
                      isLoading={isSubmitting}
                      size="lg"
                      onPress={handleNext}
                    >
                      {uploadingPhotos.size > 0
                        ? "Espera, subiendo fotos..."
                        : isSubmitting
                          ? isEditingExisting
                            ? "Actualizando..."
                            : "Enviando..."
                          : isEditingExisting
                            ? "Actualizar"
                            : "Enviar"}
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

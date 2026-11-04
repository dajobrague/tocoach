"use client";

import {
  Button,
  ModalContent,
  ModalFooter,
  addToast,
  closeToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  BigNumberInput,
  BooleanInput,
  ChoiceTiles,
  FIELD_ATTR,
  FieldError,
  FieldHint,
  NumberRow,
  PhotoTile,
  RatingInput,
  TextInput,
} from "@/components/client-dashboard/dynamic-form-fields";
import {
  ClientSheet,
  ClientSheetGrabber,
} from "@/components/client-dashboard/client-sheet";
import { IconTile } from "@/components/shared/icon-tile";
import { clearClientToken, clientFetch } from "@/lib/auth/client-token-storage";
import {
  clearFormResponseDraft,
  formResponseDraftStorageKey,
  readFormResponseDraft,
  writeFormResponseDraft,
} from "@/lib/client/checkin-draft";
import { getLocalTodayYmd } from "@/lib/forms/client-helpers";
import { shouldShowQuestion as sharedShouldShowQuestion } from "@/lib/forms/conditional";
// La heurística de pasos vive en lib/forms para que el server aplique la
// misma regla (relax del required cuando el cliente no tiene NEAT cards).
import { isStepsQuestion } from "@/lib/forms/neat-steps";
import { dropPagesNotDue } from "@/lib/forms/page-cadence";
import { getScheduleOrDefault } from "@/lib/forms/schedule";
import { isEmptyAnswer, numberRangeError } from "@/lib/forms/validation";
import { findWorkoutResponseForSession } from "@/lib/forms/workout";
import {
  QuestionConfig,
  FormPage,
  FormConfigData,
  hasStructuredPages,
  isStructuredConfig,
  normalizeFormConfig,
  type CheckInSchedule,
  type FormType,
} from "@/lib/forms/types";

interface DynamicFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  formType: FormType;
  /**
   * Metadatos extra del envío (se mezclan con los del modal). El post-entreno
   * manda aquí `session_id` para enlazar la respuesta a la sesión.
   */
  metadata?: Record<string, unknown> | undefined;
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
  metadata: extraMetadata,
}: DynamicFormModalProps) {
  const draftScope =
    typeof extraMetadata?.session_id === "string"
      ? extraMetadata.session_id
      : undefined;
  const [currentStep, setCurrentStep] = useState(0);
  // Sentido de la última navegación entre pasos: adelante desliza la
  // página hacia la izquierda, atrás hacia la derecha.
  const [direction, setDirection] = useState<1 | -1>(1);
  const [questions, setQuestions] = useState<QuestionConfig[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Mensaje de error del último intento de envío que NO mapea a ninguna
  // pregunta renderizada (sesión expirada, error de red, campo oculto…).
  // Se muestra inline en el footer — los toasts solos no bastan: si fallan
  // en renderizarse el cliente percibe "aprieto Enviar y no pasa nada".
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [, setExistingResponseDate] = useState<string>("");
  const [hasNeatCards, setHasNeatCards] = useState(true);
  const [uploadingPhotos, setUploadingPhotos] = useState<Set<string>>(
    new Set()
  );
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  // "Guardado" en la barra superior: el borrador local (sessionStorage) ya
  // tiene lo que el cliente tocó. Solo aplica a respuestas nuevas — al
  // editar una enviada no hay borrador.
  const [hasLocalDraft, setHasLocalDraft] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Solo la validación al pulsar Siguiente/Enviar lleva el scroll al primer
  // campo con error; limpiar un error mientras se escribe no debe moverlo.
  const scrollToErrorRef = useRef(false);

  // Upload a photo for a question and store the URL in answers.
  //
  // Bulletproofing:
  //  - 60s AbortController timeout — slow networks shouldn't hang.
  //  - On success, we write the URL to sessionStorage BEFORE setAnswers.
  //    If the user closes the modal between fetch resolution and React
  //    re-render (very real on slow phones), the URL still survives in
  //    the draft and is restored next time the modal opens.
  //  - AbortError due to timeout shows a specific toast; AbortError due
  //    to manual cancellation is silent.
  const handlePhotoUpload = useCallback(
    async (questionId: string, file: File) => {
      setUploadingPhotos((prev) => new Set(prev).add(questionId));
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort("timeout");
      }, 60_000);

      try {
        const fd = new FormData();

        fd.append("file", file);
        fd.append("question_id", questionId);
        fd.append("form_type", formType);

        const res = await clientFetch("/api/forms/upload-photo", {
          method: "POST",
          body: fd,
          signal: controller.signal,
        });
        const data = await res.json();

        if (data.success && data.url) {
          // Defense in depth: persist to sessionStorage SYNCHRONOUSLY
          // before the React commit. Even if the modal is unmounting on
          // the next tick, the draft has the URL and the next open will
          // restore it. Skipped when editing an existing server response
          // because that branch's draft is cleared by checkExistingResponse.
          if (!isEditingExisting) {
            const dateForKey = targetDate || getLocalTodayYmd();
            const draftKey = formResponseDraftStorageKey(
              clientId,
              formType,
              dateForKey,
              draftScope
            );
            const existing = readFormResponseDraft(draftKey);

            writeFormResponseDraft(draftKey, {
              ...(existing?.answers ?? {}),
              [questionId]: data.url,
            });
            setHasLocalDraft(true);
          }
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
        // AbortError = either timeout (we set reason="timeout") or a
        // caller-initiated cancel. Distinguish so the user only sees a
        // toast for the network-stalled case.
        const error = err as Error & { name?: string };

        if (error?.name === "AbortError") {
          if (controller.signal.reason === "timeout") {
            addToast({
              title: "La subida tardó demasiado",
              description:
                "Verifica tu conexión y vuelve a intentarlo en un momento.",
              color: "warning",
            });
          }
          // Silent on user-initiated abort.
        } else {
          console.error("Photo upload error:", err);
          addToast({
            title: "Error de conexión",
            description: "No se pudo subir la imagen",
            color: "danger",
          });
        }
      } finally {
        clearTimeout(timeoutId);
        setUploadingPhotos((prev) => {
          const next = new Set(prev);

          next.delete(questionId);

          return next;
        });
      }
    },
    [formType, clientId, targetDate, isEditingExisting]
  );

  const triggerFileInput = (questionId: string) => {
    fileInputRefs.current[questionId]?.click();
  };

  // Load form configuration and check for existing response.
  //
  // Pasa un `cancelled` flag a las 3 funciones async para que, si el
  // componente desmonta o el effect re-fires antes de que terminen
  // los fetches (ej: cliente abre/cierra el modal rápido en mobile),
  // los setState no se apliquen sobre el state actual con datos
  // staleados de un fetch viejo. React 18 silencia el warning, pero
  // sin esto un fetch lento de un modal anterior podía pisar el
  // estado del modal nuevo.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const isCancelled = () => cancelled;

    setSubmitError(null);
    checkNeatCards(isCancelled);
    fetchFormConfig(isCancelled);
    checkExistingResponse(isCancelled);

    return () => {
      cancelled = true;
    };
  }, [isOpen, clientId, formType, targetDate]);

  // Persist in-progress answers to sessionStorage so a refresh, tab
  // background, or accidental modal close doesn't wipe a half-filled
  // form. Only writes when the user is actively editing a NEW response
  // — server-stored existing responses are canonical, drafts for that
  // date have already been cleared by checkExistingResponse(). Photo
  // upload setAnswers also flows through here, so a draft preserves
  // uploaded photo URLs even before submit.
  useEffect(() => {
    if (!isOpen || isLoading || isViewMode || isEditingExisting) return;
    const dateForKey = targetDate || getLocalTodayYmd();
    const key = formResponseDraftStorageKey(
      clientId,
      formType,
      dateForKey,
      draftScope
    );

    if (Object.keys(answers).length === 0) {
      clearFormResponseDraft(key);

      return;
    }
    writeFormResponseDraft(key, answers);
  }, [
    isOpen,
    isLoading,
    isViewMode,
    isEditingExisting,
    answers,
    clientId,
    formType,
    targetDate,
    draftScope,
  ]);

  const checkNeatCards = async (isCancelled?: () => boolean) => {
    try {
      const response = await clientFetch("/api/client/neat");

      if (isCancelled?.()) return;
      const data = await response.json();

      if (isCancelled?.()) return;
      if (data.success) {
        setHasNeatCards((data.cards || []).length > 0);
      }
    } catch (error) {
      if (isCancelled?.()) return;
      console.error("Error checking NEAT cards:", error);
      setHasNeatCards(true);
    }
  };

  const checkExistingResponse = async (isCancelled?: () => boolean) => {
    try {
      // `getLocalTodayYmd` usa el huso local del navegador. Con
      // `new Date().toISOString()` un cliente en LATAM a las 22h local queda
      // buscando "el día de mañana" en UTC y no encontraba el registro
      // recién enviado.
      const dateToCheck = targetDate || getLocalTodayYmd();
      const response = await clientFetch(
        `/api/forms/responses/${clientId}?form_type=${formType}&start_date=${dateToCheck}&end_date=${dateToCheck}`
      );

      if (isCancelled?.()) return;
      const data = await response.json();

      if (isCancelled?.()) return;

      // Post-entreno: puede haber una respuesta por sesión el mismo día —
      // solo vale la de ESTA sesión.
      const sessionId = extraMetadata?.session_id;
      const existingResponse =
        formType === "workout"
          ? typeof sessionId === "string"
            ? findWorkoutResponseForSession(data.responses ?? [], sessionId)
            : null
          : data.responses?.[0];

      if (data.success && existingResponse) {
        setAnswers(existingResponse.answers || {});
        setExistingResponseDate(existingResponse.response_date);

        // Both habits and check-in forms are editable when a response already
        // exists. This allows clients to update their answers during a coaching
        // call or if they need to correct a previous submission.
        setIsEditingExisting(true);
        setIsViewMode(false);
        // Server copy supersedes any local draft for this date — clear it
        // so we don't accidentally restore stale answers next time.
        clearFormResponseDraft(
          formResponseDraftStorageKey(
            clientId,
            formType,
            dateToCheck,
            draftScope
          )
        );
      } else {
        setIsEditingExisting(false);
        setIsViewMode(false);

        // No server response yet — try to restore an in-progress draft so
        // the client can resume where they left off after a refresh, tab
        // background, or accidental modal close.
        const draft = readFormResponseDraft(
          formResponseDraftStorageKey(
            clientId,
            formType,
            dateToCheck,
            draftScope
          )
        );

        setAnswers(draft?.answers ?? {});
      }
    } catch (error) {
      if (isCancelled?.()) return;
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

  const fetchFormConfig = async (isCancelled?: () => boolean) => {
    setIsLoading(true);
    setConfigError(null);
    try {
      const response = await clientFetch(
        `/api/forms/configs/${clientId}?form_type=${formType}`
      );

      if (isCancelled?.()) return;
      const data = await response.json();

      if (isCancelled?.()) return;

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
        const normalizedConfig: FormConfigData = isStructuredConfig(raw)
          ? raw
          : normalizeFormConfig(Array.isArray(raw) ? raw : []);
        // Check-ins: pages with a cadence (`every_n`) only appear on their
        // period. Same helper (and schedule) as the server's validation.
        const structured =
          formType === "checkins"
            ? dropPagesNotDue(
                normalizedConfig,
                scheduleProp ?? data.schedule ?? null,
                // Pages of the period of the date being filled — same
                // instant (UTC noon) the server validates against.
                new Date(`${targetDate || getLocalTodayYmd()}T12:00:00Z`)
              )
            : normalizedConfig;

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
      if (isCancelled?.()) return;
      console.error("Error fetching form config:", error);
      if (formType === "checkins") {
        setFetchedCheckinSchedule(getScheduleOrDefault(null));
      }

      setConfigError("Error de conexión al cargar el formulario.");
    } finally {
      if (!isCancelled?.()) setIsLoading(false);
    }
  };

  // Delegado a lib/forms/conditional.ts para evitar divergencia con el
  // validador del servidor (ver `validateFormResponse`).
  const shouldShowQuestion = (question: QuestionConfig): boolean =>
    sharedShouldShowQuestion(question, answers);

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

  /**
   * Valida una sección y retorna el mapa de errores. Extraído para que
   * `handleNext` y la validación cross-page del submit final compartan
   * exactamente la misma lógica (antes solo se llamaba inline en
   * handleNext y el submit no validaba globalmente — un required vacío
   * en una página previa pasaba silencioso al server, que retornaba
   * 400 sin mensaje claro al cliente).
   */
  const validateSection = (
    section: (typeof sections)[number]
  ): Record<string, string> => {
    const sectionErrors: Record<string, string> = {};

    section.questions.forEach((question) => {
      if (!shouldShowQuestion(question)) return;

      if (question.type === "group" && question.subQuestions) {
        question.subQuestions
          .filter((sq) => sq.enabled && sq.required)
          .forEach((sq) => {
            // Paridad con `validateFormResponse` del server: una subpregunta
            // condicional oculta no se renderiza (ver el render de grupos),
            // así que exigirla bloquearía el envío con un error invisible.
            if (!shouldShowQuestion(sq)) return;

            if (isEmptyAnswer(sq.type, answers[sq.id])) {
              sectionErrors[sq.id] = "Este campo es obligatorio";
            }
          });
      } else if (
        question.required &&
        isEmptyAnswer(question.type, answers[question.id])
      ) {
        sectionErrors[question.id] = "Este campo es obligatorio";
      }
    });

    // Rango min/max de los `number` (mismo helper que el servidor), también
    // dentro de grupos. Solo si hay respuesta: vacío es cosa del required.
    const numberQs = section.questions.flatMap((q) =>
      q.type === "group" ? (q.subQuestions ?? []) : [q]
    );

    numberQs.forEach((q) => {
      const v = answers[q.id];

      if (q.type !== "number" || typeof v !== "number") return;
      if (!shouldShowQuestion(q) || sectionErrors[q.id]) return;
      const rangeError = numberRangeError(q, v);

      if (rangeError) sectionErrors[q.id] = rangeError;
    });

    return sectionErrors;
  };

  const goToStep = (step: number) => {
    setDirection(step >= currentStep ? 1 : -1);
    setCurrentStep(step);
  };

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [currentStep]);

  useEffect(() => {
    if (!scrollToErrorRef.current) return;
    scrollToErrorRef.current = false;
    const raf = requestAnimationFrame(() => {
      bodyRef.current
        ?.querySelector(`[data-form-page="${currentStep}"] [data-invalid]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });

    return () => cancelAnimationFrame(raf);
  }, [errors, currentStep]);

  // Último aviso de validación: se cierra al reenviar para no acumularse.
  const warningToastRef = useRef<string | null>(null);
  const clearWarningToast = () => {
    if (warningToastRef.current !== null) {
      closeToast(warningToastRef.current);
      warningToastRef.current = null;
    }
  };
  const showWarningToast = (toast: { title: string; description: string }) => {
    clearWarningToast();
    warningToastRef.current = addToast({ ...toast, color: "warning" });
  };

  const handleNext = () => {
    // Avance entre páginas: solo validamos la sección actual. Si pasa,
    // pasamos a la siguiente.
    if (currentStep < totalSteps - 1) {
      const stepErrors = validateSection(currentSection);

      if (Object.keys(stepErrors).length > 0) {
        scrollToErrorRef.current = true;
        setErrors(stepErrors);

        return;
      }
      setErrors({});
      goToStep(currentStep + 1);

      return;
    }

    // Último paso → validamos TODAS las secciones antes de submit. Si
    // hay errores en alguna sección previa (ej: una required que se
    // activó condicionalmente después de que el cliente la pasó), las
    // juntamos, saltamos al primer paso con error y avisamos por toast.
    // Antes esto pasaba silencioso al server y el cliente veía
    // "aprieto Enviar y no pasa nada".
    const allErrors: Record<string, string> = {};
    let firstErrorStep = -1;

    sections.forEach((section, idx) => {
      const sectionErrors = validateSection(section);

      if (Object.keys(sectionErrors).length > 0) {
        if (firstErrorStep < 0) firstErrorStep = idx;
        Object.assign(allErrors, sectionErrors);
      }
    });

    if (firstErrorStep >= 0) {
      scrollToErrorRef.current = true;
      setErrors(allErrors);
      goToStep(firstErrorStep);
      // En el paso actual el error ya se ve en el campo (borde rojo +
      // scroll): un toast abajo solo tapaba el botón Enviar. Solo avisamos
      // cuando el error está en otro paso.
      if (firstErrorStep !== currentStep) {
        showWarningToast({
          title: "Faltan campos por completar",
          description: `Revisa el paso ${firstErrorStep + 1} antes de enviar.`,
        });
      }

      return;
    }

    setErrors({});
    handleSubmit();
  };

  const handleBack = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    // Un aviso de un intento anterior no debe quedarse junto a
    // "Formulario enviado" (ni tapando el botón mientras se reenvía).
    clearWarningToast();
    setIsSubmitting(true);
    setSubmitError(null);
    // 30s timeout on submit. If the network stalls (tunnel, flaky 3G,
    // etc.), abort instead of hanging the modal indefinitely. The user's
    // answers stay in `answers` state so a retry just reruns this same
    // function with the same payload.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort("timeout");
    }, 30_000);

    try {
      const response = await clientFetch(`/api/forms/responses/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_type: formType,
          response_date: targetDate || getLocalTodayYmd(),
          answers,
          metadata: {
            ...extraMetadata,
            submitted_from: "mobile",
            completion_time: new Date().toISOString(),
          },
        }),
        signal: controller.signal,
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

        // Drop the local draft now that the server has the canonical
        // copy — keeping it would risk restoring stale answers if the
        // client re-opens the modal before the server cache refreshes.
        clearFormResponseDraft(
          formResponseDraftStorageKey(
            clientId,
            formType,
            targetDate || getLocalTodayYmd(),
            draftScope
          )
        );

        setAnswers({});
        setCurrentStep(0);
        setIsEditingExisting(false);
        onClose();
      } else if (response.status === 401) {
        // Sesión muerta: cookie bloqueada/expirada Y token local inválido.
        // Limpiamos el token para no seguir adjuntando un JWT muerto y
        // damos una instrucción accionable en vez del genérico
        // "No autorizado".
        clearClientToken();
        const sessionMessage =
          "Tu sesión expiró. Cierra el formulario y vuelve a iniciar sesión para poder enviarlo. Tus respuestas quedan guardadas en este dispositivo.";

        setSubmitError(sessionMessage);
        addToast({
          title: "Sesión expirada",
          description: sessionMessage,
          color: "danger",
        });
      } else {
        // Mapear errores de validación server-side al state local
        // `errors` para que se vean inline en cada pregunta, en vez
        // de mostrar un toast genérico "Respuestas inválidas" sin
        // decir cuál pregunta. Aparte saltamos al primer paso que
        // contenga un error para que el usuario lo vea sin scroll
        // innecesario. Esto cubre, por ejemplo, foto que falló al
        // upload silenciosamente, número fuera de rango, etc.
        const serverErrors: Record<string, string> = {};

        if (Array.isArray(data.errors)) {
          for (const e of data.errors as Array<{
            field?: string;
            message?: string;
          }>) {
            if (e?.field && e?.message) {
              serverErrors[e.field] = e.message;
            }
          }
        }

        if (Object.keys(serverErrors).length > 0) {
          scrollToErrorRef.current = true;
          setErrors(serverErrors);

          // Saltar a la primera sección que contenga un error
          // mapeado. Si ninguna lo tiene (error de un campo
          // condicional ahora oculto), nos quedamos donde estamos.
          const firstStepWithError = sections.findIndex((s) =>
            s.questions.some((q) => {
              if (serverErrors[q.id]) return true;
              if (q.type === "group" && q.subQuestions) {
                return q.subQuestions.some((sq) => serverErrors[sq.id]);
              }

              return false;
            })
          );

          if (firstStepWithError >= 0 && firstStepWithError !== currentStep) {
            goToStep(firstStepWithError);
          }

          // Errores sobre campos que NO están renderizados (p.ej. una
          // pregunta filtrada client-side o de una versión vieja del
          // config) no tienen dónde mostrarse inline. Sin este banner el
          // cliente no ve nada y cree que el botón no funciona.
          const renderedIds = new Set<string>();

          sections.forEach((s) =>
            s.questions.forEach((q) => {
              renderedIds.add(q.id);
              q.subQuestions?.forEach((sq) => renderedIds.add(sq.id));
            })
          );
          const unmappedMessages = Object.entries(serverErrors)
            .filter(([field]) => !renderedIds.has(field))
            .map(([, message]) => message);

          if (unmappedMessages.length > 0) {
            setSubmitError(unmappedMessages.join(" · "));
          }

          showWarningToast({
            title: "Revisa los campos marcados",
            description:
              "Hay respuestas que necesitan corrección antes de enviar.",
          });
        } else {
          setSubmitError(data.error || "Error al enviar formulario");
          addToast({
            title: "Error",
            description: data.error || "Error al enviar formulario",
            color: "danger",
          });
        }
      }
    } catch (error) {
      const err = error as Error & { name?: string };

      // Timeout-specific message — "Reintentar" hint nudges the user to
      // tap Enviar again rather than thinking the form is broken. The
      // answers state is intact so a retry just reruns the same payload.
      if (
        err?.name === "AbortError" &&
        controller.signal.reason === "timeout"
      ) {
        setSubmitError(
          "El envío tardó demasiado. Verifica tu conexión y toca Enviar otra vez. Tus respuestas siguen aquí."
        );
        addToast({
          title: "El envío tardó demasiado",
          description:
            "Verifica tu conexión y toca Enviar otra vez. Tus respuestas siguen aquí.",
          color: "warning",
        });
      } else {
        console.error("Error submitting form:", error);
        setSubmitError(
          "No se pudo enviar el formulario. Verifica tu conexión y toca Enviar otra vez."
        );
        addToast({
          title: "Error de conexión",
          description: "No se pudo enviar el formulario",
          color: "danger",
        });
      }
    } finally {
      clearTimeout(timeoutId);
      setIsSubmitting(false);
    }
  };

  const handleAnswerChange = (id: string, value: any) => {
    if (isViewMode) return;
    setAnswers((prev) => ({ ...prev, [id]: value }));
    if (!isEditingExisting) setHasLocalDraft(true);
    if (submitError) setSubmitError(null);
    // Clear error on change
    if (errors[id]) {
      setErrors((prev) => {
        const next = { ...prev };

        delete next[id];

        return next;
      });
    }
  };

  // ── Render ────────────────────────────────────────────────────────
  const fileInput = (id: string) => (
    <input
      ref={(el) => {
        fileInputRefs.current[id] = el;
      }}
      accept="image/*"
      className="hidden"
      type="file"
      onChange={(e) => {
        const f = e.target.files?.[0];

        if (f) handlePhotoUpload(id, f);
        e.target.value = ""; // Reset so same file can be re-selected
      }}
    />
  );

  /** Input de una pregunta (o subpregunta, `compact`) que no es grupo. */
  const renderInput = (question: QuestionConfig, compact: boolean) => {
    const value = answers[question.id];
    const invalid = Boolean(errors[question.id]);
    const set = (v: unknown) => handleAnswerChange(question.id, v);

    switch (question.type) {
      case "rating":
        return (
          <RatingInput
            compact={compact}
            disabled={isViewMode}
            label={question.label}
            showHint={!isViewMode && !compact}
            value={value}
            onChange={set}
          />
        );

      case "number":
        return (
          <BigNumberInput
            integer={isStepsQuestion(question)}
            invalid={invalid}
            label={question.label}
            max={question.max}
            min={question.min}
            readOnly={isViewMode}
            unit={question.unit}
            value={value}
            onChange={set}
          />
        );

      case "boolean":
        return (
          <BooleanInput
            compact={compact}
            disabled={isViewMode}
            value={value}
            onChange={set}
          />
        );

      case "text":
        return (
          <TextInput
            compact={compact}
            invalid={invalid}
            label={question.label}
            placeholder={
              compact ? "Escribe aquí..." : "Escribe tu respuesta..."
            }
            readOnly={isViewMode}
            value={value}
            onChange={set}
          />
        );

      case "photo":
        return (
          <>
            {fileInput(question.id)}
            <PhotoTile
              aspect={compact ? "aspect-[4/5]" : "aspect-[4/3]"}
              compact={compact}
              disabled={isViewMode}
              invalid={invalid}
              label={question.label}
              uploading={uploadingPhotos.has(question.id)}
              url={typeof value === "string" && value ? value : undefined}
              onPick={() => triggerFileInput(question.id)}
            />
          </>
        );

      case "choice": {
        const choices = question.choices ?? [];
        const selectedId = typeof value === "string" ? value : null;
        const selectedExists =
          selectedId !== null && choices.some((c) => c.id === selectedId);

        return (
          <div className="space-y-2">
            <ChoiceTiles
              choices={choices}
              disabled={isViewMode}
              isSelected={(id) => selectedId === id}
              multi={false}
              onToggle={set}
            />
            {/* Historic fallback: stored id no longer exists in choices. */}
            {selectedId !== null && !selectedExists && (
              <FieldHint>
                Respuesta original: <strong>opción eliminada</strong>
              </FieldHint>
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
            <ChoiceTiles
              multi
              choices={choices}
              disabled={isViewMode}
              isSelected={(id) => selectedIds.includes(id)}
              onToggle={(id) => {
                if (isViewMode) return;
                set(
                  selectedIds.includes(id)
                    ? selectedIds.filter((x) => x !== id)
                    : [...selectedIds, id]
                );
              }}
            />
            {missingIds.length > 0 && (
              <FieldHint>
                {missingIds.length === 1
                  ? "1 opción previamente seleccionada fue eliminada"
                  : `${missingIds.length} opciones previamente seleccionadas fueron eliminadas`}
              </FieldHint>
            )}
          </div>
        );
      }

      default:
        return (
          <p className="text-sm text-default-500">
            Tipo de pregunta no soportado
          </p>
        );
    }
  };

  const requiredMark = (q: QuestionConfig) =>
    q.required && !isViewMode ? <span className="text-danger"> *</span> : null;

  /**
   * Grupo: números consecutivos en filas compactas (Medidas), fotos
   * consecutivas en una rejilla de 2, el resto como mini-bloques con su
   * etiqueta. Se respeta el orden del trainer.
   */
  const renderGroup = (question: QuestionConfig) => {
    const subs = (question.subQuestions ?? []).filter(
      (sq) => sq.enabled && shouldShowQuestion(sq)
    );
    const runs: Array<{ kind: string; items: QuestionConfig[] }> = [];

    for (const sq of subs) {
      const kind =
        sq.type === "number" || sq.type === "photo" ? sq.type : sq.id;
      const last = runs[runs.length - 1];

      if (last && last.kind === kind) last.items.push(sq);
      else runs.push({ kind, items: [sq] });
    }

    return (
      <div className="space-y-3">
        {runs.map(({ kind, items }) => {
          const key = items[0]?.id ?? kind;

          if (kind === "number") {
            return (
              <div
                key={key}
                className="divide-y divide-default-200 overflow-hidden rounded-xl bg-default-100"
              >
                {items.map((sq) => (
                  <NumberRow
                    key={sq.id}
                    integer={isStepsQuestion(sq)}
                    invalid={Boolean(errors[sq.id])}
                    label={sq.label}
                    readOnly={isViewMode}
                    required={sq.required}
                    sublabel={
                      sq.fullQuestion && sq.fullQuestion !== sq.label
                        ? sq.fullQuestion
                        : undefined
                    }
                    unit={sq.unit}
                    value={answers[sq.id]}
                    onChange={(v) => handleAnswerChange(sq.id, v)}
                  />
                ))}
              </div>
            );
          }

          if (kind === "photo") {
            return (
              <div key={key} className="grid grid-cols-2 gap-2.5">
                {items.map((sq) => (
                  <div key={sq.id} className="flex flex-col gap-1.5">
                    {renderInput(sq, true)}
                    <span
                      className={`text-center text-[13px] font-semibold ${errors[sq.id] ? "text-danger" : "text-default-500"}`}
                    >
                      {sq.label}
                      {requiredMark(sq)}
                    </span>
                  </div>
                ))}
              </div>
            );
          }

          return items.map((sq) => (
            <div key={sq.id} className="space-y-2">
              <div>
                <p
                  className={`break-words text-[15px] font-semibold ${errors[sq.id] ? "text-danger" : "text-foreground"}`}
                >
                  {sq.label}
                  {requiredMark(sq)}
                </p>
                {sq.fullQuestion && sq.fullQuestion !== sq.label && (
                  <p className="break-words text-[13px] text-default-500">
                    {sq.fullQuestion}
                  </p>
                )}
              </div>
              {renderInput(sq, true)}
            </div>
          ));
        })}
      </div>
    );
  };

  const renderQuestionCard = (question: QuestionConfig) => {
    const isGroup = question.type === "group";
    const enabledSubs = (question.subQuestions ?? []).filter(
      (sq) => sq.enabled
    );
    const ownError = errors[question.id];
    // En grupos los errores van por subpregunta; se muestran una sola vez
    // al pie de la tarjeta y la fila/foto afectada se marca en rojo.
    const messages = isGroup
      ? [
          ...new Set(
            enabledSubs.flatMap((sq) => {
              const m = errors[sq.id];

              return m ? [m] : [];
            })
          ),
        ]
      : ownError
        ? [ownError]
        : [];
    const invalid = messages.length > 0;

    return (
      <div
        className={`flex flex-col gap-3.5 rounded-large bg-content1 p-4 shadow-small ${
          invalid ? "outline outline-[1.5px] outline-danger" : ""
        }`}
        data-invalid={invalid || undefined}
      >
        <div className="flex items-start gap-3">
          <IconTile icon={question.icon} size="sm" />
          <div className="min-w-0 flex-1 pt-1.5">
            <h3 className="break-words text-base font-semibold leading-snug text-foreground">
              {question.label}
              {requiredMark(question)}
            </h3>
            {question.fullQuestion &&
              question.fullQuestion !== question.label && (
                <p className="mt-0.5 break-words text-sm leading-snug text-default-500">
                  {question.fullQuestion}
                </p>
              )}
            {!isViewMode && isGroup && (
              <p className="mt-0.5 text-sm text-default-500">
                {enabledSubs.length} campos a completar
              </p>
            )}
          </div>
        </div>
        {isGroup ? renderGroup(question) : renderInput(question, false)}
        <FieldError messages={messages} />
      </div>
    );
  };

  // Enter en un campo de una línea pasa al siguiente; en el último avanza
  // de paso (o envía), como el botón principal.
  const handleFieldEnter = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const t = e.target;

    if (
      e.key !== "Enter" ||
      e.nativeEvent.isComposing ||
      !(t instanceof HTMLInputElement) ||
      !t.hasAttribute(FIELD_ATTR)
    ) {
      return;
    }
    e.preventDefault();
    const page = t.closest("[data-form-page]");
    const fields = Array.from(
      page?.querySelectorAll<HTMLElement>(`[${FIELD_ATTR}]`) ?? []
    );
    const next = fields[fields.indexOf(t) + 1];

    if (next) {
      next.focus();

      return;
    }
    t.blur();
    if (!isSubmitting && uploadingPhotos.size === 0) handleNext();
  };

  const formName =
    formType === "checkins"
      ? (effectiveCheckinSchedule?.custom_name ?? "Check-in")
      : formType === "workout"
        ? "Cómo fue el entreno"
        : "Registro diario";
  const dateFor = (ymd: string) =>
    new Date(`${ymd}T12:00:00`).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
    });
  const dateLabel = targetDate
    ? dateFor(targetDate)
    : formType === "habits"
      ? dateFor(getLocalTodayYmd())
      : "";
  const dialogLabel =
    targetDate && formType !== "workout"
      ? `${formType === "checkins" ? formName : "Registro"} del ${dateLabel}`
      : formName;
  const showSteps = !isLoading && !configError && !isViewMode;
  const isLastStep = currentStep >= totalSteps - 1;
  const busy = isSubmitting || uploadingPhotos.size > 0;
  const primaryLabel =
    uploadingPhotos.size > 0
      ? isLastStep
        ? "Espera, subiendo fotos..."
        : "Subiendo fotos..."
      : !isLastStep
        ? "Siguiente"
        : isSubmitting
          ? isEditingExisting
            ? "Actualizando..."
            : "Enviando..."
          : isEditingExisting
            ? "Actualizar"
            : "Enviar";

  return (
    <ClientSheet
      hideCloseButton
      classNames={{
        base: "h-[94dvh] max-h-[94dvh]! bg-background sm:h-[min(880px,90dvh)] sm:max-h-[90dvh]!",
      }}
      isDismissable={!isSubmitting}
      isOpen={isOpen}
      size="xl"
      onClose={onClose}
    >
      <ModalContent aria-label={dialogLabel}>
        {(onModalClose) => (
          <MotionConfig reducedMotion="user">
            {/* Mientras se envía no se puede cerrar (el padre espera a
                onSuccess antes de cerrar): sin asa arrastrable. */}
            {isSubmitting ? (
              <div aria-hidden className="h-6 shrink-0 sm:hidden" />
            ) : (
              <ClientSheetGrabber onClose={onModalClose} />
            )}

            {/* Barra superior: Cancelar · nombre + fecha · Guardado */}
            <div className="shrink-0 px-2 pb-3 sm:pt-3">
              <div className="grid min-h-11 grid-cols-[1fr_auto_1fr] items-center">
                <button
                  className="min-h-11 justify-self-start px-2 text-[17px] text-primary transition-opacity active:opacity-60 disabled:opacity-40"
                  disabled={isSubmitting}
                  type="button"
                  onClick={onModalClose}
                >
                  Cancelar
                </button>
                <div className="min-w-0 max-w-[200px] text-center">
                  <p className="truncate text-base font-semibold text-foreground">
                    {formName}
                  </p>
                  {dateLabel && (
                    <p className="mt-px text-xs text-default-500">
                      {dateLabel}
                    </p>
                  )}
                </div>
                <span
                  aria-hidden={!hasLocalDraft || isEditingExisting}
                  className={`inline-flex items-center gap-1 justify-self-end pr-2 text-xs font-semibold text-default-500 transition-opacity duration-300 ${
                    hasLocalDraft && !isEditingExisting
                      ? "opacity-100"
                      : "opacity-0"
                  }`}
                >
                  <Icon icon="solar:cloud-check-linear" width={18} />
                  Guardado
                </span>
              </div>
              {showSteps && totalSteps > 1 && (
                <div
                  aria-label="Progreso"
                  aria-valuemax={totalSteps}
                  aria-valuemin={1}
                  aria-valuenow={currentStep + 1}
                  className="flex gap-1 px-2 pt-2.5"
                  role="progressbar"
                >
                  {sections.map((s, i) => (
                    <span
                      key={`${s.title}-${i}`}
                      className={`h-1 flex-1 rounded-sm transition-colors duration-300 ${
                        i <= currentStep ? "bg-primary" : "bg-default-200"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div
              ref={bodyRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-7"
            >
              {isLoading ? (
                <div
                  aria-busy
                  className="flex flex-col items-center gap-3 pt-14"
                >
                  <Icon
                    className="animate-spin text-default-400 motion-reduce:animate-none"
                    icon="solar:refresh-linear"
                    width={30}
                  />
                  <p className="text-[15px] text-default-500">
                    Cargando formulario...
                  </p>
                  <div className="mt-6 w-full space-y-3">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-[120px] animate-pulse rounded-large bg-content1 shadow-small motion-reduce:animate-none"
                      />
                    ))}
                  </div>
                </div>
              ) : configError ? (
                <div className="flex flex-col items-center gap-3 px-2 pt-14 text-center">
                  <IconTile
                    icon="solar:clipboard-remove-linear"
                    size="lg"
                    tone="warning"
                  />
                  <p className="max-w-[280px] text-[15px] leading-relaxed text-default-500">
                    {configError}
                  </p>
                </div>
              ) : isViewMode ? (
                <div className="space-y-3 pt-1.5">
                  {visibleQuestions.map((q) => (
                    <div key={q.id}>{renderQuestionCard(q)}</div>
                  ))}
                </div>
              ) : (
                // Enter burbujea desde los inputs del paso (ver handleFieldEnter).
                // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                <div
                  className="relative overflow-x-clip"
                  onKeyDown={handleFieldEnter}
                >
                  <AnimatePresence
                    custom={direction}
                    initial={false}
                    mode="popLayout"
                  >
                    <motion.div
                      key={currentStep}
                      animate="center"
                      custom={direction}
                      data-form-page={currentStep}
                      exit="exit"
                      initial="enter"
                      transition={{
                        x: { duration: 0.42, ease: EASE },
                        opacity: { duration: 0.28, ease: "easeOut" },
                      }}
                      variants={PAGE_VARIANTS}
                    >
                      <header className="mb-1 mt-1.5 flex items-center gap-3">
                        <IconTile
                          icon={
                            currentSection.icon ||
                            (formType === "checkins"
                              ? "solar:clipboard-check-linear"
                              : "solar:calendar-mark-linear")
                          }
                        />
                        <div className="min-w-0">
                          <h2 className="break-words font-heading text-[26px] leading-tight tracking-[-0.02em] text-foreground">
                            {currentSection.title || formName}
                          </h2>
                          {(totalSteps > 1 || isEditingExisting) && (
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-default-500">
                              {totalSteps > 1 && (
                                <span>
                                  Paso {currentStep + 1} de {totalSteps}
                                </span>
                              )}
                              {isEditingExisting && (
                                <span className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full bg-primary/10 px-2.5 text-xs font-semibold text-primary">
                                  <Icon icon="solar:pen-2-linear" width={14} />
                                  Editando registro enviado
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </header>

                      <AnimatePresence initial={false}>
                        {currentSection.questions.map((question) =>
                          question.conditionalOn ? (
                            // Pregunta condicional: crece en su sitio al
                            // cumplirse la condición.
                            <motion.div
                              key={question.id}
                              animate={{
                                height: "auto",
                                opacity: 1,
                                transitionEnd: { overflow: "visible" },
                              }}
                              exit={{
                                height: 0,
                                opacity: 0,
                                overflow: "hidden",
                              }}
                              initial={{
                                height: 0,
                                opacity: 0,
                                overflow: "hidden",
                              }}
                              transition={{ duration: 0.36, ease: EASE }}
                            >
                              <div className="pt-3">
                                {renderQuestionCard(question)}
                              </div>
                            </motion.div>
                          ) : (
                            <div key={question.id} className="pt-3">
                              {renderQuestionCard(question)}
                            </div>
                          )
                        )}
                      </AnimatePresence>

                      {currentSection.questions.length === 0 && (
                        <div className="mt-3 flex flex-col items-center gap-2.5 rounded-large bg-content1 px-5 py-7 text-center shadow-small">
                          <IconTile
                            className="rounded-full"
                            icon="solar:check-circle-linear"
                            tone="success"
                          />
                          <p className="text-[17px] font-semibold text-foreground">
                            ¡Todas las preguntas contestadas!
                          </p>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}
            </div>

            <ModalFooter className="flex-col gap-3 bg-background px-4 pb-4 pt-3 shadow-[0_-1px_0_hsl(var(--heroui-default-200))]">
              {showSteps && submitError && (
                <div
                  className="flex w-full items-start gap-2.5 rounded-xl bg-danger/10 px-3.5 py-3 text-sm leading-snug text-foreground"
                  role="alert"
                >
                  <Icon
                    className="mt-px shrink-0 text-danger"
                    icon="solar:danger-triangle-linear"
                    width={20}
                  />
                  <span>{submitError}</span>
                </div>
              )}
              {showSteps ? (
                <div className="flex w-full gap-2.5">
                  {currentStep > 0 && (
                    <Button
                      className="h-[52px] min-w-32 shrink-0 bg-default-100 text-base font-semibold text-foreground"
                      isDisabled={isSubmitting}
                      radius="lg"
                      onPress={handleBack}
                    >
                      Anterior
                    </Button>
                  )}
                  <Button
                    className="h-[52px] flex-1 text-base font-semibold"
                    color="primary"
                    isDisabled={busy}
                    isLoading={isSubmitting}
                    radius="lg"
                    onPress={handleNext}
                  >
                    {primaryLabel}
                  </Button>
                </div>
              ) : (
                <Button
                  fullWidth
                  className="h-[52px] bg-default-100 text-base font-semibold text-foreground"
                  radius="lg"
                  onPress={onModalClose}
                >
                  Cerrar
                </Button>
              )}
            </ModalFooter>
          </MotionConfig>
        )}
      </ModalContent>
    </ClientSheet>
  );
}

const EASE = [0.32, 0.72, 0, 1] as const;

// Adelante: la página nueva entra por la derecha y la vieja sale por la
// izquierda; atrás, al revés. MotionConfig reducedMotion="user" deja solo
// el fundido.
const PAGE_VARIANTS = {
  enter: (dir: 1 | -1) => ({ x: `${dir * 40}%`, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: 1 | -1) => ({ x: `${dir * -30}%`, opacity: 0 }),
};

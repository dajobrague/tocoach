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
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useRef, useState } from "react";

import FormConfigEditor from "@/components/dashboard/client-profile/tabs/form-config-editor";
import {
  FormResponse as FormResponseType,
  QuestionConfig,
  FormConfigData,
  normalizeFormConfig,
  isStructuredConfig,
} from "@/lib/forms/types";

interface FormsTabProps {
  clientId: string;
  /** Called when config dirty state changes (for parent tab guard) */
  onConfigDirtyChange?: (dirty: boolean) => void;
}

export default function FormsTab({
  clientId,
  onConfigDirtyChange,
}: FormsTabProps) {
  const [selectedFormType, setSelectedFormType] = useState<
    "checkins" | "habits"
  >("checkins");
  const [selectedView, setSelectedView] = useState("responses"); // "responses" o "configuration"
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewStep, setPreviewStep] = useState(0);
  const [isAddQuestionModalOpen, setIsAddQuestionModalOpen] = useState(false);

  // Response detail modal
  const [viewingResponse, setViewingResponse] = useState<{
    id: string;
    date: string;
    answers: Record<string, any>;
  } | null>(null);

  // Dirty tracking for the config editor
  const [isConfigDirty, setIsConfigDirty] = useState(false);

  const handleDirtyChange = useCallback(
    (dirty: boolean) => {
      setIsConfigDirty(dirty);
      onConfigDirtyChange?.(dirty);
    },
    [onConfigDirtyChange]
  );

  // Guard function: warns user before losing unsaved changes
  const guardUnsaved = useCallback(
    (action: () => void) => {
      if (isConfigDirty) {
        if (
          window.confirm(
            "Tienes cambios sin guardar en la configuración. ¿Quieres descartarlos?"
          )
        ) {
          setIsConfigDirty(false);
          onConfigDirtyChange?.(false);
          pendingConfigRef.current = null;
          action();
        }
      } else {
        action();
      }
    },
    [isConfigDirty, onConfigDirtyChange]
  );

  // Warn before closing the browser tab with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isConfigDirty) {
        e.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handler);

    return () => window.removeEventListener("beforeunload", handler);
  }, [isConfigDirty]);

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

  // ── Default structured configs with category-based pages ───────────
  const DEFAULT_CHECKIN_CONFIG: FormConfigData = {
    pages: [
      {
        id: "checkin_reflection",
        title: "Reflexión Personal",
        icon: "solar:user-heart-bold",
        order: 0,
      },
      {
        id: "checkin_goals",
        title: "Objetivos",
        icon: "solar:target-bold",
        order: 1,
      },
      {
        id: "checkin_service",
        title: "Valoración del Servicio",
        icon: "solar:star-bold",
        order: 2,
      },
      {
        id: "checkin_body",
        title: "Fotos y Medidas",
        icon: "solar:camera-bold",
        order: 3,
      },
    ],
    questions: [
      // ── Page: Reflexión Personal ──
      {
        id: "personal_life",
        label: "Vida Personal",
        fullQuestion: "¿Cómo va todo a nivel personal?",
        icon: "solar:user-heart-bold",
        type: "text",
        enabled: true,
        required: true,
        pageId: "checkin_reflection",
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
        pageId: "checkin_reflection",
      },
      {
        id: "other_victory",
        label: "Otra Victoria",
        fullQuestion: "¿Alguna otra victoria que celebrar?",
        icon: "solar:star-circle-bold",
        type: "text",
        enabled: true,
        required: false,
        pageId: "checkin_reflection",
      },
      {
        id: "biggest_challenge",
        label: "Mayor Desafío",
        fullQuestion:
          "¿Cuál ha sido el mayor desafío al que te has enfrentado?",
        icon: "solar:shield-warning-bold",
        type: "text",
        enabled: true,
        required: true,
        pageId: "checkin_reflection",
      },
      // ── Page: Objetivos ──
      {
        id: "goals_completed",
        label: "Objetivos Cumplidos",
        fullQuestion:
          "¿Has cumplido objetivos que te marcaste en nuestra última revisión?",
        icon: "solar:check-square-bold",
        type: "boolean",
        enabled: true,
        required: true,
        pageId: "checkin_goals",
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
        pageId: "checkin_goals",
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
        pageId: "checkin_goals",
      },
      // ── Page: Valoración del Servicio ──
      {
        id: "service_rating",
        label: "Valoración del Servicio",
        fullQuestion: "¿Cómo valoras el servicio que te estamos dando?",
        icon: "solar:star-bold",
        type: "rating",
        enabled: true,
        required: true,
        pageId: "checkin_service",
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
        conditionalValue: true,
        pageId: "checkin_service",
      },
      // ── Page: Fotos y Medidas ──
      {
        id: "photos",
        label: "Fotos de Progreso",
        icon: "solar:camera-bold",
        type: "group",
        enabled: true,
        required: false,
        pageId: "checkin_body",
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
        pageId: "checkin_body",
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
        pageId: "checkin_body",
      },
    ],
  };

  const DEFAULT_HABIT_CONFIG: FormConfigData = {
    pages: [
      {
        id: "habit_wellbeing",
        title: "Bienestar",
        icon: "solar:heart-pulse-bold",
        order: 0,
      },
      {
        id: "habit_activity",
        title: "Actividad Física",
        icon: "solar:running-bold",
        order: 1,
      },
      {
        id: "habit_nutrition",
        title: "Nutrición",
        icon: "solar:plate-bold",
        order: 2,
      },
      {
        id: "habit_sleep",
        title: "Sueño",
        icon: "solar:sleeping-bold",
        order: 3,
      },
    ],
    questions: [
      // ── Page: Bienestar ──
      {
        id: "energy_levels",
        label: "Niveles de Energía",
        fullQuestion: "Niveles de energía durante el día",
        icon: "solar:bolt-bold",
        type: "rating",
        enabled: true,
        required: false,
        pageId: "habit_wellbeing",
      },
      {
        id: "stress_levels",
        label: "Manejo del Estrés",
        fullQuestion: "¿Qué tal has sobrellevado el estrés?",
        icon: "solar:shield-warning-bold",
        type: "rating",
        enabled: true,
        required: false,
        pageId: "habit_wellbeing",
      },
      {
        id: "illness_signs",
        label: "Signos de Enfermedad",
        fullQuestion:
          "¿Has tenido algún signo de enfermedad, infección, dolor?",
        icon: "solar:health-bold",
        type: "boolean",
        enabled: true,
        required: false,
        pageId: "habit_wellbeing",
      },
      {
        id: "illness_details",
        label: "Detalles de Enfermedad",
        fullQuestion: "Más detalles",
        icon: "solar:notes-bold",
        type: "text",
        enabled: true,
        required: false,
        conditionalOn: "illness_signs",
        conditionalValue: true,
        pageId: "habit_wellbeing",
      },
      // ── Page: Actividad Física ──
      {
        id: "steps",
        label: "Pasos del Día",
        fullQuestion: "¿Cuántos pasos has hecho hoy?",
        icon: "solar:walking-bold",
        type: "number",
        unit: "pasos",
        enabled: true,
        required: false,
        pageId: "habit_activity",
      },
      {
        id: "other_activity",
        label: "Otra Actividad Física",
        fullQuestion: "¿Otra actividad física exigente?",
        icon: "solar:running-bold",
        type: "boolean",
        enabled: true,
        required: false,
        pageId: "habit_activity",
      },
      {
        id: "other_activity_details",
        label: "Detalles de Actividad",
        fullQuestion: "Más detalles",
        icon: "solar:notes-bold",
        type: "text",
        enabled: true,
        required: false,
        conditionalOn: "other_activity",
        conditionalValue: true,
        pageId: "habit_activity",
      },
      {
        id: "sun_exposure",
        label: "Exposición Solar",
        fullQuestion: "Horas de exposición al sol durante el día",
        icon: "solar:sun-bold",
        type: "number",
        unit: "horas",
        enabled: true,
        required: false,
        pageId: "habit_activity",
      },
      // ── Page: Nutrición ──
      {
        id: "macro_tracking",
        label: "Seguimiento de Macros",
        fullQuestion: "¿Seguimiento de macros hoy?",
        icon: "solar:pie-chart-bold",
        type: "group",
        enabled: true,
        required: false,
        pageId: "habit_nutrition",
        subQuestions: [
          {
            id: "calories",
            label: "Calorías Totales",
            icon: "solar:fire-bold",
            type: "number",
            unit: "kcal",
            enabled: true,
            required: false,
          },
          {
            id: "protein",
            label: "Proteína",
            icon: "solar:bone-bold",
            type: "number",
            unit: "g",
            enabled: true,
            required: false,
          },
          {
            id: "carbs",
            label: "Carbohidratos",
            icon: "solar:leaf-bold",
            type: "number",
            unit: "g",
            enabled: true,
            required: false,
          },
          {
            id: "fats",
            label: "Grasas",
            icon: "solar:cloud-waterdrop-bold",
            type: "number",
            unit: "g",
            enabled: true,
            required: false,
          },
        ],
      },
      {
        id: "hunger_levels",
        label: "Niveles de Hambre",
        fullQuestion: "¿Cómo han sido tus niveles de hambre?",
        icon: "solar:plate-bold",
        type: "rating",
        enabled: true,
        required: false,
        pageId: "habit_nutrition",
      },
      {
        id: "adherence",
        label: "Adherencia al Plan",
        fullQuestion: "¿Cómo ha sido la adherencia?",
        icon: "solar:check-circle-bold",
        type: "rating",
        enabled: true,
        required: false,
        pageId: "habit_nutrition",
      },
      {
        id: "adherence_reason",
        label: "Razón de No Adherencia",
        fullQuestion: "¿Por qué no te has podido ceñir al plan?",
        icon: "solar:question-circle-bold",
        type: "text",
        enabled: true,
        required: false,
        conditionalOn: "adherence",
        conditionalValue: true,
        pageId: "habit_nutrition",
      },
      {
        id: "caffeine",
        label: "Consumo de Cafeína",
        fullQuestion: "¿Cuánta cafeína se ha consumido?",
        icon: "solar:cup-hot-bold",
        type: "number",
        unit: "mg",
        enabled: true,
        required: false,
        pageId: "habit_nutrition",
      },
      {
        id: "supplementation",
        label: "Suplementación",
        fullQuestion: "Suplementación",
        icon: "solar:pill-bold",
        type: "text",
        enabled: true,
        required: false,
        pageId: "habit_nutrition",
      },
      // ── Page: Sueño ──
      {
        id: "bedtime",
        label: "Hora de Acostar",
        fullQuestion: "¿A qué hora te acostaste ayer?",
        icon: "solar:moon-stars-bold",
        type: "text",
        enabled: true,
        required: false,
        pageId: "habit_sleep",
      },
      {
        id: "wake_time",
        label: "Hora de Despertar",
        fullQuestion: "¿A qué hora te has despertado hoy?",
        icon: "solar:sun-fog-bold",
        type: "text",
        enabled: true,
        required: false,
        pageId: "habit_sleep",
      },
      {
        id: "sleep_hours",
        label: "Horas de Sueño",
        fullQuestion: "¿Cuántas horas has dormido en total?",
        icon: "solar:sleeping-bold",
        type: "number",
        unit: "horas",
        enabled: true,
        required: false,
        pageId: "habit_sleep",
      },
      {
        id: "morning_feeling",
        label: "Sensación al Despertar",
        fullQuestion: "Al salir de cama esta mañana sentías que",
        icon: "solar:smile-circle-bold",
        type: "rating",
        enabled: true,
        required: false,
        pageId: "habit_sleep",
      },
      {
        id: "morning_feeling_details",
        label: "Detalles de Despertar",
        fullQuestion: "Más detalles",
        icon: "solar:notes-bold",
        type: "text",
        enabled: true,
        required: false,
        conditionalOn: "morning_feeling",
        conditionalValue: true,
        pageId: "habit_sleep",
      },
      {
        id: "special_comment",
        label: "Comentario Especial",
        fullQuestion: "Comentario especial",
        icon: "solar:chat-round-dots-bold",
        type: "boolean",
        enabled: false,
        required: false,
        pageId: "habit_sleep",
      },
    ],
  };

  // Flat question arrays (kept for backward compat in responses/preview views)
  const [checkinQuestions, setCheckinQuestions] = useState<QuestionConfig[]>(
    DEFAULT_CHECKIN_CONFIG.questions
  );
  const [habitQuestions, setHabitQuestions] = useState<QuestionConfig[]>(
    DEFAULT_HABIT_CONFIG.questions
  );
  const [responses, setResponses] = useState<FormResponseType[]>([]);

  // "Saved" config — loaded from server / last saved. Passed as initialConfig
  // to FormConfigEditor so the editor only resets when we intentionally reload.
  const [checkinConfigData, setCheckinConfigData] =
    useState<FormConfigData | null>(null);
  const [habitConfigData, setHabitConfigData] = useState<FormConfigData | null>(
    null
  );

  // "Live" config — reflects every editor change, used for the preview modal.
  const [checkinLiveConfig, setCheckinLiveConfig] =
    useState<FormConfigData | null>(null);
  const [habitLiveConfig, setHabitLiveConfig] = useState<FormConfigData | null>(
    null
  );

  // Track pending unsaved changes from the editor
  const pendingConfigRef = useRef<FormConfigData | null>(null);

  // Only update live config — NOT the saved config. Updating checkinConfigData
  // here would change the initialConfig prop to FormConfigEditor, which resets
  // its internal isDirty and defeats dirty tracking.
  const handleEditorChange = useCallback(
    (data: FormConfigData) => {
      pendingConfigRef.current = data;
      if (selectedFormType === "checkins") {
        setCheckinLiveConfig(data);
      } else {
        setHabitLiveConfig(data);
      }
    },
    [selectedFormType]
  );

  // Fetch form configuration — extracted for reuse (initial load + discard)
  const fetchConfig = useCallback(async () => {
    pendingConfigRef.current = null;
    setIsLoadingConfig(true);
    try {
      const response = await fetch(
        `/api/forms/configs/${clientId}?form_type=${selectedFormType}`
      );
      const data = await response.json();

      if (data.success && data.config) {
        const raw = data.config.questions_config;

        if (isStructuredConfig(raw)) {
          if (selectedFormType === "checkins") {
            setCheckinConfigData(raw);
            setCheckinLiveConfig(raw);
            setCheckinQuestions(raw.questions);
          } else {
            setHabitConfigData(raw);
            setHabitLiveConfig(raw);
            setHabitQuestions(raw.questions);
          }
        } else if (Array.isArray(raw) && raw.length > 0) {
          const normalized = normalizeFormConfig(raw);

          if (selectedFormType === "checkins") {
            setCheckinConfigData(normalized);
            setCheckinLiveConfig(normalized);
            setCheckinQuestions(raw);
          } else {
            setHabitConfigData(normalized);
            setHabitLiveConfig(normalized);
            setHabitQuestions(raw);
          }
        } else {
          if (selectedFormType === "checkins") {
            setCheckinConfigData(DEFAULT_CHECKIN_CONFIG);
            setCheckinLiveConfig(DEFAULT_CHECKIN_CONFIG);
            setCheckinQuestions(DEFAULT_CHECKIN_CONFIG.questions);
          } else {
            setHabitConfigData(DEFAULT_HABIT_CONFIG);
            setHabitLiveConfig(DEFAULT_HABIT_CONFIG);
            setHabitQuestions(DEFAULT_HABIT_CONFIG.questions);
          }
        }
      } else {
        if (selectedFormType === "checkins") {
          setCheckinConfigData(DEFAULT_CHECKIN_CONFIG);
          setCheckinLiveConfig(DEFAULT_CHECKIN_CONFIG);
          setCheckinQuestions(DEFAULT_CHECKIN_CONFIG.questions);
        } else {
          setHabitConfigData(DEFAULT_HABIT_CONFIG);
          setHabitLiveConfig(DEFAULT_HABIT_CONFIG);
          setHabitQuestions(DEFAULT_HABIT_CONFIG.questions);
        }
      }
    } catch (error) {
      console.debug("Form config fetch:", error);
      if (selectedFormType === "checkins") {
        setCheckinConfigData(DEFAULT_CHECKIN_CONFIG);
        setCheckinLiveConfig(DEFAULT_CHECKIN_CONFIG);
        setCheckinQuestions(DEFAULT_CHECKIN_CONFIG.questions);
      } else {
        setHabitConfigData(DEFAULT_HABIT_CONFIG);
        setHabitLiveConfig(DEFAULT_HABIT_CONFIG);
        setHabitQuestions(DEFAULT_HABIT_CONFIG.questions);
      }
    } finally {
      setIsLoadingConfig(false);
    }
  }, [clientId, selectedFormType]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleDiscardChanges = useCallback(() => {
    if (
      !isConfigDirty ||
      !window.confirm(
        "Tienes cambios sin guardar en la configuración. ¿Quieres descartarlos?"
      )
    ) {
      return;
    }
    setIsConfigDirty(false);
    onConfigDirtyChange?.(false);
    pendingConfigRef.current = null;
    fetchConfig();
  }, [isConfigDirty, onConfigDirtyChange, fetchConfig]);

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

  // Save configuration handler — now sends structured format { pages, questions }
  const handleSaveConfiguration = async () => {
    setIsSavingConfig(true);
    try {
      // Prefer the live editor state (always current), fall back to saved snapshot
      const configData =
        selectedFormType === "checkins"
          ? checkinLiveConfig || checkinConfigData
          : habitLiveConfig || habitConfigData;

      // Determine what to send: structured or legacy
      const payload = configData
        ? configData // structured { pages, questions }
        : selectedFormType === "checkins"
          ? checkinQuestions
          : habitQuestions;

      const response = await fetch(`/api/forms/configs/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_type: selectedFormType,
          questions_config: payload,
          uses_template: false,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Sync saved config so initialConfig to FormConfigEditor stays current
        if (selectedFormType === "checkins" && checkinLiveConfig) {
          setCheckinConfigData(checkinLiveConfig);
        } else if (selectedFormType === "habits" && habitLiveConfig) {
          setHabitConfigData(habitLiveConfig);
        }
        pendingConfigRef.current = null;
        setIsConfigDirty(false);
        onConfigDirtyChange?.(false);
        addToast({
          title: "Configuración guardada",
          description: "Los cambios se han guardado exitosamente.",
          color: "success",
        });
      } else {
        addToast({
          title: "Error",
          description: data.error || "Error al guardar configuración",
          color: "danger",
        });
      }
    } catch (error) {
      console.error("Error saving config:", error);
      addToast({
        title: "Error de conexión",
        description: "No se pudo conectar al servidor para guardar.",
        color: "danger",
      });
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

  // Build preview sections from the structured config (page-aware)
  const previewConfig =
    selectedFormType === "checkins"
      ? (checkinLiveConfig ?? checkinConfigData)
      : (habitLiveConfig ?? habitConfigData);
  const previewSections = (() => {
    if (!previewConfig) {
      // Fallback: one flat list
      const qs =
        selectedFormType === "checkins"
          ? enabledCheckinQuestions
          : enabledHabitQuestions;

      return [
        { title: "General", icon: "solar:clipboard-check-bold", questions: qs },
      ];
    }
    const pages = [...previewConfig.pages].sort((a, b) => a.order - b.order);
    const enabledQs = previewConfig.questions.filter((q) => q.enabled);

    return pages
      .map((page) => ({
        title: page.title,
        icon: page.icon,
        questions: enabledQs.filter(
          (q) => (q.pageId || pages[0]?.id) === page.id
        ),
      }))
      .filter((s) => s.questions.length > 0);
  })();

  // Transform responses for display — newest first
  const displayResponses = responses
    .map((r) => ({
      id: r.id,
      date: r.response_date,
      type: r.form_type,
      answers: r.answers,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

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

  const showStickySaveBar =
    selectedView === "configuration" && isConfigDirty && !isLoadingConfig;

  return (
    <div className={`flex flex-col gap-6 ${showStickySaveBar ? "pb-24" : ""}`}>
      {/* Tabs de tipos de formularios */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Tabs
          classNames={{
            tabList: "px-6",
            cursor: "bg-black",
            tab: "h-12",
            tabContent: "group-data-[selected=true]:text-black",
          }}
          selectedKey={selectedFormType}
          variant="underlined"
          onSelectionChange={(key) =>
            guardUnsaved(() =>
              setSelectedFormType(key as "checkins" | "habits")
            )
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
            cursor: "bg-black",
            tab: "h-12",
            tabContent: "group-data-[selected=true]:text-black",
          }}
          selectedKey={selectedView}
          variant="underlined"
          onSelectionChange={(key) =>
            guardUnsaved(() => setSelectedView(key as string))
          }
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
        <div className="space-y-3">
          {/* Loading state */}
          {isLoadingResponses && (
            <div className="flex justify-center items-center p-12">
              <Spinner label="Cargando respuestas..." size="lg" />
            </div>
          )}

          {/* Response list — single-line rows, newest first */}
          {!isLoadingResponses && displayResponses.length > 0 && (
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardBody className="p-0">
                <div className="divide-y divide-gray-100">
                  {displayResponses.map((response) => {
                    const answeredCount = Object.keys(response.answers).length;
                    const formattedDate = new Date(
                      response.date + "T12:00:00"
                    ).toLocaleDateString("es-ES", {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    });

                    return (
                      <button
                        key={response.id}
                        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                        type="button"
                        onClick={() => setViewingResponse(response)}
                      >
                        <Icon
                          className="text-gray-400 flex-shrink-0"
                          icon={
                            selectedFormType === "checkins"
                              ? "solar:clipboard-check-bold"
                              : "solar:calendar-mark-bold"
                          }
                          width={18}
                        />
                        <p className="text-sm font-semibold text-gray-900 capitalize flex-1">
                          {formattedDate}
                        </p>
                        <span className="text-xs text-gray-400">
                          {answeredCount} respuesta
                          {answeredCount !== 1 ? "s" : ""}
                        </span>
                        <Chip color="success" size="sm" variant="flat">
                          Completado
                        </Chip>
                        <Icon
                          className="text-gray-300"
                          icon="solar:alt-arrow-right-linear"
                          width={18}
                        />
                      </button>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          )}

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

      {/* CONFIGURATION VIEW — shared for both check-ins and habits */}
      {selectedView === "configuration" && (
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
                      {selectedFormType === "checkins"
                        ? "Preguntas del Check-in Semanal"
                        : "Métricas de Hábitos Diarios"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Organiza las preguntas en páginas, arrastra para reordenar
                      y activa/desactiva según necesites
                    </p>
                  </div>
                </div>

                {/* New editor component */}
                {((selectedFormType === "checkins" && checkinConfigData) ||
                  (selectedFormType === "habits" && habitConfigData)) && (
                  <FormConfigEditor
                    key={selectedFormType}
                    initialConfig={
                      selectedFormType === "checkins"
                        ? checkinConfigData!
                        : habitConfigData!
                    }
                    onChange={handleEditorChange}
                    onDirtyChange={handleDirtyChange}
                    onQuestionAdded={() =>
                      addToast({
                        title: "Pregunta agregada",
                        description:
                          "No olvides hacer clic en Guardar Configuración para guardar los cambios.",
                        color: "warning",
                      })
                    }
                  />
                )}

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
                        <p className="text-sm font-semibold text-slate-900 mb-1">
                          {selectedFormType === "checkins"
                            ? "Frecuencia del Check-in"
                            : "Seguimiento Diario"}
                        </p>
                        <p className="text-sm text-slate-700">
                          {selectedFormType === "checkins"
                            ? "Este formulario se enviará automáticamente cada semana. El cliente recibirá una notificación para completarlo."
                            : "Estas métricas se pueden registrar todos los días. El cliente puede completarlas cuando lo desee."}
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
                    onPress={() => {
                      setPreviewStep(0);
                      setIsPreviewModalOpen(true);
                    }}
                  >
                    Vista Previa del Formulario
                  </Button>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {/* Sticky save bar — appears when there are unsaved changes in configuration */}
      {showStickySaveBar && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-amber-50 border-t border-amber-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Chip color="warning" size="sm" variant="flat">
                Sin guardar
              </Chip>
              <span className="text-sm text-amber-800 font-medium">
                Tienes cambios sin guardar
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                color="default"
                variant="bordered"
                onPress={handleDiscardChanges}
              >
                Descartar cambios
              </Button>
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
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal — paginated, one page at a time */}
      <Modal
        classNames={{
          base: "max-h-[90vh]",
          header: "border-b border-gray-200 pb-3",
          body: "py-6",
          footer: "border-t border-gray-200",
        }}
        isOpen={isPreviewModalOpen}
        scrollBehavior="inside"
        size="3xl"
        onClose={() => setIsPreviewModalOpen(false)}
      >
        <ModalContent>
          {(() => {
            const totalPages = previewSections.length;
            const currentPage =
              previewSections[previewStep] || previewSections[0];
            const isFirstPage = previewStep === 0;
            const isLastPage = previewStep >= totalPages - 1;

            return (
              <>
                <ModalHeader className="flex flex-col gap-0 pb-0">
                  {/* Progress bar */}
                  {totalPages > 1 && (
                    <div className="w-full mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-gray-500">
                          Progreso
                        </p>
                        <p className="text-xs font-bold text-gray-900">
                          {Math.round(((previewStep + 1) / totalPages) * 100)}%
                        </p>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gray-900 rounded-full transition-all duration-300 ease-out"
                          style={{
                            width: `${((previewStep + 1) / totalPages) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between w-full">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {currentPage?.title || "General"}
                      </h3>
                      <p className="text-xs text-gray-500 font-normal">
                        Página {previewStep + 1} de {totalPages}
                        {" · "}
                        {currentPage?.questions.length || 0} pregunta
                        {(currentPage?.questions.length || 0) !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Icon
                      className="text-gray-400"
                      icon={currentPage?.icon || "solar:clipboard-check-bold"}
                      width={20}
                    />
                  </div>
                </ModalHeader>

                <ModalBody>
                  <div className="space-y-4">
                    {/* Questions for the current page */}
                    {currentPage?.questions.map((question) => (
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
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-bold text-gray-900">
                                  {question.label}
                                </p>
                                {question.required && (
                                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                    Obligatorio
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                {question.fullQuestion &&
                                question.fullQuestion !== question.label
                                  ? question.fullQuestion
                                  : question.type === "rating"
                                    ? "Califica del 1 al 5"
                                    : question.type === "number"
                                      ? `Ingresa el valor en ${question.unit || ""}`
                                      : question.type === "text"
                                        ? "Escribe tus comentarios"
                                        : question.type === "boolean"
                                          ? "Selecciona Sí o No"
                                          : question.type === "photo"
                                            ? "Sube una foto"
                                            : question.type === "group"
                                              ? `${question.subQuestions?.filter((sq) => sq.enabled).length || 0} elementos`
                                              : ""}
                              </p>
                            </div>
                          </div>

                          {/* Input preview by type */}
                          <div className="ml-14">
                            {question.type === "rating" && renderRatingInput()}
                            {question.type === "number" && (
                              <Input
                                classNames={{ input: "text-base" }}
                                endContent={
                                  <span className="text-sm text-gray-400">
                                    {question.unit}
                                  </span>
                                }
                                placeholder="Ej: 75"
                                type="number"
                              />
                            )}
                            {question.type === "text" && (
                              <Textarea
                                classNames={{ input: "text-base" }}
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
                                    <Icon
                                      icon="solar:check-circle-bold"
                                      width={20}
                                    />
                                  }
                                  variant="flat"
                                >
                                  Sí
                                </Button>
                                <Button
                                  className="flex-1"
                                  color="danger"
                                  startContent={
                                    <Icon
                                      icon="solar:close-circle-bold"
                                      width={20}
                                    />
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
                            {question.type === "group" &&
                              question.subQuestions && (
                                <div className="space-y-2">
                                  {question.subQuestions
                                    .filter((sq) => sq.enabled)
                                    .map((sub) => (
                                      <div
                                        key={sub.id}
                                        className="flex items-center gap-3 bg-gray-50 rounded-lg p-3"
                                      >
                                        <Icon
                                          className="text-gray-500 flex-shrink-0"
                                          icon={sub.icon}
                                          width={16}
                                        />
                                        <p className="text-xs font-semibold text-gray-700 flex-1">
                                          {sub.label}
                                        </p>
                                        {sub.type === "number" && (
                                          <Input
                                            className="w-28"
                                            endContent={
                                              <span className="text-[10px] text-gray-400">
                                                {sub.unit}
                                              </span>
                                            }
                                            placeholder="0"
                                            size="sm"
                                            type="number"
                                          />
                                        )}
                                        {sub.type === "photo" && (
                                          <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center">
                                            <Icon
                                              className="text-gray-300"
                                              icon="solar:camera-bold"
                                              width={20}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                </div>
                              )}
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </ModalBody>

                <ModalFooter>
                  <div className="flex items-center justify-between w-full">
                    <Button
                      variant="light"
                      onPress={() => setIsPreviewModalOpen(false)}
                    >
                      Cerrar
                    </Button>

                    <div className="flex items-center gap-2">
                      {!isFirstPage && (
                        <Button
                          startContent={
                            <Icon
                              icon="solar:alt-arrow-left-linear"
                              width={18}
                            />
                          }
                          variant="flat"
                          onPress={() =>
                            setPreviewStep((s) => Math.max(0, s - 1))
                          }
                        >
                          Anterior
                        </Button>
                      )}
                      {!isLastPage ? (
                        <Button
                          className="text-white font-semibold"
                          color="primary"
                          endContent={
                            <Icon
                              icon="solar:alt-arrow-right-linear"
                              width={18}
                            />
                          }
                          onPress={() =>
                            setPreviewStep((s) =>
                              Math.min(totalPages - 1, s + 1)
                            )
                          }
                        >
                          Siguiente
                        </Button>
                      ) : (
                        <Button
                          className="text-white font-semibold"
                          color="success"
                          startContent={
                            <Icon icon="solar:check-circle-bold" width={18} />
                          }
                          onPress={() => setIsPreviewModalOpen(false)}
                        >
                          Enviar (Vista Previa)
                        </Button>
                      )}
                    </div>
                  </div>
                </ModalFooter>
              </>
            );
          })()}
        </ModalContent>
      </Modal>

      {/* ── Response Detail Modal ──────────────────────────────── */}
      <Modal
        classNames={{
          base: "max-h-[90vh]",
          header: "border-b border-gray-200 pb-3",
          body: "py-6",
          footer: "border-t border-gray-200",
        }}
        isOpen={!!viewingResponse}
        scrollBehavior="inside"
        size="3xl"
        onClose={() => setViewingResponse(null)}
      >
        <ModalContent>
          {(() => {
            if (!viewingResponse) return null;
            const configData =
              selectedFormType === "checkins"
                ? (checkinLiveConfig ?? checkinConfigData)
                : (habitLiveConfig ?? habitConfigData);
            // Build page-aware sections from config
            const allQuestions =
              configData?.questions ||
              (selectedFormType === "checkins"
                ? checkinQuestions
                : habitQuestions);
            const configPages = configData?.pages || [];
            const sortedPages = [...configPages].sort(
              (a, b) => a.order - b.order
            );

            // Find all questions that have answers
            const answeredQIds = new Set(Object.keys(viewingResponse.answers));

            // Build sections
            const responseSections =
              sortedPages.length > 1
                ? sortedPages
                    .map((page) => ({
                      title: page.title,
                      icon: page.icon,
                      questions: allQuestions.filter(
                        (q) =>
                          (q.pageId || sortedPages[0]?.id) === page.id &&
                          (answeredQIds.has(q.id) ||
                            (q.type === "group" &&
                              q.subQuestions?.some((sq) =>
                                answeredQIds.has(sq.id)
                              )))
                      ),
                    }))
                    .filter((s) => s.questions.length > 0)
                : [
                    {
                      title: "Respuestas",
                      icon: "solar:clipboard-check-bold",
                      questions: allQuestions.filter(
                        (q) =>
                          answeredQIds.has(q.id) ||
                          (q.type === "group" &&
                            q.subQuestions?.some((sq) =>
                              answeredQIds.has(sq.id)
                            ))
                      ),
                    },
                  ];

            const formattedDate = new Date(
              viewingResponse.date + "T12:00:00"
            ).toLocaleDateString("es-ES", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            });

            const renderAnswer = (q: QuestionConfig) => {
              const answer = viewingResponse.answers[q.id];

              if (answer === undefined || answer === null) return null;

              if (q.type === "rating") {
                return (
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Icon
                        key={i}
                        className={
                          i < (answer as number)
                            ? "text-yellow-400"
                            : "text-gray-300"
                        }
                        icon="solar:star-bold"
                        width={18}
                      />
                    ))}
                    <span className="ml-1.5 text-sm font-semibold text-gray-700">
                      {answer}/5
                    </span>
                  </div>
                );
              }
              if (q.type === "number") {
                return (
                  <p className="text-sm font-semibold text-gray-900">
                    {answer} {q.unit || ""}
                  </p>
                );
              }
              if (q.type === "boolean") {
                return (
                  <Chip
                    color={answer === true ? "success" : "danger"}
                    size="sm"
                    variant="flat"
                  >
                    {answer === true ? "Sí" : "No"}
                  </Chip>
                );
              }
              if (q.type === "text") {
                return (
                  <p className="text-sm text-gray-800 whitespace-pre-line">
                    {answer}
                  </p>
                );
              }
              if (q.type === "photo") {
                return typeof answer === "string" &&
                  answer.startsWith("http") ? (
                  <a
                    className="block"
                    href={answer}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <img
                      alt={q.label}
                      className="w-full max-w-xs h-40 object-cover rounded-lg border border-gray-200"
                      src={answer}
                    />
                  </a>
                ) : (
                  <p className="text-xs text-gray-400 italic">Sin foto</p>
                );
              }

              return <p className="text-sm text-gray-800">{String(answer)}</p>;
            };

            return (
              <>
                <ModalHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100">
                      <Icon
                        className="text-slate-700"
                        icon={
                          selectedFormType === "checkins"
                            ? "solar:clipboard-check-bold"
                            : "solar:calendar-mark-bold"
                        }
                        width={22}
                      />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 capitalize">
                        {formattedDate}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {selectedFormType === "checkins"
                          ? "Check-in Semanal"
                          : "Hábitos Diarios"}{" "}
                        · {Object.keys(viewingResponse.answers).length}{" "}
                        respuestas
                      </p>
                    </div>
                  </div>
                </ModalHeader>
                <ModalBody>
                  <div className="space-y-6">
                    {responseSections.map((section, sIdx) => (
                      <div key={section.title} className="space-y-3">
                        {/* Section header */}
                        {responseSections.length > 1 && (
                          <div className="flex items-center gap-2.5 pt-1">
                            <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center">
                              <Icon
                                className="text-gray-600"
                                icon={section.icon}
                                width={16}
                              />
                            </div>
                            <p className="text-sm font-bold text-gray-900">
                              {section.title}
                            </p>
                            <div className="flex-1 border-t border-gray-200 ml-1" />
                          </div>
                        )}

                        {/* Questions & answers */}
                        {section.questions.map((question) => (
                          <Card
                            key={question.id}
                            className="bg-gray-50 border border-gray-200"
                          >
                            <CardBody className="p-4">
                              {/* Main question */}
                              {question.type !== "group" ? (
                                <div className="flex items-start gap-3">
                                  <div className="bg-white p-2 rounded-lg flex-shrink-0 border border-gray-100">
                                    <Icon
                                      className="text-gray-600"
                                      icon={question.icon}
                                      width={18}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-gray-500 mb-1">
                                      {question.label}
                                    </p>
                                    {renderAnswer(question)}
                                  </div>
                                </div>
                              ) : (
                                /* Group question with sub-answers */
                                <div>
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="bg-white p-1.5 rounded-lg flex-shrink-0 border border-gray-100">
                                      <Icon
                                        className="text-gray-600"
                                        icon={question.icon}
                                        width={16}
                                      />
                                    </div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                      {question.label}
                                    </p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    {question.subQuestions
                                      ?.filter(
                                        (sq) =>
                                          viewingResponse.answers[sq.id] !==
                                          undefined
                                      )
                                      .map((sub) => (
                                        <div
                                          key={sub.id}
                                          className="bg-white rounded-lg p-3 border border-gray-100"
                                        >
                                          <div className="flex items-center gap-2 mb-1.5">
                                            <Icon
                                              className="text-gray-500"
                                              icon={sub.icon}
                                              width={14}
                                            />
                                            <p className="text-[11px] font-semibold text-gray-500">
                                              {sub.label}
                                            </p>
                                          </div>
                                          {renderAnswer(sub)}
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </CardBody>
                          </Card>
                        ))}
                      </div>
                    ))}
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button
                    variant="light"
                    onPress={() => setViewingResponse(null)}
                  >
                    Cerrar
                  </Button>
                </ModalFooter>
              </>
            );
          })()}
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
              <div className="p-2 rounded-lg bg-slate-100">
                <Icon
                  className="text-slate-700"
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

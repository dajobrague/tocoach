"use client";

import { Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Switch, Tab, Tabs, Textarea } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

interface FormsTabProps {
    clientId: string;
}

// Tipos de preguntas disponibles
interface QuestionConfig {
    id: string;
    label: string;
    shortLabel?: string; // Para mostrar en la configuración
    fullQuestion?: string; // Pregunta completa para el formulario
    icon: string;
    type: 'rating' | 'number' | 'text' | 'boolean' | 'photo' | 'group';
    unit?: string;
    enabled: boolean;
    required: boolean;
    conditionalOn?: string; // ID de la pregunta de la que depende
    conditionalValue?: boolean; // Valor que debe tener para mostrarse
    subQuestions?: QuestionConfig[]; // Para preguntas agrupadas
}

// Tipos para respuestas
interface FormResponse {
    id: string;
    date: string;
    type: 'checkin' | 'habit';
    answers: Record<string, string | number>;
}

export default function FormsTab({ clientId }: FormsTabProps) {
    const [selectedFormType, setSelectedFormType] = useState("checkins");
    const [selectedView, setSelectedView] = useState("responses"); // "responses" o "configuration"
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [expandedResponse, setExpandedResponse] = useState<string | null>(null);

    // Configuración de preguntas para Check-ins
    const [checkinQuestions, setCheckinQuestions] = useState<QuestionConfig[]>([
        {
            id: 'personal_life',
            label: 'Vida Personal',
            fullQuestion: '¿Cómo va todo a nivel personal?',
            icon: 'solar:user-heart-bold',
            type: 'text',
            enabled: true,
            required: true
        },
        {
            id: 'gym_achievement',
            label: 'Triunfo en el Gimnasio',
            fullQuestion: 'Triunfo que has conseguido en el gimnasio desde última revisión',
            icon: 'solar:cup-star-bold',
            type: 'text',
            enabled: true,
            required: true
        },
        {
            id: 'other_victory',
            label: 'Otra Victoria',
            fullQuestion: '¿Alguna otra victoria que celebrar?',
            icon: 'solar:star-circle-bold',
            type: 'text',
            enabled: true,
            required: false
        },
        {
            id: 'biggest_challenge',
            label: 'Mayor Desafío',
            fullQuestion: '¿Cuál ha sido el mayor desafío al que te has enfrentado?',
            icon: 'solar:shield-warning-bold',
            type: 'text',
            enabled: true,
            required: true
        },
        {
            id: 'goals_completed',
            label: 'Objetivos Cumplidos',
            fullQuestion: '¿Has cumplido objetivos que te marcaste en nuestra última revisión?',
            icon: 'solar:check-square-bold',
            type: 'boolean',
            enabled: true,
            required: true
        },
        {
            id: 'goals_impediment',
            label: 'Impedimentos',
            fullQuestion: '¿Qué te lo ha impedido?',
            icon: 'solar:close-circle-bold',
            type: 'text',
            enabled: true,
            required: false,
            conditionalOn: 'goals_completed',
            conditionalValue: false
        },
        {
            id: 'focus_next_weeks',
            label: 'Enfoque Próximas Semanas',
            fullQuestion: '¿En qué quieres enfocarte especialmente para mejorar en estas próximas semanas?',
            icon: 'solar:target-bold',
            type: 'text',
            enabled: true,
            required: true
        },
        {
            id: 'service_rating',
            label: 'Valoración del Servicio',
            fullQuestion: '¿Cómo valoras el servicio que te estamos dando?',
            icon: 'solar:star-bold',
            type: 'rating',
            enabled: true,
            required: true
        },
        {
            id: 'service_details',
            label: 'Detalles del Servicio',
            fullQuestion: '¿Me puedes dar más detalles?',
            icon: 'solar:chat-round-dots-bold',
            type: 'text',
            enabled: true,
            required: false,
            conditionalOn: 'service_rating',
            conditionalValue: true // Se muestra si hay cualquier rating
        },
        {
            id: 'photos',
            label: 'Fotos de Progreso',
            icon: 'solar:camera-bold',
            type: 'group',
            enabled: true,
            required: false,
            subQuestions: [
                {
                    id: 'photo_front',
                    label: 'Foto de Frente',
                    icon: 'solar:user-bold',
                    type: 'photo',
                    enabled: true,
                    required: false
                },
                {
                    id: 'photo_side',
                    label: 'Foto de Perfil',
                    icon: 'solar:user-bold',
                    type: 'photo',
                    enabled: true,
                    required: false
                },
                {
                    id: 'photo_back',
                    label: 'Foto de Espaldas',
                    icon: 'solar:user-bold',
                    type: 'photo',
                    enabled: true,
                    required: false
                }
            ]
        },
        {
            id: 'body_measurements',
            label: 'Medidas Corporales',
            icon: 'solar:ruler-bold',
            type: 'group',
            enabled: true,
            required: false,
            subQuestions: [
                {
                    id: 'chest',
                    label: 'Pecho',
                    icon: 'solar:ruler-cross-pen-bold',
                    type: 'number',
                    unit: 'cm',
                    enabled: true,
                    required: false
                },
                {
                    id: 'shoulders',
                    label: 'Hombros',
                    icon: 'solar:ruler-cross-pen-bold',
                    type: 'number',
                    unit: 'cm',
                    enabled: true,
                    required: false
                },
                {
                    id: 'arm',
                    label: 'Brazo',
                    icon: 'solar:ruler-cross-pen-bold',
                    type: 'number',
                    unit: 'cm',
                    enabled: true,
                    required: false
                },
                {
                    id: 'above_navel',
                    label: 'Sobre el Ombligo 3cm',
                    icon: 'solar:ruler-cross-pen-bold',
                    type: 'number',
                    unit: 'cm',
                    enabled: true,
                    required: false
                },
                {
                    id: 'below_navel',
                    label: 'Bajo el Ombligo 3cm',
                    icon: 'solar:ruler-cross-pen-bold',
                    type: 'number',
                    unit: 'cm',
                    enabled: true,
                    required: false
                },
                {
                    id: 'groin',
                    label: 'Ingle',
                    icon: 'solar:ruler-cross-pen-bold',
                    type: 'number',
                    unit: 'cm',
                    enabled: true,
                    required: false
                },
                {
                    id: 'thigh',
                    label: 'Muslo',
                    icon: 'solar:ruler-cross-pen-bold',
                    type: 'number',
                    unit: 'cm',
                    enabled: true,
                    required: false
                },
                {
                    id: 'calf',
                    label: 'Gemelo',
                    icon: 'solar:ruler-cross-pen-bold',
                    type: 'number',
                    unit: 'cm',
                    enabled: true,
                    required: false
                }
            ]
        },
        {
            id: 'body_weight',
            label: 'Peso Corporal',
            icon: 'solar:scale-bold',
            type: 'number',
            unit: 'kg',
            enabled: true,
            required: true
        }
    ]);

    // Configuración de preguntas para Hábitos Diarios
    const [habitQuestions, setHabitQuestions] = useState<QuestionConfig[]>([
        // CATEGORÍA: OTRAS (Salud y Actividad)
        {
            id: 'energy_levels',
            label: 'Niveles de Energía',
            fullQuestion: 'Niveles de energía durante el día',
            icon: 'solar:bolt-bold',
            type: 'rating',
            enabled: true,
            required: false
        },
        {
            id: 'stress_levels',
            label: 'Manejo del Estrés',
            fullQuestion: '¿Qué tal has sobrellevado el estrés?',
            icon: 'solar:shield-warning-bold',
            type: 'rating',
            enabled: true,
            required: false
        },
        {
            id: 'illness_signs',
            label: 'Signos de Enfermedad',
            fullQuestion: '¿Has tenido algún signo de enfermedad, infección, dolor?',
            icon: 'solar:health-bold',
            type: 'boolean',
            enabled: true,
            required: false
        },
        {
            id: 'illness_details',
            label: 'Detalles de Enfermedad',
            fullQuestion: 'Más detalles',
            icon: 'solar:notes-bold',
            type: 'text',
            enabled: true,
            required: false,
            conditionalOn: 'illness_signs',
            conditionalValue: true
        },
        {
            id: 'steps',
            label: 'Pasos del Día',
            fullQuestion: '¿Cuántos pasos has hecho hoy?',
            icon: 'solar:walking-bold',
            type: 'number',
            unit: 'pasos',
            enabled: true,
            required: false
        },
        {
            id: 'other_activity',
            label: 'Otra Actividad Física',
            fullQuestion: '¿Otra actividad física exigente?',
            icon: 'solar:running-bold',
            type: 'boolean',
            enabled: true,
            required: false
        },
        {
            id: 'other_activity_details',
            label: 'Detalles de Actividad',
            fullQuestion: 'Más detalles',
            icon: 'solar:notes-bold',
            type: 'text',
            enabled: true,
            required: false,
            conditionalOn: 'other_activity',
            conditionalValue: true
        },
        {
            id: 'special_comment',
            label: 'Comentario Especial',
            fullQuestion: 'Comentario especial',
            icon: 'solar:chat-round-dots-bold',
            type: 'boolean',
            enabled: false,
            required: false
        },
        {
            id: 'sun_exposure',
            label: 'Exposición Solar',
            fullQuestion: 'Horas de exposición al sol durante el día',
            icon: 'solar:sun-bold',
            type: 'number',
            unit: 'horas',
            enabled: true,
            required: false
        },

        // CATEGORÍA: NUTRICIÓN
        {
            id: 'macro_tracking',
            label: 'Seguimiento de Macros',
            fullQuestion: '¿Seguimiento de macros hoy?',
            icon: 'solar:pie-chart-bold',
            type: 'group',
            enabled: true,
            required: false,
            subQuestions: [
                {
                    id: 'calories',
                    label: 'Calorías Totales',
                    icon: 'solar:fire-bold',
                    type: 'number',
                    unit: 'kcal',
                    enabled: true,
                    required: false
                },
                {
                    id: 'protein',
                    label: 'Proteína',
                    icon: 'solar:nutrition-bold',
                    type: 'number',
                    unit: 'g',
                    enabled: true,
                    required: false
                },
                {
                    id: 'carbs',
                    label: 'Carbohidratos',
                    icon: 'solar:leaf-bold',
                    type: 'number',
                    unit: 'g',
                    enabled: true,
                    required: false
                },
                {
                    id: 'fats',
                    label: 'Grasas',
                    icon: 'solar:drop-bold',
                    type: 'number',
                    unit: 'g',
                    enabled: true,
                    required: false
                }
            ]
        },
        {
            id: 'hunger_levels',
            label: 'Niveles de Hambre',
            fullQuestion: '¿Cómo han sido tus niveles de hambre?',
            icon: 'solar:hamburger-bold',
            type: 'rating',
            enabled: true,
            required: false
        },
        {
            id: 'adherence',
            label: 'Adherencia al Plan',
            fullQuestion: '¿Cómo ha sido la adherencia?',
            icon: 'solar:check-circle-bold',
            type: 'rating',
            enabled: true,
            required: false
        },
        {
            id: 'adherence_reason',
            label: 'Razón de No Adherencia',
            fullQuestion: '¿Por qué no te has podido ceñir al plan?',
            icon: 'solar:question-circle-bold',
            type: 'text',
            enabled: true,
            required: false,
            conditionalOn: 'adherence',
            conditionalValue: true // Se muestra si el rating es bajo
        },
        {
            id: 'caffeine',
            label: 'Consumo de Cafeína',
            fullQuestion: '¿Cuánta cafeína se ha consumido?',
            icon: 'solar:cup-hot-bold',
            type: 'number',
            unit: 'mg',
            enabled: true,
            required: false
        },
        {
            id: 'supplementation',
            label: 'Suplementación',
            fullQuestion: 'Suplementación',
            icon: 'solar:pill-bold',
            type: 'text',
            enabled: true,
            required: false
        },

        // CATEGORÍA: DESCANSO
        {
            id: 'bedtime',
            label: 'Hora de Acostar',
            fullQuestion: '¿A qué hora te acostaste ayer?',
            icon: 'solar:moon-stars-bold',
            type: 'text',
            enabled: true,
            required: false
        },
        {
            id: 'wake_time',
            label: 'Hora de Despertar',
            fullQuestion: '¿A qué hora te has despertado hoy?',
            icon: 'solar:sun-fog-bold',
            type: 'text',
            enabled: true,
            required: false
        },
        {
            id: 'sleep_hours',
            label: 'Horas de Sueño',
            fullQuestion: '¿Cuántas horas has dormido en total?',
            icon: 'solar:sleep-bold',
            type: 'number',
            unit: 'horas',
            enabled: true,
            required: false
        },
        {
            id: 'morning_feeling',
            label: 'Sensación al Despertar',
            fullQuestion: 'Al salir de cama esta mañana sentías que',
            icon: 'solar:smile-circle-bold',
            type: 'rating',
            enabled: true,
            required: false
        },
        {
            id: 'morning_feeling_details',
            label: 'Detalles de Despertar',
            fullQuestion: 'Más detalles',
            icon: 'solar:notes-bold',
            type: 'text',
            enabled: true,
            required: false,
            conditionalOn: 'morning_feeling',
            conditionalValue: true // Se muestra si el rating es 3 o menos
        }
    ]);

    const toggleCheckinQuestion = (questionId: string, parentId?: string) => {
        setCheckinQuestions(checkinQuestions.map(q => {
            if (parentId && q.id === parentId && q.subQuestions) {
                // Toggle sub-pregunta
                return {
                    ...q,
                    subQuestions: q.subQuestions.map(sq =>
                        sq.id === questionId ? { ...sq, enabled: !sq.enabled } : sq
                    )
                };
            } else if (q.id === questionId) {
                // Toggle pregunta principal
                return { ...q, enabled: !q.enabled };
            }
            return q;
        }));
    };

    const toggleCheckinRequired = (questionId: string, parentId?: string) => {
        setCheckinQuestions(checkinQuestions.map(q => {
            if (parentId && q.id === parentId && q.subQuestions) {
                // Toggle required en sub-pregunta
                return {
                    ...q,
                    subQuestions: q.subQuestions.map(sq =>
                        sq.id === questionId ? { ...sq, required: !sq.required } : sq
                    )
                };
            } else if (q.id === questionId) {
                // Toggle required en pregunta principal
                return { ...q, required: !q.required };
            }
            return q;
        }));
    };

    const toggleHabitQuestion = (questionId: string, parentId?: string) => {
        setHabitQuestions(habitQuestions.map(q => {
            if (parentId && q.id === parentId && q.subQuestions) {
                // Toggle sub-pregunta
                return {
                    ...q,
                    subQuestions: q.subQuestions.map(sq =>
                        sq.id === questionId ? { ...sq, enabled: !sq.enabled } : sq
                    )
                };
            } else if (q.id === questionId) {
                // Toggle pregunta principal
                return { ...q, enabled: !q.enabled };
            }
            return q;
        }));
    };

    const toggleHabitRequired = (questionId: string, parentId?: string) => {
        setHabitQuestions(habitQuestions.map(q => {
            if (parentId && q.id === parentId && q.subQuestions) {
                // Toggle required en sub-pregunta
                return {
                    ...q,
                    subQuestions: q.subQuestions.map(sq =>
                        sq.id === questionId ? { ...sq, required: !sq.required } : sq
                    )
                };
            } else if (q.id === questionId) {
                // Toggle required en pregunta principal
                return { ...q, required: !q.required };
            }
            return q;
        }));
    };

    const enabledCheckinQuestions = checkinQuestions.filter(q => q.enabled);
    const enabledHabitQuestions = habitQuestions.filter(q => q.enabled);

    // Mock data para respuestas de check-ins
    const mockCheckinResponses: FormResponse[] = [
        {
            id: '1',
            date: '2025-10-13',
            type: 'checkin',
            answers: {
                weight: 82.5,
                energy: 4,
                sleep: 5,
                stress: 2,
                mood: 4,
                progress: 'Muy buena semana, he visto mejoras en mi fuerza y resistencia.',
                challenges: 'Me costó un poco mantener la dieta durante el fin de semana.',
                achievements: 'Logré completar todos los entrenamientos programados y mejoré mi PR en sentadillas.'
            }
        },
        {
            id: '2',
            date: '2025-10-06',
            type: 'checkin',
            answers: {
                weight: 83.0,
                energy: 3,
                sleep: 4,
                stress: 3,
                mood: 3,
                progress: 'Semana normal, avanzando constantemente.',
                challenges: 'Tuve mucho trabajo y me sentí cansado algunos días.',
                achievements: 'Mantuve la consistencia a pesar de la carga de trabajo.'
            }
        },
        {
            id: '3',
            date: '2025-09-29',
            type: 'checkin',
            answers: {
                weight: 83.5,
                energy: 4,
                sleep: 4,
                stress: 2,
                mood: 5,
                progress: 'Excelente semana, me siento muy motivado.',
                challenges: 'Ningún reto significativo.',
                achievements: 'Completé todas las sesiones y mejoré mi técnica en peso muerto.'
            }
        }
    ];

    // Mock data para respuestas de hábitos diarios
    const mockHabitResponses: FormResponse[] = [
        {
            id: '1',
            date: '2025-10-15',
            type: 'habit',
            answers: {
                steps: 12500,
                sleep_hours: 7.5,
                water: 8
            }
        },
        {
            id: '2',
            date: '2025-10-14',
            type: 'habit',
            answers: {
                steps: 10200,
                sleep_hours: 7,
                water: 7
            }
        },
        {
            id: '3',
            date: '2025-10-13',
            type: 'habit',
            answers: {
                steps: 9800,
                sleep_hours: 6.5,
                water: 6
            }
        }
    ];

    const renderRatingInput = () => {
        return (
            <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <Icon
                            icon="solar:star-linear"
                            className="text-gray-300 hover:text-yellow-400"
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
                    selectedKey={selectedFormType}
                    onSelectionChange={(key) => setSelectedFormType(key as string)}
                    variant="underlined"
                    classNames={{
                        tabList: "px-6",
                        cursor: "bg-blue-600",
                        tab: "h-12",
                        tabContent: "group-data-[selected=true]:text-blue-600"
                    }}
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
                    selectedKey={selectedView}
                    onSelectionChange={(key) => setSelectedView(key as string)}
                    variant="underlined"
                    classNames={{
                        tabList: "px-6",
                        cursor: "bg-blue-600",
                        tab: "h-12",
                        tabContent: "group-data-[selected=true]:text-blue-600"
                    }}
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
                    {/* Lista de respuestas */}
                    {(selectedFormType === "checkins" ? mockCheckinResponses : mockHabitResponses).map((response) => {
                        const isExpanded = expandedResponse === response.id;
                        const questions = selectedFormType === "checkins" ? checkinQuestions : habitQuestions;
                        const formattedDate = new Date(response.date + 'T12:00:00').toLocaleDateString('es-ES', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });

                        return (
                            <Card key={response.id} className="bg-white border border-gray-200 shadow-sm">
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
                                                            icon={selectedFormType === 'checkins' ? 'solar:clipboard-check-bold' : 'solar:calendar-mark-bold'}
                                                            className="text-blue-600"
                                                            width={24}
                                                        />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-gray-900 capitalize">{formattedDate}</h3>
                                                        <p className="text-sm text-gray-500">
                                                            {selectedFormType === 'checkins' ? 'Check-in Semanal' : 'Hábitos Diarios'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Chip
                                                        color="success"
                                                        variant="flat"
                                                        size="sm"
                                                        startContent={<Icon icon="solar:check-circle-bold" width={16} />}
                                                    >
                                                        Completado
                                                    </Chip>
                                                    <Icon
                                                        icon={isExpanded ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"}
                                                        className="text-gray-400"
                                                        width={24}
                                                    />
                                                </div>
                                            </div>
                                        </summary>

                                        {/* Respuestas del formulario */}
                                        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-4">
                                            {questions.filter(q => response.answers[q.id] !== undefined).map((question) => {
                                                const answer = response.answers[question.id];
                                                return (
                                                    <Card key={question.id} className="bg-gray-50 border border-gray-200">
                                                        <CardBody className="p-3">
                                                            <div className="flex items-start gap-3">
                                                                <div className="bg-white p-2 rounded-lg flex-shrink-0">
                                                                    <Icon
                                                                        icon={question.icon}
                                                                        className="text-gray-600"
                                                                        width={20}
                                                                    />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="text-sm font-semibold text-gray-700 mb-1">
                                                                        {question.label}
                                                                    </p>
                                                                    <div className="text-sm text-gray-900">
                                                                        {question.type === 'rating' && (
                                                                            <div className="flex gap-1">
                                                                                {Array.from({ length: 5 }).map((_, i) => (
                                                                                    <Icon
                                                                                        key={i}
                                                                                        icon="solar:star-bold"
                                                                                        className={i < (answer as number) ? 'text-yellow-400' : 'text-gray-300'}
                                                                                        width={20}
                                                                                    />
                                                                                ))}
                                                                                <span className="ml-2 font-semibold text-gray-700">
                                                                                    {answer}/5
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {question.type === 'number' && (
                                                                            <p className="font-semibold">
                                                                                {answer} {question.unit}
                                                                            </p>
                                                                        )}
                                                                        {question.type === 'text' && (
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
                    {(selectedFormType === "checkins" ? mockCheckinResponses : mockHabitResponses).length === 0 && (
                        <Card className="bg-white border border-gray-200 shadow-sm">
                            <CardBody className="p-12">
                                <div className="text-center">
                                    <div className="bg-gray-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                        <Icon icon="solar:document-text-linear" className="text-gray-400 text-3xl" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin respuestas aún</h3>
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
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Preguntas del Check-in Semanal</h3>
                                <p className="text-sm text-gray-500">Activa/desactiva preguntas y marca las obligatorias</p>
                            </div>
                            <Chip color="primary" variant="solid" size="lg" className="text-white">
                                {enabledCheckinQuestions.length} preguntas activas
                            </Chip>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {checkinQuestions.map((question) => (
                                <Card key={question.id} className={`border-2 transition-all ${question.enabled
                                    ? 'border-blue-300 bg-blue-50'
                                    : 'border-gray-200 bg-gray-50'
                                    }`}>
                                    <CardBody className="p-4">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className={`p-2 rounded-lg flex-shrink-0 ${question.enabled ? 'bg-blue-100' : 'bg-gray-200'
                                                }`}>
                                                <Icon
                                                    icon={question.icon}
                                                    className={question.enabled ? 'text-blue-600' : 'text-gray-400'}
                                                    width={20}
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold mb-1 ${question.enabled ? 'text-gray-900' : 'text-gray-500'
                                                    }`}>
                                                    {question.label}
                                                </p>
                                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                                    {question.type === 'rating' && (
                                                        <>
                                                            <Icon icon="solar:star-bold" width={12} />
                                                            <span>Escala 1-5</span>
                                                        </>
                                                    )}
                                                    {question.type === 'number' && (
                                                        <>
                                                            <Icon icon="solar:hashtag-bold" width={12} />
                                                            <span>Número ({question.unit})</span>
                                                        </>
                                                    )}
                                                    {question.type === 'text' && (
                                                        <>
                                                            <Icon icon="solar:text-bold" width={12} />
                                                            <span>Texto</span>
                                                        </>
                                                    )}
                                                    {question.type === 'boolean' && (
                                                        <>
                                                            <Icon icon="solar:check-circle-bold" width={12} />
                                                            <span>Sí/No</span>
                                                        </>
                                                    )}
                                                    {question.type === 'photo' && (
                                                        <>
                                                            <Icon icon="solar:camera-bold" width={12} />
                                                            <span>Foto</span>
                                                        </>
                                                    )}
                                                    {question.type === 'group' && (
                                                        <>
                                                            <Icon icon="solar:folder-bold" width={12} />
                                                            <span>Grupo ({question.subQuestions?.length || 0} items)</span>
                                                        </>
                                                    )}
                                                </div>
                                                {question.conditionalOn && (
                                                    <Chip size="sm" variant="flat" color="warning" className="mt-1">
                                                        Condicional
                                                    </Chip>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-blue-200">
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    isSelected={question.enabled}
                                                    onValueChange={() => toggleCheckinQuestion(question.id)}
                                                    size="sm"
                                                    color="primary"
                                                    classNames={{
                                                        wrapper: "group-data-[selected=true]:bg-blue-600 bg-gray-300"
                                                    }}
                                                />
                                                <span className="text-xs font-semibold text-gray-700">
                                                    {question.enabled ? 'Activa' : 'Inactiva'}
                                                </span>
                                            </div>
                                            {question.enabled && !question.conditionalOn && (
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        isSelected={question.required}
                                                        onValueChange={() => toggleCheckinRequired(question.id)}
                                                        size="sm"
                                                        color="primary"
                                                        classNames={{
                                                            wrapper: "group-data-[selected=true]:bg-blue-600 bg-gray-300"
                                                        }}
                                                    />
                                                    <span className={`text-xs font-semibold ${question.required ? 'text-blue-700' : 'text-gray-500'}`}>
                                                        {question.required ? '★ Obligatorio' : 'Opcional'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Sub-preguntas dentro de la tarjeta */}
                                        {question.type === 'group' && question.enabled && question.subQuestions && (
                                            <div className="mt-3 pt-3 border-t border-blue-200 space-y-2">
                                                <p className="text-xs font-bold text-gray-700 mb-2">Elementos del grupo:</p>
                                                {question.subQuestions.map((subQuestion) => (
                                                    <div key={subQuestion.id} className={`flex items-center gap-2 p-2 rounded-lg ${subQuestion.enabled
                                                        ? 'bg-blue-100'
                                                        : 'bg-gray-100'
                                                        }`}>
                                                        <Icon
                                                            icon={subQuestion.icon}
                                                            className={subQuestion.enabled ? 'text-blue-600' : 'text-gray-400'}
                                                            width={14}
                                                        />
                                                        <span className={`text-xs flex-1 ${subQuestion.enabled ? 'text-gray-900' : 'text-gray-500'
                                                            }`}>
                                                            {subQuestion.label}
                                                        </span>
                                                        <Switch
                                                            isSelected={subQuestion.enabled}
                                                            onValueChange={() => toggleCheckinQuestion(subQuestion.id, question.id)}
                                                            size="sm"
                                                            color="primary"
                                                            classNames={{
                                                                wrapper: "group-data-[selected=true]:bg-blue-600 bg-gray-300"
                                                            }}
                                                        />
                                                        {subQuestion.enabled && (
                                                            <>
                                                                <Switch
                                                                    isSelected={subQuestion.required}
                                                                    onValueChange={() => toggleCheckinRequired(subQuestion.id, question.id)}
                                                                    size="sm"
                                                                    color="primary"
                                                                    classNames={{
                                                                        wrapper: "group-data-[selected=true]:bg-blue-600 bg-gray-300"
                                                                    }}
                                                                />
                                                                <span className={`text-xs font-semibold ${subQuestion.required ? 'text-blue-700' : 'text-gray-500'}`}>
                                                                    {subQuestion.required ? '★ Obligatorio' : 'Opcional'}
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
                                    <Icon icon="solar:info-circle-bold" className="text-blue-600 mt-0.5 flex-shrink-0" width={18} />
                                    <div>
                                        <p className="text-sm font-semibold text-blue-900 mb-1">Frecuencia del Check-in</p>
                                        <p className="text-sm text-blue-700">
                                            Este formulario se enviará automáticamente cada semana. El cliente recibirá una notificación para completarlo.
                                        </p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>

                        {/* Action Buttons */}
                        <div className="flex gap-3 mt-6">
                            <Button
                                color="primary"
                                startContent={<Icon icon="solar:diskette-bold" width={18} />}
                                className="text-white font-semibold"
                            >
                                Guardar Configuración
                            </Button>
                            <Button
                                variant="bordered"
                                startContent={<Icon icon="solar:eye-linear" width={18} />}
                                onPress={() => setIsPreviewModalOpen(true)}
                            >
                                Vista Previa del Formulario
                            </Button>
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* HABITS CONFIGURATION */}
            {selectedView === "configuration" && selectedFormType === "habits" && (
                <Card className="bg-white border border-gray-200 shadow-sm">
                    <CardBody className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Métricas de Hábitos Diarios</h3>
                                <p className="text-sm text-gray-500">Activa/desactiva métricas y marca las obligatorias</p>
                            </div>
                            <Chip color="primary" variant="solid" size="lg" className="text-white">
                                {enabledHabitQuestions.length} métricas activas
                            </Chip>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {habitQuestions.map((question) => (
                                <Card key={question.id} className={`border-2 transition-all ${question.enabled
                                    ? 'border-blue-300 bg-blue-50'
                                    : 'border-gray-200 bg-gray-50'
                                    }`}>
                                    <CardBody className="p-4">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className={`p-2 rounded-lg flex-shrink-0 ${question.enabled ? 'bg-blue-100' : 'bg-gray-200'
                                                }`}>
                                                <Icon
                                                    icon={question.icon}
                                                    className={question.enabled ? 'text-blue-600' : 'text-gray-400'}
                                                    width={20}
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold mb-1 ${question.enabled ? 'text-gray-900' : 'text-gray-500'
                                                    }`}>
                                                    {question.label}
                                                </p>
                                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                                    {question.type === 'rating' && (
                                                        <>
                                                            <Icon icon="solar:star-bold" width={12} />
                                                            <span>Escala 1-5</span>
                                                        </>
                                                    )}
                                                    {question.type === 'number' && (
                                                        <>
                                                            <Icon icon="solar:hashtag-bold" width={12} />
                                                            <span>Número ({question.unit})</span>
                                                        </>
                                                    )}
                                                    {question.type === 'text' && (
                                                        <>
                                                            <Icon icon="solar:text-bold" width={12} />
                                                            <span>Texto</span>
                                                        </>
                                                    )}
                                                    {question.type === 'boolean' && (
                                                        <>
                                                            <Icon icon="solar:check-circle-bold" width={12} />
                                                            <span>Sí/No</span>
                                                        </>
                                                    )}
                                                    {question.type === 'group' && (
                                                        <>
                                                            <Icon icon="solar:folder-bold" width={12} />
                                                            <span>Grupo ({question.subQuestions?.length || 0} items)</span>
                                                        </>
                                                    )}
                                                </div>
                                                {question.conditionalOn && (
                                                    <Chip size="sm" variant="flat" color="warning" className="mt-1">
                                                        Condicional
                                                    </Chip>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-blue-200">
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    isSelected={question.enabled}
                                                    onValueChange={() => toggleHabitQuestion(question.id)}
                                                    size="sm"
                                                    color="primary"
                                                    classNames={{
                                                        wrapper: "group-data-[selected=true]:bg-blue-600 bg-gray-300"
                                                    }}
                                                />
                                                <span className="text-xs font-semibold text-gray-700">
                                                    {question.enabled ? 'Activa' : 'Inactiva'}
                                                </span>
                                            </div>
                                            {question.enabled && !question.conditionalOn && (
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        isSelected={question.required}
                                                        onValueChange={() => toggleHabitRequired(question.id)}
                                                        size="sm"
                                                        color="primary"
                                                        classNames={{
                                                            wrapper: "group-data-[selected=true]:bg-blue-600 bg-gray-300"
                                                        }}
                                                    />
                                                    <span className={`text-xs font-semibold ${question.required ? 'text-blue-700' : 'text-gray-500'}`}>
                                                        {question.required ? '★ Obligatorio' : 'Opcional'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Sub-preguntas dentro de la tarjeta */}
                                        {question.type === 'group' && question.enabled && question.subQuestions && (
                                            <div className="mt-3 pt-3 border-t border-blue-200 space-y-2">
                                                <p className="text-xs font-bold text-gray-700 mb-2">Elementos del grupo:</p>
                                                {question.subQuestions.map((subQuestion) => (
                                                    <div key={subQuestion.id} className={`flex items-center gap-2 p-2 rounded-lg ${subQuestion.enabled
                                                        ? 'bg-blue-100'
                                                        : 'bg-gray-100'
                                                        }`}>
                                                        <Icon
                                                            icon={subQuestion.icon}
                                                            className={subQuestion.enabled ? 'text-blue-600' : 'text-gray-400'}
                                                            width={14}
                                                        />
                                                        <span className={`text-xs flex-1 ${subQuestion.enabled ? 'text-gray-900' : 'text-gray-500'
                                                            }`}>
                                                            {subQuestion.label}
                                                        </span>
                                                        <Switch
                                                            isSelected={subQuestion.enabled}
                                                            onValueChange={() => toggleHabitQuestion(subQuestion.id, question.id)}
                                                            size="sm"
                                                            color="primary"
                                                            classNames={{
                                                                wrapper: "group-data-[selected=true]:bg-blue-600 bg-gray-300"
                                                            }}
                                                        />
                                                        {subQuestion.enabled && (
                                                            <>
                                                                <Switch
                                                                    isSelected={subQuestion.required}
                                                                    onValueChange={() => toggleHabitRequired(subQuestion.id, question.id)}
                                                                    size="sm"
                                                                    color="primary"
                                                                    classNames={{
                                                                        wrapper: "group-data-[selected=true]:bg-blue-600 bg-gray-300"
                                                                    }}
                                                                />
                                                                <span className={`text-xs font-semibold ${subQuestion.required ? 'text-blue-700' : 'text-gray-500'}`}>
                                                                    {subQuestion.required ? '★ Obligatorio' : 'Opcional'}
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
                                    <Icon icon="solar:info-circle-bold" className="text-blue-600 mt-0.5 flex-shrink-0" width={18} />
                                    <div>
                                        <p className="text-sm font-semibold text-blue-900 mb-1">Seguimiento Diario</p>
                                        <p className="text-sm text-blue-700">
                                            Estas métricas se pueden registrar todos los días. El cliente puede completarlas cuando lo desee.
                                        </p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>

                        {/* Action Buttons */}
                        <div className="flex gap-3 mt-6">
                            <Button
                                color="primary"
                                startContent={<Icon icon="solar:diskette-bold" width={18} />}
                                className="text-white font-semibold"
                            >
                                Guardar Configuración
                            </Button>
                            <Button
                                variant="bordered"
                                startContent={<Icon icon="solar:eye-linear" width={18} />}
                                onPress={() => setIsPreviewModalOpen(true)}
                            >
                                Vista Previa del Formulario
                            </Button>
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* Preview Modal */}
            <Modal
                isOpen={isPreviewModalOpen}
                onClose={() => setIsPreviewModalOpen(false)}
                size="3xl"
                scrollBehavior="inside"
                classNames={{
                    base: "max-h-[90vh]",
                    header: "border-b border-gray-200",
                    body: "py-6",
                    footer: "border-t border-gray-200"
                }}
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-50">
                                <Icon
                                    icon={selectedFormType === 'checkins' ? "solar:clipboard-check-bold" : "solar:calendar-mark-bold"}
                                    className="text-blue-600"
                                    width={24}
                                />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">
                                    Vista Previa: {selectedFormType === 'checkins' ? 'Check-in Semanal' : 'Hábitos Diarios'}
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
                                            icon="solar:info-circle-bold"
                                            className="text-blue-600"
                                            width={20}
                                        />
                                        <div>
                                            <p className="text-sm font-semibold mb-1 text-blue-900">
                                                {selectedFormType === 'checkins' ? 'Check-in Semanal' : 'Registro de Hábitos'}
                                            </p>
                                            <p className="text-sm text-blue-700">
                                                {selectedFormType === 'checkins'
                                                    ? 'Completa este formulario para que tu entrenador pueda hacer seguimiento de tu progreso.'
                                                    : 'Registra tus hábitos diarios para mantener un seguimiento constante.'}
                                            </p>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>

                            {/* Form Questions */}
                            {(selectedFormType === 'checkins' ? enabledCheckinQuestions : enabledHabitQuestions).map((question) => (
                                <Card key={question.id} className="bg-white border border-gray-200">
                                    <CardBody className="p-5">
                                        <div className="flex items-start gap-3 mb-4">
                                            <div className="bg-gray-100 p-2 rounded-lg flex-shrink-0">
                                                <Icon
                                                    icon={question.icon}
                                                    className="text-gray-600"
                                                    width={20}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-gray-900 mb-1">
                                                    {question.label}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {question.type === 'rating' && 'Califica del 1 al 5'}
                                                    {question.type === 'number' && `Ingresa el valor en ${question.unit}`}
                                                    {question.type === 'text' && 'Escribe tus comentarios'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Input based on question type */}
                                        <div className="ml-14">
                                            {question.type === 'rating' && renderRatingInput()}
                                            {question.type === 'number' && (
                                                <Input
                                                    type="number"
                                                    placeholder={`Ej: 75`}
                                                    endContent={
                                                        <span className="text-sm text-gray-400">{question.unit}</span>
                                                    }
                                                    classNames={{
                                                        input: "text-base"
                                                    }}
                                                />
                                            )}
                                            {question.type === 'text' && (
                                                <Textarea
                                                    placeholder="Escribe aquí..."
                                                    minRows={3}
                                                    classNames={{
                                                        input: "text-base"
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </CardBody>
                                </Card>
                            ))}

                            {/* Submit Button Preview */}
                            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
                                <CardBody className="p-4">
                                    <Button
                                        color="primary"
                                        size="lg"
                                        className="w-full text-white font-semibold"
                                        startContent={<Icon icon="solar:check-circle-bold" width={20} />}
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
        </div>
    );
}

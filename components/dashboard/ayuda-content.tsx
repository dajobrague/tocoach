"use client";

import {
  Accordion,
  AccordionItem,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

const priorities = [
  { key: "low", label: "Baja" },
  { key: "medium", label: "Media" },
  { key: "high", label: "Alta" },
  { key: "urgent", label: "Urgente" },
];

const categories = [
  { key: "technical", label: "Problema Técnico" },
  { key: "client", label: "Cliente" },
  { key: "feature", label: "Solicitud de Función" },
  { key: "account", label: "Cuenta y Acceso" },
  { key: "other", label: "Otro" },
];

export default function AyudaContent() {
  const [subject, setSubject] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [priority, setPriority] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitResult, setSubmitResult] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const canSubmit = subject.trim().length > 0 && description.trim().length > 0;

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      setSubmitResult({
        type: "error",
        text: "Por favor completa el asunto y la descripción.",
      });

      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const categoryLabel =
        categories.find((c) => c.key === category)?.label ||
        category ||
        "Consulta General";
      const priorityLabel =
        priorities.find((p) => p.key === priority)?.label ||
        priority ||
        "Media";

      const response = await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asunto: subject.trim(),
          categoria: categoryLabel,
          prioridad: priorityLabel,
          descripcion: description.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSubmitResult({
          type: "success",
          text: "¡Ticket enviado! Te responderemos en las próximas 48 horas.",
        });
        setSubject("");
        setDescription("");
        setCategory("");
        setPriority("");
      } else {
        setSubmitResult({
          type: "error",
          text: data.error || "Error al enviar el mensaje. Intenta de nuevo.",
        });
      }
    } catch (error) {
      console.error("Error submitting contact form:", error);
      setSubmitResult({
        type: "error",
        text: "Error de conexión. Intenta de nuevo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqs = [
    {
      question: "¿Cómo agrego un nuevo cliente?",
      answer:
        "Para agregar un nuevo cliente, dirígete a la sección 'Clientes' en el menú lateral y haz clic en el botón 'Agregar Cliente'. Completa el formulario con la información del cliente y haz clic en 'Guardar'. El cliente recibirá automáticamente un correo con sus credenciales de acceso.",
    },
    {
      question: "¿Cómo creo un programa de entrenamiento?",
      answer:
        "Puedes crear programas desde la sección 'Plantillas de Programas'. Haz clic en 'Crear Nueva Plantilla', define los ejercicios, series, repeticiones y días de la semana. Una vez guardada la plantilla, podrás asignarla a tus clientes desde su perfil individual.",
    },
    {
      question: "¿Puedo personalizar el diseño de mi plataforma?",
      answer:
        "¡Sí! En la sección 'Configuración de Plataforma' encontrarás opciones para personalizar colores, logo, tipografía y dominio personalizado. Todos los cambios se reflejarán inmediatamente en la experiencia de tus clientes.",
    },
    {
      question: "¿Cómo funcionan los suplementos en el inventario?",
      answer:
        "El 'Inventario de Suplementos' te permite gestionar los productos que recomiendas a tus clientes. Puedes agregar suplementos con su información nutricional, precio, y enlaces de compra. Luego, podrás asignar protocolos de suplementación personalizados a cada cliente.",
    },
    {
      question: "¿Cómo acceden mis clientes a su cuenta?",
      answer:
        "Tus clientes pueden acceder a través de tu dominio personalizado (ej: tunombre.topcoach.com). Inician sesión con el correo electrónico que registraste y la contraseña que se les envió por correo. Desde ahí pueden ver sus programas, registrar ejercicios y comunicarse contigo.",
    },
    {
      question: "¿Puedo ver las métricas de progreso de mis clientes?",
      answer:
        "Sí, en la sección 'Métricas' encontrarás dashboards con estadísticas de todos tus clientes: adherencia a programas, ejercicios completados, mensajes intercambiados y más. También puedes ver métricas individuales desde el perfil de cada cliente.",
    },
    {
      question: "¿Cómo funciona el sistema de mensajería?",
      answer:
        "La mensajería te permite comunicarte directamente con tus clientes. Puedes enviar mensajes, fotos, y recibir actualizaciones en tiempo real. Los clientes verán las notificaciones en su panel y también pueden recibir alertas por correo electrónico.",
    },
    {
      question: "¿Qué hago si olvidé mi contraseña?",
      answer:
        "En la pantalla de inicio de sesión, haz clic en '¿Olvidaste tu contraseña?'. Introduce tu correo electrónico y recibirás un enlace para restablecer tu contraseña. El enlace es válido por 1 hora.",
    },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* FAQ Section */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-200 bg-gray-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <Icon
                  className="text-gray-700"
                  icon="solar:question-square-linear"
                  width={24}
                />
                <h2 className="text-lg font-bold text-gray-900">
                  Preguntas Frecuentes
                </h2>
              </div>
            </CardHeader>
            <CardBody className="p-6">
              <Accordion
                className="px-0"
                itemClasses={{
                  base: "border-b border-gray-200 last:border-b-0",
                  title: "font-semibold text-gray-900 text-sm",
                  trigger:
                    "py-4 hover:bg-gray-50 px-4 rounded-lg data-[open=true]:bg-slate-100",
                  content: "text-sm text-gray-600 px-4 pb-4",
                  indicator: "text-gray-500",
                }}
                variant="light"
              >
                {faqs.map((faq, index) => (
                  <AccordionItem
                    key={index}
                    aria-label={faq.question}
                    startContent={
                      <Icon
                        className="text-slate-700"
                        icon="solar:chat-round-line-linear"
                        width={20}
                      />
                    }
                    title={faq.question}
                  >
                    {faq.answer}
                  </AccordionItem>
                ))}
              </Accordion>
            </CardBody>
          </Card>

          {/* Contact Form */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-200 bg-gray-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <Icon
                  className="text-gray-700"
                  icon="solar:letter-linear"
                  width={24}
                />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Contactar Soporte
                  </h2>
                  <p className="text-sm text-gray-500">
                    ¿No encontraste lo que buscabas? Escríbenos
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardBody className="p-6">
              {/* Success/Error Feedback */}
              {submitResult && (
                <div
                  className={`mb-4 px-4 py-3 rounded-lg flex items-center gap-2 ${
                    submitResult.type === "success"
                      ? "bg-green-50 text-green-800 border border-green-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  <Icon
                    icon={
                      submitResult.type === "success"
                        ? "solar:check-circle-bold"
                        : "solar:danger-circle-bold"
                    }
                    width={20}
                  />
                  <p className="text-sm font-medium flex-1">
                    {submitResult.text}
                  </p>
                  <button
                    className="text-current opacity-60 hover:opacity-100 transition-opacity"
                    type="button"
                    onClick={() => setSubmitResult(null)}
                  >
                    <Icon icon="solar:close-linear" width={18} />
                  </button>
                </div>
              )}

              <div className="space-y-4">
                <Input
                  isRequired
                  isDisabled={isSubmitting}
                  label="Asunto"
                  labelPlacement="outside"
                  placeholder="¿En qué podemos ayudarte?"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:document-text-linear"
                      width={20}
                    />
                  }
                  value={subject}
                  variant="bordered"
                  onValueChange={setSubject}
                />

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    isDisabled={isSubmitting}
                    label="Categoría"
                    labelPlacement="outside"
                    placeholder="Selecciona una categoría"
                    selectedKeys={category ? [category] : []}
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:tag-linear"
                        width={20}
                      />
                    }
                    variant="bordered"
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {categories.map((cat) => (
                      <SelectItem key={cat.key}>{cat.label}</SelectItem>
                    ))}
                  </Select>

                  <Select
                    isDisabled={isSubmitting}
                    label="Prioridad"
                    labelPlacement="outside"
                    placeholder="Nivel de urgencia"
                    selectedKeys={priority ? [priority] : []}
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:flag-linear"
                        width={20}
                      />
                    }
                    variant="bordered"
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    {priorities.map((pri) => (
                      <SelectItem key={pri.key}>{pri.label}</SelectItem>
                    ))}
                  </Select>
                </div>

                <Textarea
                  isRequired
                  isDisabled={isSubmitting}
                  label="Descripción"
                  labelPlacement="outside"
                  minRows={6}
                  placeholder="Describe tu consulta o problema con el mayor detalle posible..."
                  value={description}
                  variant="bordered"
                  onValueChange={setDescription}
                />

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-gray-500">
                    <Icon
                      className="inline mr-1"
                      icon="solar:clock-circle-linear"
                      width={16}
                    />
                    Responderemos en menos de 48 horas
                  </p>
                  <button
                    className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      !canSubmit || isSubmitting
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-black text-white hover:bg-slate-800 cursor-pointer"
                    }`}
                    disabled={!canSubmit || isSubmitting}
                    type="button"
                    onClick={handleSubmit}
                  >
                    {isSubmitting ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            fill="currentColor"
                          />
                        </svg>
                        Enviando...
                      </>
                    ) : (
                      <>
                        Enviar Ticket
                        <Icon icon="solar:arrow-right-linear" width={20} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

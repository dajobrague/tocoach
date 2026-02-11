"use client";

import { Input, Select, SelectItem, Textarea } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

export default function FloatingSupportButton() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitResult, setSubmitResult] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [subject, setSubject] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [priority, setPriority] = React.useState("");

  const resetForm = () => {
    setSubject("");
    setDescription("");
    setCategory("");
    setPriority("");
    setSubmitResult(null);
  };

  const canSubmit = subject.trim().length > 0 && description.trim().length > 0;

  const handleSubmit = async () => {
    console.log("[FloatingSupport] handleSubmit called", {
      subject,
      description,
      category,
      priority,
      canSubmit,
    });

    if (!subject.trim() || !description.trim()) {
      console.log("[FloatingSupport] Validation failed");
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

      console.log("[FloatingSupport] Sending to API...", {
        asunto: subject,
        categoria: categoryLabel,
        prioridad: priorityLabel,
      });

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

      console.log("[FloatingSupport] API response:", response.status, data);

      if (response.ok && data.success) {
        setSubmitResult({
          type: "success",
          text: "¡Ticket enviado! Te responderemos en las próximas 48 horas.",
        });
        setSubject("");
        setDescription("");
        setCategory("");
        setPriority("");
        setTimeout(() => {
          setIsOpen(false);
          setSubmitResult(null);
        }, 4000);
      } else {
        setSubmitResult({
          type: "error",
          text: data.error || "Error al crear el ticket. Intenta de nuevo.",
        });
      }
    } catch (error) {
      console.error("[FloatingSupport] Fetch error:", error);
      setSubmitResult({
        type: "error",
        text: "Error de conexión. Intenta de nuevo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={() => {
            setIsOpen(false);
            setSubmitResult(null);
          }}
        />
      )}

      {/* Widget Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
        {/* Expanded Widget Form */}
        {isOpen && (
          <div
            className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
            style={{ width: "420px", maxHeight: "calc(100vh - 120px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Widget Header */}
            <div className="bg-black px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
                  <Icon
                    className="text-white"
                    icon="solar:ticket-bold"
                    width={22}
                  />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Soporte</h3>
                  <p className="text-white/80 text-xs">
                    Responderemos en menos de 48hrs
                  </p>
                </div>
              </div>
              <button
                className="text-white/80 hover:text-white transition-colors"
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setSubmitResult(null);
                }}
              >
                <Icon icon="solar:close-circle-linear" width={24} />
              </button>
            </div>

            {/* Success/Error Feedback */}
            {submitResult && (
              <div
                className={`px-6 py-3 flex items-center gap-2 ${
                  submitResult.type === "success"
                    ? "bg-green-50 text-green-800"
                    : "bg-red-50 text-red-800"
                }`}
              >
                <Icon
                  icon={
                    submitResult.type === "success"
                      ? "solar:check-circle-bold"
                      : "solar:danger-circle-bold"
                  }
                  width={18}
                />
                <p className="text-xs font-medium">{submitResult.text}</p>
              </div>
            )}

            {/* Widget Body - Scrollable */}
            <div
              className="overflow-y-auto"
              style={{ maxHeight: "calc(100vh - 280px)" }}
            >
              <div className="p-6 space-y-4">
                <Input
                  isRequired
                  isDisabled={isSubmitting}
                  label="Asunto"
                  labelPlacement="outside"
                  placeholder="Resumen breve del problema"
                  size="sm"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:document-text-linear"
                      width={18}
                    />
                  }
                  value={subject}
                  variant="bordered"
                  onValueChange={setSubject}
                />

                <Select
                  isDisabled={isSubmitting}
                  label="Categoría"
                  labelPlacement="outside"
                  placeholder="Selecciona una categoría"
                  selectedKeys={category ? [category] : []}
                  size="sm"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:tag-linear"
                      width={18}
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
                  size="sm"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:flag-linear"
                      width={18}
                    />
                  }
                  variant="bordered"
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {priorities.map((pri) => (
                    <SelectItem key={pri.key}>{pri.label}</SelectItem>
                  ))}
                </Select>

                <Textarea
                  isRequired
                  isDisabled={isSubmitting}
                  label="Descripción"
                  labelPlacement="outside"
                  minRows={4}
                  placeholder="Describe tu problema con detalle..."
                  size="sm"
                  value={description}
                  variant="bordered"
                  onValueChange={setDescription}
                />

                <div className="bg-slate-100 border border-slate-200 rounded-lg p-3">
                  <div className="flex gap-2">
                    <Icon
                      className="text-slate-700 flex-shrink-0 mt-0.5"
                      icon="solar:info-circle-bold"
                      width={18}
                    />
                    <p className="text-xs text-slate-700">
                      Los tickets urgentes son priorizados por nuestro equipo de
                      soporte.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Widget Footer */}
            <div className="border-t border-gray-200 bg-slate-50 px-6 py-4 flex items-center justify-between gap-3">
              <button
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100"
                disabled={isSubmitting}
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setSubmitResult(null);
                }}
              >
                Cancelar
              </button>
              <button
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  !canSubmit || isSubmitting
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-black text-white hover:bg-slate-800 cursor-pointer"
                }`}
                disabled={!canSubmit || isSubmitting}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSubmit();
                }}
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
                    <Icon icon="solar:arrow-right-linear" width={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Floating Button */}
        <button
          className={`
            flex items-center gap-2 bg-black text-white px-5 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group
            ${isOpen ? "scale-95" : "hover:scale-105"}
          `}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
            if (!isOpen) {
              resetForm();
            }
          }}
        >
          <Icon
            className={`transition-transform duration-300 ${isOpen ? "rotate-180" : "group-hover:rotate-12"}`}
            icon={
              isOpen ? "solar:close-circle-bold" : "solar:chat-round-call-bold"
            }
            width={24}
          />
          <span className="font-semibold text-sm">
            {isOpen ? "Cerrar" : "Contáctanos"}
          </span>
        </button>
      </div>
    </>
  );
}

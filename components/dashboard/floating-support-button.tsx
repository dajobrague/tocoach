"use client";

import { Button, Input, Select, SelectItem, Textarea } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

export default function FloatingSupportButton() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [formData, setFormData] = React.useState({
    subject: "",
    priority: "",
    category: "",
    description: "",
  });

  const handleSubmit = () => {
    console.log("Support ticket submitted:", formData);
    // TODO: Connect to backend API
    alert("Tu ticket de soporte ha sido creado. Te contactaremos pronto.");
    setFormData({ subject: "", priority: "", category: "", description: "" });
    setIsOpen(false);
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
          className="fixed inset-0 bg-black/20 z-40 transition-opacity pointer-events-auto"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Widget Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-none">
        {/* Expanded Widget Form - only rendered when open */}
        {isOpen && (
          <div
            className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden pointer-events-auto"
            style={{ width: "420px", maxHeight: "calc(100vh - 120px)" }}
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
                    Responderemos en menos de 24hrs
                  </p>
                </div>
              </div>
              <button
                className="text-white/80 hover:text-white transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <Icon icon="solar:close-circle-linear" width={24} />
              </button>
            </div>

            {/* Widget Body - Scrollable */}
            <div
              className="overflow-y-auto"
              style={{ maxHeight: "calc(100vh - 280px)" }}
            >
              <form className="p-6 space-y-4" onSubmit={handleSubmit}>
                <Input
                  isRequired
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
                  value={formData.subject}
                  variant="bordered"
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                />

                <Select
                  isRequired
                  label="Categoría"
                  labelPlacement="outside"
                  placeholder="Selecciona una categoría"
                  size="sm"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:tag-linear"
                      width={18}
                    />
                  }
                  value={formData.category}
                  variant="bordered"
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                >
                  {categories.map((category) => (
                    <SelectItem key={category.key}>{category.label}</SelectItem>
                  ))}
                </Select>

                <Select
                  isRequired
                  label="Prioridad"
                  labelPlacement="outside"
                  placeholder="Nivel de urgencia"
                  size="sm"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:flag-linear"
                      width={18}
                    />
                  }
                  value={formData.priority}
                  variant="bordered"
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value })
                  }
                >
                  {priorities.map((priority) => (
                    <SelectItem key={priority.key}>{priority.label}</SelectItem>
                  ))}
                </Select>

                <Textarea
                  isRequired
                  label="Descripción"
                  labelPlacement="outside"
                  minRows={4}
                  placeholder="Describe tu problema con detalle..."
                  size="sm"
                  value={formData.description}
                  variant="bordered"
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
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
              </form>
            </div>

            {/* Widget Footer */}
            <div className="border-t border-gray-200 bg-slate-50 px-6 py-4 flex items-center justify-between gap-3">
              <Button
                color="default"
                size="sm"
                variant="light"
                onPress={() => setIsOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                color="primary"
                endContent={<Icon icon="solar:arrow-right-linear" width={18} />}
                size="sm"
                onPress={handleSubmit}
              >
                Enviar Ticket
              </Button>
            </div>
          </div>
        )}

        {/* Floating Button */}
        <button
          className={`
            flex items-center gap-2 bg-black text-white px-5 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group pointer-events-auto
            ${isOpen ? "scale-95" : "hover:scale-105"}
          `}
          onClick={() => setIsOpen(!isOpen)}
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

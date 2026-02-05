"use client";

import {
  Accordion,
  AccordionItem,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

export default function AyudaContent() {
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
    // TODO: Connect to backend API
    alert("Gracias por contactarnos. Te responderemos pronto.");
    setFormData({ name: "", email: "", subject: "", message: "" });
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
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    isRequired
                    label="Nombre Completo"
                    labelPlacement="outside"
                    placeholder="Tu nombre"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:user-linear"
                        width={20}
                      />
                    }
                    value={formData.name}
                    variant="bordered"
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                  <Input
                    isRequired
                    label="Correo Electrónico"
                    labelPlacement="outside"
                    placeholder="tu@correo.com"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:letter-linear"
                        width={20}
                      />
                    }
                    type="email"
                    value={formData.email}
                    variant="bordered"
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>

                <Input
                  isRequired
                  label="Asunto"
                  labelPlacement="outside"
                  placeholder="¿En qué podemos ayudarte?"
                  startContent={
                    <Icon
                      className="text-gray-400"
                      icon="solar:tag-linear"
                      width={20}
                    />
                  }
                  value={formData.subject}
                  variant="bordered"
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                />

                <Textarea
                  isRequired
                  label="Mensaje"
                  labelPlacement="outside"
                  minRows={6}
                  placeholder="Describe tu consulta o problema con el mayor detalle posible..."
                  value={formData.message}
                  variant="bordered"
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                />

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-gray-500">
                    <Icon
                      className="inline mr-1"
                      icon="solar:clock-circle-linear"
                      width={16}
                    />
                    Responderemos en menos de 24 horas
                  </p>
                  <Button
                    className="px-6"
                    color="primary"
                    endContent={
                      <Icon icon="solar:arrow-right-linear" width={20} />
                    }
                    type="submit"
                  >
                    Enviar Mensaje
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

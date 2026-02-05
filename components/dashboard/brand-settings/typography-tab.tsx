"use client";

import { Alert, Button, Card, CardBody, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

// Popular Google Fonts for coaching platforms
const FONT_OPTIONS = [
  {
    family: "Poppins",
    category: "Sans-serif",
    description: "Moderno y amigable",
    preview: "Transforma tu cuerpo",
  },
  {
    family: "Inter",
    category: "Sans-serif",
    description: "Legible y profesional",
    preview: "Transforma tu cuerpo",
  },
  {
    family: "Roboto",
    category: "Sans-serif",
    description: "Clásico y versátil",
    preview: "Transforma tu cuerpo",
  },
  {
    family: "Open Sans",
    category: "Sans-serif",
    description: "Neutral y legible",
    preview: "Transforma tu cuerpo",
  },
  {
    family: "Montserrat",
    category: "Sans-serif",
    description: "Elegante y moderno",
    preview: "Transforma tu cuerpo",
  },
  {
    family: "Lato",
    category: "Sans-serif",
    description: "Cálido y humano",
    preview: "Transforma tu cuerpo",
  },
];

export default function BrandTypographyTab() {
  const [headingFont, setHeadingFont] = React.useState("Inter");
  const [bodyFont, setBodyFont] = React.useState("Inter");
  const [customFontUrl, setCustomFontUrl] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  React.useEffect(() => {
    // Fetch current brand configuration
    const fetchBrandConfig = async () => {
      try {
        const response = await fetch("/api/brand/config");

        if (response.ok) {
          const data = await response.json();

          if (data.theme_json?.fonts) {
            setHeadingFont(data.theme_json.fonts.heading?.family || "Inter");
            setBodyFont(data.theme_json.fonts.body?.family || "Inter");
          }
        }
      } catch (error) {
        console.error("Error fetching brand config:", error);
      }
    };

    fetchBrandConfig();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/brand/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fonts: {
            heading: {
              family: headingFont,
              weight: 600,
            },
            body: {
              family: bodyFont,
              weight: 400,
            },
          },
        }),
      });

      if (response.ok) {
        setMessage({
          type: "success",
          text: "Tipografía guardada exitosamente",
        });
        setTimeout(() => setMessage(null), 5000);
      } else {
        throw new Error("Failed to save fonts");
      }
    } catch (error) {
      console.error("Error saving fonts:", error);
      setMessage({ type: "error", text: "Error al guardar la tipografía" });
    } finally {
      setIsSaving(false);
    }
  };

  const FontPreviewCard = ({
    font,
    isSelected,
    onClick,
    type,
  }: {
    font: (typeof FONT_OPTIONS)[0];
    isSelected: boolean;
    onClick: () => void;
    type: "heading" | "body";
  }) => (
    <Card
      isPressable
      className={`border transition-all ${
        isSelected
          ? "border-slate-500 bg-slate-100"
          : "border-gray-200 hover:border-slate-300"
      }`}
      onPress={onClick}
    >
      <CardBody className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="font-semibold text-black">{font.family}</h5>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {font.category}
            </span>
          </div>

          <p
            className={`${type === "heading" ? "text-xl font-semibold" : "text-sm"}`}
            style={{ fontFamily: font.family }}
          >
            {font.preview}
          </p>

          <p className="text-xs text-gray-600">{font.description}</p>

          {isSelected && (
            <div className="flex items-center gap-2 text-slate-700">
              <Icon className="text-sm" icon="solar:check-circle-bold" />
              <span className="text-xs font-medium">Seleccionado</span>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );

  return (
    <div className="space-y-8">
      {/* Success/Error Message */}
      {message && (
        <Alert
          color={message.type === "success" ? "success" : "danger"}
          description={message.text}
          endContent={
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={() => setMessage(null)}
            >
              <Icon icon="solar:close-linear" width={18} />
            </Button>
          }
          startContent={
            <Icon
              icon={
                message.type === "success"
                  ? "solar:check-circle-bold"
                  : "solar:danger-circle-bold"
              }
              width={20}
            />
          }
          title={message.type === "success" ? "Éxito" : "Error"}
        />
      )}
      {/* Custom Google Font */}
      <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
        <CardBody className="p-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-slate-100">
                <Icon
                  className="text-2xl text-slate-700"
                  icon="solar:link-circle-linear"
                />
              </div>
              <div className="flex-1">
                <h5 className="text-sm font-semibold text-black mb-1">
                  Agregar fuente personalizada
                </h5>
                <p className="text-xs text-gray-600 mb-3">
                  Pega la URL de Google Fonts para usar cualquier fuente de su
                  catálogo
                </p>

                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="https://fonts.googleapis.com/css2?family=..."
                    size="sm"
                    startContent={
                      <Icon
                        className="text-gray-400"
                        icon="solar:link-linear"
                      />
                    }
                    value={customFontUrl}
                    variant="bordered"
                    onValueChange={setCustomFontUrl}
                  />
                  <Button
                    className="bg-black text-white hover:bg-slate-800"
                    isDisabled={!customFontUrl.trim()}
                    size="md"
                    startContent={<Icon icon="solar:download-linear" />}
                  >
                    Cargar
                  </Button>
                </div>

                <div className="mt-3 space-y-1">
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Icon
                      className="text-slate-600"
                      icon="solar:info-circle-linear"
                    />
                    Visita{" "}
                    <a
                      className="text-slate-700 underline"
                      href="https://fonts.google.com"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Google Fonts
                    </a>{" "}
                    para buscar fuentes
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Heading Font Selection */}
      <div>
        <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
          <Icon className="text-slate-700" icon="solar:text-bold-linear" />
          Fuente para títulos
        </h4>
        <div className="grid md:grid-cols-2 gap-4">
          {FONT_OPTIONS.map((font) => (
            <FontPreviewCard
              key={`heading-${font.family}`}
              font={font}
              isSelected={headingFont === font.family}
              type="heading"
              onClick={() => setHeadingFont(font.family)}
            />
          ))}
        </div>
      </div>

      {/* Body Font Selection */}
      <div>
        <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
          <Icon className="text-slate-700" icon="solar:text-linear" />
          Fuente para texto
        </h4>
        <div className="grid md:grid-cols-2 gap-4">
          {FONT_OPTIONS.map((font) => (
            <FontPreviewCard
              key={`body-${font.family}`}
              font={font}
              isSelected={bodyFont === font.family}
              type="body"
              onClick={() => setBodyFont(font.family)}
            />
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-6 border-t border-gray-200">
        <Button
          className="bg-black text-white hover:bg-slate-800"
          isLoading={isSaving}
          size="lg"
          startContent={<Icon icon="solar:floppy-disk-linear" />}
          onPress={handleSave}
        >
          {isSaving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>
    </div>
  );
}

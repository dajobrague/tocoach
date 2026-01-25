"use client";

import { Alert, Button, Card, CardBody, Slider } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

export default function BrandDesignTab() {
  const [radius, setRadius] = React.useState({
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
  });
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

          if (data.theme_json?.radius) {
            setRadius({
              sm: data.theme_json.radius.sm || 6,
              md: data.theme_json.radius.md || 8,
              lg: data.theme_json.radius.lg || 12,
              xl: data.theme_json.radius.xl || 16,
            });
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
          radius: {
            sm: radius.sm,
            md: radius.md,
            lg: radius.lg,
            xl: radius.xl,
          },
          shadow: {
            e1: "0 1px 2px rgba(0, 0, 0, 0.05)",
            e2: "0 4px 6px rgba(0, 0, 0, 0.07)",
          },
        }),
      });

      if (response.ok) {
        setMessage({
          type: "success",
          text: "Configuración de diseño guardada exitosamente",
        });
        setTimeout(() => setMessage(null), 5000);
      } else {
        throw new Error("Failed to save design config");
      }
    } catch (error) {
      console.error("Error saving design config:", error);
      setMessage({
        type: "error",
        text: "Error al guardar la configuración de diseño",
      });
    } finally {
      setIsSaving(false);
    }
  };

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
      {/* Border Radius Section */}
      <div>
        <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
          <Icon className="text-blue-600" icon="solar:layers-linear" />
          Bordes Redondeados
        </h4>
        <p className="text-sm text-gray-600 mb-6">
          Ajusta el radio de los bordes para botones, tarjetas y otros elementos
        </p>

        <div className="space-y-6">
          {/* Small Radius */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-black">
                Pequeño (sm)
              </label>
              <span className="text-sm text-gray-600">{radius.sm}px</span>
            </div>
            <Slider
              className="max-w-full"
              maxValue={28}
              minValue={0}
              size="sm"
              step={1}
              value={radius.sm}
              onChange={(value) =>
                setRadius({ ...radius, sm: value as number })
              }
            />
            <div className="mt-3 flex gap-2">
              <div
                className="w-16 h-16 bg-blue-500"
                style={{ borderRadius: `${radius.sm}px` }}
              />
              <div className="flex-1 text-xs text-gray-500">
                Usado en elementos pequeños como chips y badges
              </div>
            </div>
          </div>

          {/* Medium Radius */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-black">
                Mediano (md)
              </label>
              <span className="text-sm text-gray-600">{radius.md}px</span>
            </div>
            <Slider
              className="max-w-full"
              maxValue={28}
              minValue={0}
              size="sm"
              step={1}
              value={radius.md}
              onChange={(value) =>
                setRadius({ ...radius, md: value as number })
              }
            />
            <div className="mt-3 flex gap-2">
              <div
                className="w-16 h-16 bg-blue-500"
                style={{ borderRadius: `${radius.md}px` }}
              />
              <div className="flex-1 text-xs text-gray-500">
                Usado en botones y inputs
              </div>
            </div>
          </div>

          {/* Large Radius */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-black">
                Grande (lg)
              </label>
              <span className="text-sm text-gray-600">{radius.lg}px</span>
            </div>
            <Slider
              className="max-w-full"
              maxValue={28}
              minValue={0}
              size="sm"
              step={1}
              value={radius.lg}
              onChange={(value) =>
                setRadius({ ...radius, lg: value as number })
              }
            />
            <div className="mt-3 flex gap-2">
              <div
                className="w-16 h-16 bg-blue-500"
                style={{ borderRadius: `${radius.lg}px` }}
              />
              <div className="flex-1 text-xs text-gray-500">
                Usado en tarjetas y modales
              </div>
            </div>
          </div>

          {/* Extra Large Radius */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-black">
                Extra Grande (xl)
              </label>
              <span className="text-sm text-gray-600">{radius.xl}px</span>
            </div>
            <Slider
              className="max-w-full"
              maxValue={28}
              minValue={0}
              size="sm"
              step={1}
              value={radius.xl}
              onChange={(value) =>
                setRadius({ ...radius, xl: value as number })
              }
            />
            <div className="mt-3 flex gap-2">
              <div
                className="w-16 h-16 bg-blue-500"
                style={{ borderRadius: `${radius.xl}px` }}
              />
              <div className="flex-1 text-xs text-gray-500">
                Usado en elementos destacados y hero sections
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div>
        <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
          <Icon className="text-blue-600" icon="solar:eye-linear" />
          Vista Previa
        </h4>
        <Card className="border border-gray-200">
          <CardBody className="p-6 space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                color="primary"
                size="sm"
                style={{ borderRadius: `${radius.sm}px` }}
              >
                Botón SM
              </Button>
              <Button
                color="primary"
                size="md"
                style={{ borderRadius: `${radius.md}px` }}
              >
                Botón MD
              </Button>
              <Button
                color="primary"
                size="lg"
                style={{ borderRadius: `${radius.lg}px` }}
              >
                Botón LG
              </Button>
            </div>
            <Card
              className="border border-gray-200"
              style={{ borderRadius: `${radius.lg}px` }}
            >
              <CardBody className="p-4">
                <p className="text-sm text-gray-600">
                  Ejemplo de tarjeta con radio {radius.lg}px
                </p>
              </CardBody>
            </Card>
          </CardBody>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-6 border-t border-gray-200">
        <Button
          color="primary"
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

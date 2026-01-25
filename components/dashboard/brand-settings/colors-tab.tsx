"use client";

import { Alert, Button, Card, CardBody, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";
import { HexColorPicker } from "react-colorful";

export default function BrandColorsTab() {
  const [colors, setColors] = React.useState({
    primary: "#3b82f6",
    secondary: "#6366f1",
    text: {
      h1: "#1f2937",
      h2: "#374151",
      h3: "#4b5563",
      body: "#6b7280",
      muted: "#9ca3af",
    },
    background: {
      primary: "#ffffff",
      secondary: "#f8fafc",
      accent: "#f1f5f9",
    },
    buttons: {
      primary: { bg: "#3b82f6", text: "#ffffff", hover: "#2563eb" },
      secondary: { bg: "#f1f5f9", text: "#374151", hover: "#e2e8f0" },
    },
  });

  const [activeColorPicker, setActiveColorPicker] = React.useState<
    string | null
  >(null);
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

          if (data.theme_json?.colors) {
            // Map the theme colors to our format
            setColors({
              primary: data.theme_json.colors.brand || colors.primary,
              secondary: data.theme_json.colors.accent || colors.secondary,
              text: {
                h1: data.theme_json.colors.text?.primary || colors.text.h1,
                h2: data.theme_json.colors.text?.primary || colors.text.h2,
                h3: data.theme_json.colors.text?.primary || colors.text.h3,
                body:
                  data.theme_json.colors.text?.secondary || colors.text.body,
                muted:
                  data.theme_json.colors.text?.secondary || colors.text.muted,
              },
              background: {
                primary:
                  data.theme_json.colors.surface?.["1"] ||
                  colors.background.primary,
                secondary:
                  data.theme_json.colors.surface?.["2"] ||
                  colors.background.secondary,
                accent: data.theme_json.colors.fill || colors.background.accent,
              },
              buttons: colors.buttons, // Keep defaults for buttons for now
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
          colors: {
            brand: colors.primary,
            accent: colors.secondary,
            text: {
              primary: colors.text.h1,
              secondary: colors.text.body,
            },
            surface: {
              "1": colors.background.primary,
              "2": colors.background.secondary,
            },
            fill: colors.background.accent,
            border: "#e2e8f0",
          },
        }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Colores guardados exitosamente" });
        setTimeout(() => setMessage(null), 5000);
      } else {
        throw new Error("Failed to save colors");
      }
    } catch (error) {
      console.error("Error saving colors:", error);
      setMessage({ type: "error", text: "Error al guardar los colores" });
    } finally {
      setIsSaving(false);
    }
  };

  const ColorPickerButton = ({
    color,
    label,
    pickerId,
    onChange,
  }: {
    color: string;
    label: string;
    pickerId: string;
    onChange: (color: string) => void;
  }) => (
    <div className="space-y-3">
      <label className="text-sm font-medium text-black">{label}</label>
      <div className="flex items-center gap-4">
        <Button
          className="w-16 h-16 p-1 border-2 border-gray-300 flex-shrink-0"
          style={{ backgroundColor: color }}
          onPress={() =>
            setActiveColorPicker(
              activeColorPicker === pickerId ? null : pickerId
            )
          }
        >
          <div
            className="w-full h-full rounded-lg"
            style={{ backgroundColor: color }}
          />
        </Button>
        <Input
          className="font-mono flex-1"
          description="Código hexadecimal"
          placeholder="#3b82f6"
          startContent="#"
          value={color.replace("#", "")}
          onValueChange={(value) => {
            const hexRegex = /^[0-9A-F]{6}$/i;

            if (hexRegex.test(value)) {
              onChange(`#${value}`);
            }
          }}
        />
      </div>

      {activeColorPicker === pickerId && (
        <Card className="p-4">
          <CardBody className="flex items-center justify-center">
            <HexColorPicker color={color} onChange={onChange} />
          </CardBody>
        </Card>
      )}
    </div>
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
      {/* Brand Colors Section */}
      <div>
        <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
          <Icon className="text-blue-600" icon="solar:palette-linear" />
          Colores de Marca
        </h4>
        <div className="grid md:grid-cols-2 gap-6">
          <ColorPickerButton
            color={colors.primary}
            label="Color Primario"
            pickerId="primary"
            onChange={(c) => setColors({ ...colors, primary: c })}
          />
          <ColorPickerButton
            color={colors.secondary}
            label="Color Secundario"
            pickerId="secondary"
            onChange={(c) => setColors({ ...colors, secondary: c })}
          />
        </div>
      </div>

      {/* Text Colors Section */}
      <div>
        <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
          <Icon className="text-blue-600" icon="solar:text-field-linear" />
          Colores de Texto
        </h4>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ColorPickerButton
            color={colors.text.h1}
            label="Títulos H1"
            pickerId="text-h1"
            onChange={(c) =>
              setColors({ ...colors, text: { ...colors.text, h1: c } })
            }
          />
          <ColorPickerButton
            color={colors.text.h2}
            label="Títulos H2"
            pickerId="text-h2"
            onChange={(c) =>
              setColors({ ...colors, text: { ...colors.text, h2: c } })
            }
          />
          <ColorPickerButton
            color={colors.text.h3}
            label="Títulos H3"
            pickerId="text-h3"
            onChange={(c) =>
              setColors({ ...colors, text: { ...colors.text, h3: c } })
            }
          />
          <ColorPickerButton
            color={colors.text.body}
            label="Texto del Cuerpo"
            pickerId="text-body"
            onChange={(c) =>
              setColors({ ...colors, text: { ...colors.text, body: c } })
            }
          />
          <ColorPickerButton
            color={colors.text.muted}
            label="Texto Secundario"
            pickerId="text-muted"
            onChange={(c) =>
              setColors({ ...colors, text: { ...colors.text, muted: c } })
            }
          />
        </div>
      </div>

      {/* Background Colors Section */}
      <div>
        <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
          <Icon className="text-blue-600" icon="solar:layers-linear" />
          Colores de Fondo
        </h4>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ColorPickerButton
            color={colors.background.primary}
            label="Fondo Principal"
            pickerId="bg-primary"
            onChange={(c) =>
              setColors({
                ...colors,
                background: { ...colors.background, primary: c },
              })
            }
          />
          <ColorPickerButton
            color={colors.background.secondary}
            label="Fondo de Secciones"
            pickerId="bg-secondary"
            onChange={(c) =>
              setColors({
                ...colors,
                background: { ...colors.background, secondary: c },
              })
            }
          />
          <ColorPickerButton
            color={colors.background.accent}
            label="Fondo de Acentos"
            pickerId="bg-accent"
            onChange={(c) =>
              setColors({
                ...colors,
                background: { ...colors.background, accent: c },
              })
            }
          />
        </div>
      </div>

      {/* Button Colors Section */}
      <div>
        <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
          <Icon className="text-blue-600" icon="solar:cursor-linear" />
          Colores de Botones
        </h4>

        {/* Primary Button */}
        <div className="mb-6">
          <h5 className="text-sm font-medium text-gray-700 mb-3">
            Botón Primario
          </h5>
          <div className="grid md:grid-cols-3 gap-4">
            <ColorPickerButton
              color={colors.buttons.primary.bg}
              label="Fondo"
              pickerId="btn-primary-bg"
              onChange={(c) =>
                setColors({
                  ...colors,
                  buttons: {
                    ...colors.buttons,
                    primary: { ...colors.buttons.primary, bg: c },
                  },
                })
              }
            />
            <ColorPickerButton
              color={colors.buttons.primary.text}
              label="Texto"
              pickerId="btn-primary-text"
              onChange={(c) =>
                setColors({
                  ...colors,
                  buttons: {
                    ...colors.buttons,
                    primary: { ...colors.buttons.primary, text: c },
                  },
                })
              }
            />
            <ColorPickerButton
              color={colors.buttons.primary.hover}
              label="Hover"
              pickerId="btn-primary-hover"
              onChange={(c) =>
                setColors({
                  ...colors,
                  buttons: {
                    ...colors.buttons,
                    primary: { ...colors.buttons.primary, hover: c },
                  },
                })
              }
            />
          </div>
        </div>

        {/* Secondary Button */}
        <div>
          <h5 className="text-sm font-medium text-gray-700 mb-3">
            Botón Secundario
          </h5>
          <div className="grid md:grid-cols-3 gap-4">
            <ColorPickerButton
              color={colors.buttons.secondary.bg}
              label="Fondo"
              pickerId="btn-secondary-bg"
              onChange={(c) =>
                setColors({
                  ...colors,
                  buttons: {
                    ...colors.buttons,
                    secondary: { ...colors.buttons.secondary, bg: c },
                  },
                })
              }
            />
            <ColorPickerButton
              color={colors.buttons.secondary.text}
              label="Texto"
              pickerId="btn-secondary-text"
              onChange={(c) =>
                setColors({
                  ...colors,
                  buttons: {
                    ...colors.buttons,
                    secondary: { ...colors.buttons.secondary, text: c },
                  },
                })
              }
            />
            <ColorPickerButton
              color={colors.buttons.secondary.hover}
              label="Hover"
              pickerId="btn-secondary-hover"
              onChange={(c) =>
                setColors({
                  ...colors,
                  buttons: {
                    ...colors.buttons,
                    secondary: { ...colors.buttons.secondary, hover: c },
                  },
                })
              }
            />
          </div>
        </div>
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

"use client";

import { Alert, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerFormat,
  ColorPickerOutput,
} from "@/components/kibo-ui/color-picker";

interface BrandColors {
  brand: string;
  accent: string;
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  surface: {
    "1": string;
    "2": string;
    "3": string;
  };
  border: string;
  fill: string;
  buttons: {
    primary: { bg: string; text: string; hover: string };
    secondary: { bg: string; text: string; hover: string };
  };
}

const DEFAULT_COLORS: BrandColors = {
  brand: "#3b82f6",
  accent: "#6366f1",
  text: {
    primary: "#1f2937",
    secondary: "#6b7280",
    muted: "#9ca3af",
  },
  surface: {
    "1": "#ffffff",
    "2": "#f8fafc",
    "3": "#f1f5f9",
  },
  border: "#e2e8f0",
  fill: "#f1f5f9",
  buttons: {
    primary: { bg: "#3b82f6", text: "#ffffff", hover: "#2563eb" },
    secondary: { bg: "#f1f5f9", text: "#374151", hover: "#e2e8f0" },
  },
};

export default function BrandColorsTab() {
  const [colors, setColors] = React.useState<BrandColors>(DEFAULT_COLORS);
  const [originalColors, setOriginalColors] =
    React.useState<BrandColors>(DEFAULT_COLORS);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [message, setMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  React.useEffect(() => {
    const fetchBrandConfig = async () => {
      try {
        const response = await fetch("/api/brand/config");

        if (response.ok) {
          const data = await response.json();

          if (data.theme_json?.colors) {
            const c = data.theme_json.colors;
            const loaded: BrandColors = {
              brand: c.brand || DEFAULT_COLORS.brand,
              accent: c.accent || DEFAULT_COLORS.accent,
              text: {
                primary: c.text?.primary || DEFAULT_COLORS.text.primary,
                secondary: c.text?.secondary || DEFAULT_COLORS.text.secondary,
                muted: c.text?.muted || DEFAULT_COLORS.text.muted,
              },
              surface: {
                "1": c.surface?.["1"] || DEFAULT_COLORS.surface["1"],
                "2": c.surface?.["2"] || DEFAULT_COLORS.surface["2"],
                "3": c.surface?.["3"] || DEFAULT_COLORS.surface["3"],
              },
              border: c.border || DEFAULT_COLORS.border,
              fill: c.fill || DEFAULT_COLORS.fill,
              buttons: {
                primary: {
                  bg:
                    c.buttons?.primary?.bg || DEFAULT_COLORS.buttons.primary.bg,
                  text:
                    c.buttons?.primary?.text ||
                    DEFAULT_COLORS.buttons.primary.text,
                  hover:
                    c.buttons?.primary?.hover ||
                    DEFAULT_COLORS.buttons.primary.hover,
                },
                secondary: {
                  bg:
                    c.buttons?.secondary?.bg ||
                    DEFAULT_COLORS.buttons.secondary.bg,
                  text:
                    c.buttons?.secondary?.text ||
                    DEFAULT_COLORS.buttons.secondary.text,
                  hover:
                    c.buttons?.secondary?.hover ||
                    DEFAULT_COLORS.buttons.secondary.hover,
                },
              },
            };

            setColors(loaded);
            setOriginalColors(loaded);
          }
        }
      } catch (error) {
        console.error("Error fetching brand config:", error);
      } finally {
        setIsLoading(false);
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
            brand: colors.brand,
            accent: colors.accent,
            text: colors.text,
            surface: colors.surface,
            border: colors.border,
            fill: colors.fill,
            buttons: colors.buttons,
          },
        }),
      });

      if (response.ok) {
        setOriginalColors(colors);
        setMessage({
          type: "success",
          text: "Colores guardados exitosamente",
        });
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

  const hasChanges = JSON.stringify(colors) !== JSON.stringify(originalColors);

  const [openPicker, setOpenPicker] = React.useState<string | null>(null);

  // Close picker when clicking outside
  React.useEffect(() => {
    if (!openPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (
        target.closest("[data-color-panel]") ||
        target.closest("[data-color-swatch]")
      ) {
        return;
      }
      setOpenPicker(null);
    };

    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [openPicker]);

  const rgbaToHex = (rgba: number[]): string => {
    const r = Math.round(Math.max(0, Math.min(255, rgba[0] || 0)));
    const g = Math.round(Math.max(0, Math.min(255, rgba[1] || 0)));
    const b = Math.round(Math.max(0, Math.min(255, rgba[2] || 0)));

    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
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
  }) => {
    const isOpen = openPicker === pickerId;

    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-black">{label}</label>
        <div className="flex items-center gap-3 relative">
          <button
            className="w-12 h-12 rounded-xl border-2 border-gray-200 hover:border-gray-400 transition-colors cursor-pointer flex-shrink-0 shadow-sm hover:shadow-md"
            data-color-swatch={pickerId}
            style={{ backgroundColor: color }}
            type="button"
            onClick={() => setOpenPicker(isOpen ? null : pickerId)}
          />
          <span className="text-xs font-mono text-gray-500 uppercase">
            {color}
          </span>

          {isOpen && (
            <div
              className="absolute top-full left-0 mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4"
              data-color-panel={pickerId}
              style={{ width: 280 }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-700">
                  {label}
                </span>
                <button
                  className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded-md hover:bg-gray-100"
                  type="button"
                  onClick={() => setOpenPicker(null)}
                >
                  <Icon icon="solar:close-circle-linear" width={18} />
                </button>
              </div>
              <ColorPicker
                value={color}
                onChange={(rgba) => {
                  const hex = rgbaToHex(rgba as number[]);

                  onChange(hex);
                }}
              >
                <ColorPickerSelection className="h-40 rounded-lg" />
                <ColorPickerHue />
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg border border-gray-200 flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <ColorPickerOutput />
                  <ColorPickerFormat className="flex-1" />
                </div>
              </ColorPicker>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

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
        <h4 className="text-md font-semibold text-black mb-1 flex items-center gap-2">
          <Icon className="text-slate-700" icon="solar:palette-linear" />
          Colores de Marca
        </h4>
        <p className="text-sm text-gray-500 mb-4">
          Los colores principales que definen tu identidad visual
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <ColorPickerButton
            color={colors.brand}
            label="Color Primario"
            pickerId="brand"
            onChange={(c) => setColors({ ...colors, brand: c })}
          />
          <ColorPickerButton
            color={colors.accent}
            label="Color de Acento"
            pickerId="accent"
            onChange={(c) => setColors({ ...colors, accent: c })}
          />
        </div>
      </div>

      {/* Text Colors Section */}
      <div>
        <h4 className="text-md font-semibold text-black mb-1 flex items-center gap-2">
          <Icon className="text-slate-700" icon="solar:text-field-linear" />
          Colores de Texto
        </h4>
        <p className="text-sm text-gray-500 mb-4">
          Define cómo se ven los textos en tu plataforma
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <ColorPickerButton
            color={colors.text.primary}
            label="Texto Principal"
            pickerId="text-primary"
            onChange={(c) =>
              setColors({
                ...colors,
                text: { ...colors.text, primary: c },
              })
            }
          />
          <ColorPickerButton
            color={colors.text.secondary}
            label="Texto Secundario"
            pickerId="text-secondary"
            onChange={(c) =>
              setColors({
                ...colors,
                text: { ...colors.text, secondary: c },
              })
            }
          />
          <ColorPickerButton
            color={colors.text.muted}
            label="Texto Sutil"
            pickerId="text-muted"
            onChange={(c) =>
              setColors({
                ...colors,
                text: { ...colors.text, muted: c },
              })
            }
          />
        </div>
      </div>

      {/* Surface/Background Colors Section */}
      <div>
        <h4 className="text-md font-semibold text-black mb-1 flex items-center gap-2">
          <Icon className="text-slate-700" icon="solar:layers-linear" />
          Colores de Fondo
        </h4>
        <p className="text-sm text-gray-500 mb-4">
          Los fondos y superficies de tarjetas y secciones
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <ColorPickerButton
            color={colors.surface["1"]}
            label="Fondo Principal"
            pickerId="surface-1"
            onChange={(c) =>
              setColors({
                ...colors,
                surface: { ...colors.surface, "1": c },
              })
            }
          />
          <ColorPickerButton
            color={colors.surface["2"]}
            label="Fondo de Secciones"
            pickerId="surface-2"
            onChange={(c) =>
              setColors({
                ...colors,
                surface: { ...colors.surface, "2": c },
              })
            }
          />
          <ColorPickerButton
            color={colors.surface["3"]}
            label="Fondo de Acentos"
            pickerId="surface-3"
            onChange={(c) =>
              setColors({
                ...colors,
                surface: { ...colors.surface, "3": c },
              })
            }
          />
        </div>
      </div>

      {/* Border & Fill */}
      <div>
        <h4 className="text-md font-semibold text-black mb-1 flex items-center gap-2">
          <Icon className="text-slate-700" icon="solar:ruler-angular-linear" />
          Bordes y Rellenos
        </h4>
        <p className="text-sm text-gray-500 mb-4">
          Colores para bordes de tarjetas y áreas de relleno
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <ColorPickerButton
            color={colors.border}
            label="Color de Borde"
            pickerId="border"
            onChange={(c) => setColors({ ...colors, border: c })}
          />
          <ColorPickerButton
            color={colors.fill}
            label="Color de Relleno"
            pickerId="fill"
            onChange={(c) => setColors({ ...colors, fill: c })}
          />
        </div>
      </div>

      {/* Button Colors Section */}
      <div>
        <h4 className="text-md font-semibold text-black mb-1 flex items-center gap-2">
          <Icon className="text-slate-700" icon="solar:cursor-linear" />
          Colores de Botones
        </h4>
        <p className="text-sm text-gray-500 mb-4">
          Personaliza la apariencia de los botones en la app del cliente
        </p>

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
          className="bg-black text-white hover:bg-slate-800"
          isDisabled={!hasChanges}
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

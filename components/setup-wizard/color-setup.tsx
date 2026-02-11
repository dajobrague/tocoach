"use client";

import { Button, Card, CardBody, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";
import { HexColorPicker } from "react-colorful";

import { useSetupWizard } from "@/lib/setup-wizard/context";

// Complete theme palettes for one-click setup
const COLOR_PALETTES = [
  {
    name: "Profesional Azul",
    primary: "#0f172a",
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
      primary: { bg: "#0f172a", text: "#ffffff", hover: "#1e293b" },
      secondary: { bg: "#f1f5f9", text: "#374151", hover: "#e2e8f0" },
    },
    shadows: {
      light: "rgba(59, 130, 246, 0.08)",
      medium: "rgba(59, 130, 246, 0.15)",
      dark: "rgba(59, 130, 246, 0.25)",
    },
  },
  {
    name: "Energía Naranja",
    primary: "#f97316",
    secondary: "#eab308",
    text: {
      h1: "#1f2937",
      h2: "#374151",
      h3: "#4b5563",
      body: "#6b7280",
      muted: "#9ca3af",
    },
    background: {
      primary: "#ffffff",
      secondary: "#fef3c7",
      accent: "#fef7cd",
    },
    buttons: {
      primary: { bg: "#f97316", text: "#ffffff", hover: "#ea580c" },
      secondary: { bg: "#fef3c7", text: "#92400e", hover: "#fde68a" },
    },
    shadows: {
      light: "rgba(249, 115, 22, 0.08)",
      medium: "rgba(249, 115, 22, 0.15)",
      dark: "rgba(249, 115, 22, 0.25)",
    },
  },
  {
    name: "Naturaleza Verde",
    primary: "#10b981",
    secondary: "#059669",
    text: {
      h1: "#1f2937",
      h2: "#374151",
      h3: "#4b5563",
      body: "#6b7280",
      muted: "#9ca3af",
    },
    background: {
      primary: "#ffffff",
      secondary: "#f0fdf4",
      accent: "#dcfce7",
    },
    buttons: {
      primary: { bg: "#10b981", text: "#ffffff", hover: "#059669" },
      secondary: { bg: "#f0fdf4", text: "#166534", hover: "#dcfce7" },
    },
    shadows: {
      light: "rgba(16, 185, 129, 0.08)",
      medium: "rgba(16, 185, 129, 0.15)",
      dark: "rgba(16, 185, 129, 0.25)",
    },
  },
  {
    name: "Elegante Púrpura",
    primary: "#8b5cf6",
    secondary: "#a855f7",
    text: {
      h1: "#1f2937",
      h2: "#374151",
      h3: "#4b5563",
      body: "#6b7280",
      muted: "#9ca3af",
    },
    background: {
      primary: "#ffffff",
      secondary: "#faf5ff",
      accent: "#f3e8ff",
    },
    buttons: {
      primary: { bg: "#8b5cf6", text: "#ffffff", hover: "#7c3aed" },
      secondary: { bg: "#faf5ff", text: "#6b21a8", hover: "#f3e8ff" },
    },
    shadows: {
      light: "rgba(139, 92, 246, 0.08)",
      medium: "rgba(139, 92, 246, 0.15)",
      dark: "rgba(139, 92, 246, 0.25)",
    },
  },
  {
    name: "Fuerza Roja",
    primary: "#ef4444",
    secondary: "#dc2626",
    text: {
      h1: "#1f2937",
      h2: "#374151",
      h3: "#4b5563",
      body: "#6b7280",
      muted: "#9ca3af",
    },
    background: {
      primary: "#ffffff",
      secondary: "#fef2f2",
      accent: "#fee2e2",
    },
    buttons: {
      primary: { bg: "#ef4444", text: "#ffffff", hover: "#dc2626" },
      secondary: { bg: "#fef2f2", text: "#991b1b", hover: "#fee2e2" },
    },
    shadows: {
      light: "rgba(239, 68, 68, 0.08)",
      medium: "rgba(239, 68, 68, 0.15)",
      dark: "rgba(239, 68, 68, 0.25)",
    },
  },
  {
    name: "Equilibrio Teal",
    primary: "#14b8a6",
    secondary: "#0d9488",
    text: {
      h1: "#1f2937",
      h2: "#374151",
      h3: "#4b5563",
      body: "#6b7280",
      muted: "#9ca3af",
    },
    background: {
      primary: "#ffffff",
      secondary: "#f0fdfa",
      accent: "#ccfbf1",
    },
    buttons: {
      primary: { bg: "#14b8a6", text: "#ffffff", hover: "#0f766e" },
      secondary: { bg: "#f0fdfa", text: "#134e4a", hover: "#ccfbf1" },
    },
    shadows: {
      light: "rgba(20, 184, 166, 0.08)",
      medium: "rgba(20, 184, 166, 0.15)",
      dark: "rgba(20, 184, 166, 0.25)",
    },
  },
  {
    name: "Cielo Brillante",
    primary: "#0ea5e9",
    secondary: "#06b6d4",
    text: {
      h1: "#0c4a6e",
      h2: "#075985",
      h3: "#0369a1",
      body: "#64748b",
      muted: "#94a3b8",
    },
    background: {
      primary: "#ffffff",
      secondary: "#f0f9ff",
      accent: "#e0f2fe",
    },
    buttons: {
      primary: { bg: "#0ea5e9", text: "#ffffff", hover: "#0284c7" },
      secondary: { bg: "#f0f9ff", text: "#0c4a6e", hover: "#e0f2fe" },
    },
    shadows: {
      light: "rgba(14, 165, 233, 0.08)",
      medium: "rgba(14, 165, 233, 0.15)",
      dark: "rgba(14, 165, 233, 0.25)",
    },
  },
  {
    name: "Coral Cálido",
    primary: "#f97066",
    secondary: "#fb923c",
    text: {
      h1: "#7c2d12",
      h2: "#9a3412",
      h3: "#c2410c",
      body: "#78716c",
      muted: "#a8a29e",
    },
    background: {
      primary: "#ffffff",
      secondary: "#fff7ed",
      accent: "#ffedd5",
    },
    buttons: {
      primary: { bg: "#f97066", text: "#ffffff", hover: "#f43f5e" },
      secondary: { bg: "#fff7ed", text: "#7c2d12", hover: "#ffedd5" },
    },
    shadows: {
      light: "rgba(249, 112, 102, 0.08)",
      medium: "rgba(249, 112, 102, 0.15)",
      dark: "rgba(249, 112, 102, 0.25)",
    },
  },
  {
    name: "Amatista Profundo",
    primary: "#7c3aed",
    secondary: "#a78bfa",
    text: {
      h1: "#3b0764",
      h2: "#581c87",
      h3: "#6b21a8",
      body: "#71717a",
      muted: "#a1a1aa",
    },
    background: {
      primary: "#ffffff",
      secondary: "#faf5ff",
      accent: "#f3e8ff",
    },
    buttons: {
      primary: { bg: "#7c3aed", text: "#ffffff", hover: "#6d28d9" },
      secondary: { bg: "#faf5ff", text: "#3b0764", hover: "#f3e8ff" },
    },
    shadows: {
      light: "rgba(124, 58, 237, 0.08)",
      medium: "rgba(124, 58, 237, 0.15)",
      dark: "rgba(124, 58, 237, 0.25)",
    },
  },
  {
    name: "Bosque Oscuro",
    primary: "#059669",
    secondary: "#34d399",
    text: {
      h1: "#064e3b",
      h2: "#065f46",
      h3: "#047857",
      body: "#52525b",
      muted: "#a1a1aa",
    },
    background: {
      primary: "#ffffff",
      secondary: "#ecfdf5",
      accent: "#d1fae5",
    },
    buttons: {
      primary: { bg: "#059669", text: "#ffffff", hover: "#047857" },
      secondary: { bg: "#ecfdf5", text: "#064e3b", hover: "#d1fae5" },
    },
    shadows: {
      light: "rgba(5, 150, 105, 0.08)",
      medium: "rgba(5, 150, 105, 0.15)",
      dark: "rgba(5, 150, 105, 0.25)",
    },
  },
  {
    name: "Dorado Vibrante",
    primary: "#f59e0b",
    secondary: "#fbbf24",
    text: {
      h1: "#78350f",
      h2: "#92400e",
      h3: "#b45309",
      body: "#57534e",
      muted: "#a8a29e",
    },
    background: {
      primary: "#ffffff",
      secondary: "#fffbeb",
      accent: "#fef3c7",
    },
    buttons: {
      primary: { bg: "#f59e0b", text: "#ffffff", hover: "#d97706" },
      secondary: { bg: "#fffbeb", text: "#78350f", hover: "#fef3c7" },
    },
    shadows: {
      light: "rgba(245, 158, 11, 0.08)",
      medium: "rgba(245, 158, 11, 0.15)",
      dark: "rgba(245, 158, 11, 0.25)",
    },
  },
  {
    name: "Marino Profesional",
    primary: "#1e40af",
    secondary: "#3b82f6",
    text: {
      h1: "#1e3a8a",
      h2: "#1e40af",
      h3: "#2563eb",
      body: "#475569",
      muted: "#94a3b8",
    },
    background: {
      primary: "#ffffff",
      secondary: "#eff6ff",
      accent: "#dbeafe",
    },
    buttons: {
      primary: { bg: "#1e40af", text: "#ffffff", hover: "#1e3a8a" },
      secondary: { bg: "#eff6ff", text: "#1e3a8a", hover: "#dbeafe" },
    },
    shadows: {
      light: "rgba(30, 64, 175, 0.08)",
      medium: "rgba(30, 64, 175, 0.15)",
      dark: "rgba(30, 64, 175, 0.25)",
    },
  },
];

export default function ColorSetup() {
  const { state, actions } = useSetupWizard();
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(
    null
  );

  const handlePaletteSelect = (palette: (typeof COLOR_PALETTES)[0]) => {
    // Set brand colors
    actions.setPrimaryColor(palette.primary);
    actions.setSecondaryColor(palette.secondary);

    // Set all text colors
    actions.setTextColor("h1", palette.text.h1);
    actions.setTextColor("h2", palette.text.h2);
    actions.setTextColor("h3", palette.text.h3);
    actions.setTextColor("body", palette.text.body);
    actions.setTextColor("muted", palette.text.muted);

    // Set all background colors
    actions.setBackgroundColor("primary", palette.background.primary);
    actions.setBackgroundColor("secondary", palette.background.secondary);
    actions.setBackgroundColor("accent", palette.background.accent);

    // Set all button colors
    actions.setButtonColor("primary", "bg", palette.buttons.primary.bg);
    actions.setButtonColor("primary", "text", palette.buttons.primary.text);
    actions.setButtonColor("primary", "hover", palette.buttons.primary.hover);
    actions.setButtonColor("secondary", "bg", palette.buttons.secondary.bg);
    actions.setButtonColor("secondary", "text", palette.buttons.secondary.text);
    actions.setButtonColor(
      "secondary",
      "hover",
      palette.buttons.secondary.hover
    );

    // Set all shadow colors
    actions.setShadowColor("light", palette.shadows.light);
    actions.setShadowColor("medium", palette.shadows.medium);
    actions.setShadowColor("dark", palette.shadows.dark);
  };

  const handleHexInput = (
    rawValue: string,
    onChange: (color: string) => void
  ) => {
    // Remove any # prefix since it's shown visually via startContent
    const cleaned = rawValue.replace(/^#+/, "");
    const hexRegex = /^[0-9A-F]{6}$/i;

    if (hexRegex.test(cleaned)) {
      onChange(`#${cleaned}`);
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
        <button
          className="w-16 h-16 rounded-lg border-2 border-gray-300 flex-shrink-0 cursor-pointer hover:border-gray-400 transition-colors"
          style={{ backgroundColor: color }}
          type="button"
          onClick={() =>
            setActiveColorPicker(
              activeColorPicker === pickerId ? null : pickerId
            )
          }
        />
        <Input
          className="font-mono flex-1"
          description="Código hexadecimal"
          placeholder="3b82f6"
          startContent={<span className="text-gray-400">#</span>}
          value={color.replace(/^#/, "")}
          onValueChange={(value) => handleHexInput(value, onChange)}
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
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-heading font-bold text-black mb-2">
          Define tu sistema de colores
        </h2>
        <p className="text-gray-600 font-body">
          Personaliza todos los aspectos visuales de tu plataforma para crear
          una experiencia de marca cohesiva
        </p>
      </div>

      {/* Predefined Palettes */}
      <div>
        <h3 className="text-lg font-heading font-semibold text-black mb-4">
          Paletas predefinidas
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {COLOR_PALETTES.map((palette, index) => (
            <Card
              key={index}
              isPressable
              className="border-2 border-gray-200 hover:border-slate-400 transition-all hover:shadow-md"
              onPress={() => handlePaletteSelect(palette)}
            >
              <CardBody className="p-3">
                <div className="flex flex-col gap-2">
                  <div className="flex gap-1.5 justify-center">
                    <div
                      className="w-8 h-8 rounded-lg border border-gray-200 shadow-sm"
                      style={{ backgroundColor: palette.primary }}
                    />
                    <div
                      className="w-8 h-8 rounded-lg border border-gray-200 shadow-sm"
                      style={{ backgroundColor: palette.secondary }}
                    />
                  </div>
                  <div className="flex gap-1 justify-center">
                    <div
                      className="w-4 h-4 rounded border border-gray-200"
                      style={{ backgroundColor: palette.background.secondary }}
                    />
                    <div
                      className="w-4 h-4 rounded border border-gray-200"
                      style={{ backgroundColor: palette.buttons.primary.bg }}
                    />
                    <div
                      className="w-4 h-4 rounded border border-gray-200"
                      style={{ backgroundColor: palette.text.h1 }}
                    />
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* Detailed Color Controls */}
      <div className="space-y-8">
        <h3 className="text-lg font-heading font-semibold text-black">
          Personalización avanzada
        </h3>

        {/* Brand Colors Section */}
        <div>
          <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
            <Icon className="text-slate-700" icon="solar:palette-linear" />
            Colores de Marca
          </h4>
          <div className="grid md:grid-cols-2 gap-6">
            <ColorPickerButton
              color={state.colors.primary}
              label="Color Primario"
              pickerId="primary"
              onChange={actions.setPrimaryColor}
            />
            <ColorPickerButton
              color={state.colors.secondary}
              label="Color Secundario"
              pickerId="secondary"
              onChange={actions.setSecondaryColor}
            />
          </div>
        </div>

        {/* Text Colors Section */}
        <div>
          <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
            <Icon className="text-slate-700" icon="solar:text-field-linear" />
            Colores de Texto
          </h4>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ColorPickerButton
              color={state.colors.text.h1}
              label="Títulos H1"
              pickerId="text-h1"
              onChange={(color) => actions.setTextColor("h1", color)}
            />
            <ColorPickerButton
              color={state.colors.text.h2}
              label="Títulos H2"
              pickerId="text-h2"
              onChange={(color) => actions.setTextColor("h2", color)}
            />
            <ColorPickerButton
              color={state.colors.text.h3}
              label="Títulos H3"
              pickerId="text-h3"
              onChange={(color) => actions.setTextColor("h3", color)}
            />
            <ColorPickerButton
              color={state.colors.text.body}
              label="Texto del Cuerpo"
              pickerId="text-body"
              onChange={(color) => actions.setTextColor("body", color)}
            />
            <ColorPickerButton
              color={state.colors.text.muted}
              label="Texto Secundario"
              pickerId="text-muted"
              onChange={(color) => actions.setTextColor("muted", color)}
            />
          </div>
        </div>

        {/* Background Colors Section */}
        <div>
          <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
            <Icon className="text-slate-700" icon="solar:layers-linear" />
            Colores de Fondo
          </h4>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ColorPickerButton
              color={state.colors.background.primary}
              label="Fondo Principal"
              pickerId="bg-primary"
              onChange={(color) => actions.setBackgroundColor("primary", color)}
            />
            <ColorPickerButton
              color={state.colors.background.secondary}
              label="Fondo de Secciones"
              pickerId="bg-secondary"
              onChange={(color) =>
                actions.setBackgroundColor("secondary", color)
              }
            />
            <ColorPickerButton
              color={state.colors.background.accent}
              label="Fondo de Acentos"
              pickerId="bg-accent"
              onChange={(color) => actions.setBackgroundColor("accent", color)}
            />
          </div>
        </div>

        {/* Button Colors Section */}
        <div>
          <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
            <Icon className="text-slate-700" icon="solar:cursor-linear" />
            Colores de Botones
          </h4>

          {/* Primary Button */}
          <div className="mb-6">
            <h5 className="text-sm font-medium text-gray-700 mb-3">
              Botón Primario
            </h5>
            <div className="grid md:grid-cols-3 gap-4">
              <ColorPickerButton
                color={state.colors.buttons.primary.bg}
                label="Fondo"
                pickerId="btn-primary-bg"
                onChange={(color) =>
                  actions.setButtonColor("primary", "bg", color)
                }
              />
              <ColorPickerButton
                color={state.colors.buttons.primary.text}
                label="Texto"
                pickerId="btn-primary-text"
                onChange={(color) =>
                  actions.setButtonColor("primary", "text", color)
                }
              />
              <ColorPickerButton
                color={state.colors.buttons.primary.hover}
                label="Hover"
                pickerId="btn-primary-hover"
                onChange={(color) =>
                  actions.setButtonColor("primary", "hover", color)
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
                color={state.colors.buttons.secondary.bg}
                label="Fondo"
                pickerId="btn-secondary-bg"
                onChange={(color) =>
                  actions.setButtonColor("secondary", "bg", color)
                }
              />
              <ColorPickerButton
                color={state.colors.buttons.secondary.text}
                label="Texto"
                pickerId="btn-secondary-text"
                onChange={(color) =>
                  actions.setButtonColor("secondary", "text", color)
                }
              />
              <ColorPickerButton
                color={state.colors.buttons.secondary.hover}
                label="Hover"
                pickerId="btn-secondary-hover"
                onChange={(color) =>
                  actions.setButtonColor("secondary", "hover", color)
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Color Preview Summary */}
      <Card className="bg-gray-50 border border-gray-200">
        <CardBody className="p-6">
          <h4 className="text-lg font-semibold text-black mb-4">
            Resumen de colores
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Brand Colors */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600 uppercase">
                Marca
              </p>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: state.colors.primary }}
                />
                <span className="text-xs text-gray-600">Primario</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: state.colors.secondary }}
                />
                <span className="text-xs text-gray-600">Secundario</span>
              </div>
            </div>

            {/* Text Colors */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600 uppercase">
                Texto
              </p>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: state.colors.text.h1 }}
                />
                <span className="text-xs text-gray-600">H1</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: state.colors.text.body }}
                />
                <span className="text-xs text-gray-600">Cuerpo</span>
              </div>
            </div>

            {/* Background Colors */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600 uppercase">
                Fondos
              </p>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: state.colors.background.primary }}
                />
                <span className="text-xs text-gray-600">Principal</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: state.colors.background.secondary }}
                />
                <span className="text-xs text-gray-600">Secciones</span>
              </div>
            </div>

            {/* Button Colors */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600 uppercase">
                Botones
              </p>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: state.colors.buttons.primary.bg }}
                />
                <span className="text-xs text-gray-600">Primario</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: state.colors.buttons.secondary.bg }}
                />
                <span className="text-xs text-gray-600">Secundario</span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between pt-6 border-t border-gray-200">
        <Button
          className="border-gray-300"
          startContent={<Icon icon="solar:arrow-left-linear" />}
          variant="bordered"
          onPress={actions.prevStep}
        >
          Anterior
        </Button>

        <Button
          className="bg-black text-white hover:bg-slate-800"
          endContent={<Icon icon="solar:arrow-right-linear" />}
          size="lg"
          onPress={actions.nextStep}
        >
          Siguiente: Logo
        </Button>
      </div>
    </div>
  );
}

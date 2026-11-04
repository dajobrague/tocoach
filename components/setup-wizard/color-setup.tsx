"use client";

import { Button, Card, CardBody, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";
import { HexColorPicker } from "react-colorful";

import { useSetupWizard } from "@/lib/setup-wizard/context";
import { brandColorHint } from "@/lib/theme/brand-colors";

// Paletas de un clic: solo principal + secundario; el resto lo deriva la app.
const COLOR_PALETTES = [
  { name: "Profesional Azul", primary: "#0f172a", secondary: "#6366f1" },
  { name: "Energía Naranja", primary: "#f97316", secondary: "#eab308" },
  { name: "Naturaleza Verde", primary: "#10b981", secondary: "#059669" },
  { name: "Elegante Púrpura", primary: "#8b5cf6", secondary: "#a855f7" },
  { name: "Fuerza Roja", primary: "#ef4444", secondary: "#dc2626" },
  { name: "Equilibrio Teal", primary: "#14b8a6", secondary: "#0d9488" },
  { name: "Cielo Brillante", primary: "#0ea5e9", secondary: "#06b6d4" },
  { name: "Coral Cálido", primary: "#f97066", secondary: "#fb923c" },
  { name: "Amatista Profundo", primary: "#7c3aed", secondary: "#a78bfa" },
  { name: "Bosque Oscuro", primary: "#059669", secondary: "#34d399" },
  { name: "Dorado Vibrante", primary: "#f59e0b", secondary: "#fbbf24" },
  { name: "Marino Profesional", primary: "#1e40af", secondary: "#3b82f6" },
];

export default function ColorSetup() {
  const { state, actions } = useSetupWizard();
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(
    null
  );

  const handlePaletteSelect = (palette: (typeof COLOR_PALETTES)[number]) => {
    actions.setPrimaryColor(palette.primary);
    actions.setSecondaryColor(palette.secondary);
  };

  const primaryHint = brandColorHint(state.colors.primary);

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
  }) => {
    // Cinturón de seguridad: si el estado llega con un color undefined o
    // vacío (theme_json guardado con otra shape), la card no debe tirar
    // abajo el paso entero del wizard.
    const safeColor =
      typeof color === "string" && color.length > 0 ? color : "#000000";

    return (
      <div className="space-y-3">
        <label className="text-sm font-medium text-black">{label}</label>
        <div className="flex items-center gap-4">
          <button
            className="w-16 h-16 rounded-lg border-2 border-gray-300 flex-shrink-0 cursor-pointer hover:border-gray-400 transition-colors"
            style={{ backgroundColor: safeColor }}
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
            value={safeColor.replace(/^#/, "")}
            onValueChange={(value) => handleHexInput(value, onChange)}
          />
        </div>

        {activeColorPicker === pickerId && (
          <Card className="p-4">
            <CardBody className="flex items-center justify-center">
              <HexColorPicker color={safeColor} onChange={onChange} />
            </CardBody>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-heading font-bold text-black mb-2">
          Elige los colores de tu marca
        </h2>
        <p className="text-gray-600 font-body">
          Solo necesitas tu color principal y, si quieres, uno secundario. Los
          textos, fondos y botones se ajustan solos para que todo se lea bien.
        </p>
      </div>

      {/* Predefined Palettes */}
      <div>
        <h3 className="text-lg font-heading font-semibold text-black mb-4">
          Paletas predefinidas
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {COLOR_PALETTES.map((palette) => (
            <Card
              key={palette.name}
              isPressable
              aria-label={palette.name}
              className="border-2 border-gray-200 hover:border-slate-400 transition-all hover:shadow-md"
              onPress={() => handlePaletteSelect(palette)}
            >
              <CardBody className="p-3">
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
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* Brand colors */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <ColorPickerButton
            color={state.colors.primary}
            label="Color principal"
            pickerId="primary"
            onChange={actions.setPrimaryColor}
          />
          {primaryHint && (
            <p className="flex items-start gap-1.5 text-xs text-warning-600">
              <Icon
                className="mt-0.5 shrink-0"
                icon="solar:danger-triangle-linear"
              />
              {primaryHint}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <ColorPickerButton
            color={state.colors.secondary}
            label="Color secundario (opcional)"
            pickerId="secondary"
            onChange={actions.setSecondaryColor}
          />
          <Button
            size="sm"
            variant="light"
            onPress={() => actions.setSecondaryColor(state.colors.primary)}
          >
            Usar el color principal
          </Button>
        </div>
      </div>

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
          Siguiente: Tipografía
        </Button>
      </div>
    </div>
  );
}

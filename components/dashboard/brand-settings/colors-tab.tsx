"use client";

import { Alert, Button, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerFormat,
  ColorPickerOutput,
} from "@/components/kibo-ui/color-picker";
import {
  brandColorHint,
  hasLegacyCustomColors,
} from "@/lib/theme/brand-colors";
import { pickForegroundHSL } from "@/lib/theme/color-utils";

// Editor simple: solo color principal (brand) y secundario (accent). Textos,
// fondos, bordes y botones los deriva el pipeline con contraste garantizado.
// Guardar envía `auto: true` y el PATCH reescribe lo derivado con
// simplifyBrandColors (lib/theme/brand-colors.ts). Quien no guarde aquí
// conserva su theme_json y se ve exactamente igual que antes.
interface BrandColors {
  brand: string;
  accent: string;
}

const DEFAULT_COLORS: BrandColors = {
  brand: "#3b82f6",
  accent: "#6366f1",
};

const HEX_RE = /^#?[0-9a-f]{6}$/i;

const hexOr = (v: unknown, fallback: string): string =>
  typeof v === "string" && HEX_RE.test(v)
    ? v.startsWith("#")
      ? v
      : `#${v}`
    : fallback;

export default function BrandColorsTab() {
  const [colors, setColors] = React.useState<BrandColors>(DEFAULT_COLORS);
  const [originalColors, setOriginalColors] =
    React.useState<BrandColors>(DEFAULT_COLORS);
  // Tenant con textos/fondos personalizados del editor antiguo: al guardar
  // pasan a derivarse, así que se avisa y se permite guardar sin cambios.
  const [hasLegacy, setHasLegacy] = React.useState(false);
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
          const c: unknown = data.theme_json?.colors;

          if (c && typeof c === "object") {
            const rec = c as Record<string, unknown>;
            const brand = hexOr(rec.brand, DEFAULT_COLORS.brand);
            const loaded: BrandColors = {
              brand,
              accent: hexOr(rec.accent, brand),
            };

            setColors(loaded);
            setOriginalColors(loaded);
            setHasLegacy(hasLegacyCustomColors(c));
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
          colors: { brand: colors.brand, accent: colors.accent, auto: true },
        }),
      });

      if (response.ok) {
        setOriginalColors(colors);
        setHasLegacy(false);
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

  const hasChanges =
    hasLegacy ||
    colors.brand !== originalColors.brand ||
    colors.accent !== originalColors.accent;
  const brandHint = brandColorHint(colors.brand);

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

  const handleHexInput = (
    rawValue: string,
    onChange: (color: string) => void
  ) => {
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
          <Input
            classNames={{ inputWrapper: "h-9", input: "font-mono text-xs" }}
            description="Código hexadecimal"
            placeholder="3b82f6"
            size="sm"
            startContent={
              <span className="text-gray-400 text-xs font-mono">#</span>
            }
            value={color.replace(/^#/, "")}
            onValueChange={(value) => handleHexInput(value, onChange)}
          />

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
              <Icon icon="solar:close-circle-linear" width={18} />
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

      <div>
        <h4 className="text-md font-semibold text-black mb-1 flex items-center gap-2">
          <Icon className="text-slate-700" icon="solar:palette-linear" />
          Colores de marca
        </h4>
        <p className="text-sm text-gray-500 mb-4">
          Elige tu color principal y, si quieres, uno secundario. Los textos,
          fondos y botones se ajustan solos para que todo se lea bien.
        </p>

        {hasLegacy && (
          <Alert
            className="mb-4"
            color="warning"
            description="Tu marca tiene colores de texto y fondo personalizados de la versión anterior. Al guardar, se ajustarán automáticamente a tu color principal."
            title="Textos y fondos automáticos"
          />
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <ColorPickerButton
              color={colors.brand}
              label="Color principal"
              pickerId="brand"
              onChange={(c) => setColors({ ...colors, brand: c })}
            />
            {brandHint && (
              <p className="flex items-start gap-1.5 text-xs text-warning-600">
                <Icon
                  className="mt-0.5 shrink-0"
                  icon="solar:danger-triangle-linear"
                />
                {brandHint}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <ColorPickerButton
              color={colors.accent}
              label="Color secundario (opcional)"
              pickerId="accent"
              onChange={(c) => setColors({ ...colors, accent: c })}
            />
            <Button
              size="sm"
              variant="light"
              onPress={() => setColors({ ...colors, accent: colors.brand })}
            >
              Usar el color principal
            </Button>
          </div>
        </div>

        {/* Muestra: el texto del botón se elige solo (pickForegroundHSL). */}
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <span className="text-xs text-gray-500">Vista previa</span>
          <span
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: colors.brand,
              color: `hsl(${pickForegroundHSL(colors.brand)})`,
            }}
          >
            Botón principal
          </span>
          <span
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: colors.accent,
              color: `hsl(${pickForegroundHSL(colors.accent)})`,
            }}
          >
            Secundario
          </span>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-6 border-t border-gray-200">
        <Button
          className="bg-black text-white hover:bg-slate-800"
          isDisabled={!hasChanges}
          isLoading={isSaving}
          size="lg"
          startContent={<Icon icon="solar:diskette-linear" />}
          onPress={handleSave}
        >
          {isSaving ? "Guardando..." : "Guardar colores"}
        </Button>
      </div>
    </div>
  );
}

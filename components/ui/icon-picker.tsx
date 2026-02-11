"use client";

import { Input, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo, useState } from "react";

// ── Curated icon catalog organized by category ────────────────────────
export const ICON_CATALOG: {
  category: string;
  icons: { name: string; label: string }[];
}[] = [
  {
    category: "Salud y Cuerpo",
    icons: [
      { name: "solar:heart-bold", label: "Corazón" },
      { name: "solar:health-bold", label: "Salud" },
      { name: "solar:shield-warning-bold", label: "Alerta" },
      { name: "solar:thermometer-bold", label: "Temperatura" },
      { name: "solar:scale-bold", label: "Peso" },
      { name: "solar:ruler-bold", label: "Medidas" },
      { name: "solar:ruler-cross-pen-bold", label: "Medir" },
      { name: "solar:user-bold", label: "Persona" },
      { name: "solar:user-heart-bold", label: "Bienestar" },
    ],
  },
  {
    category: "Fitness",
    icons: [
      { name: "solar:dumbbell-bold", label: "Pesas" },
      { name: "solar:running-bold", label: "Correr" },
      { name: "solar:walking-bold", label: "Caminar" },
      { name: "solar:bolt-bold", label: "Energía" },
      { name: "solar:fire-bold", label: "Calorías" },
      { name: "solar:cup-star-bold", label: "Logro" },
      { name: "solar:target-bold", label: "Objetivo" },
      { name: "solar:medal-star-bold", label: "Medalla" },
    ],
  },
  {
    category: "Alimentación",
    icons: [
      { name: "solar:plate-bold", label: "Comida" },
      { name: "solar:cup-hot-bold", label: "Cafeína" },
      { name: "solar:leaf-bold", label: "Carbos" },
      { name: "solar:cloud-waterdrop-bold", label: "Grasas" },
      { name: "solar:pie-chart-bold", label: "Macros" },
      { name: "solar:pill-bold", label: "Suplemento" },
      { name: "solar:water-bold", label: "Agua" },
      { name: "solar:bottle-bold", label: "Botella" },
    ],
  },
  {
    category: "Sueño y Descanso",
    icons: [
      { name: "solar:moon-sleep-bold", label: "Sueño" },
      { name: "solar:moon-stars-bold", label: "Noche" },
      { name: "solar:sun-fog-bold", label: "Amanecer" },
      { name: "solar:sun-bold", label: "Sol" },
      { name: "solar:sleeping-bold", label: "Dormir" },
      { name: "solar:clock-circle-bold", label: "Hora" },
    ],
  },
  {
    category: "Estado de Ánimo",
    icons: [
      { name: "solar:smile-circle-bold", label: "Feliz" },
      { name: "solar:emoji-funny-circle-bold", label: "Divertido" },
      { name: "solar:star-bold", label: "Estrella" },
      { name: "solar:star-circle-bold", label: "Favorito" },
      { name: "solar:chat-round-dots-bold", label: "Comentario" },
    ],
  },
  {
    category: "General",
    icons: [
      { name: "solar:check-circle-bold", label: "Completado" },
      { name: "solar:check-square-bold", label: "Check" },
      { name: "solar:close-circle-bold", label: "Cerrar" },
      { name: "solar:question-circle-bold", label: "Pregunta" },
      { name: "solar:info-circle-bold", label: "Info" },
      { name: "solar:notes-bold", label: "Notas" },
      { name: "solar:clipboard-check-bold", label: "Clipboard" },
      { name: "solar:calendar-bold", label: "Calendario" },
      { name: "solar:calendar-mark-bold", label: "Fecha" },
      { name: "solar:camera-bold", label: "Cámara" },
      { name: "solar:chart-bold", label: "Gráfico" },
      { name: "solar:hashtag-bold", label: "Número" },
      { name: "solar:text-bold", label: "Texto" },
    ],
  },
];

// Flat list for search
const ALL_ICONS = ICON_CATALOG.flatMap((cat) =>
  cat.icons.map((icon) => ({ ...icon, category: cat.category }))
);

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  size?: "sm" | "md";
}

export function IconPicker({ value, onChange, size = "md" }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return ICON_CATALOG;

    const q = search.toLowerCase();

    return ICON_CATALOG.map((cat) => ({
      ...cat,
      icons: cat.icons.filter(
        (i) =>
          i.label.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          cat.category.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.icons.length > 0);
  }, [search]);

  const triggerSize = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const iconSize = size === "sm" ? "text-base" : "text-xl";

  return (
    <Popover isOpen={isOpen} placement="bottom-start" onOpenChange={setIsOpen}>
      <PopoverTrigger>
        <button
          className={`${triggerSize} rounded-xl bg-default-100 hover:bg-default-200 flex items-center justify-center transition-colors border border-default-200 cursor-pointer`}
          type="button"
        >
          <Icon
            className={`${iconSize} text-default-700`}
            icon={value || "solar:question-circle-bold"}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <div className="p-3 border-b border-divider">
          <Input
            className="w-full"
            placeholder="Buscar icono..."
            size="sm"
            startContent={
              <Icon className="text-default-400" icon="solar:magnifer-linear" />
            }
            value={search}
            variant="bordered"
            onValueChange={setSearch}
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-2 space-y-3">
          {filtered.map((cat) => (
            <div key={cat.category}>
              <p className="text-[10px] font-bold text-default-400 uppercase tracking-wider px-1 mb-1.5">
                {cat.category}
              </p>
              <div className="grid grid-cols-6 gap-1">
                {cat.icons.map((icon) => (
                  <button
                    key={icon.name}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                      value === icon.name
                        ? "bg-gray-900 ring-2 ring-gray-900"
                        : "hover:bg-default-100"
                    }`}
                    title={icon.label}
                    type="button"
                    onClick={() => {
                      onChange(icon.name);
                      setIsOpen(false);
                      setSearch("");
                    }}
                  >
                    <Icon
                      className={`text-lg ${value === icon.name ? "text-white" : "text-default-600"}`}
                      icon={icon.name}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-default-400 text-center py-4">
              No se encontraron iconos
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

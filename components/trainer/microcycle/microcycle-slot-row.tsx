// Una fila del microciclo en el editor. Variantes:
// - Slot asignado: nombre + chip de tipo + botón × (eliminar).
// - Slot vacío + no seleccionado: hint "— Descanso —" + chip "Rest".
// - Slot vacío + seleccionado: hint "Toca una sesión del panel".
//
// Click en cualquier área del row (no en ×) → selecciona el día.
// Click en × → elimina la asignación; NO selecciona automáticamente.

import type { Session, SessionType } from "@/types/training";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

const TYPE_LABEL: Record<SessionType, string> = {
  strength: "Fuerza",
  cardio: "Cardio",
  flexibility: "Flexibilidad",
  sports: "Deportes",
  recovery: "Descanso activo",
  other: "Otro",
};

// Pills de tipo de sesión. Renderizadas como <span> con clases Tailwind
// explícitas en lugar de <Chip color="..."> de HeroUI, porque el chip
// con color="primary" no respeta la escala de azules del theme custom y
// termina renderizando casi negro. Estas clases dan el aspecto tintado
// preciso del wireframe.
const TYPE_PILL_CLASS: Record<SessionType, string> = {
  strength: "bg-blue-100 text-blue-800",
  cardio: "bg-red-100 text-red-800",
  flexibility: "bg-amber-100 text-amber-800",
  sports: "bg-green-100 text-green-800",
  recovery: "bg-gray-100 text-gray-700",
  other: "bg-gray-100 text-gray-700",
};

const PILL_BASE_CLASS =
  "inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded";

interface Props {
  dayIndex: number;
  selectedSessionId: string | null;
  isSelected: boolean;
  availableSessions: Session[];
  isDisabled?: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

export default function MicrocycleSlotRow({
  dayIndex,
  selectedSessionId,
  isSelected,
  availableSessions,
  isDisabled = false,
  onSelect,
  onRemove,
}: Props) {
  const session =
    selectedSessionId === null
      ? null
      : (availableSessions.find((s) => s.id === selectedSessionId) ?? null);

  // Usamos div con role=button (no <button> real) porque dentro va el
  // botón × (HeroUI Button es un <button>); anidar buttons es HTML
  // inválido y provoca handlers fantasma en algunos navegadores.
  return (
    <div
      aria-disabled={isDisabled}
      aria-pressed={isSelected}
      className={`flex w-full items-center gap-3 py-3 px-2 rounded-md text-left transition-colors border-[1.5px] ${
        isSelected
          ? "bg-blue-50 border-blue-500"
          : "border-transparent hover:bg-gray-50"
      } ${isDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      onClick={() => {
        if (!isDisabled) onSelect();
      }}
      onKeyDown={(e) => {
        if (isDisabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div
        className={`w-12 shrink-0 text-sm font-semibold ${
          isSelected ? "text-blue-600" : "text-gray-700"
        }`}
      >
        Día {dayIndex}
      </div>

      {session ? (
        <span className="flex-1 text-sm text-gray-900 truncate">
          {session.name}
        </span>
      ) : isSelected ? (
        <span className="flex-1 text-sm text-blue-600 font-medium">
          Toca una sesión del panel
        </span>
      ) : (
        <span className="flex-1 text-sm text-gray-400">— Descanso —</span>
      )}

      <div className="shrink-0 flex items-center gap-2">
        {session?.session_type ? (
          <span
            className={`${PILL_BASE_CLASS} ${TYPE_PILL_CLASS[session.session_type]}`}
          >
            {TYPE_LABEL[session.session_type]}
          </span>
        ) : selectedSessionId === null ? (
          <span className={`${PILL_BASE_CLASS} bg-gray-100 text-gray-700`}>
            Rest
          </span>
        ) : null}

        {session ? (
          <Button
            isIconOnly
            aria-label={`Quitar sesión del día ${dayIndex}`}
            isDisabled={isDisabled}
            size="sm"
            variant="light"
            onClick={(e) => {
              // Stop bubbling para que el div padre no interprete el
              // tap como "selecciona el día".
              e.stopPropagation();
            }}
            onPress={onRemove}
          >
            <Icon
              className="text-gray-500"
              icon="solar:close-circle-linear"
              width={18}
            />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

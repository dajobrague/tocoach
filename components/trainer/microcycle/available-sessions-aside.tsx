// Panel lateral del editor del Plan Semanal. Las sesiones del programa
// son CLICKABLES (Trabajo 3 §5.6): tap en una sesión la asigna al slot
// seleccionado o, si no hay seleccionado, al primer slot vacío.
//
// Cuando hay un slot seleccionado, las cards reciben un highlight sutil
// (border info) para señalar que son la próxima acción esperada.

import type { Session, SessionType } from "@/types/training";

import { Card, CardBody, CardHeader, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";

interface AvailableSession extends Session {
  exercise_count?: number;
}

interface Props {
  sessions: AvailableSession[];
  /** True cuando hay un slot seleccionado en el panel principal. */
  highlighted: boolean;
  isDisabled?: boolean;
  onSelectSession: (sessionId: string) => void;
}

const TYPE_LABEL: Record<SessionType, string> = {
  strength: "Fuerza",
  cardio: "Cardio",
  flexibility: "Flexibilidad",
  sports: "Deportes",
  recovery: "Descanso activo",
  other: "Otro",
};

// Mapeo legible en ambos modos. NO usar "primary" (brand color es muy
// oscuro como chip). Todos con variant="flat" → HeroUI da bg tintado +
// fg legible automático en light/dark.
const TYPE_COLOR: Record<
  SessionType,
  "danger" | "warning" | "secondary" | "success" | "default"
> = {
  strength: "secondary",
  cardio: "danger",
  flexibility: "warning",
  sports: "success",
  recovery: "default",
  other: "default",
};

export default function AvailableSessionsAside({
  sessions,
  highlighted,
  isDisabled = false,
  onSelectSession,
}: Props) {
  return (
    <Card shadow="sm">
      <CardHeader className="flex items-center gap-2 pb-2">
        <Icon className="text-gray-500" icon="solar:dumbbell-bold" width={20} />
        <span className="text-sm font-semibold text-gray-700">
          Sesiones del programa
        </span>
      </CardHeader>
      <CardBody className="pt-0">
        {sessions.length === 0 ? (
          <p className="text-xs text-gray-400">
            Este programa todavía no tiene sesiones. Agrégalas desde la pestaña{" "}
            <span className="font-medium">Entrenamientos</span>.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                    highlighted
                      ? "border-blue-500 bg-blue-50 hover:bg-blue-100"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  disabled={isDisabled}
                  type="button"
                  onClick={() => onSelectSession(s.id)}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    {s.session_type ? (
                      <Chip
                        color={TYPE_COLOR[s.session_type]}
                        size="sm"
                        variant="flat"
                      >
                        {TYPE_LABEL[s.session_type]}
                      </Chip>
                    ) : (
                      <span />
                    )}
                    <span className="text-[11px] text-gray-500 font-body">
                      {formatMeta(s)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {s.name}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function formatMeta(s: AvailableSession): string {
  if (s.session_type === "cardio" && s.duration_minutes) {
    return `${s.duration_minutes} min`;
  }
  if (typeof s.exercise_count === "number" && s.exercise_count > 0) {
    return `${s.exercise_count} ${s.exercise_count === 1 ? "ejercicio" : "ejercicios"}`;
  }
  if (s.duration_minutes) {
    return `${s.duration_minutes} min`;
  }

  return "Sin ejercicios";
}

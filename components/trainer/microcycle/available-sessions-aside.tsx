// Panel lateral del editor del Microciclo. Las sesiones del programa
// son CLICKABLES (Trabajo 3 §5.6): tap en una sesión la asigna al slot
// seleccionado o, si no hay seleccionado, al primer slot vacío.
//
// Cuando hay un slot seleccionado, las cards reciben un highlight sutil
// (border info) para señalar que son la próxima acción esperada.
//
// Las sesiones se agrupan por tipo en tres bloques: Fuerza, Cardio y
// Otros. Cada grupo solo aparece si tiene al menos una sesión.

import type { Session, SessionType } from "@/types/training";

import { Card, CardBody, CardHeader } from "@heroui/react";
import { Icon } from "@iconify/react";

interface AvailableSession extends Session {
  exercise_count?: number;
}

interface Props {
  sessions: AvailableSession[];
  /** True cuando hay un slot seleccionado en el panel principal. */
  highlighted: boolean;
  /** day_index del slot seleccionado (1..N) o null. Se usa para el
   *  subtítulo dinámico arriba de los grupos de sesiones. */
  selectedDay: number | null;
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

// Pills de tipo de sesión. Renderizadas como <span> con clases Tailwind
// explícitas en lugar de <Chip color="..."> de HeroUI, porque el chip
// con color="primary" no respeta la escala de azules del theme custom y
// termina renderizando casi negro. Las clases de abajo dan el aspecto
// tintado preciso del wireframe en ambos modos.
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

type GroupKey = "strength" | "cardio" | "other";

interface Group {
  key: GroupKey;
  title: string;
  sessions: AvailableSession[];
}

const GROUP_DOT_CLASS: Record<GroupKey, string> = {
  strength: "bg-blue-200",
  cardio: "bg-red-200",
  other: "bg-gray-200",
};

export default function AvailableSessionsAside({
  sessions,
  highlighted,
  selectedDay,
  isDisabled = false,
  onSelectSession,
}: Props) {
  const groups = groupSessions(sessions);
  const helpText =
    selectedDay !== null
      ? `Día ${selectedDay} seleccionado · toca para asignar`
      : "Toca un día o una sesión para empezar";

  return (
    <Card shadow="sm">
      <CardHeader className="flex flex-col items-start gap-1 pb-2">
        <div className="flex items-center gap-2">
          <Icon
            className="text-gray-500"
            icon="solar:dumbbell-bold"
            width={20}
          />
          <span className="text-sm font-semibold text-gray-700">
            Sesiones del programa
          </span>
        </div>
        <span
          className={`text-[10px] ${
            selectedDay !== null ? "text-blue-600 font-medium" : "text-gray-400"
          }`}
        >
          {helpText}
        </span>
      </CardHeader>
      <CardBody className="pt-0">
        {sessions.length === 0 ? (
          <p className="text-xs text-gray-400">
            Este programa todavía no tiene sesiones. Agrégalas desde la pestaña{" "}
            <span className="font-medium">Entrenamientos</span>.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.key}>
                <div className="flex items-center gap-2 px-1 mb-2">
                  <span
                    className={`w-3 h-3 rounded-sm shrink-0 ${GROUP_DOT_CLASS[group.key]}`}
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 flex-1">
                    {group.title}
                  </span>
                  <span className="text-[10px] text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5 leading-tight tabular-nums">
                    {group.sessions.length}
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {group.sessions.map((s) => (
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
                            <span
                              className={`${PILL_BASE_CLASS} ${TYPE_PILL_CLASS[s.session_type]}`}
                            >
                              {TYPE_LABEL[s.session_type]}
                            </span>
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
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function groupSessions(sessions: AvailableSession[]): Group[] {
  const strength: AvailableSession[] = [];
  const cardio: AvailableSession[] = [];
  const others: AvailableSession[] = [];

  for (const s of sessions) {
    if (s.session_type === "strength") strength.push(s);
    else if (s.session_type === "cardio") cardio.push(s);
    else others.push(s);
  }

  const result: Group[] = [];

  if (strength.length > 0) {
    result.push({ key: "strength", title: "Fuerza", sessions: strength });
  }
  if (cardio.length > 0) {
    result.push({ key: "cardio", title: "Cardio", sessions: cardio });
  }
  if (others.length > 0) {
    result.push({ key: "other", title: "Otros", sessions: others });
  }

  return result;
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

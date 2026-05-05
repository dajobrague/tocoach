// Detalle del día seleccionado: card debajo del grid con la lista de
// sesiones completadas en esa fecha. Solo lectura — la edición
// retroactiva está fuera de scope (decisión extra-2 §1 spec).

import type { CalendarEntrySession } from "./hooks/use-calendar-entries";

import { Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";

import { chipColor, typeLabel } from "./calendar-shared";

interface Props {
  date: string;
  sessions: CalendarEntrySession[];
  onClose: () => void;
}

export function CalendarDayDetail({ date, sessions, onClose }: Props) {
  return (
    <Card>
      <CardBody className="p-3">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-base font-heading font-bold text-foreground">
              {formatLong(date)}
            </h3>
            <p className="text-xs text-default-500 font-body">
              {sessions.length}{" "}
              {sessions.length === 1
                ? "entrenamiento completado"
                : "entrenamientos completados"}
            </p>
          </div>
          <button
            aria-label="Cerrar detalle"
            className="text-default-400 hover:text-default-600 shrink-0"
            type="button"
            onClick={onClose}
          >
            <Icon icon="solar:close-circle-linear" width={22} />
          </button>
        </div>

        {sessions.length === 0 ? (
          <p className="text-sm text-default-500 font-body">
            No hay entrenamientos registrados.
          </p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-md bg-default-50 p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {s.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Chip
                      color={chipColor(s.session_type)}
                      size="sm"
                      variant="flat"
                    >
                      {typeLabel(s.session_type)}
                    </Chip>
                    <span className="text-xs text-default-500 font-body">
                      {s.exercises_completed}/{s.exercises_total} ejercicios
                    </span>
                  </div>
                </div>
                {s.exercises_total > 0 &&
                s.exercises_completed >= s.exercises_total ? (
                  <Icon
                    className="text-success shrink-0"
                    icon="solar:check-circle-bold"
                    width={22}
                  />
                ) : (
                  <Icon
                    className="text-warning shrink-0"
                    icon="solar:clock-circle-bold"
                    width={22}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function formatLong(isoYmd: string): string {
  try {
    const d = new Date(`${isoYmd}T12:00:00Z`);

    return new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return isoYmd;
  }
}

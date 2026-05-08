// Sección "Tu entrenamiento del [día]". Aparece arriba de la lista de
// templates cuando el cliente seleccionó una fecha pasada y tiene logs
// registrados ese día. Cada card es tappable → entra a ActiveSessionView
// en modo edición (existingLog ya está plumbeado en el modal de log).

import type { LoggedSession } from "./hooks/use-logged-sessions-for-date";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

import { SessionCard } from "./session-card";

interface Props {
  loggedSessions: LoggedSession[];
  scheduledDate: string;
  todayYmd: string;
  onActivate: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

function headingFor(scheduledDate: string, todayYmd: string): string {
  if (scheduledDate === todayYmd) return "Lo que ya hiciste hoy";
  // Si es ayer, "Tu entrenamiento de ayer" suena más natural.
  // Para cualquier otra fecha, "Tu entrenamiento del [día]".
  try {
    const [yyyy, mm, dd] = scheduledDate.split("-").map(Number);
    const d = new Date(yyyy ?? 1970, (mm ?? 1) - 1, dd ?? 1);
    const formatted = new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(d);
    const cap = formatted.charAt(0).toUpperCase() + formatted.slice(1);

    return `Tu entrenamiento del ${cap}`;
  } catch {
    return "Tu entrenamiento";
  }
}

export function LoggedSessionsSection({
  loggedSessions,
  scheduledDate,
  todayYmd,
  onActivate,
  onDelete,
}: Props) {
  if (loggedSessions.length === 0) return null;

  return (
    <section className="w-full">
      <div className="flex items-center gap-2 mb-3">
        <Icon
          className="text-success"
          icon="solar:check-circle-bold"
          width={20}
        />
        <h2 className="text-xl font-heading font-semibold text-foreground">
          {headingFor(scheduledDate, todayYmd)}
        </h2>
      </div>
      <div className="space-y-3 w-full">
        {loggedSessions.map((s) => (
          <div
            key={s.sessionId}
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => !s.templateMissing && onActivate(s.sessionId)}
            onKeyDown={(e) => {
              if (!s.templateMissing && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onActivate(s.sessionId);
              }
            }}
          >
            <SessionCard
              exerciseCount={s.exercisesTotal}
              name={s.name}
              rightContent={
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-body text-foreground/60 mr-1">
                    {s.exercisesLogged}/{s.exercisesTotal}
                  </span>
                  {!s.templateMissing ? (
                    <Button
                      isIconOnly
                      aria-label="Editar entrenamiento"
                      size="sm"
                      variant="light"
                      onPress={() => onActivate(s.sessionId)}
                    >
                      <Icon icon="solar:pen-2-linear" width={16} />
                    </Button>
                  ) : null}
                  <Button
                    isIconOnly
                    aria-label="Borrar entrenamiento"
                    color="danger"
                    size="sm"
                    variant="light"
                    onPress={() => {
                      if (
                        window.confirm(
                          "¿Borrar todo este entrenamiento? Se eliminarán todos los registros de esta sesión en esta fecha."
                        )
                      ) {
                        onDelete(s.sessionId);
                      }
                    }}
                  >
                    <Icon icon="solar:trash-bin-trash-linear" width={16} />
                  </Button>
                </div>
              }
              sessionType={s.sessionType}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

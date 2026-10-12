// Sección "Tu entrenamiento del [día]". Aparece arriba de la lista de
// templates cuando el cliente seleccionó una fecha pasada y tiene logs
// registrados ese día. Cada card es tappable → abre la sesión
// en modo edición (existingLog ya está plumbeado en el modal de log).

import type { LoggedSession } from "./hooks/use-logged-sessions-for-date";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

import { SectionHeader } from "../client-page";

import { SessionTypeTile } from "./session-card";
import { getSessionTypeStyle } from "./session-type-style";

import { confirmAfterPress } from "@/lib/ui/native-dialog";

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
      <SectionHeader
        className="mb-3.5"
        title={headingFor(scheduledDate, todayYmd)}
      />
      <div className="w-full space-y-2.5">
        {loggedSessions.map((s) => {
          const full = s.exercisesLogged >= s.exercisesTotal;
          const body = (
            <>
              <SessionTypeTile sessionType={s.sessionType} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-foreground">
                  {s.name}
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-default-500">
                  {s.templateMissing
                    ? "Tu entrenador quitó esta sesión del programa"
                    : getSessionTypeStyle(s.sessionType).label}
                </span>
              </span>
              <span
                aria-label={`${s.exercisesLogged} de ${s.exercisesTotal} ejercicios`}
                className={`flex h-[26px] min-w-10 shrink-0 items-center justify-center rounded-full px-2 text-[13px] font-bold tabular-nums ${
                  full
                    ? "bg-success/15 text-success-700"
                    : "bg-default-100 text-default-500"
                }`}
              >
                {s.exercisesLogged}/{s.exercisesTotal}
              </span>
            </>
          );

          return (
            <div
              key={s.sessionId}
              className="flex items-center gap-1 rounded-large bg-content1 py-1.5 pl-3.5 pr-1.5 shadow-small"
            >
              {s.templateMissing ? (
                <div className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5">
                  {body}
                </div>
              ) : (
                // Tocar la card reabre la sesión (modo edición: existingLog
                // ya viaja al modal de log).
                <button
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-medium py-1.5 text-left active:opacity-70"
                  type="button"
                  onClick={() => onActivate(s.sessionId)}
                >
                  {body}
                </button>
              )}
              {!s.templateMissing ? (
                <button
                  aria-label="Editar entrenamiento"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-default-500 active:bg-default-100"
                  type="button"
                  onClick={() => onActivate(s.sessionId)}
                >
                  <Icon icon="solar:pen-2-linear" width={20} />
                </button>
              ) : null}
              <Button
                isIconOnly
                aria-label="Borrar entrenamiento"
                className="h-11 w-11 min-w-11"
                color="danger"
                radius="full"
                variant="light"
                onPress={() => {
                  // confirmAfterPress y no window.confirm: un confirm()
                  // síncrono dentro de onPress congela la página hasta
                  // recargar (react-aria queda esperando el pointer-up).
                  void confirmAfterPress(
                    "¿Borrar todo este entrenamiento? Se eliminarán todos los registros de esta sesión en esta fecha."
                  ).then((ok) => {
                    if (ok) onDelete(s.sessionId);
                  });
                }}
              >
                <Icon icon="solar:trash-bin-trash-linear" width={20} />
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

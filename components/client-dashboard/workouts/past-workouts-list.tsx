// Lista "Entrenamientos pasados". Lee de usePastSessions (que consume
// /api/client/calendar y aplana los entries por fecha). Solo lectura,
// sin acción de tap — la edición retroactiva está fuera de scope para
// este bloque (decisión extra-2 §1 spec).

import { Icon } from "@iconify/react";

import { type PastSession } from "./hooks/use-past-sessions";
import { SessionCard } from "./session-card";

interface Props {
  sessions: PastSession[];
}

export function PastWorkoutsList({ sessions }: Props) {
  if (sessions.length === 0) return null;

  return (
    <section className="w-full">
      <div className="flex items-center gap-2 mb-3 mt-8">
        <Icon
          className="text-foreground/70"
          icon="solar:history-2-bold"
          width={18}
        />
        <h3 className="text-lg font-heading font-semibold text-foreground">
          Entrenamientos pasados
        </h3>
      </div>
      <div className="space-y-3 w-full">
        {sessions.map((s) => (
          <SessionCard
            key={s.id}
            dateBadge={<DateBadge isoYmd={s.scheduled_date} />}
            exerciseCount={s.exercises_total}
            name={s.name}
            rightContent={<CompletionLabel session={s} />}
            sessionType={s.session_type}
          />
        ))}
      </div>
    </section>
  );
}

function DateBadge({ isoYmd }: { isoYmd: string }) {
  const { day, month } = formatLocalParts(isoYmd);

  return (
    <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl bg-default-100">
      <span className="text-[11px] font-semibold uppercase text-foreground/60 font-body">
        {month}
      </span>
      <span className="text-xl font-bold text-foreground font-heading leading-none">
        {day}
      </span>
    </div>
  );
}

function CompletionLabel({ session }: { session: PastSession }) {
  const { exercises_completed, exercises_total } = session;
  const allDone = exercises_total > 0 && exercises_completed >= exercises_total;

  return (
    <div className="flex flex-col items-end gap-1">
      <Icon
        className={allDone ? "text-success" : "text-warning"}
        icon={allDone ? "solar:check-circle-bold" : "solar:clock-circle-bold"}
        width={20}
      />
      <span className="text-[11px] font-body text-foreground/60">
        {exercises_completed}/{exercises_total}
      </span>
    </div>
  );
}

// Parsea YYYY-MM-DD como UTC noon para evitar deriva por TZ del navegador
// en la línea del día. Devuelve { day, month } en es-ES corto.
function formatLocalParts(isoYmd: string): { day: string; month: string } {
  try {
    const d = new Date(`${isoYmd}T12:00:00Z`);
    const day = new Intl.DateTimeFormat("es-ES", { day: "2-digit" }).format(d);
    const month = new Intl.DateTimeFormat("es-ES", {
      month: "short",
    })
      .format(d)
      .replace(".", "");

    return { day, month };
  } catch {
    return { day: "--", month: "" };
  }
}

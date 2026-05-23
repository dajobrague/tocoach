// Lista "Escoge tu siguiente entrenamiento". Itera sobre useAvailableSessions
// y muestra una card por sesión, agrupando por tipo de sesión (Fuerza,
// Cardio, etc). Tap en card o "Comenzar" → emite onActivate(sessionId):
// el orquestador entra en MODO ACTIVA (ver active-session-view.tsx) y
// la lista deja de renderizarse.
//
// Si todas las sesiones son del mismo tipo, no renderizamos los headers
// — añaden ruido visual cuando solo hay un grupo.

import type { SessionType } from "@/types/training";
import type { AvailableSession } from "./hooks/use-available-sessions";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

import { SessionCard } from "./session-card";
import { SESSION_TYPE_ORDER, getSessionTypeStyle } from "./session-type-style";

// Re-exportado aquí porque el orquestador y la vista activa lo consumen.
export interface OpenLogPayload {
  exercise: { order: number; name: string; imageUrl?: string } & Record<
    string,
    unknown
  >;
  sessionId: string;
  scheduledDate: string;
  existingLog: unknown | null;
}

interface Props {
  availableSessions: AvailableSession[];
  onActivate: (sessionId: string) => void;
  heading?: string;
  /** Session id that the trainer's microcycle/override prescribes for the visible date. */
  recommendedSessionId?: string | null;
  /**
   * Sessions el cliente ya logueó al menos un ejercicio para la fecha
   * visible. Se renderizan grises + "Hecho" en vez de "Comenzar" — no
   * se permite re-entrar a la misma sesión el mismo día.
   */
  loggedSessionIds?: ReadonlySet<string>;
}

interface Bucket {
  type: SessionType;
  sessions: AvailableSession[];
}

function groupByType(sessions: AvailableSession[]): Bucket[] {
  const map = new Map<SessionType, AvailableSession[]>();

  for (const s of sessions) {
    const key = (s.session_type ?? "other") as SessionType;
    const arr = map.get(key) ?? [];

    arr.push(s);
    map.set(key, arr);
  }

  return SESSION_TYPE_ORDER.filter((t) => map.has(t)).map((t) => ({
    type: t,
    sessions: map.get(t) ?? [],
  }));
}

export function AvailableSessionsList({
  availableSessions,
  onActivate,
  heading = "Escoge tu siguiente entrenamiento",
  recommendedSessionId = null,
  loggedSessionIds,
}: Props) {
  if (availableSessions.length === 0) return null;

  const buckets = groupByType(availableSessions);
  const showHeaders = buckets.length > 1;

  return (
    <section className="w-full">
      <h2 className="text-xl font-heading font-semibold text-foreground mb-3">
        {heading}
      </h2>
      <div className="space-y-5 w-full">
        {buckets.map((bucket) => (
          <div key={bucket.type} className="space-y-2">
            {showHeaders ? <BucketHeader bucket={bucket} /> : null}
            <div className="space-y-3 w-full">
              {bucket.sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  isDone={loggedSessionIds?.has(session.id) ?? false}
                  isRecommended={session.id === recommendedSessionId}
                  session={session}
                  onActivate={onActivate}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BucketHeader({ bucket }: { bucket: Bucket }) {
  const style = getSessionTypeStyle(bucket.type);
  const count = bucket.sessions.length;

  return (
    <div className="flex items-center gap-2 px-1">
      <Icon className={style.iconColorClass} icon={style.icon} width={16} />
      <h3 className="text-sm font-heading font-semibold text-foreground">
        {style.label}
      </h3>
      <span className="text-xs font-body text-foreground/50">({count})</span>
    </div>
  );
}

function SessionRow({
  session,
  onActivate,
  isRecommended,
  isDone,
}: {
  session: AvailableSession;
  onActivate: (sessionId: string) => void;
  isRecommended: boolean;
  isDone: boolean;
}) {
  // Sesión ya logueada hoy: la card va gris y no es clickable. El cliente
  // puede entrar a otra sesión, pero no a la misma de nuevo el mismo día —
  // si quiere editar logs existentes lo hace desde "Tu entrenamiento del día".
  if (isDone) {
    return (
      <div
        aria-disabled="true"
        className="opacity-60 pointer-events-none select-none"
      >
        <SessionCard
          exerciseCount={session.exercise_count}
          isRecommended={isRecommended}
          name={session.name}
          rightContent={
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-success-700">
              <Icon icon="solar:check-circle-bold" width={14} />
              <span className="text-xs font-semibold leading-none">Hecho</span>
            </span>
          }
          sessionType={session.session_type}
        />
      </div>
    );
  }

  return (
    <div
      className="cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={() => onActivate(session.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate(session.id);
        }
      }}
    >
      <SessionCard
        exerciseCount={session.exercise_count}
        isRecommended={isRecommended}
        name={session.name}
        rightContent={
          <Button
            color="primary"
            size="sm"
            startContent={<Icon icon="solar:play-bold" width={16} />}
            onPress={() => onActivate(session.id)}
          >
            Comenzar
          </Button>
        }
        sessionType={session.session_type}
      />
    </div>
  );
}

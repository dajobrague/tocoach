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

import { useClientData } from "../client-data-provider";
import { SectionHeader } from "../client-page";

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
  /**
   * Session ids que el microciclo prescribe para la fecha visible — una
   * por programa activo (fuerza + cardio el mismo día = dos badges).
   */
  recommendedSessionIds?: ReadonlySet<string> | null;
  /**
   * Nombre de programa por program_id, para etiquetar cada card cuando el
   * cliente tiene varios programas activos. null/omitido = sin etiquetas.
   */
  programNameById?: ReadonlyMap<string, string> | null;
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
  recommendedSessionIds = null,
  programNameById = null,
  loggedSessionIds,
}: Props) {
  const { firstName, lastName } = useClientData();
  const clientFullName = `${firstName} ${lastName}`.trim();

  if (availableSessions.length === 0) return null;

  const buckets = groupByType(availableSessions);
  const showHeaders = buckets.length > 1;

  return (
    <section className="w-full">
      <SectionHeader title={heading} />
      <div className="space-y-5 w-full">
        {buckets.map((bucket) => (
          <div key={bucket.type} className="space-y-2">
            {showHeaders ? <BucketHeader bucket={bucket} /> : null}
            <div className="space-y-3 w-full">
              {bucket.sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  isDone={loggedSessionIds?.has(session.id) ?? false}
                  isRecommended={
                    recommendedSessionIds?.has(session.id) ?? false
                  }
                  programName={withoutClientName(
                    (session.program_id != null
                      ? programNameById?.get(session.program_id)
                      : null) ?? null,
                    clientFullName
                  )}
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
      <Icon className="text-primary" icon={style.icon} width={16} />
      <h3 className="text-sm font-heading font-semibold text-foreground">
        {style.label}
        <span className="font-body font-normal text-default-500">
          {" "}
          · {count}
        </span>
      </h3>
    </div>
  );
}

function SessionRow({
  session,
  onActivate,
  isRecommended,
  isDone,
  programName,
}: {
  session: AvailableSession;
  onActivate: (sessionId: string) => void;
  isRecommended: boolean;
  isDone: boolean;
  programName: string | null;
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
          programName={programName}
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
        programName={programName}
        rightContent={
          // Toda la card ya es tocable; el botón queda como señal discreta
          // (antes, cinco "Comenzar" sólidos iguales hacían una pared de
          // color sin jerarquía).
          <Button
            isIconOnly
            aria-label={`Comenzar ${session.name}`}
            className="h-11 w-11 min-w-11 rounded-full bg-primary/10 text-primary"
            onPress={() => onActivate(session.id)}
          >
            <Icon icon="solar:play-bold" width={18} />
          </Button>
        }
        sessionType={session.session_type}
      />
    </div>
  );
}

/**
 * Los entrenadores suelen nombrar el programa "Plantilla - Nombre Cliente";
 * en el portal del propio cliente ese sufijo es ruido. Solo se quita cuando
 * coincide exactamente con su nombre completo.
 */
export function withoutClientName(
  programName: string | null,
  clientFullName: string
): string | null {
  if (!programName || !clientFullName) return programName;
  const suffix = ` - ${clientFullName}`.toLowerCase();

  return programName.toLowerCase().endsWith(suffix)
    ? programName.slice(0, -suffix.length).trim()
    : programName;
}

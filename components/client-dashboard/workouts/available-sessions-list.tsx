// Lista "Escoge tu siguiente entrenamiento". Itera sobre useAvailableSessions
// y muestra una card por sesión, agrupando por tipo de sesión (Fuerza,
// Cardio, etc). Tap en la card → emite onActivate(sessionId): el
// orquestador abre la pantalla de sesión activa (ver active-session-view.tsx).
//
// Si todas las sesiones son del mismo tipo, no renderizamos los headers
// — añaden ruido visual cuando solo hay un grupo.

import type { SessionType } from "@/types/training";
import type { AvailableSession } from "./hooks/use-available-sessions";

import { Icon } from "@iconify/react";

import { useClientData } from "../client-data-provider";
import { SectionHeader } from "../client-page";

import { SessionTypeTile } from "./session-card";
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
      <SectionHeader className="mb-3.5" title={heading} />
      <div className="w-full space-y-[18px]">
        {buckets.map((bucket) => (
          <div key={bucket.type}>
            {showHeaders ? <BucketHeader bucket={bucket} /> : null}
            <div className="w-full space-y-2.5">
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

  return (
    <h3 className="mb-2.5 ml-1 flex items-center gap-2 text-sm font-semibold text-default-500">
      <span aria-hidden className={`h-2 w-2 rounded-full ${style.dotClass}`} />
      {style.label} · {bucket.sessions.length}
    </h3>
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
  const recommended = isRecommended && !isDone;
  const count = session.exercise_count;

  return (
    <button
      aria-disabled={isDone}
      aria-label={
        isDone ? `${session.name}, hecho` : `Comenzar ${session.name}`
      }
      className={`flex w-full flex-col gap-3 rounded-large p-3.5 text-left transition-transform motion-reduce:transition-none ${
        isDone
          ? "pointer-events-none cursor-default select-none bg-default-100"
          : `bg-content1 shadow-small active:scale-[0.97] [@media(hover:hover)]:hover:bg-default-50 ${
              recommended ? "ring-2 ring-inset ring-primary" : ""
            }`
      }`}
      tabIndex={isDone ? -1 : 0}
      type="button"
      onClick={() => {
        if (!isDone) onActivate(session.id);
      }}
    >
      {recommended ? (
        <span className="inline-flex h-6 items-center gap-1 rounded-full bg-primary/10 px-2.5 text-xs font-semibold text-primary">
          <Icon aria-hidden icon="solar:star-bold" width={14} />
          Recomendado por tu coach
        </span>
      ) : null}
      <span className="flex w-full items-center gap-3">
        <SessionTypeTile
          className={isDone ? "opacity-55" : ""}
          sessionType={session.session_type}
        />
        <span className={`min-w-0 flex-1 ${isDone ? "opacity-55" : ""}`}>
          <span className="block truncate text-base font-semibold text-foreground">
            {session.name}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-default-500">
            {count} {count === 1 ? "ejercicio" : "ejercicios"}
            {programName != null && programName.length > 0
              ? ` · ${programName}`
              : null}
          </span>
        </span>
        {isDone ? (
          <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-success/15 px-2.5 text-xs font-semibold text-success-700">
            <Icon aria-hidden icon="solar:check-circle-bold" width={14} />
            Hecho
          </span>
        ) : (
          // Toda la card es el botón; el círculo es solo la señal visual.
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Icon className="ml-0.5" icon="solar:play-bold" width={18} />
          </span>
        )}
      </span>
    </button>
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

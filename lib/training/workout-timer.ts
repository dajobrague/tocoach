/**
 * Matemática pura de la burbuja de cronómetro del entreno (cliente).
 *
 * Inicio de la sesión = la hora de inicio que el cliente declaró en el
 * servidor (`scheduled_sessions.scheduled_time`, botón "Empezar
 * entrenamiento" o editada a mano). Es la señal más fiel que existe: abrir la
 * vista no es empezar (llamada 29 Jul) y el primer set registrado llega tarde.
 * Precisión de minuto (la columna es HH:MM); sobra para un cronómetro de
 * sesión. Pausas y descanso son locales al dispositivo (localStorage).
 */

export interface WorkoutTimerLocal {
  /** Instante en que se pausó el cronómetro; null = corriendo. */
  pausedAt: number | null;
  /** Total pausado acumulado (ms) de pausas ya reanudadas. */
  pausedMs: number;
  /** Fin del descanso en curso (epoch ms); null = sin descanso. */
  restEndsAt: number | null;
}

export const EMPTY_TIMER_LOCAL: WorkoutTimerLocal = {
  pausedAt: null,
  pausedMs: 0,
  restEndsAt: null,
};

export const REST_PRESETS_SECONDS = [60, 90, 120, 180] as const;
export const REST_EXTEND_SECONDS = 15;
/** Tras esto un descanso terminado deja de mostrarse (p. ej. al recargar). */
export const REST_FINISHED_VISIBLE_MS = 5 * 60_000;

/** "YYYY-MM-DD" + "HH:MM" en hora local → epoch ms; null si no parsea. */
export function sessionStartMs(
  dateYmd: string,
  hhmm: string | null | undefined
): number | null {
  if (!hhmm) return null;
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd);
  const t = /^(\d{2}):(\d{2})/.exec(hhmm);

  if (!d || !t) return null;
  const ms = new Date(
    Number(d[1]),
    Number(d[2]) - 1,
    Number(d[3]),
    Number(t[1]),
    Number(t[2])
  ).getTime();

  return Number.isNaN(ms) ? null : ms;
}

/** Tiempo de entreno transcurrido, descontando pausas. Nunca negativo. */
export function elapsedMs(
  startMs: number,
  local: WorkoutTimerLocal,
  now: number
): number {
  const end = local.pausedAt ?? now;

  return Math.max(0, end - startMs - local.pausedMs);
}

export function pauseTimer(
  local: WorkoutTimerLocal,
  now: number
): WorkoutTimerLocal {
  return local.pausedAt === null ? { ...local, pausedAt: now } : local;
}

export function resumeTimer(
  local: WorkoutTimerLocal,
  now: number
): WorkoutTimerLocal {
  if (local.pausedAt === null) return local;

  return {
    ...local,
    pausedAt: null,
    pausedMs: local.pausedMs + Math.max(0, now - local.pausedAt),
  };
}

export function startRest(
  local: WorkoutTimerLocal,
  seconds: number,
  now: number
): WorkoutTimerLocal {
  return { ...local, restEndsAt: now + seconds * 1000 };
}

/** +15 s al descanso en curso; sin descanso corriendo no hace nada. */
export function extendRest(
  local: WorkoutTimerLocal,
  now: number,
  seconds: number = REST_EXTEND_SECONDS
): WorkoutTimerLocal {
  if (local.restEndsAt === null || local.restEndsAt <= now) return local;

  return { ...local, restEndsAt: local.restEndsAt + seconds * 1000 };
}

export function clearRest(local: WorkoutTimerLocal): WorkoutTimerLocal {
  return { ...local, restEndsAt: null };
}

export type RestPhase =
  | { kind: "idle" }
  | { kind: "running"; remainingMs: number }
  | { kind: "finished" };

export function restPhase(local: WorkoutTimerLocal, now: number): RestPhase {
  if (local.restEndsAt === null) return { kind: "idle" };
  const remaining = local.restEndsAt - now;

  if (remaining > 0) return { kind: "running", remainingMs: remaining };
  if (-remaining <= REST_FINISHED_VISIBLE_MS) return { kind: "finished" };

  return { kind: "idle" };
}

/** 75_000 → "1:15"; 3_725_000 → "1:02:05". Cuenta atrás: redondea arriba. */
export function formatClock(ms: number, roundUp = false): string {
  const total = Math.max(
    0,
    roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000)
  );
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");

  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Lectura robusta del estado local persistido (datos viejos/corruptos). */
export function parseTimerLocal(raw: string | null): WorkoutTimerLocal {
  if (!raw) return EMPTY_TIMER_LOCAL;
  try {
    const v = JSON.parse(raw) as Partial<
      Record<keyof WorkoutTimerLocal, unknown>
    >;
    const num = (x: unknown) =>
      typeof x === "number" && Number.isFinite(x) ? x : null;

    return {
      pausedAt: num(v.pausedAt),
      pausedMs: Math.max(0, num(v.pausedMs) ?? 0),
      restEndsAt: num(v.restEndsAt),
    };
  } catch {
    return EMPTY_TIMER_LOCAL;
  }
}

export function timerStorageKey(
  clientId: string,
  dateYmd: string,
  sessionId: string
): string {
  return `tc_workout_timer:${clientId}:${dateYmd}:${sessionId}`;
}

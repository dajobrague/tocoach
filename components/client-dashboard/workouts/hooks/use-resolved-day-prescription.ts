"use client";

import { useQuery } from "@tanstack/react-query";

import { clientFetch } from "@/lib/auth/client-token-storage";

export interface ResolvedSet {
  set_number: number;
  reps: string | null;
  weight_kg: number | null;
}

export interface ResolvedExercise {
  exercise_id: string;
  name: string;
  category: string;
  image_url: string | null;
  video_url: string | null;
  exercise_order: number;
  sets: number | null;
  reps: string | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  rest_seconds: number | null;
  notes: string | null;
  /** Cardio coaching meta — antes el endpoint los dropeaba y override de cardio se renderizaba como strength. */
  intensity: string | null;
  cardio_type: string | null;
  heart_rate_min: number | null;
  heart_rate_max: number | null;
  /** Strength coaching meta (tempo, sistema de entrenamiento). */
  tempo: string | null;
  training_system: string | null;
  prescribed_sets: ResolvedSet[];
  /**
   * Pesos del último log finalizado del mismo ejercicio (indexados por
   * posición de set, 0..N-1). El form de log usa estos valores para
   * prellenar inputs vacíos: si la prescripción no trae peso, el
   * cliente abre el modal con su última carga ya cargada.
   */
  last_used_weights: Array<number | null>;
}

export interface ResolvedDay {
  date: string;
  source: "override" | "session" | "template" | "rest";
  session: { id: string; name: string } | null;
  exercises: ResolvedExercise[];
  /**
   * Sesión que el trainer recomienda para este día. Independiente de
   * `session` (estado actual del día, que puede haber sido sobrescrito
   * cuando el cliente loguea otra sesión). Calculado server-side
   * combinando override del trainer + slot del microciclo. Null = sin
   * recomendación (descanso, no hay microciclo, o aún no aplica el
   * start_date del ciclo).
   */
  trainer_recommended_session_id: string | null;
}

interface UseResolvedDayPrescription {
  data: ResolvedDay | null;
  loading: boolean;
  error: string | null;
}

interface ApiResponse {
  success: boolean;
  day?: ResolvedDay;
  error?: string;
}

async function fetchResolvedDay(date: string): Promise<ResolvedDay> {
  const res = await clientFetch(`/api/client/scheduled-sessions/${date}`);
  const json = (await res.json()) as ApiResponse;

  if (!json.success || !json.day) {
    throw new Error(json.error ?? "No se pudo cargar la prescripción del día.");
  }

  return json.day;
}

/**
 * Fetches the resolved prescription for a date from
 * GET /api/client/scheduled-sessions/[date]. Used to surface trainer
 * overrides (sets, reps, weight, per-set values) to the active session
 * view without disturbing the template-cache flow when no override exists.
 *
 * Backed por React Query con cache compartido por `date`. Antes el hook
 * usaba useState/useEffect aislado por instancia, así que workouts-content
 * y active-session-view disparaban dos fetches separados al mismo endpoint
 * cada vez que el cliente entraba a una sesión, y el skeleton de
 * active-session-view se mostraba aunque los datos ya estuvieran cargados
 * un nivel arriba.
 */
export function useResolvedDayPrescription(
  date: string
): UseResolvedDayPrescription {
  const query = useQuery({
    queryKey: ["client", "resolved-day", date],
    queryFn: () => fetchResolvedDay(date),
    // Datos del día son baratos de revalidar pero rara vez cambian dentro
    // de la misma sesión del cliente. 30s da hit instantáneo en
    // navegaciones típicas (entrar a sesión activa, volver al listado)
    // sin volverse stale frente a cambios del trainer.
    staleTime: 30_000,
  });

  return {
    // El contrato anterior devolvía null (no undefined) cuando no había
    // datos cargados. Mantenemos esa convención para no obligar a tocar
    // los consumidores.
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : "Error de conexión."
      : null,
  };
}

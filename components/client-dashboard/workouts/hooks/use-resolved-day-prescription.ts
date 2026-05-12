"use client";

import { useEffect, useState } from "react";

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
}

export interface ResolvedDay {
  date: string;
  source: "override" | "session" | "template" | "rest";
  session: { id: string; name: string } | null;
  exercises: ResolvedExercise[];
}

interface UseResolvedDayPrescription {
  data: ResolvedDay | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches the resolved prescription for a date from
 * GET /api/client/scheduled-sessions/[date]. Used to surface trainer
 * overrides (sets, reps, weight, per-set values) to the active session
 * view without disturbing the template-cache flow when no override exists.
 */
export function useResolvedDayPrescription(
  date: string
): UseResolvedDayPrescription {
  const [data, setData] = useState<ResolvedDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // CRÍTICO: reset data al cambiar fecha. Antes solo seteábamos
    // loading=true pero data quedaba con el día anterior; el gate
    // `resolvedLoading && !resolved` en active-session-view evaluaba
    // `false` (porque resolved seguía existiendo) y el cliente abría
    // el modal de log con la prescripción del día equivocado.
    setData(null);
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await clientFetch(`/api/client/scheduled-sessions/${date}`);
        const json = await res.json();

        if (cancelled) return;
        if (json.success) {
          setData(json.day as ResolvedDay);
        } else {
          setError("No se pudo cargar la prescripción del día.");
        }
      } catch {
        if (cancelled) return;
        setError("Error de conexión.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [date]);

  return { data, loading, error };
}

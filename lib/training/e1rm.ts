// Núcleo puro del 1RM estimado (rebanada Progreso). Sin imports, sin Supabase:
// lo comparten los endpoints de progresión, la detección de récords en el POST
// de logs y los charts de ambos lados.
//
// Fórmulas (decisión de la llamada del 15-jul, validada contra la captura de
// José): 1 rep = el peso levantado; 2–6 reps = Brzycki; ≥7 reps = Epley.
// Brzycki es más precisa en rangos bajos y Epley no colapsa en rangos altos.
//
// TODO calculado al vuelo: exercise_log_sets se borra y reinserta en cada
// autosave, así que cualquier récord almacenado se corrompería. Derivar
// siempre desde los datos vigentes también hace que editar/borrar un log
// "repare" los récords solo.

export interface SetInput {
  reps: number | null;
  weight_kg: number | null;
}

export interface SessionSets {
  /** YYYY-MM-DD (scheduled_date de la sesión). */
  date: string;
  sets: SetInput[];
}

export interface E1rmPoint {
  date: string;
  e1rm: number;
  reps: number;
  weightKg: number;
}

export interface RepMax {
  /** "1".."11" o "12+". */
  bucket: string;
  reps: number;
  weightKg: number;
  e1rm: number;
  /** Primera fecha en que se levantó ese peso récord para el bucket. */
  date: string;
}

export interface NewRecord {
  bucket: string;
  reps: number;
  weightKg: number;
  /** null = primera marca en ese rango de reps. */
  previousWeightKg: number | null;
}

/**
 * 1RM estimado de una serie. null si la serie no computa (sin peso, sin reps,
 * o valores no positivos — las series a peso corporal no estiman 1RM).
 */
export function estimateOneRepMax(
  weightKg: number | null,
  reps: number | null
): number | null {
  if (weightKg === null || reps === null) return null;
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return null;
  if (weightKg <= 0 || reps <= 0) return null;

  if (reps === 1) return weightKg;
  if (reps <= 6) return (weightKg * 36) / (37 - reps);

  return weightKg * (1 + reps / 30);
}

export function repBucket(reps: number): string {
  return reps >= 12 ? "12+" : String(reps);
}

/** Mejor serie de un conjunto por e1RM; null si ninguna computa. */
export function bestSetByE1rm(
  sets: SetInput[]
): { e1rm: number; reps: number; weightKg: number } | null {
  let best: { e1rm: number; reps: number; weightKg: number } | null = null;

  for (const set of sets) {
    const e1rm = estimateOneRepMax(set.weight_kg, set.reps);

    if (e1rm === null) continue;
    if (best === null || e1rm > best.e1rm) {
      best = {
        e1rm,
        reps: set.reps as number,
        weightKg: set.weight_kg as number,
      };
    }
  }

  return best;
}

/**
 * Serie temporal de e1RM: un punto por fecha = la mejor serie de ese día.
 * Sesiones sin serie computable no generan punto. Orden ascendente por fecha.
 */
export function computeE1rmSeries(sessions: SessionSets[]): E1rmPoint[] {
  const bestByDate = new Map<string, E1rmPoint>();

  for (const session of sessions) {
    if (session.date === "") continue;
    const best = bestSetByE1rm(session.sets);

    if (best === null) continue;

    const existing = bestByDate.get(session.date);

    if (existing === undefined || best.e1rm > existing.e1rm) {
      bestByDate.set(session.date, { date: session.date, ...best });
    }
  }

  return [...bestByDate.values()].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );
}

/**
 * Récords por nº de reps: el mayor peso levantado en cada bucket (1..11, 12+).
 * A igual peso gana la PRIMERA fecha (el récord es de quien lo logró antes).
 * Orden: buckets numéricos ascendentes, "12+" al final.
 */
export function computeRepMaxes(sessions: SessionSets[]): RepMax[] {
  const byBucket = new Map<string, RepMax>();

  for (const session of sessions) {
    if (session.date === "") continue;

    for (const set of session.sets) {
      const e1rm = estimateOneRepMax(set.weight_kg, set.reps);

      if (e1rm === null) continue;

      const reps = set.reps as number;
      const weightKg = set.weight_kg as number;
      const bucket = repBucket(reps);
      const current = byBucket.get(bucket);

      const beats =
        current === undefined ||
        weightKg > current.weightKg ||
        (weightKg === current.weightKg && session.date < current.date);

      if (beats) {
        byBucket.set(bucket, {
          bucket,
          reps,
          weightKg,
          e1rm,
          date: session.date,
        });
      }
    }
  }

  return [...byBucket.values()].sort((a, b) => {
    const an = a.bucket === "12+" ? 12 : parseInt(a.bucket, 10);
    const bn = b.bucket === "12+" ? 12 : parseInt(b.bucket, 10);

    return an - bn;
  });
}

/**
 * Récords nuevos de un log recién finalizado contra los mejores previos
 * (previos = SIN el log actual — el autosave borra-y-reinserta hace que el
 * log actual ya esté en la base al momento de comparar).
 * Bucket sin precedente → previousWeightKg null ("primera marca en N reps").
 * Devuelve null si no hay ninguno.
 */
export function diffRecords(
  prior: RepMax[],
  currentSets: SetInput[]
): NewRecord[] | null {
  const priorByBucket = new Map(prior.map((r) => [r.bucket, r]));
  const bestNewByBucket = new Map<string, NewRecord>();

  for (const set of currentSets) {
    const e1rm = estimateOneRepMax(set.weight_kg, set.reps);

    if (e1rm === null) continue;

    const reps = set.reps as number;
    const weightKg = set.weight_kg as number;
    const bucket = repBucket(reps);
    const previous = priorByBucket.get(bucket);

    if (previous !== undefined && weightKg <= previous.weightKg) continue;

    const candidate: NewRecord = {
      bucket,
      reps,
      weightKg,
      previousWeightKg: previous?.weightKg ?? null,
    };

    const existing = bestNewByBucket.get(bucket);

    if (existing === undefined || weightKg > existing.weightKg) {
      bestNewByBucket.set(bucket, candidate);
    }
  }

  const records = [...bestNewByBucket.values()];

  return records.length > 0 ? records : null;
}

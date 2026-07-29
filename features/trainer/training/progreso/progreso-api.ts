// Capa de datos de la rebanada "Progreso" del tab Entrenamiento.
//
// Un solo endpoint: la progresión de UN ejercicio para UN cliente
// (/api/clients/[clientId]/exercises/[exerciseId]/progression?days=N). Todo lo
// que devuelve ya viene derivado en el servidor con el núcleo compartido
// lib/training/e1rm.ts, así que el cliente no recalcula nada: pinta.
//
// Mismas convenciones que videos-api.ts / training-api.ts: respuestas
// {success, <clave>} sin envelope `data`, y errores como clase con status para
// que la UI pueda ramificar.

/** Un día con datos: la MEJOR serie de esa fecha, más el volumen total. */
export interface ProgressionPoint {
  /** YYYY-MM-DD. */
  date: string;
  e1rm: number;
  reps: number;
  weightKg: number;
  /** Σ reps × peso de todas las series de esa fecha. */
  volumeKg: number;
}

/** Récord de un rango de repeticiones ("1".."11" o "12+"). */
export interface ProgressionRepMax {
  bucket: string;
  reps: number;
  weightKg: number;
  e1rm: number;
  date: string;
}

export interface Progression {
  /** Ascendente por fecha. */
  e1rmSeries: ProgressionPoint[];
  /** Ordenado por nº de reps ascendente, "12+" al final. */
  repMaxes: ProgressionRepMax[];
  /** e1RM de la sesión más reciente. */
  currentE1rm: number | null;
  bestE1rm: number | null;
  totalSessions: number;
}

/** Lleva el status HTTP para que el caller pueda ramificar (404, 403, ...). */
export class ProgresoApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ProgresoApiError";
    this.status = status;
  }
}

async function readBody<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (response.ok === false || data?.success !== true) {
    throw new ProgresoApiError(data?.error ?? "Error de red", response.status);
  }

  return data as T;
}

/** Progresión del ejercicio en la ventana pedida (días hacia atrás). */
export function fetchProgression(
  clientId: string,
  exerciseId: string,
  days: number
): Promise<Progression> {
  return fetch(
    `/api/clients/${clientId}/exercises/${exerciseId}/progression?days=${days}`,
    { credentials: "same-origin", cache: "no-store" }
  )
    .then(readBody<{ progression?: Progression }>)
    .then(
      (body) =>
        body.progression ?? {
          e1rmSeries: [],
          repMaxes: [],
          currentE1rm: null,
          bestE1rm: null,
          totalSessions: 0,
        }
    );
}

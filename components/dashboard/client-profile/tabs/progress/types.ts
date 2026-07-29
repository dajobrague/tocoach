export interface ExerciseLogSet {
  id?: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  /** Per-set video uploaded by the client (added in migration 091). */
  video_url?: string | null;
}

export interface ExerciseLog {
  id: string;
  exercise_id: string;
  exercises: {
    id: string;
    name: string;
    category: string;
    muscle_groups: string[] | null;
  };
  scheduled_date: string;
  session_id?: string | null;
  /** Slot específico del plan (session_exercises.id) al que pertenece el log. */
  session_exercise_id?: string | null;
  completed_at: string;
  /**
   * Sesión cerrada por el cliente. Los autosaves dejan esto en null: un "100"
   * tecleado camino a "10" no puede contar como récord. Opcional porque no
   * todas las rutas lo seleccionan explícitamente.
   */
  finalized_at?: string | null;
  sets: ExerciseLogSet[];
  video_url: string | null;
  // Legacy fields kept for backward compatibility with old data
  sets_completed?: number | null;
  reps_completed?: string | null;
  weight_kg?: number | null;
  weight_used?: string | null;
  duration_minutes: number | null;
  distance_km: number | null;
  intensity: string | null;
  avg_heart_rate: number | null;
  notes: string | null;
  /**
   * exercise_logs.metadata (JSONB). Interesa borrowed_from_session_name:
   * el ejercicio fue "prestado" de otra sesión por el cliente y el detalle
   * del día lo etiqueta con su origen. Opcional: no todas las rutas lo traen.
   */
  metadata?: {
    borrowed_from_session_name?: string;
    [key: string]: unknown;
  } | null;
}

export interface ExerciseGroup {
  exercise: ExerciseLog["exercises"];
  logs: ExerciseLog[];
}

export interface FormResponse {
  id: string;
  response_date: string;
  answers: Record<string, any>;
}

export interface StepsPoint {
  date: string;
  steps: number;
}

export interface NutritionPoint {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

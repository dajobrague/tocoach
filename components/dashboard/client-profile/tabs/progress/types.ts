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
  completed_at: string;
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

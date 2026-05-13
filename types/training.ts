// Training-related TypeScript interfaces

// Database-level types

export interface Program {
  id: string;
  tenant_host: string;
  trainer_id: string;
  name: string;
  description?: string;
  duration_weeks?: number;
  difficulty_level?: "beginner" | "intermediate" | "advanced";
  is_template: boolean;
  is_published: boolean;
  tags?: string[];
  metadata: {
    type?:
      | "Strength"
      | "HIIT"
      | "Functional"
      | "Hypertrophy"
      | "Endurance"
      | "Fat Loss"
      | "Mixed"
      | string;
    division?: string; // "Full Body", "Upper/Lower", "Push/Pull/Legs"
    sessions_per_week?: number;
    category?: "cardio" | "strength"; // Distinguishes cardio from strength programs
    goal?: string; // For cardio programs: "Mejorar resistencia cardiovascular", etc.
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface ClientProgram {
  id: string;
  tenant_host: string;
  client_id: string;
  program_id: string;
  trainer_id: string;
  start_date: string;
  end_date?: string;
  status: "active" | "completed" | "paused" | "cancelled";
  progress_percentage: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  program?: Program;
}

export interface Session {
  id: string;
  tenant_host: string;
  program_id?: string;
  trainer_id: string;
  name: string;
  description?: string;
  session_order?: number;
  duration_minutes?: number;
  session_type?: SessionType;
  intensity_level?: "low" | "moderate" | "high";
  equipment_needed?: string[];
  notes?: string;
  metadata: {
    day_of_week?: "Lun" | "Mar" | "Mie" | "Jue" | "Vie" | "Sab" | "Dom";
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface Exercise {
  id: string;
  tenant_host: string;
  trainer_id: string;
  name: string;
  description?: string;
  category?:
    | "strength"
    | "cardio"
    | "flexibility"
    | "balance"
    | "plyometric"
    | "olympic"
    | "powerlifting"
    | "bodyweight"
    | "other";
  muscle_groups?: string[];
  equipment?: string[];
  movement_pattern?: string;
  video_url?: string;
  uploaded_video_url?: string;
  image_url?: string;
  instructions?: string[];
  tips?: string[];
  is_public: boolean;
  // Default training parameters (auto-fill when adding to sessions)
  default_sets?: number;
  default_reps?: string;
  default_tempo?: string;
  default_rest_seconds?: number;
  default_training_system?: string;
  metadata: {
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface SessionExercise {
  id: string;
  tenant_host: string;
  session_id: string;
  exercise_id: string;
  exercise_order: number;
  sets?: number;
  reps?: string; // Can be "10-12", "AMRAP", etc.
  duration_seconds?: number;
  rest_seconds?: number;
  weight_kg?: number;
  distance_meters?: number;
  notes?: string;
  metadata: {
    tempo?: string; // "Pausa Final Excéntrica", "Explosivo", etc.
    training_system?: string; // "Series Rectas", "Repeticiones Totales", etc.
    rest_description?: string; // "El necesario para rendir al 100%"
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
  // Joined data
  exercise?: Exercise;
}

export interface ScheduledSession {
  id: string;
  tenant_host: string;
  client_id: string;
  trainer_id: string;
  session_id?: string;
  client_program_id?: string;
  scheduled_date: string;
  scheduled_time?: string;
  duration_minutes?: number;
  status: "scheduled" | "completed" | "missed" | "cancelled" | "rescheduled";
  completion_date?: string;
  client_notes?: string;
  trainer_notes?: string;
  metadata: {
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

// UI-level types (transformed for the frontend)

export interface WorkoutExercise {
  order: number;
  name: string;
  category?:
    | "strength"
    | "cardio"
    | "flexibility"
    | "balance"
    | "plyometric"
    | "olympic"
    | "powerlifting"
    | "bodyweight"
    | "other";
  // Strength training fields
  sets: number;
  reps: string;
  tempo: string;
  rest: string;
  trainingSystem: string;
  videoUrl?: string;
  uploadedVideoUrl?: string;
  imageUrl?: string;
  // Cardio-specific fields
  duration?: number; // Duration in minutes
  distance?: number; // Distance in km
  intensity?: "Low" | "Moderate" | "High" | "Interval" | string;
  heartRateZone?: { min: number; max: number }; // Target heart rate zone
  cardioType?:
    | "Running"
    | "Cycling"
    | "Swimming"
    | "Walking"
    | "Rowing"
    | "HIIT"
    | "Elliptical"
    | "Stairmaster"
    | string;
  description?: string;
  notes?: string | undefined; // Trainer notes for the exercise
  // Database IDs for updates
  id?: string;
  exercise_id?: string;
}

export interface WorkoutSession {
  id: string;
  dayOfWeek: ("Lun" | "Mar" | "Mie" | "Jue" | "Vie" | "Sab" | "Dom")[];
  name: string;
  completed: boolean;
  exercises: WorkoutExercise[];
}

export interface WorkoutProgram {
  id: string;
  name: string;
  type: "Strength" | "HIIT" | "Functional" | "Hypertrophy" | string;
  category?: "strength" | "cardio";
  division: string;
  currentWeek: string; // "Semana 20"
  sessionsPerWeek: number;
  assignedDate: string;
  lastModified: string;
  progress: number;
  status: "active" | "completed";
  notes?: string | undefined;
  sessions: WorkoutSession[];
  // Database IDs
  clientProgramId: string;
  programId: string;
}

// API Request/Response types

export interface CreateProgramRequest {
  name: string;
  division?: string; // Optional for cardio programs
  type: string;
  startDate: string;
  sessionsPerWeek: string;
  notes?: string;
  category?: "cardio" | "strength"; // To distinguish program type
  goal?: string; // For cardio programs
}

export interface CreateSessionRequest {
  name: string;
  dayOfWeek: "Lun" | "Mar" | "Mie" | "Jue" | "Vie" | "Sab" | "Dom";
}

export interface CreateExerciseRequest {
  name: string;
  // Strength training fields
  sets?: string;
  reps?: string;
  tempo?: string;
  rest?: string;
  trainingSystem?: string;
  videoUrl?: string;
  // Cardio-specific fields
  duration?: string; // Duration in minutes
  distance?: string; // Distance in km
  intensity?: string; // Low, Moderate, High, Interval
  minHeartRate?: string; // Minimum target heart rate
  maxHeartRate?: string; // Maximum target heart rate
  type?: string; // Cardio type: Running, Cycling, etc.
  notes?: string; // Exercise notes
}

export interface ProgramsApiResponse {
  success: boolean;
  programs: WorkoutProgram[];
  error?: string;
}

// Exercise Library API types

export interface CreateExerciseLibraryRequest {
  name: string;
  description?: string;
  category:
    | "strength"
    | "cardio"
    | "flexibility"
    | "balance"
    | "plyometric"
    | "olympic"
    | "powerlifting"
    | "bodyweight"
    | "other";
  muscle_groups?: string[];
  equipment?: string[];
  movement_pattern?: string;
  video_url?: string;
  uploaded_video_url?: string;
  image_url?: string;
  instructions?: string[];
  tips?: string[];
  // Default training parameters
  default_sets?: number;
  default_reps?: string;
  default_tempo?: string;
  default_rest_seconds?: number;
  default_training_system?: string;
}

export interface UpdateExerciseLibraryRequest {
  name?: string;
  description?: string;
  category?:
    | "strength"
    | "cardio"
    | "flexibility"
    | "balance"
    | "plyometric"
    | "olympic"
    | "powerlifting"
    | "bodyweight"
    | "other";
  muscle_groups?: string[];
  equipment?: string[];
  movement_pattern?: string;
  video_url?: string;
  uploaded_video_url?: string;
  image_url?: string;
  instructions?: string[];
  tips?: string[];
  // Default training parameters
  default_sets?: number;
  default_reps?: string;
  default_tempo?: string;
  default_rest_seconds?: number;
  default_training_system?: string;
}

export interface ExerciseLibraryResponse {
  success: boolean;
  exercises: Exercise[];
  total?: number;
  page?: number;
  limit?: number;
  error?: string;
}

// Exercise log set (per-set tracking)

export interface ExerciseLogSet {
  id?: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
}

// === Session type (extracted for reuse across microcycles and elsewhere) ===

export type SessionType =
  | "strength"
  | "cardio"
  | "flexibility"
  | "sports"
  | "recovery"
  | "other";

// === Microcycles ===

export interface Microcycle {
  id: string;
  tenant_host: string;
  client_program_id: string;
  duration_days: number;
  /**
   * Fecha (YYYY-MM-DD) en que cae el "Día 1" del microciclo. El resolver
   * de prescripciones del cliente la usa como ancla del modulo:
   * `dayIndex = ((date - start_date) % duration_days) + 1`. Antes el ancla
   * era `client_program.start_date` y el trainer no podía elegirla; ahora
   * la setea desde el editor del microciclo.
   */
  start_date: string;
  created_at: string;
  updated_at: string;
}

export interface MicrocycleSlot {
  id: string;
  microcycle_id: string;
  day_index: number;
  session_id: string | null; // null = descanso explícito
  created_at: string;
}

export interface MicrocycleWithSlots extends Microcycle {
  slots: MicrocycleSlot[];
}

// View model que combina slot + sesión expandida (para el cliente).
// Lo devuelve GET /api/client/microcycle, ya con descansos implícitos
// completados hasta duration_days (decisión c en §1 de bloque-1-spec.md).

export interface MicrocycleSlotView {
  day_index: number;
  type: "session" | "rest";
  session?: {
    id: string;
    name: string;
    session_type: SessionType;
    duration_minutes: number | null;
  };
}

// === Exercise history (modal de ejercicio) ===

export interface ExerciseHistoryEntry {
  scheduled_date: string;
  exercise_log_id: string;
  sets: Array<{
    set_number: number;
    reps: number;
    weight_kg: number | null;
  }>;
}

export interface ExerciseHistoryResponse {
  exercise_id: string;
  recent: ExerciseHistoryEntry[]; // últimas N, orden descendente
  pr: {
    weight_kg: number;
    reps: number;
    achieved_at: string; // scheduled_date del set ganador
  } | null;
}

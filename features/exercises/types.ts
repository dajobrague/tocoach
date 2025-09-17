// Exercise types and interfaces

export interface Exercise {
  id: string;
  name: string;
  description: string;
  category: string;
  muscleGroups: string[];
  equipment: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  instructions: string[];
  videoUrl?: string;
  imageUrl?: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description: string;
  exercises: WorkoutExercise[];
  estimatedDuration: number; // minutes
  difficulty: "beginner" | "intermediate" | "advanced";
  tags: string[];
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: number;
  reps: number | string; // Can be "10-12" or "30 seconds"
  weight?: number;
  restTime?: number; // seconds
  notes?: string;
}

// Exercise library utility functions

import type { Exercise } from "@/types/training";

/**
 * Format exercise for display in UI
 * @param exercise - Exercise from database
 * @returns Formatted exercise object
 */
export function formatExerciseForDisplay(exercise: Exercise) {
  return {
    ...exercise,
    categoryLabel: getCategoryLabel(exercise.category),
    difficultyLabel: getDifficultyLabel(exercise.difficulty_level),
    muscleGroupsText: exercise.muscle_groups?.join(", ") || "N/A",
    equipmentText: exercise.equipment?.join(", ") || "Ninguno",
    hasDefaults:
      exercise.default_sets ||
      exercise.default_reps ||
      exercise.default_tempo ||
      exercise.default_rest_seconds ||
      exercise.default_training_system,
  };
}

/**
 * Get human-readable category label
 */
export function getCategoryLabel(category?: string): string {
  const labels: Record<string, string> = {
    strength: "Fuerza",
    cardio: "Cardio",
    flexibility: "Flexibilidad",
    balance: "Equilibrio",
    plyometric: "Pliométrico",
    olympic: "Olímpico",
    powerlifting: "Powerlifting",
    bodyweight: "Peso Corporal",
    other: "Otro",
  };

  return category ? labels[category] || category : "N/A";
}

/**
 * Get human-readable difficulty label
 */
export function getDifficultyLabel(difficulty?: string): string {
  const labels: Record<string, string> = {
    beginner: "Principiante",
    intermediate: "Intermedio",
    advanced: "Avanzado",
  };

  return difficulty ? labels[difficulty] || difficulty : "N/A";
}

/**
 * Validate exercise library form data
 */
export function validateExerciseLibraryForm(form: {
  name: string;
  category: string;
  default_sets?: string;
  default_reps?: string;
  default_tempo?: string;
  default_rest_seconds?: string;
  default_training_system?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!form.name || form.name.trim() === "") {
    errors.push("El nombre del ejercicio es requerido");
  }

  if (!form.category || form.category.trim() === "") {
    errors.push("La categoría es requerida");
  }

  // Validate numeric fields if provided
  if (
    form.default_sets &&
    form.default_sets.trim() !== "" &&
    (parseInt(form.default_sets, 10) < 1 ||
      isNaN(parseInt(form.default_sets, 10)))
  ) {
    errors.push("Las series deben ser un número mayor a 0");
  }

  if (
    form.default_rest_seconds &&
    form.default_rest_seconds.trim() !== "" &&
    (parseInt(form.default_rest_seconds, 10) < 0 ||
      isNaN(parseInt(form.default_rest_seconds, 10)))
  ) {
    errors.push("El descanso debe ser un número mayor o igual a 0");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Upload exercise image to Supabase storage
 */
export async function uploadExerciseImage(
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const formData = new FormData();

    formData.append("file", file);

    const response = await fetch("/api/exercises/upload-image", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || "Error al subir imagen",
      };
    }

    return {
      success: true,
      url: data.url,
    };
  } catch (error) {
    console.error("[Exercise Utils] Error uploading image:", error);

    return {
      success: false,
      error: "Error inesperado al subir imagen",
    };
  }
}

/**
 * Delete exercise image from Supabase storage
 */
export async function deleteExerciseImage(
  imagePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `/api/exercises/upload-image?path=${encodeURIComponent(imagePath)}`,
      {
        method: "DELETE",
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || "Error al eliminar imagen",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("[Exercise Utils] Error deleting image:", error);

    return {
      success: false,
      error: "Error inesperado al eliminar imagen",
    };
  }
}

/**
 * Extract image path from Supabase URL
 */
export function extractImagePathFromUrl(url: string): string | null {
  try {
    // Example URL: https://xxx.supabase.co/storage/v1/object/public/exercise-images/tenant/trainer/123456.jpg
    const parts = url.split("/exercise-images/");

    if (parts.length === 2 && parts[1]) {
      return parts[1];
    }

    return null;
  } catch (error) {
    console.error("[Exercise Utils] Error extracting image path:", error);

    return null;
  }
}

/**
 * Format rest time from seconds to human-readable string
 */
export function formatRestTime(seconds?: number): string {
  if (!seconds) return "N/A";

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes}min`;
  }

  return `${minutes}min ${remainingSeconds}s`;
}

/**
 * Parse rest time string to seconds
 */
export function parseRestTimeToSeconds(restString: string): number | null {
  if (!restString || restString.trim() === "") return null;

  // Try to parse as plain number (assume seconds)
  const plainNumber = parseInt(restString, 10);

  if (!isNaN(plainNumber)) {
    return plainNumber;
  }

  // Try to parse "1min 30s" or "90s" format
  const minMatch = restString.match(/(\d+)\s*min/i);
  const secMatch = restString.match(/(\d+)\s*s/i);

  let totalSeconds = 0;

  if (minMatch && minMatch[1]) {
    totalSeconds += parseInt(minMatch[1], 10) * 60;
  }

  if (secMatch && secMatch[1]) {
    totalSeconds += parseInt(secMatch[1], 10);
  }

  return totalSeconds > 0 ? totalSeconds : null;
}

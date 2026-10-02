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
    movementPattern: exercise.movement_pattern || "N/A",
    muscleGroupsText: exercise.muscle_groups?.join(", ") || "N/A",
    equipmentText: exercise.equipment?.join(", ") || "Ninguno",
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
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!form.name || form.name.trim() === "") {
    errors.push("El nombre del ejercicio es requerido");
  }

  if (!form.category || form.category.trim() === "") {
    errors.push("La categoría es requerida");
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
 * Upload exercise video to Supabase storage
 */
export async function uploadExerciseVideo(
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const formData = new FormData();

    formData.append("file", file);

    const response = await fetch("/api/exercises/upload-video", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || "Error al subir video",
      };
    }

    return {
      success: true,
      url: data.url,
    };
  } catch (error) {
    console.error("[Exercise Utils] Error uploading video:", error);

    return {
      success: false,
      error: "Error inesperado al subir video",
    };
  }
}

/**
 * Delete exercise video from Supabase storage
 */
export async function deleteExerciseVideo(
  videoPath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `/api/exercises/upload-video?path=${encodeURIComponent(videoPath)}`,
      {
        method: "DELETE",
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || "Error al eliminar video",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("[Exercise Utils] Error deleting video:", error);

    return {
      success: false,
      error: "Error inesperado al eliminar video",
    };
  }
}

/**
 * Extract video path from Supabase URL
 */
export function extractVideoPathFromUrl(url: string): string | null {
  try {
    const parts = url.split("/exercise-videos/");

    if (parts.length === 2 && parts[1]) {
      return parts[1];
    }

    return null;
  } catch (error) {
    console.error("[Exercise Utils] Error extracting video path:", error);

    return null;
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
 * Parse a rest prescription to seconds: "90", "90s", "90 seg", "2 min",
 * "1min 30s", "1,5 min", "1:30", "2'", "45''". Free text ("El necesario") → null.
 * Ranges ("2-3 min") take the last number.
 */
export function parseRestTimeToSeconds(restString: string): number | null {
  const s = restString?.trim().toLowerCase() ?? "";

  if (!s) return null;

  // Bare number = seconds. (parseInt("1min 30s") used to return 1.)
  if (/^\d+$/.test(s)) return Number(s) > 0 ? Number(s) : null;

  const clock = s.match(/^(\d+):([0-5]\d)$/);

  if (clock) return Number(clock[1]) * 60 + Number(clock[2]) || null;

  const minMatch = s.match(/(\d+(?:[.,]\d+)?)\s*(?:min|m\b|'(?!'))/);
  const secMatch = s.match(/(\d+)\s*(?:s|''|")/);
  const minutes = minMatch?.[1] ? Number(minMatch[1].replace(",", ".")) : 0;
  const seconds = secMatch?.[1] ? Number(secMatch[1]) : 0;
  const total = Math.round(minutes * 60 + seconds);

  return total > 0 ? total : null;
}

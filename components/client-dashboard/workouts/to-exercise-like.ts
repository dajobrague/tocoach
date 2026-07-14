// Convierte un ResolvedExercise (respuesta de
// /api/client/scheduled-sessions/[date]) al shape ExerciseLike que renderiza
// la vista de sesión activa y consume el modal de log. Extraído de
// active-session-view.tsx para poder testearlo puro: este mapeo es donde los
// campos del "resolved path" (día recomendado) se pierden si no se mapean —
// los comentarios del trainer (notes) desaparecían SOLO en el día recomendado
// porque el template path sí los traía y este conversor los dropeaba.

import type { ExerciseLike } from "./active-session-view";
import type { ResolvedExercise } from "./hooks/use-resolved-day-prescription";

import { resolveRestLabel } from "@/lib/training/rest-label";

export function toExerciseLike(r: ResolvedExercise): ExerciseLike {
  const out: ExerciseLike = {
    order: r.exercise_order,
    name: r.name,
    category: r.category,
  };

  if (r.exercise_id) out.exercise_id = r.exercise_id;
  if (r.session_exercise_id) out.session_exercise_id = r.session_exercise_id;
  if (r.sets != null) out.sets = r.sets;
  if (r.reps != null) out.reps = r.reps;
  if (r.weight_kg != null) out.weightKg = r.weight_kg;
  if (r.image_url) out.imageUrl = r.image_url;
  if (r.video_url) out.videoUrl = r.video_url;
  if (r.duration_seconds != null) {
    out.duration = Math.round(r.duration_seconds / 60);
  }
  if (r.distance_meters != null) {
    out.distance = parseFloat((r.distance_meters / 1000).toFixed(2));
  }
  // Coaching meta — antes no se mapeaban y un override de cardio caía
  // al branch de strength porque isExerciseCardio() no veía intensity
  // ni cardio_type. También tempo/trainingSystem para que el draft
  // signature detecte cambios cuando el trainer ajusta cadencia/sistema.
  if (r.intensity) out.intensity = r.intensity;
  if (r.cardio_type) out.cardioType = r.cardio_type;
  if (r.heart_rate_min != null && r.heart_rate_max != null) {
    out.heartRateZone = { min: r.heart_rate_min, max: r.heart_rate_max };
  }
  if (r.tempo) out.tempo = r.tempo;
  if (r.training_system) out.trainingSystem = r.training_system;
  if (r.rir) out.rir = r.rir;
  // Comentario del trainer — el modal de log lo muestra como nota del
  // entrenador (exercise.notes). Sin este mapeo, el comentario solo se
  // veía al abrir la sesión un día distinto al recomendado.
  if (r.notes) out.notes = r.notes;
  // El descanso puede vivir en metadata.rest_description (texto libre del
  // flujo add/edit de la página del cliente) o en la columna rest_seconds
  // (editor de templates); leer solo rest_seconds dejaba el descanso vacío.
  const restLabel = resolveRestLabel(r.rest_description, r.rest_seconds);

  if (restLabel) out.rest = restLabel;
  if (r.last_used_weights && r.last_used_weights.length > 0) {
    out.lastUsedWeights = r.last_used_weights;
  }

  return out;
}

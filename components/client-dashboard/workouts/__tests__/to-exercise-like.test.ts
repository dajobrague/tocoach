import type { ResolvedExercise } from "../hooks/use-resolved-day-prescription";

import { describe, expect, it } from "vitest";

import { toExerciseLike } from "../to-exercise-like";

const baseResolved = (
  overrides: Partial<ResolvedExercise> = {}
): ResolvedExercise => ({
  session_exercise_id: "se-1",
  exercise_id: "ex-1",
  name: "Press banca",
  category: "strength",
  image_url: null,
  video_url: null,
  uploaded_video_url: null,
  exercise_order: 1,
  sets: 4,
  reps: "8-10",
  weight_kg: null,
  duration_seconds: null,
  distance_meters: null,
  rest_seconds: 90,
  rest_description: null,
  notes: null,
  intensity: null,
  cardio_type: null,
  heart_rate_min: null,
  heart_rate_max: null,
  tempo: null,
  training_system: null,
  rir: null,
  last_used_weights: [],
  ...overrides,
});

describe("toExerciseLike", () => {
  it("maps trainer notes from the resolved prescription", () => {
    // Regresión: en el día recomendado los ejercicios vienen del resolved
    // path y los comentarios del trainer desaparecían — solo se veían al
    // abrir la misma sesión otro día (template path).
    const out = toExerciseLike(
      baseResolved({ notes: "Baja en 3 segundos, sube explosivo" })
    );

    expect(out.notes).toBe("Baja en 3 segundos, sube explosivo");
  });

  it("omits notes when the prescription has none", () => {
    const out = toExerciseLike(baseResolved());

    expect(out.notes).toBeUndefined();
  });

  it("maps both trainer video fields", () => {
    // Regresión: uploaded_video_url no se mapeaba, así que los videos
    // subidos directo a la app (sin enlace externo) nunca llegaban al
    // cliente en el resolved path — solo via template path (programas).
    const out = toExerciseLike(
      baseResolved({
        video_url: "https://youtu.be/abc123",
        uploaded_video_url: "https://cdn.example.com/demo.mp4",
      })
    );

    expect(out.videoUrl).toBe("https://youtu.be/abc123");
    expect(out.uploadedVideoUrl).toBe("https://cdn.example.com/demo.mp4");
  });

  it("omits video fields when the exercise has none", () => {
    const out = toExerciseLike(baseResolved());

    expect(out.videoUrl).toBeUndefined();
    expect(out.uploadedVideoUrl).toBeUndefined();
  });

  it("keeps mapping core fields", () => {
    const out = toExerciseLike(
      baseResolved({ rir: "2", tempo: "3-1-1", weight_kg: 60 })
    );

    expect(out).toMatchObject({
      order: 1,
      name: "Press banca",
      exercise_id: "ex-1",
      session_exercise_id: "se-1",
      sets: 4,
      reps: "8-10",
      weightKg: 60,
      rir: "2",
      tempo: "3-1-1",
      rest: "90s",
    });
  });
});

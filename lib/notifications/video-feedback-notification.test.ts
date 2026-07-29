import { describe, it, expect } from "vitest";

import { buildVideoFeedbackNotificationRow } from "./video-feedback-notification";

// La campana muestra `message` (recortado) pero el visor del video lee
// metadata.comment, así que el comentario completo nunca puede perderse.
describe("buildVideoFeedbackNotificationRow", () => {
  it("builds a client-audience row with the fixed shape", () => {
    const row = buildVideoFeedbackNotificationRow({
      tenantSlug: "brachod7197",
      clientId: 42,
      trainerId: "t-uuid-1",
      videoUrl: "https://cdn.example.com/videos/abc.mp4",
      exerciseName: "Sentadilla",
      setLabel: "Serie 3 · 8 reps × 80 kg",
      scheduledDate: "2026-07-28",
      comment: "Baja un poco más la cadera",
    });

    expect(row).toEqual({
      tenant_slug: "brachod7197",
      client_id: 42,
      trainer_id: "t-uuid-1",
      type: "video_feedback",
      title: "Tu coach comentó tu video",
      message: "Baja un poco más la cadera",
      icon: "solar:videocamera-record-broken",
      metadata: {
        audience: "client",
        action: "open_video_feedback",
        video_url: "https://cdn.example.com/videos/abc.mp4",
        exercise_name: "Sentadilla",
        set_label: "Serie 3 · 8 reps × 80 kg",
        scheduled_date: "2026-07-28",
        comment: "Baja un poco más la cadera",
      },
    });
  });

  it("truncates the bell body at 120 chars but keeps the full comment in metadata", () => {
    const comment = "x".repeat(300);
    const row = buildVideoFeedbackNotificationRow({
      tenantSlug: "s",
      clientId: 1,
      trainerId: "t",
      videoUrl: "https://cdn.example.com/v.mp4",
      exerciseName: "Press banca",
      setLabel: "Serie 1 · 10 reps",
      scheduledDate: "2026-07-28",
      comment,
    });

    expect(row.message).toHaveLength(120);
    expect(row.message.endsWith("…")).toBe(true);
    expect(row.metadata.comment).toBe(comment);
  });
});

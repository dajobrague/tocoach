import { describe, expect, it } from "vitest";

import { buildVideoUploadNotificationRow } from "./video-upload-notification";

describe("buildVideoUploadNotificationRow", () => {
  it("arma la fila para la campana del trainer con link al tab Videos", () => {
    const row = buildVideoUploadNotificationRow({
      tenantSlug: "david-train",
      clientId: 42,
      trainerId: "t-1",
      clientName: "María Pérez",
    });

    expect(row.type).toBe("video_upload");
    expect(row.metadata.audience).toBe("trainer");
    expect(row.message).toBe("María Pérez subió un video de entrenamiento");
    expect(row.link).toBe(
      "/trainer/dashboard/clients/42?tab=training&sub=videos"
    );
    expect(row.tenant_slug).toBe("david-train");
    expect(row.client_id).toBe(42);
  });

  it("usa un mensaje genérico cuando el nombre viene vacío", () => {
    const row = buildVideoUploadNotificationRow({
      tenantSlug: "s",
      clientId: 1,
      trainerId: "t",
      clientName: "  ",
    });

    expect(row.message).toBe("Un cliente subió un video de entrenamiento");
  });
});

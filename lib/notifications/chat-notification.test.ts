import { describe, it, expect } from "vitest";

import {
  buildChatNotificationRow,
  truncateForNotification,
} from "./chat-notification";

// Chat notification rows set BOTH client_id (NOT NULL column) and trainer_id,
// so metadata.audience is what keeps each side's bell from showing the other
// side's (or their own sent) messages.
describe("buildChatNotificationRow", () => {
  it("builds a trainer-audience row when a client sends a message", () => {
    const row = buildChatNotificationRow({
      recipientType: "trainer",
      trainerId: "t-uuid-1",
      clientId: 42,
      tenantSlug: "brachod7197",
      senderName: "Ana López",
      message: "¿Cambiamos la sesión?",
    });

    expect(row).toEqual({
      tenant_slug: "brachod7197",
      client_id: 42,
      trainer_id: "t-uuid-1",
      type: "message",
      title: "Nuevo mensaje de Ana López",
      message: "¿Cambiamos la sesión?",
      icon: "solar:chat-round-dots-bold",
      metadata: { audience: "trainer", action: "open_chat" },
    });
  });

  it("builds a client-audience row when the trainer sends a message", () => {
    const row = buildChatNotificationRow({
      recipientType: "client",
      trainerId: "t-uuid-1",
      clientId: 42,
      tenantSlug: "brachod7197",
      senderName: "Coach David",
      message: "Revisa tu nuevo plan",
    });

    expect(row.title).toBe("Nuevo mensaje de tu entrenador");
    expect(row.metadata.audience).toBe("client");
    expect(row.client_id).toBe(42);
  });

  it("truncates long messages in the row body", () => {
    const row = buildChatNotificationRow({
      recipientType: "trainer",
      trainerId: "t",
      clientId: 1,
      tenantSlug: "s",
      senderName: "Ana",
      message: "x".repeat(300),
    });

    expect(row.message).toHaveLength(120);
    expect(row.message.endsWith("…")).toBe(true);
  });
});

describe("truncateForNotification", () => {
  it("passes short messages through trimmed", () => {
    expect(truncateForNotification("  hola  ")).toBe("hola");
  });

  it("caps at 120 chars with ellipsis", () => {
    const out = truncateForNotification("a".repeat(200));

    expect(out).toHaveLength(120);
    expect(out.endsWith("…")).toBe(true);
  });
});

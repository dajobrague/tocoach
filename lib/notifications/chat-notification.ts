// Builders for chat-message rows in `notifications`. The bell dropdowns and
// useRealtimeNotifications already subscribe per client_id / trainer_id —
// chat just never inserted rows (the trainer route had a TODO for years).
//
// Conventions these rows must follow:
//   - tenant_slug stores the SLUG: the client-mode GET in
//     app/api/notifications/route.ts filters by the URL slug (unlike
//     `messages.tenant_slug`, which stores the host).
//   - client_id is NOT NULL in the table, so trainer-audience rows still
//     carry the sender's client_id; metadata.audience is what scopes which
//     bell may show the row.

const MAX_BODY_LENGTH = 120;

export interface ChatNotificationRow {
  tenant_slug: string;
  client_id: number;
  trainer_id: string;
  type: "message";
  title: string;
  message: string;
  icon: string;
  metadata: { audience: "trainer" | "client"; action: "open_chat" };
}

export function truncateForNotification(message: string): string {
  const trimmed = message.trim();

  if (trimmed.length <= MAX_BODY_LENGTH) return trimmed;

  return `${trimmed.slice(0, MAX_BODY_LENGTH - 1)}…`;
}

export function buildChatNotificationRow(args: {
  /** Whose bell should show this row. */
  recipientType: "trainer" | "client";
  trainerId: string;
  clientId: number;
  tenantSlug: string;
  senderName: string;
  message: string;
}): ChatNotificationRow {
  const title =
    args.recipientType === "client"
      ? "Nuevo mensaje de tu entrenador"
      : `Nuevo mensaje de ${args.senderName}`;

  return {
    tenant_slug: args.tenantSlug,
    client_id: args.clientId,
    trainer_id: args.trainerId,
    type: "message",
    title,
    message: truncateForNotification(args.message),
    icon: "solar:chat-round-dots-bold",
    metadata: { audience: args.recipientType, action: "open_chat" },
  };
}

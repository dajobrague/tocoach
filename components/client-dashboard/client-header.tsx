"use client";

import { Badge, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { ChatPanel } from "./chat-panel";
import { NotificationsDropdown } from "./notifications-dropdown";

import { TenantLogo } from "@/components/tenant-logo";
import { clientFetch } from "@/lib/auth/client-token-storage";
import { useRealtimeMessages } from "@/lib/hooks/use-realtime-messages";

interface ClientHeaderProps {
  firstName: string;
  logoUrl?: string | undefined;
  trainerName: string;
  clientProfilePicture?: string | undefined;
  clientId: string;
  tenantSlug: string;
  tagline?: string | undefined;
  onOpenWeeklyForm?: () => void;
  onOpenDailyForm?: () => void;
}

export function ClientHeader({
  firstName,
  logoUrl,
  trainerName,
  clientProfilePicture,
  clientId,
  tenantSlug,
  tagline = "¡Listo para entrenar!",
  onOpenWeeklyForm,
  onOpenDailyForm,
}: ClientHeaderProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const { newMessageCount: realtimeUnread, clearNewMessages } =
    useRealtimeMessages({
      clientId,
      userId: clientId,
      userType: "client",
    });

  // Load unread message count (fallback). countOnly: el API devuelve solo
  // el número (count exact + head en DB) — antes se bajaba el historial
  // completo de mensajes en cada poll solo para contar en el cliente.
  const loadUnreadCount = async () => {
    try {
      const response = await clientFetch(
        `/api/messages?clientId=${clientId}&tenantSlug=${tenantSlug}&countOnly=true`
      );

      if (response.ok) {
        const data = await response.json();

        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch (error) {
      console.error("Error loading unread count:", error);
    }
  };

  // Load unread count on mount; el poll es solo fallback (Realtime ya
  // entrega los mensajes nuevos al instante vía useRealtimeMessages), así
  // que 5 min basta — y con la pestaña oculta no se consulta.
  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadUnreadCount();
      }
    }, 300_000);

    // Al volver a la pestaña se refresca al instante: en móvil/PWA el
    // background suspende timers y el websocket de Realtime, así que este
    // es el momento en el que el badge puede estar desactualizado.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadUnreadCount();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clientId, tenantSlug]);

  // Combine polled count with realtime count
  const totalUnread = unreadCount + realtimeUnread;

  // Refresh unread count when chat closes
  const handleChatClose = () => {
    setIsChatOpen(false);
    setUnreadCount(0);
    clearNewMessages();
    loadUnreadCount();
  };

  return (
    <>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 bg-content1 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <TenantLogo
                alt={trainerName}
                className="h-10 w-auto object-contain"
                height={40}
                src={logoUrl}
                width={80}
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon
                  className="text-primary text-xl"
                  icon="solar:dumbbell-bold"
                />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold font-heading text-foreground">
                Hola, {firstName}
              </h1>
              <p className="text-xs text-foreground/60 font-body">{tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              color="danger"
              content={totalUnread}
              isInvisible={totalUnread === 0}
              shape="circle"
              size="sm"
            >
              <Button
                isIconOnly
                className="text-foreground/70"
                size="sm"
                variant="light"
                onPress={() => setIsChatOpen(true)}
              >
                <Icon
                  className="text-2xl"
                  icon="solar:chat-round-dots-linear"
                />
              </Button>
            </Badge>
            <NotificationsDropdown
              clientId={clientId}
              isChatOpen={isChatOpen}
              tenantSlug={tenantSlug}
              onOpenChat={() => setIsChatOpen(true)}
              {...(onOpenWeeklyForm ? { onOpenWeeklyForm } : {})}
              {...(onOpenDailyForm ? { onOpenDailyForm } : {})}
            />
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      <ChatPanel
        clientId={clientId}
        isOpen={isChatOpen}
        tenantSlug={tenantSlug}
        trainerName={trainerName}
        onClose={handleChatClose}
      />
    </>
  );
}

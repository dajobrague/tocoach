"use client";

import { Badge, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { ChatPanel } from "./chat-panel";
import { useClientData } from "./client-data-provider";
import { NotificationsDropdown } from "./notifications-dropdown";

import { TenantLogo } from "@/components/tenant-logo";
import { clientFetch } from "@/lib/auth/client-token-storage";
import { useRealtimeMessages } from "@/lib/hooks/use-realtime-messages";

interface ClientHeaderProps {
  /** Título de la pestaña: barra compacta. Sin título: banda de marca (Inicio). */
  title?: string | undefined;
  onOpenWeeklyForm?: () => void;
  onOpenDailyForm?: () => void;
}

/**
 * Marco superior del portal de cliente. Dos formas, una sola pieza:
 * - Inicio (sin `title`): banda sólida con el color del entrenador — el
 *   único sitio donde la marca llena una región. Saludo + fecha de hoy.
 * - Resto de pestañas: barra compacta y fija con logo, título y acciones.
 * El foreground sobre la marca es `primary-foreground` (calculado por
 * contraste en render-css), nunca blanco fijo.
 */
export function ClientHeader({
  title,
  onOpenWeeklyForm,
  onOpenDailyForm,
}: ClientHeaderProps) {
  const { firstName, logoUrl, trainerName, clientId, tenantSlug } =
    useClientData();
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

  const isHero = !title;
  const actionTone = isHero ? "text-primary-foreground" : "text-default-600";

  const logo = (
    <div
      className={
        isHero
          ? "flex h-11 min-w-11 items-center justify-center rounded-large bg-content1 px-1.5 shadow-small"
          : "flex h-9 min-w-9 shrink-0 items-center justify-center"
      }
    >
      {logoUrl ? (
        <TenantLogo
          priority
          alt={trainerName}
          className="h-8 w-auto object-contain"
          height={32}
          src={logoUrl}
          width={80}
        />
      ) : (
        <Icon className="text-primary text-xl" icon="solar:dumbbell-bold" />
      )}
    </div>
  );

  const actions = (
    <div className="flex shrink-0 items-center gap-1">
      <Badge
        color="danger"
        content={totalUnread}
        isInvisible={totalUnread === 0}
        shape="circle"
        size="sm"
      >
        <Button
          isIconOnly
          aria-label={
            totalUnread > 0 ? `Mensajes (${totalUnread} sin leer)` : "Mensajes"
          }
          className={actionTone}
          variant="light"
          onPress={() => setIsChatOpen(true)}
        >
          <Icon className="text-2xl" icon="solar:chat-round-dots-linear" />
        </Button>
      </Badge>
      <NotificationsDropdown
        clientId={clientId}
        isChatOpen={isChatOpen}
        tenantSlug={tenantSlug}
        triggerClassName={actionTone}
        onOpenChat={() => setIsChatOpen(true)}
        {...(onOpenWeeklyForm ? { onOpenWeeklyForm } : {})}
        {...(onOpenDailyForm ? { onOpenDailyForm } : {})}
      />
    </div>
  );

  return (
    <>
      {isHero ? (
        <header className="mb-5 rounded-b-[2rem] bg-primary px-5 pb-7 pt-[max(1rem,env(safe-area-inset-top))] text-primary-foreground">
          <div className="flex items-center justify-between">
            {logo}
            {actions}
          </div>
          <p className="mt-6 text-sm font-medium text-primary-foreground/80">
            {todayLabel()}
          </p>
          <h1 className="mt-0.5 font-heading text-3xl leading-tight text-primary-foreground">
            Hola, {firstName}
          </h1>
        </header>
      ) : (
        <header className="sticky top-0 z-30 border-b border-default-200 bg-background pt-[env(safe-area-inset-top)]">
          <div className="flex h-14 items-center gap-3 px-4">
            {logo}
            <h1 className="min-w-0 flex-1 truncate font-heading text-lg text-foreground">
              {title}
            </h1>
            {actions}
          </div>
        </header>
      )}

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

function todayLabel(): string {
  const label = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return label.charAt(0).toUpperCase() + label.slice(1);
}

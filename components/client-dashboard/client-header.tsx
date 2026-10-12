"use client";

import { Badge, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ChatPanel } from "./chat-panel";
import { useClientData } from "./client-data-provider";
import { NotificationsDropdown } from "./notifications-dropdown";

import { TenantLogo } from "@/components/tenant-logo";
import { clientFetch } from "@/lib/auth/client-token-storage";
import { useRealtimeMessages } from "@/lib/hooks/use-realtime-messages";

interface ClientHeaderProps {
  /** Título de la pantalla. Con `collapsing`, se muestra pequeño solo al hacer scroll. */
  title?: string | undefined;
  /**
   * La página pinta su propio título grande debajo (ClientPage): la barra
   * empieza transparente y muestra el título pequeño cuando el grande sale
   * de pantalla. Sin `collapsing` (p. ej. Comunidad) la barra es sólida y el
   * título siempre visible.
   */
  collapsing?: boolean;
  /** Pantallas a las que se llega desde "Más": botón Atrás en lugar del logo. */
  showBack?: boolean;
  onOpenWeeklyForm?: () => void;
  onOpenDailyForm?: () => void;
}

/** true cuando el scroll de la ventana pasa `threshold` px. */
function useScrolledPast(threshold: number): boolean {
  const [past, setPast] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setPast(window.scrollY > threshold);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [threshold]);

  return past;
}

/**
 * Barra superior del portal (estilo iOS): logo del entrenador a la izquierda,
 * chat y avisos a la derecha. En modo `collapsing` es transparente sobre el
 * título grande de la página y se vuelve material translúcido con el título
 * pequeño al hacer scroll. Nunca rellena una región con la marca.
 */
export function ClientHeader({
  title,
  collapsing = false,
  showBack = false,
  onOpenWeeklyForm,
  onOpenDailyForm,
}: ClientHeaderProps) {
  const { logoUrl, trainerName, clientId, tenantSlug } = useClientData();
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

  const router = useRouter();
  const scrolledPast = useScrolledPast(44);
  const solid = !collapsing || scrolledPast;

  const leading = showBack ? (
    <button
      className="-ml-2 flex h-11 items-center gap-0.5 justify-self-start rounded-medium pr-2 text-base font-medium text-primary active:opacity-60"
      type="button"
      onClick={() =>
        window.history.length > 1
          ? router.back()
          : router.push(`/${tenantSlug}/dashboard`)
      }
    >
      <Icon className="text-2xl" icon="solar:alt-arrow-left-linear" />
      Atrás
    </button>
  ) : (
    <div className="flex h-9 min-w-9 shrink-0 items-center justify-center justify-self-start rounded-medium bg-content1 px-1.5 shadow-small">
      {logoUrl ? (
        <TenantLogo
          priority
          alt={trainerName}
          className="h-6 w-auto object-contain"
          height={24}
          src={logoUrl}
          width={72}
        />
      ) : (
        <Icon className="text-primary text-xl" icon="solar:dumbbell-bold" />
      )}
    </div>
  );

  const actions = (
    <div className="flex shrink-0 items-center justify-self-end">
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
          className="text-foreground"
          radius="full"
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
        triggerClassName="text-foreground"
        onOpenChat={() => setIsChatOpen(true)}
        {...(onOpenWeeklyForm ? { onOpenWeeklyForm } : {})}
        {...(onOpenDailyForm ? { onOpenDailyForm } : {})}
      />
    </div>
  );

  return (
    <>
      <header
        className={`sticky top-0 z-30 pt-[env(safe-area-inset-top)] transition-[background-color,box-shadow] duration-200 ${
          solid
            ? "bg-background/80 shadow-[0_1px_0_hsl(var(--heroui-default-200))] backdrop-blur-xl backdrop-saturate-150"
            : "bg-transparent"
        }`}
      >
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 pl-4 pr-2">
          {leading}
          <p
            aria-hidden={collapsing}
            className={`max-w-[12rem] truncate font-heading text-[17px] text-foreground transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
              solid ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0"
            }`}
          >
            {title}
          </p>
          {actions}
        </div>
      </header>

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

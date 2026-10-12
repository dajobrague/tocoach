"use client";

import {
  addToast,
  Badge,
  Button,
  ModalBody,
  ModalContent,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { usePathname, useRouter } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useClientData } from "@/components/client-dashboard/client-data-provider";
import {
  ClientSheet,
  ClientSheetGrabber,
} from "@/components/client-dashboard/client-sheet";
import { clientFetch } from "@/lib/auth/client-token-storage";
import {
  useRealtimeNotifications,
  RealtimeNotification,
} from "@/lib/hooks/use-realtime-notifications";
import { RealtimeStatusIndicator } from "@/components/realtime-status-indicator";
import {
  VideoFeedbackStoryViewer,
  type StoryItem,
} from "@/components/client-dashboard/video-feedback/video-feedback-story-viewer";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  icon: string;
  read_at: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

// metadata viene de la BD como JSONB: leemos con guardas en vez de castear.
function metaString(
  metadata: Record<string, unknown> | null | undefined,
  key: string
): string {
  const value = metadata?.[key];

  return typeof value === "string" ? value : "";
}

function isVideoFeedback(notification: Notification): boolean {
  return metaString(notification.metadata, "action") === "open_video_feedback";
}

function toStoryItem(notification: Notification): StoryItem | null {
  const videoUrl = metaString(notification.metadata, "video_url");

  if (!videoUrl) return null;

  return {
    videoUrl,
    exerciseName:
      metaString(notification.metadata, "exercise_name") || "Ejercicio",
    setLabel: metaString(notification.metadata, "set_label"),
    scheduledDate: metaString(notification.metadata, "scheduled_date"),
    comment:
      metaString(notification.metadata, "comment") || notification.message,
    notificationId: notification.id,
  };
}

interface NotificationsDropdownProps {
  clientId: string;
  tenantSlug: string;
  onOpenWeeklyForm?: () => void;
  onOpenDailyForm?: () => void;
  /** Abre el panel de chat (notificaciones de mensajes). */
  onOpenChat?: () => void;
  /** Cuando el chat ya está abierto se omite el toast de mensajes nuevos. */
  isChatOpen?: boolean;
  /** Color del icono del trigger (sobre la banda de marca va primary-foreground). */
  triggerClassName?: string;
}

export function NotificationsDropdown({
  clientId,
  tenantSlug,
  onOpenWeeklyForm,
  onOpenDailyForm,
  onOpenChat,
  isChatOpen,
  triggerClassName = "text-default-600",
}: NotificationsDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [storyItems, setStoryItems] = useState<StoryItem[]>([]);
  const [storyIndex, setStoryIndex] = useState(0);
  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { trainerName } = useClientData();
  const loadNotificationsRef = useRef<() => void>();

  const isChatOpenRef = useRef(isChatOpen);

  isChatOpenRef.current = isChatOpen;

  const handleNewNotification = useCallback(
    (notification: RealtimeNotification) => {
      // Con el chat abierto el mensaje ya se ve en el panel — sin toast.
      if (notification.type === "message" && isChatOpenRef.current) return;

      // Superficie NEUTRA (content1/foreground) en vez de color="primary":
      // el primary lo pinta el theme de cada tenant y el banner sólido
      // quedaba ilegible o chillón según la paleta. El acento del tenant
      // se usa solo en el icono, donde no puede romper el contraste.
      addToast({
        title: notification.title,
        description: notification.message,
        icon: (
          <Icon icon={notification.icon ?? "solar:bell-linear"} width={20} />
        ),
        classNames: {
          base: "bg-content1 border border-default-200 shadow-lg",
          icon: "text-primary",
          title: "text-foreground font-semibold font-heading",
          description: "text-foreground/70 font-body",
          closeButton: "text-foreground/50",
        },
      });
    },
    []
  );

  const {
    isConnected: realtimeConnected,
    hasAttempted: realtimeAttempted,
    refreshTrigger,
  } = useRealtimeNotifications({
    userId: clientId,
    userType: "client",
    onNewNotification: handleNewNotification,
    onRefreshNeeded: () => loadNotificationsRef.current?.(),
  });

  // Load notifications
  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await clientFetch(
        `/api/notifications?clientId=${clientId}&tenantSlug=${tenantSlug}`
      );

      if (response.ok) {
        const data = await response.json();

        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await clientFetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [notificationId] }),
      });

      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);

    if (unreadIds.length === 0) return;

    try {
      await clientFetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: unreadIds }),
      });

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          read_at: n.read_at || new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  // Abre el visor de stories con TODAS las notificaciones de video que
  // siguen sin leer (más la clicada, aunque ya estuviera leída), de la más
  // nueva a la más vieja.
  const openVideoStories = (clicked: Notification) => {
    const items = notifications
      .filter((n) => isVideoFeedback(n) && (!n.read_at || n.id === clicked.id))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .map(toStoryItem)
      .filter((item): item is StoryItem => item !== null);

    if (items.length === 0) {
      // Sin video utilizable: al menos no dejamos la notificación colgando.
      if (!clicked.read_at) markAsRead(clicked.id);

      return;
    }

    const clickedIndex = items.findIndex(
      (item) => item.notificationId === clicked.id
    );

    setStoryItems(items);
    setStoryIndex(clickedIndex >= 0 ? clickedIndex : 0);
    setIsStoryOpen(true);
  };

  // Marca leída la historia al mostrarse (una vez por notificación).
  const handleStoryViewed = (item: StoryItem) => {
    const id = item.notificationId;

    if (!id) return;
    const target = notifications.find((n) => n.id === id);

    if (!target || target.read_at) return;
    markAsRead(id);
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    // Feedback en video → visor tipo story (el visor marca como leída).
    if (isVideoFeedback(notification)) {
      openVideoStories(notification);
      setIsOpen(false);

      return;
    }

    // Mark as read
    if (!notification.read_at) {
      markAsRead(notification.id);
    }

    const action = metaString(notification.metadata, "action");

    // Chat message → open the chat panel directly
    if (action === "open_chat") {
      onOpenChat?.();
      setIsOpen(false);

      return;
    }

    // Check if it's a form notification (metadata contains form_type)
    if (action === "open_form") {
      const formType = metaString(notification.metadata, "form_type");

      if (formType === "checkins" && onOpenWeeklyForm) {
        onOpenWeeklyForm();
      } else if (formType === "habits" && onOpenDailyForm) {
        onOpenDailyForm();
      }
      setIsOpen(false);

      return;
    }

    // Navigate if link exists
    if (notification.link) {
      router.push(notification.link);
    }

    setIsOpen(false);
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMs / 3600000);
    const diffInDays = Math.floor(diffInMs / 86400000);

    if (diffInMins < 1) return "Ahora";
    if (diffInMins < 60) return `${diffInMins}m`;
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInDays < 7) return `${diffInDays}d`;

    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };

  // Keep ref in sync so the realtime hook can trigger reloads
  loadNotificationsRef.current = loadNotifications;

  // Load notifications on mount and when pathname changes
  useEffect(() => {
    loadNotifications();

    // Fallback poll every 5 minutes (Realtime handles instant updates)
    const interval = setInterval(loadNotifications, 300_000);

    return () => clearInterval(interval);
  }, [pathname]);

  // Reload when a realtime event arrives
  useEffect(() => {
    if (refreshTrigger > 0) {
      loadNotifications();
    }
  }, [refreshTrigger]);

  // Load when dropdown opens
  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  return (
    <>
      <Button
        isIconOnly
        aria-label={
          unreadCount > 0
            ? `Notificaciones (${unreadCount} sin leer)`
            : "Notificaciones"
        }
        className={`relative ${triggerClassName}`}
        variant="light"
        onPress={() => setIsOpen(true)}
      >
        <RealtimeStatusIndicator
          hasAttempted={realtimeAttempted}
          isConnected={realtimeConnected}
        />
        {unreadCount > 0 && (
          <Badge
            classNames={{
              badge: "text-xs font-bold",
            }}
            color="danger"
            content={unreadCount > 99 ? "99+" : unreadCount}
            placement="top-right"
            size="sm"
          >
            <Icon className="text-2xl" icon="solar:bell-linear" />
          </Badge>
        )}
        {unreadCount === 0 && (
          <Icon className="text-2xl" icon="solar:bell-linear" />
        )}
      </Button>

      {/* Hoja inferior en móvil (como el resto de diálogos del portal), en
          vez del desplegable de escritorio de 320px. */}
      <ClientSheet isOpen={isOpen} size="md" onClose={() => setIsOpen(false)}>
        <ModalContent>
          {(onClose) => (
            <>
              <ClientSheetGrabber onClose={onClose} />
              <ModalHeader className="flex items-center justify-between gap-2 pb-2 pr-12 pt-1 sm:pt-4">
                <span className="font-heading text-xl">Notificaciones</span>
                {unreadCount > 0 && !loadError ? (
                  <Button
                    className="px-1 text-[15px] font-semibold text-primary"
                    size="sm"
                    variant="light"
                    onPress={markAllAsRead}
                  >
                    Marcar todas leídas
                  </Button>
                ) : null}
              </ModalHeader>
              <ModalBody className="gap-0 px-0 pb-4 pt-0">
                {realtimeAttempted && !realtimeConnected ? (
                  <div
                    className="mx-5 mb-1.5 mt-1 flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2.5 text-[13px] leading-snug text-foreground"
                    role="status"
                  >
                    <Icon
                      className="mt-px shrink-0 text-warning-600"
                      icon="solar:danger-triangle-linear"
                      width={16}
                    />
                    Conexión en tiempo real perdida — usando modo respaldo
                  </div>
                ) : null}
                {isLoading && notifications.length === 0 ? (
                  <div aria-busy="true" className="flex justify-center py-16">
                    <Spinner color="default" />
                  </div>
                ) : loadError && notifications.length === 0 ? (
                  <NotificationsState
                    icon="solar:danger-triangle-linear"
                    text="Revisa tu conexión y vuelve a intentarlo."
                    title="No pudimos cargar tus notificaciones"
                  >
                    <Button
                      className="mt-2.5 font-semibold active:scale-[0.97] motion-reduce:active:scale-100"
                      size="sm"
                      variant="flat"
                      onPress={() => void loadNotifications()}
                    >
                      Reintentar
                    </Button>
                  </NotificationsState>
                ) : notifications.length === 0 ? (
                  <NotificationsState
                    icon="solar:bell-off-linear"
                    text={`Aquí verás los mensajes de ${trainerName || "tu entrenador"}, los comentarios a tus vídeos y los avisos de tus formularios.`}
                    title="No tienes notificaciones"
                  />
                ) : (
                  <>
                    <NotificationGroup
                      formatTimeAgo={formatTimeAgo}
                      items={notifications.filter((n) => !n.read_at)}
                      title="Nuevas"
                      onSelect={handleNotificationClick}
                    />
                    <NotificationGroup
                      formatTimeAgo={formatTimeAgo}
                      items={notifications.filter((n) => n.read_at)}
                      title="Anteriores"
                      onSelect={handleNotificationClick}
                    />
                  </>
                )}
              </ModalBody>
            </>
          )}
        </ModalContent>
      </ClientSheet>

      <VideoFeedbackStoryViewer
        coachName={trainerName}
        initialIndex={storyIndex}
        isOpen={isStoryOpen}
        items={storyItems}
        onClose={() => setIsStoryOpen(false)}
        onViewed={handleStoryViewed}
      />
    </>
  );
}

function NotificationsState({
  icon,
  title,
  text,
  children,
}: {
  icon: string;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-8 pb-6 pt-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-default-100 text-default-500">
        <Icon icon={icon} width={26} />
      </span>
      <p className="mt-1.5 text-[17px] font-semibold text-foreground">
        {title}
      </p>
      <p className="max-w-[280px] text-sm leading-relaxed text-default-500">
        {text}
      </p>
      {children}
    </div>
  );
}

function NotificationGroup({
  title,
  items,
  formatTimeAgo,
  onSelect,
}: {
  title: string;
  items: Notification[];
  formatTimeAgo: (iso: string) => string;
  onSelect: (n: Notification) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <h4 className="mx-5 mb-1 mt-3.5 font-heading text-[15px] font-bold text-foreground">
        {title}
      </h4>
      <ul>
        {items.map((n) => {
          const unread = !n.read_at;
          const time = formatTimeAgo(n.created_at);

          return (
            <li
              key={n.id}
              // Separador estilo iOS: arranca tras el icono (20px + 40px + 12px).
              className="relative before:absolute before:left-[72px] before:right-0 before:top-0 before:h-px before:bg-default-200 first:before:hidden"
            >
              <button
                aria-label={`${n.title}${unread ? ", sin leer" : ""}, ${time}`}
                className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors active:bg-default-100 [@media(hover:hover)]:hover:bg-default-50"
                type="button"
                onClick={() => onSelect(n)}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    unread
                      ? "bg-primary/10 text-primary"
                      : "bg-default-100 text-default-500"
                  }`}
                >
                  <Icon icon={n.icon} width={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span
                      className={`min-w-0 flex-1 truncate text-[15px] text-foreground ${
                        unread ? "font-bold" : "font-medium"
                      }`}
                    >
                      {/* e.g. form_weekly_available: server sets title to schedule.custom_name */}
                      {n.title}
                    </span>
                    <span className="shrink-0 text-[13px] tabular-nums text-default-500">
                      {time}
                    </span>
                    {unread ? (
                      <span
                        aria-hidden
                        className="h-[9px] w-[9px] shrink-0 rounded-full bg-primary"
                      />
                    ) : null}
                  </span>
                  {n.message ? (
                    <span className="mt-0.5 line-clamp-2 block text-sm leading-snug text-default-500">
                      {n.message}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

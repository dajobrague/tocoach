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
import { useCallback, useEffect, useRef, useState } from "react";

import { ClientSheet } from "@/components/client-dashboard/client-sheet";
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
  const [isOpen, setIsOpen] = useState(false);
  const [storyItems, setStoryItems] = useState<StoryItem[]>([]);
  const [storyIndex, setStoryIndex] = useState(0);
  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
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
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
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

    const notif = notification as any;

    // Chat message → open the chat panel directly
    if (notif.metadata?.action === "open_chat") {
      onOpenChat?.();
      setIsOpen(false);

      return;
    }

    // Check if it's a form notification (metadata contains form_type)
    if (notif.metadata?.action === "open_form") {
      const formType = notif.metadata?.form_type;

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
          <ModalHeader className="flex items-center justify-between gap-2 pr-12">
            <span className="font-heading text-lg">Notificaciones</span>
            {unreadCount > 0 ? (
              <Button
                className="text-primary"
                size="sm"
                variant="light"
                onPress={markAllAsRead}
              >
                Marcar todas leídas
              </Button>
            ) : null}
          </ModalHeader>
          <ModalBody className="px-3 pb-4">
            {isLoading && notifications.length === 0 ? (
              <div className="flex justify-center py-10">
                <Spinner color="primary" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-default-100">
                  <Icon
                    className="text-2xl text-default-400"
                    icon="solar:bell-off-linear"
                  />
                </div>
                <p className="text-sm text-default-500">
                  No tienes notificaciones
                </p>
              </div>
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
        </ModalContent>
      </ClientSheet>

      <VideoFeedbackStoryViewer
        initialIndex={storyIndex}
        isOpen={isStoryOpen}
        items={storyItems}
        onClose={() => setIsStoryOpen(false)}
        onViewed={handleStoryViewed}
      />
    </>
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
    <section className="mt-1">
      <h4 className="px-2 pb-1.5 pt-2 text-xs font-semibold text-default-500">
        {title}
      </h4>
      <ul className="space-y-1">
        {items.map((n) => {
          const unread = !n.read_at;

          return (
            <li key={n.id}>
              <button
                className={`flex w-full items-start gap-3 rounded-large p-2.5 text-left transition-colors ${
                  unread
                    ? "bg-primary/5 hover:bg-primary/10"
                    : "hover:bg-default-100"
                }`}
                type="button"
                onClick={() => onSelect(n)}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    unread
                      ? "bg-primary/15 text-primary"
                      : "bg-default-100 text-default-500"
                  }`}
                >
                  <Icon className="text-xl" icon={n.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span
                      className={`text-sm leading-snug ${
                        unread
                          ? "font-semibold text-foreground"
                          : "font-medium text-default-700"
                      }`}
                    >
                      {/* e.g. form_weekly_available: server sets title to schedule.custom_name */}
                      {n.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-xs text-default-400">
                      {formatTimeAgo(n.created_at)}
                      {unread ? (
                        <span
                          aria-label="Sin leer"
                          className="h-2 w-2 rounded-full bg-primary"
                        />
                      ) : null}
                    </span>
                  </span>
                  {n.message ? (
                    <span className="mt-0.5 line-clamp-2 block text-sm text-default-500">
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

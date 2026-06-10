"use client";

import {
  addToast,
  Badge,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  useRealtimeNotifications,
  RealtimeNotification,
} from "@/lib/hooks/use-realtime-notifications";
import { RealtimeStatusIndicator } from "@/components/realtime-status-indicator";

const MESSAGING_PATH = "/trainer/dashboard/messaging";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  icon: string;
  read_at: string | null;
  created_at: string;
  client_id?: number;
  metadata?: Record<string, unknown>;
}

interface TrainerNotificationsDropdownProps {
  trainerId: string;
}

export function TrainerNotificationsDropdown({
  trainerId,
}: TrainerNotificationsDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const loadNotificationsRef = useRef<() => void>();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  pathnameRef.current = pathname;

  // Toast al llegar una notificación en vivo (paridad con el dropdown del
  // cliente). Se omite para mensajes de chat si el trainer ya está en la
  // página de mensajería — ahí el hilo se actualiza en vivo.
  const handleNewNotification = useCallback(
    (notification: RealtimeNotification) => {
      if (
        notification.type === "message" &&
        pathnameRef.current?.startsWith(MESSAGING_PATH)
      ) {
        return;
      }

      addToast({
        title: notification.title,
        description: notification.message,
        color: "primary",
      });
    },
    []
  );

  const {
    isConnected: realtimeConnected,
    hasAttempted: realtimeAttempted,
    refreshTrigger,
  } = useRealtimeNotifications({
    userId: trainerId,
    userType: "trainer",
    onNewNotification: handleNewNotification,
    onRefreshNeeded: () => loadNotificationsRef.current?.(),
  });

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/notifications?trainerId=${trainerId}`);

      if (response.ok) {
        const data = await response.json();

        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Error loading trainer notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [notificationId] }),
      });

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

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);

    if (unreadIds.length === 0) return;

    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: unreadIds }),
      });

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

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read_at) {
      markAsRead(notification.id);
    }

    // Mensajes de chat → abrir la conversación de ese cliente.
    if (
      notification.metadata?.action === "open_chat" &&
      notification.client_id != null
    ) {
      router.push(`${MESSAGING_PATH}?client=${notification.client_id}`);
    } else if (notification.link) {
      router.push(notification.link);
    }

    setIsOpen(false);
  };

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

  loadNotificationsRef.current = loadNotifications;

  // Initial load + fallback poll every 5 minutes
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 300_000);

    return () => clearInterval(interval);
  }, [trainerId]);

  // Reload on realtime events
  useEffect(() => {
    if (refreshTrigger > 0) {
      loadNotifications();
    }
  }, [refreshTrigger]);

  // Reload when dropdown opens
  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  return (
    <Dropdown
      classNames={{
        content: "w-80 md:w-96 max-h-[500px] overflow-hidden",
      }}
      isOpen={isOpen}
      placement="bottom-end"
      onOpenChange={setIsOpen}
    >
      <DropdownTrigger>
        <Button
          isIconOnly
          className="text-gray-600 hover:text-black relative"
          size="sm"
          variant="light"
        >
          <RealtimeStatusIndicator
            hasAttempted={realtimeAttempted}
            isConnected={realtimeConnected}
          />
          {unreadCount > 0 && (
            <Badge
              classNames={{ badge: "text-xs font-bold" }}
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
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Notificaciones del entrenador"
        className="p-0"
        classNames={{
          base: "p-0 max-h-[450px] overflow-y-auto",
          list: "p-0 gap-0",
        }}
      >
        <DropdownSection
          showDivider
          classNames={{ base: "p-0", heading: "px-4 py-3" }}
        >
          <DropdownItem
            key="header"
            isReadOnly
            className="cursor-default hover:bg-transparent"
            classNames={{ base: "p-0" }}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-lg font-semibold">Notificaciones</h3>
              {unreadCount > 0 && (
                <Button
                  className="text-primary"
                  size="sm"
                  variant="light"
                  onPress={markAllAsRead}
                >
                  Marcar todas leídas
                </Button>
              )}
            </div>
          </DropdownItem>
        </DropdownSection>

        {isLoading ? (
          <DropdownItem
            key="loading"
            isReadOnly
            className="justify-center py-8"
          >
            <Spinner color="primary" size="md" />
          </DropdownItem>
        ) : null}
        {!isLoading && notifications.length === 0 ? (
          <DropdownItem key="empty" isReadOnly className="cursor-default">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Icon
                className="text-5xl text-gray-300 mb-3"
                icon="solar:bell-off-linear"
              />
              <p className="text-gray-500 text-sm">No tienes notificaciones</p>
            </div>
          </DropdownItem>
        ) : null}
        {!isLoading && notifications.length > 0 ? (
          <DropdownSection classNames={{ base: "p-0" }}>
            {notifications.map((notification) => (
              <DropdownItem
                key={notification.id}
                className="py-3 px-4"
                classNames={{ base: "data-[hover=true]:bg-gray-50" }}
                onPress={() => handleNotificationClick(notification)}
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        !notification.read_at ? "bg-primary/20" : "bg-gray-100"
                      }`}
                    >
                      <Icon
                        className={`text-xl ${
                          !notification.read_at
                            ? "text-primary"
                            : "text-gray-400"
                        }`}
                        icon={notification.icon || "solar:bell-linear"}
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p
                        className={`text-sm font-semibold ${
                          !notification.read_at
                            ? "text-gray-900"
                            : "text-gray-500"
                        }`}
                      >
                        {notification.title}
                      </p>
                      {!notification.read_at && (
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-1 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatTimeAgo(notification.created_at)}
                    </p>
                  </div>
                </div>
              </DropdownItem>
            ))}
          </DropdownSection>
        ) : null}
      </DropdownMenu>
    </Dropdown>
  );
}

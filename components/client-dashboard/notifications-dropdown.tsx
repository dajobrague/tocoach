"use client";

import {
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
import { useEffect, useState } from "react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  icon: string;
  read_at: string | null;
  created_at: string;
}

interface NotificationsDropdownProps {
  clientId: string;
  tenantSlug: string;
}

export function NotificationsDropdown({
  clientId,
  tenantSlug,
}: NotificationsDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Load notifications
  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
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
      await fetch("/api/notifications", {
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
      await fetch("/api/notifications", {
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

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read_at) {
      markAsRead(notification.id);
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

  // Load notifications on mount and when pathname changes
  useEffect(() => {
    loadNotifications();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);

    return () => clearInterval(interval);
  }, [pathname]);

  // Load when dropdown opens
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
          className="text-foreground/70 relative"
          size="sm"
          variant="light"
        >
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
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Notificaciones"
        className="p-0"
        classNames={{
          base: "p-0 max-h-[450px] overflow-y-auto",
          list: "p-0 gap-0",
        }}
      >
        <DropdownSection
          showDivider
          classNames={{
            base: "p-0",
            heading: "px-4 py-3",
          }}
        >
          <DropdownItem
            key="header"
            isReadOnly
            className="cursor-default hover:bg-transparent"
            classNames={{
              base: "p-0",
            }}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-lg font-semibold font-heading">
                Notificaciones
              </h3>
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
        ) : notifications.length === 0 ? (
          <DropdownItem key="empty" isReadOnly className="cursor-default">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Icon
                className="text-5xl text-foreground/20 mb-3"
                icon="solar:bell-off-linear"
              />
              <p className="text-foreground/60 font-body text-sm">
                No tienes notificaciones
              </p>
            </div>
          </DropdownItem>
        ) : (
          notifications.map((notification) => (
            <DropdownItem
              key={notification.id}
              className={`py-3 px-4 ${
                !notification.read_at ? "bg-primary/5" : ""
              }`}
              classNames={{
                base: "data-[hover=true]:bg-content2",
              }}
              onPress={() => handleNotificationClick(notification)}
            >
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      !notification.read_at ? "bg-primary/20" : "bg-content2"
                    }`}
                  >
                    <Icon
                      className={`text-xl ${
                        !notification.read_at
                          ? "text-primary"
                          : "text-foreground/60"
                      }`}
                      icon={notification.icon}
                    />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p
                      className={`text-sm font-semibold font-heading ${
                        !notification.read_at
                          ? "text-foreground"
                          : "text-foreground/70"
                      }`}
                    >
                      {notification.title}
                    </p>
                    {!notification.read_at && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-xs text-foreground/60 font-body mb-1 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-foreground/50 font-body">
                    {formatTimeAgo(notification.created_at)}
                  </p>
                </div>
              </div>
            </DropdownItem>
          ))
        )}
      </DropdownMenu>
    </Dropdown>
  );
}

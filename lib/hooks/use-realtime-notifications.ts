"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/clients/supabase-browser";

export interface RealtimeNotification {
  id: string;
  tenant_slug: string;
  client_id: number;
  trainer_id: string | null;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  icon: string | null;
  read_at: string | null;
  created_at: string;
}

interface UseRealtimeNotificationsOptions {
  userId: string | number;
  userType: "client" | "trainer";
  onNewNotification?: (notification: RealtimeNotification) => void;
  onRefreshNeeded?: () => void;
}

interface UseRealtimeNotificationsReturn {
  unreadCount: number;
  latestNotification: RealtimeNotification | null;
  isConnected: boolean;
  /** True once the channel has received at least one status callback */
  hasAttempted: boolean;
  /** Increments on every realtime event — use as a useEffect dependency to trigger re-fetches */
  refreshTrigger: number;
  resetUnreadCount: (count?: number) => void;
}

export function useRealtimeNotifications({
  userId,
  userType,
  onNewNotification,
  onRefreshNeeded,
}: UseRealtimeNotificationsOptions): UseRealtimeNotificationsReturn {
  const instanceId = useId();
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotification, setLatestNotification] =
    useState<RealtimeNotification | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const wasDisconnectedRef = useRef(false);
  const onNewNotificationRef = useRef(onNewNotification);
  const onRefreshNeededRef = useRef(onRefreshNeeded);

  onNewNotificationRef.current = onNewNotification;
  onRefreshNeededRef.current = onRefreshNeeded;

  const resetUnreadCount = useCallback((count = 0) => {
    setUnreadCount(count);
  }, []);

  useEffect(() => {
    if (!userId) return;

    const supabase = getSupabaseBrowserClient();
    const filterColumn = userType === "client" ? "client_id" : "trainer_id";
    // Instance-unique name avoids collisions when multiple components use this hook
    const safeSuffix = instanceId.replace(/:/g, "_");
    const channelName = `notifications_${userType}_${userId}_${safeSuffix}`;

    setHasAttempted(false);

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `${filterColumn}=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as RealtimeNotification;

          // Las filas de chat llevan client_id Y trainer_id, así que ambas
          // suscripciones las reciben; metadata.audience scope-a qué campana
          // puede mostrarlas (filas legacy sin audience pasan siempre).
          const audience = (
            notification.metadata as { audience?: string } | null
          )?.audience;

          if (audience && audience !== userType) return;

          setLatestNotification(notification);
          if (!notification.read_at) {
            setUnreadCount((prev) => prev + 1);
          }
          setRefreshTrigger((prev) => prev + 1);
          onNewNotificationRef.current?.(notification);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `${filterColumn}=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as RealtimeNotification;
          const old = payload.old as Partial<RealtimeNotification>;

          const audience = (updated.metadata as { audience?: string } | null)
            ?.audience;

          if (audience && audience !== userType) return;

          // Notification was just marked as read from another device/tab
          if (updated.read_at && !old.read_at) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
          setRefreshTrigger((prev) => prev + 1);
        }
      )
      .subscribe((status) => {
        setHasAttempted(true);
        const connected = status === "SUBSCRIBED";

        if (connected && wasDisconnectedRef.current) {
          setRefreshTrigger((prev) => prev + 1);
          onRefreshNeededRef.current?.();
          wasDisconnectedRef.current = false;
        }

        if (
          status === "CLOSED" ||
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          wasDisconnectedRef.current = true;
        }

        setIsConnected(connected);
      });

    channelRef.current = channel;

    // Visibility-change handler: refetch when user returns to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setRefreshTrigger((prev) => prev + 1);
        onRefreshNeededRef.current?.();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId, userType]);

  return {
    unreadCount,
    latestNotification,
    isConnected,
    hasAttempted,
    refreshTrigger,
    resetUnreadCount,
  };
}

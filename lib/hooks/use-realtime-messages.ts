"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/clients/supabase-browser";

export interface RealtimeMessage {
  id: string;
  tenant_slug: string;
  client_id: number;
  sender_type: "client" | "trainer";
  sender_id: string;
  sender_name: string;
  message: string;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UseRealtimeMessagesOptions {
  /** client_id that scopes the conversation. Pass null to disable (unless tenantSlug is set). */
  clientId: string | number | null;
  /** The current user's id (to ignore own messages in the new-message list) */
  userId: string | number;
  userType: "client" | "trainer";
  /** When set, subscribes to ALL messages in this tenant (trainer global mode). */
  tenantSlug?: string | null;
  onNewMessage?: (message: RealtimeMessage) => void;
  onRefreshNeeded?: () => void;
}

interface UseRealtimeMessagesReturn {
  newMessages: RealtimeMessage[];
  newMessageCount: number;
  isConnected: boolean;
  refreshTrigger: number;
  clearNewMessages: () => void;
}

export function useRealtimeMessages({
  clientId,
  userId,
  userType,
  tenantSlug,
  onNewMessage,
  onRefreshNeeded,
}: UseRealtimeMessagesOptions): UseRealtimeMessagesReturn {
  const instanceId = useId();
  const [newMessages, setNewMessages] = useState<RealtimeMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const wasDisconnectedRef = useRef(false);
  const onNewMessageRef = useRef(onNewMessage);
  const onRefreshNeededRef = useRef(onRefreshNeeded);

  onNewMessageRef.current = onNewMessage;
  onRefreshNeededRef.current = onRefreshNeeded;

  const clearNewMessages = useCallback(() => {
    setNewMessages([]);
  }, []);

  useEffect(() => {
    // Need either a specific clientId or a global tenantSlug to subscribe
    const filterValue = clientId ?? tenantSlug;

    if (!filterValue) return;

    const supabase = getSupabaseBrowserClient();
    const safeSuffix = instanceId.replace(/:/g, "_");
    const scope = clientId ? `c${clientId}` : `t${tenantSlug}`;
    const channelName = `messages_${userType}_${scope}_${safeSuffix}`;

    // clientId-specific filter or tenant-wide filter
    const filter = clientId
      ? `client_id=eq.${clientId}`
      : `tenant_slug=eq.${tenantSlug}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter,
        },
        (payload) => {
          const msg = payload.new as RealtimeMessage;

          if (String(msg.sender_id) !== String(userId)) {
            setNewMessages((prev) => [...prev, msg]);
            onNewMessageRef.current?.(msg);
          }
          setRefreshTrigger((prev) => prev + 1);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter,
        },
        () => {
          setRefreshTrigger((prev) => prev + 1);
        }
      )
      .subscribe((status) => {
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
  }, [clientId, tenantSlug, userId, userType]);

  return {
    newMessages,
    newMessageCount: newMessages.length,
    isConnected,
    refreshTrigger,
    clearNewMessages,
  };
}

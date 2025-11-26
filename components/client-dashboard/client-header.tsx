"use client";

import { Badge, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { ChatPanel } from "./chat-panel";
import { NotificationsDropdown } from "./notifications-dropdown";

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

  // Load unread message count
  const loadUnreadCount = async () => {
    try {
      const response = await fetch(
        `/api/messages?clientId=${clientId}&tenantSlug=${tenantSlug}`
      );

      if (response.ok) {
        const data = await response.json();
        const unread =
          data.messages?.filter(
            (m: any) => m.sender_type === "trainer" && !m.read_at
          ).length || 0;

        setUnreadCount(unread);
      }
    } catch (error) {
      console.error("Error loading unread count:", error);
    }
  };

  // Load unread count on mount and periodically
  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [clientId, tenantSlug]);

  // Refresh unread count when chat closes
  const handleChatClose = () => {
    setIsChatOpen(false);
    setUnreadCount(0); // Reset count when closing chat
    loadUnreadCount(); // Reload to ensure sync
  };

  return (
    <>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 bg-content1 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                alt={trainerName}
                className="h-10 w-auto object-contain"
                src={logoUrl}
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
              content={unreadCount}
              isInvisible={unreadCount === 0}
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
              tenantSlug={tenantSlug}
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

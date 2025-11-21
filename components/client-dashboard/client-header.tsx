"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { ChatPanel } from "./chat-panel";
import { NotificationsDropdown } from "./notifications-dropdown";

interface ClientHeaderProps {
  firstName: string;
  logoUrl?: string;
  trainerName: string;
  clientProfilePicture?: string;
  clientId: string;
  tenantSlug: string;
  currentStreak?: number;
  showStreak?: boolean;
}

export function ClientHeader({
  firstName,
  logoUrl,
  trainerName,
  clientProfilePicture,
  clientId,
  tenantSlug,
  currentStreak = 0,
  showStreak = false,
}: ClientHeaderProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);

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
              <p className="text-xs text-foreground/60 font-body">
                ¡Listo para entrenar!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              isIconOnly
              className="text-foreground/70"
              size="sm"
              variant="light"
              onPress={() => setIsChatOpen(true)}
            >
              <Icon className="text-2xl" icon="solar:chat-round-dots-linear" />
            </Button>
            <NotificationsDropdown
              clientId={clientId}
              tenantSlug={tenantSlug}
            />
          </div>
        </div>

        {/* Streak - Only show if enabled and >= 2 days */}
        {showStreak && currentStreak >= 2 && (
          <div className="mb-2">
            <div className="flex items-center gap-2">
              <Icon className="text-warning text-xl" icon="solar:fire-bold" />
              <p className="text-sm font-semibold text-foreground/80 tracking-wide">
                {currentStreak} Días en Racha
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Chat Panel */}
      <ChatPanel
        clientId={clientId}
        isOpen={isChatOpen}
        tenantSlug={tenantSlug}
        trainerName={trainerName}
        onClose={() => setIsChatOpen(false)}
      />
    </>
  );
}

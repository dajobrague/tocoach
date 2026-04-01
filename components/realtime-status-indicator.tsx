"use client";

import { Tooltip } from "@heroui/react";

interface RealtimeStatusIndicatorProps {
  isConnected: boolean;
  /** Whether at least one connection attempt has completed. Hides the indicator during initial connect. */
  hasAttempted?: boolean;
}

/**
 * Subtle dot that only appears when the realtime WebSocket is
 * disconnected after at least one attempt. Hidden when connected
 * or before the first attempt finishes (avoids a flash on page load).
 */
export function RealtimeStatusIndicator({
  isConnected,
  hasAttempted = true,
}: RealtimeStatusIndicatorProps) {
  if (isConnected || !hasAttempted) return null;

  return (
    <Tooltip content="Conexión en tiempo real perdida — usando modo respaldo">
      <span className="absolute -top-0.5 -left-0.5 flex h-2.5 w-2.5 z-10">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-warning" />
      </span>
    </Tooltip>
  );
}

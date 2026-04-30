/**
 * Per-client charts tab inside the trainer's client profile.
 * Embeds the same ChartSurface used by the standalone
 * /trainer/dashboard/clients/[clientId]/charts page, in trainer-client
 * mode (autosave + reset-to-template + real client data via snapshot).
 */

"use client";

import { ChartSurface } from "@/components/charts/surface/chart-surface";

interface Props {
  clientId: string;
}

export default function ChartsTab({ clientId }: Props) {
  return (
    <div>
      <ChartSurface clientId={clientId} mode="trainer-client" />
    </div>
  );
}

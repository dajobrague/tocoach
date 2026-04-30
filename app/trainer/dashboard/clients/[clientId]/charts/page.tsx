/**
 * Per-client chart editor — /trainer/dashboard/clients/[clientId]/charts
 *
 * Same component (ChartSurface) as the trainer template editor, in
 * "trainer-client" mode:
 *   - Reads /api/charts/clients/[clientId] for the effective config
 *     (override OR template fall-back).
 *   - Saves to PUT /api/charts/clients/[clientId] (creates an override
 *     row on first save).
 *   - "Restablecer a plantilla" deletes the override row, returning
 *     this client to the live template.
 *   - Real client data via /api/charts/clients/[clientId]/snapshot.
 */

"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useParams, useRouter } from "next/navigation";

import { ChartSurface } from "@/components/charts/surface/chart-surface";

export default function ClientChartsPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.clientId as string;

  return (
    <div className="trainer-app min-h-screen bg-background">
      <header className="border-b border-default-200 bg-content1">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
          <Button
            isIconOnly
            aria-label="Volver al perfil del cliente"
            size="sm"
            variant="light"
            onPress={() =>
              router.push(`/trainer/dashboard/clients/${clientId}`)
            }
          >
            <Icon icon="solar:alt-arrow-left-bold" width={18} />
          </Button>
          <div className="flex-1">
            <p className="text-[11px] text-foreground/40 uppercase tracking-wider">
              Trainer · Cliente
            </p>
            <h1 className="text-base font-semibold">Gráficas del cliente</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        <ChartSurface clientId={clientId} mode="trainer-client" />
      </main>
    </div>
  );
}

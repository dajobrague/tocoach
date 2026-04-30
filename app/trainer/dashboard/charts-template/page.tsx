/**
 * Trainer chart template editor — /trainer/dashboard/charts-template
 *
 * Auth: trainer cookie (SameSite=Lax). The page no longer pre-checks the
 * session via /api/auth/session — that round-trip blocks rendering and
 * the API endpoints (/api/charts/*) already enforce auth. If a query
 * returns 401, lib/charts/hooks.ts redirects to /trainer/login. This way
 * the page chrome paints immediately and queries run in parallel.
 */

"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";

import { ChartSurface } from "@/components/charts/surface/chart-surface";

export default function ChartsTemplatePage() {
  const router = useRouter();

  return (
    <div className="trainer-app min-h-screen bg-background">
      {/* Top bar — keeps the page anchored to the dashboard chrome
          (without dragging the whole sidebar/SPA in). */}
      <header className="border-b border-default-200 bg-content1">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
          <Button
            isIconOnly
            aria-label="Volver al dashboard"
            size="sm"
            variant="light"
            onPress={() => router.push("/trainer/dashboard")}
          >
            <Icon icon="solar:alt-arrow-left-bold" width={18} />
          </Button>
          <div className="flex-1">
            <p className="text-[11px] text-foreground/40 uppercase tracking-wider">
              Trainer · Configuración
            </p>
            <h1 className="text-base font-semibold">Plantilla de gráficas</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        <ChartSurface mode="trainer-template" />
      </main>
    </div>
  );
}

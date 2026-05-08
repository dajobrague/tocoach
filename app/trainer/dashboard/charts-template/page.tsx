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

import { ChartSurface } from "@/components/charts/surface/chart-surface";

export default function ChartsTemplatePage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <div className="mb-4">
        <p className="text-[11px] text-foreground/40 uppercase tracking-wider">
          Trainer · Configuración
        </p>
        <h1 className="text-base font-semibold">Plantilla de gráficas</h1>
      </div>
      <ChartSurface mode="trainer-template" />
    </div>
  );
}

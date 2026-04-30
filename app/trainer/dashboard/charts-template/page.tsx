/**
 * Trainer chart template editor — /trainer/dashboard/charts-template
 *
 * Auth: trainer cookie (SameSite=Lax). Mirrors the auth check used by
 * other trainer dashboard subroutes. The data layer (ChartSurface) handles
 * load / autosave; this page is just the route shell.
 */

"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ChartSurface } from "@/components/charts/surface/chart-surface";

interface TrainerSession {
  trainer_id: string;
  tenant_host: string;
  email: string;
}

export default function ChartsTemplatePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/session", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data: { session?: TrainerSession }) => {
        if (cancelled) return;
        if (!data.session) {
          router.push("/trainer/login");

          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) router.push("/trainer/login");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="trainer-app min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-foreground/40">Cargando…</p>
      </div>
    );
  }

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

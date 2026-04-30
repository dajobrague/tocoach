/**
 * Trainer chart template editor — /trainer/dashboard/charts-template
 *
 * Auth: trainer cookie (SameSite=Lax). Mirrors the auth check used by
 * other trainer dashboard subroutes. The data layer (ChartSurface) handles
 * load / autosave; this page is just the route shell.
 */

"use client";

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
      <div className="trainer-app min-h-screen flex items-center justify-center">
        <p className="text-sm text-foreground/40">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="trainer-app min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <ChartSurface mode="trainer-template" />
      </div>
    </div>
  );
}

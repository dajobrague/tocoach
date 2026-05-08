"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const SECTION_TO_PATH: Record<string, string> = {
  metricas: "/trainer/dashboard/metricas",
  clients: "/trainer/dashboard/clients",
  messaging: "/trainer/dashboard/messaging",
  "exercise-library": "/trainer/dashboard/exercise-library",
  inventory: "/trainer/dashboard/inventory",
  templates: "/trainer/dashboard/templates",
  "charts-template": "/trainer/dashboard/charts-template",
  help: "/trainer/dashboard/help",
  ayuda: "/trainer/dashboard/help",
  "brand-settings": "/trainer/settings",
  setup: "/trainer/dashboard/setup",
};

export default function TrainerDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Read query directly off window — avoids the Next.js useSearchParams
    // Suspense boundary requirement for client redirector pages.
    const params = new URLSearchParams(window.location.search);

    if (params.get("setup") === "completed") {
      try {
        window.localStorage.removeItem("activeSection");
      } catch {
        /* ignore */
      }
      router.replace("/trainer/dashboard/metricas");
      return;
    }

    let target = "/trainer/dashboard/metricas";
    try {
      const stored = window.localStorage.getItem("activeSection");
      if (stored && SECTION_TO_PATH[stored]) {
        target = SECTION_TO_PATH[stored] ?? target;
      }
      window.localStorage.removeItem("activeSection");
    } catch {
      /* ignore */
    }

    router.replace(target);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-default-500 font-body">Cargando...</p>
      </div>
    </div>
  );
}

"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { CheckInScheduleEditor } from "@/components/trainer/checkin-schedule-editor";

export default function CheckinDefaultsSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && !data.session) {
          router.replace("/trainer/login");
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/trainer/login");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Button
            as={Link}
            href="/trainer/dashboard"
            size="sm"
            startContent={<Icon icon="solar:arrow-left-linear" width={18} />}
            variant="light"
            onPress={() => {
              try {
                localStorage.setItem("activeSection", "brand-settings");
              } catch {
                /* ignore */
              }
            }}
          >
            Volver al panel
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Configuración por defecto de Check-in
          </h1>
          <p className="mt-2 text-gray-600">
            Estos valores se aplicarán a todos los nuevos clientes
          </p>
        </div>

        <CheckInScheduleEditor
          showApplyAllClients
          editorTitle="Horario de check-in por defecto"
          variant="template"
        />
      </main>
    </div>
  );
}

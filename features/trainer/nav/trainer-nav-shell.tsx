"use client";

import { useRouter } from "next/navigation";
import React from "react";

import { useRealtimeMessages } from "@/lib/hooks/use-realtime-messages";

import { useActiveKey } from "./use-active-key";
import { useShellMode } from "./use-shell-mode";
import { SideShell } from "./shells/side-shell";
import { TopShell } from "./shells/top-shell";

interface TrainerSession {
  trainer_id: string;
  tenant_host: string;
  email: string;
  full_name?: string;
  onboarding_completed?: boolean;
}

interface TrainerNavShellProps {
  children: React.ReactNode;
}

export function TrainerNavShell({ children }: TrainerNavShellProps) {
  const router = useRouter();
  const mode = useShellMode();
  const activeKey = useActiveKey();

  const [session, setSession] = React.useState<TrainerSession | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [trainerImage, setTrainerImage] = React.useState<string | undefined>();
  const [brandLogo, setBrandLogo] = React.useState<string | undefined>();

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.session) {
          router.push("/trainer/login");
          return;
        }
        setSession(data.session);
      })
      .catch(() => {
        if (!cancelled) router.push("/trainer/login");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  React.useEffect(() => {
    if (!session) return;
    if (session.onboarding_completed) return;
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    if (path.startsWith("/trainer/dashboard/setup")) return;
    router.push("/trainer/dashboard/setup");
  }, [session, router]);

  React.useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch("/api/trainer/profile")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success && data.trainer?.profile_picture_url) {
          setTrainerImage(data.trainer.profile_picture_url);
        }
      })
      .catch(() => {});
    fetch("/api/brand/config")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.logo_url) setBrandLogo(data.logo_url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session]);

  const { newMessageCount: unreadMessages, clearNewMessages } =
    useRealtimeMessages({
      clientId: null,
      tenantSlug: session?.tenant_host ?? null,
      userId: session?.trainer_id ?? "",
      userType: "trainer",
    });

  React.useEffect(() => {
    if (activeKey === "messaging") clearNewMessages();
  }, [activeKey, clearNewMessages]);

  const handleLogout = React.useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Logout error:", e);
    } finally {
      router.push("/trainer/login");
    }
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-default-500 font-body">
            Cargando panel de control...
          </p>
        </div>
      </div>
    );
  }
  if (!session) return null;

  const trainerName = session.full_name || session.email;

  if (mode === "side") {
    return (
      <SideShell
        activeKey={activeKey}
        brandLogo={brandLogo}
        trainerId={session.trainer_id}
        trainerImage={trainerImage}
        trainerName={trainerName}
        unreadMessages={unreadMessages}
        onLogout={handleLogout}
      >
        {children}
      </SideShell>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <TopShell
        activeKey={activeKey}
        brandLogo={brandLogo}
        trainerId={session.trainer_id}
        trainerImage={trainerImage}
        trainerName={trainerName}
        unreadMessages={unreadMessages}
        onLogout={handleLogout}
      />
      <main className="flex-1 w-full overflow-hidden">{children}</main>
    </div>
  );
}

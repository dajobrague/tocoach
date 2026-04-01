"use client";

import { Chip } from "@heroui/react";
import { useRouter } from "next/navigation";
import React from "react";

import AyudaContent from "@/components/dashboard/ayuda-content";
import SettingsContent from "@/components/dashboard/settings-content";
import ClientsContent from "@/components/dashboard/clients-content";
import ExerciseLibraryContent from "@/components/dashboard/exercise-library-content";
import FloatingSupportButton from "@/components/dashboard/floating-support-button";
import InventoryContent from "@/components/dashboard/inventory-content";
import MessagingContent from "@/components/dashboard/messaging-content";
import MetricasContent from "@/components/dashboard/metricas-content";
import dashboardSidebarItems from "@/components/dashboard/sidebar-items";
import TemplatesContent from "@/components/dashboard/templates-content";
import TopNavigation from "@/components/dashboard/top-navigation";
import { useRealtimeMessages } from "@/lib/hooks/use-realtime-messages";

interface TrainerSession {
  trainer_id: string;
  tenant_host: string;
  email: string;
  full_name?: string;
  onboarding_completed?: boolean;
}

export default function TrainerDashboard() {
  const router = useRouter();
  const [session, setSession] = React.useState<TrainerSession | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [setupJustCompleted, setSetupJustCompleted] = React.useState(false);
  const [trainerImage, setTrainerImage] = React.useState<string | undefined>();
  const [brandLogo, setBrandLogo] = React.useState<string | undefined>();
  const [activeSection, setActiveSection] = React.useState(() => {
    // Try to get saved section from localStorage
    if (typeof window !== "undefined") {
      // Check if coming from setup completion
      const urlParams = new URLSearchParams(window.location.search);

      if (urlParams.get("setup") === "completed") {
        // Clear the setup section from localStorage
        localStorage.removeItem("activeSection");
        localStorage.setItem("activeSection", "metricas");

        return "metricas";
      }

      return localStorage.getItem("activeSection") || "metricas";
    }

    return "metricas";
  });

  // Fetch session with optional cache busting
  const fetchSession = React.useCallback(async (bustCache = false) => {
    console.log("[TrainerDashboard] Fetching session, bustCache:", bustCache);
    const url = bustCache
      ? `/api/auth/session?_t=${Date.now()}`
      : "/api/auth/session";

    const res = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store", // Force no caching
    });

    console.log("[TrainerDashboard] Session API response:", res.status);

    const data = await res.json();

    console.log("[TrainerDashboard] Session data:", {
      hasSession: !!data.session,
      onboardingCompleted: data.session?.onboarding_completed,
    });

    return data;
  }, []);

  // Initial session fetch + handle setup completion flag
  React.useEffect(() => {
    console.log("[TrainerDashboard] Component mounted, checking session...");

    // Check if just completed setup
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);

      if (urlParams.get("setup") === "completed") {
        console.log(
          "[TrainerDashboard] Setup just completed - forcing fresh session"
        );
        setSetupJustCompleted(true);
        // Clear the URL parameter immediately
        window.history.replaceState({}, "", "/trainer/dashboard");
        // Ensure localStorage is clean
        localStorage.removeItem("activeSection");
        localStorage.setItem("activeSection", "metricas");
      }
    }

    // Fetch session (with cache busting if just completed setup)
    fetchSession(setupJustCompleted)
      .then((data) => {
        if (data.session) {
          console.log("[TrainerDashboard] Session found, setting state");
          setSession(data.session);

          // If setup just completed, force activeSection to metricas
          if (setupJustCompleted) {
            console.log("[TrainerDashboard] Forcing activeSection to metricas");
            setActiveSection("metricas");
          }
        } else {
          console.log(
            "[TrainerDashboard] No session, redirecting to /trainer/login"
          );
          router.push("/trainer/login");
        }
      })
      .catch((error) => {
        console.error("[TrainerDashboard] Session check error:", error);
        router.push("/trainer/login");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [router, fetchSession, setupJustCompleted]);

  // Fetch trainer profile picture and brand logo
  React.useEffect(() => {
    if (!session) return;
    fetch("/api/trainer/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.trainer?.profile_picture_url) {
          setTrainerImage(data.trainer.profile_picture_url);
        }
      })
      .catch(() => {});
    fetch("/api/brand/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.logo_url) {
          setBrandLogo(data.logo_url);
        }
      })
      .catch(() => {});
  }, [session]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/trainer/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleHelpClick = () => {
    console.log("[Dashboard] Switching to Ayuda y Soporte");
    handleSectionChange("ayuda");
  };

  const handleSectionChange = (key: string) => {
    // GUARD: Prevent switching to setup if onboarding is completed
    if (key === "setup" && session?.onboarding_completed) {
      console.log(
        "[Dashboard] BLOCKED: Cannot switch to setup - onboarding completed"
      );

      return;
    }

    console.log("[Dashboard] Switching section to:", key);
    setActiveSection(key);
    // Save to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("activeSection", key);
    }
  };

  // Restore active section on mount (with guards)
  React.useEffect(() => {
    // Don't restore if setup just completed
    if (setupJustCompleted) {
      console.log(
        "[TrainerDashboard] Skipping restoration - setup just completed"
      );

      return;
    }

    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("activeSection");

      if (saved) {
        // Don't restore "setup" if onboarding is completed
        if (saved === "setup" && session?.onboarding_completed) {
          console.log(
            "[TrainerDashboard] Prevented restoring 'setup' - onboarding completed"
          );
          localStorage.setItem("activeSection", "metricas");
          setActiveSection("metricas");

          return;
        }

        console.log("[TrainerDashboard] Restoring activeSection:", saved);
        setActiveSection(saved);
      }
    }
  }, [session, setupJustCompleted]);

  // Handle navigation for setup section
  React.useEffect(() => {
    // Skip if setup just completed - already handled
    if (setupJustCompleted) {
      console.log(
        "[TrainerDashboard] Skipping setup navigation - just completed"
      );

      return;
    }

    if (activeSection === "setup" && !isLoading && session) {
      // GUARD: If onboarding is completed, prevent navigation to setup
      if (session.onboarding_completed) {
        console.log(
          "[Dashboard] BLOCKED: Onboarding completed, cannot access setup"
        );
        setActiveSection("metricas");
        if (typeof window !== "undefined") {
          localStorage.setItem("activeSection", "metricas");
        }

        return;
      }

      // Only navigate if onboarding is NOT completed
      console.log("[Dashboard] Navigating to setup - onboarding not completed");
      router.push("/trainer/dashboard/setup");
    }
  }, [activeSection, isLoading, session, router, setupJustCompleted]);

  // Global realtime messages subscription for unread badge
  // Must be called unconditionally (before any early returns) per Rules of Hooks
  const { newMessageCount: globalUnreadMessages, clearNewMessages } =
    useRealtimeMessages({
      clientId: null,
      tenantSlug: session?.tenant_host ?? null,
      userId: session?.trainer_id ?? "",
      userType: "trainer",
    });

  // Clear the badge when the trainer opens the messaging section
  React.useEffect(() => {
    if (activeSection === "messaging") {
      clearNewMessages();
    }
  }, [activeSection, clearNewMessages]);

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

  if (!session) {
    return null; // Will redirect to login
  }

  // Filter sidebar items based on onboarding status + add messaging badge
  const filteredSidebarItems = dashboardSidebarItems
    .filter((item) => {
      if (item.key === "setup" && session.onboarding_completed) {
        return false;
      }

      return true;
    })
    .map((item) => {
      if (item.key === "messaging" && globalUnreadMessages > 0) {
        return {
          ...item,
          endContent: (
            <Chip
              className="h-5 min-w-5 px-1"
              color="primary"
              size="sm"
              variant="solid"
            >
              {globalUnreadMessages > 99 ? "99+" : globalUnreadMessages}
            </Chip>
          ),
        };
      }

      return item;
    });

  const renderContent = () => {
    switch (activeSection) {
      case "metricas":
        return <MetricasContent />;
      case "setup":
        // Navigation handled by useEffect
        return (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-default-500 font-body">
                Redirigiendo a configuración...
              </p>
            </div>
          </div>
        );
      case "clients":
        return <ClientsContent />;
      case "inventory":
        return <InventoryContent />;
      case "templates":
        return <TemplatesContent />;
      case "exercise-library":
        return <ExerciseLibraryContent />;
      case "messaging":
        return <MessagingContent />;
      case "ayuda":
        return <AyudaContent />;
      case "brand-settings":
        return (
          <SettingsContent
            onProfilePictureChange={(url) => setTrainerImage(url)}
          />
        );
      default:
        return <MetricasContent />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <TopNavigation
        activeSection={activeSection}
        brandLogo={brandLogo ?? ""}
        items={filteredSidebarItems}
        trainerEmail={session.email}
        trainerId={session.trainer_id}
        trainerImage={trainerImage ?? ""}
        trainerName={session.full_name || session.email}
        onHelpClick={handleHelpClick}
        onLogout={handleLogout}
        onSelect={handleSectionChange}
      />

      {/* Main Content */}
      <main className="flex-1 w-full overflow-hidden">{renderContent()}</main>

      {/* Floating Support Button */}
      <FloatingSupportButton />
    </div>
  );
}

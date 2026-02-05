"use client";

import { Button, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import ColorSetup from "@/components/setup-wizard/color-setup";
import DomainSetup from "@/components/setup-wizard/domain-setup";
import LivePreview from "@/components/setup-wizard/live-preview";
import LogoSetup from "@/components/setup-wizard/logo-setup";
import ReviewSetup from "@/components/setup-wizard/review-setup";
import TypographySetup from "@/components/setup-wizard/typography-setup";
import {
  SetupWizardProvider,
  useSetupWizard,
} from "@/lib/setup-wizard/context";

// Wizard steps configuration
const STEPS = [
  { key: 1, title: "Dominio", description: "Dirección web" },
  { key: 2, title: "Colores", description: "Paleta de marca" },
  { key: 3, title: "Logo", description: "Identidad visual" },
  { key: 4, title: "Tipografía", description: "Fuentes de texto" },
  { key: 5, title: "Revisar", description: "Confirmar cambios" },
];

function SetupWizardContent() {
  const { state } = useSetupWizard();
  const router = useRouter();

  const renderCurrentStep = () => {
    switch (state.currentStep) {
      case 1:
        return <DomainSetup />;
      case 2:
        return <ColorSetup />;
      case 3:
        return <LogoSetup />;
      case 4:
        return <TypographySetup />;
      case 5:
        return <ReviewSetup />;
      default:
        return <DomainSetup />;
    }
  };

  return (
    <div
      className="flex h-screen bg-gray-50 overflow-hidden"
      style={{ overscrollBehavior: "none" }}
    >
      {/* Left Side - Setup Wizard */}
      <div className="w-1/2 flex flex-col bg-white border-r border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-heading font-bold text-black">
                Configuración de Plataforma
              </h1>
              <p className="text-gray-600 font-body">
                Personaliza tu experiencia de coaching
              </p>
            </div>
            <Button
              isIconOnly
              variant="light"
              onPress={() => {
                // Clear localStorage to prevent redirect loop
                if (typeof window !== "undefined") {
                  localStorage.removeItem("activeSection");
                  localStorage.setItem("activeSection", "metricas");
                }
                // Use window.location with completion flag
                window.location.href = "/trainer/dashboard?setup=completed";
              }}
            >
              <Icon
                className="text-gray-500 text-xl"
                icon="solar:close-circle-linear"
              />
            </Button>
          </div>

          {/* Progress Indicator */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                Paso {state.currentStep} de {STEPS.length}
              </span>
              <span className="text-gray-600">
                {Math.round((state.currentStep / STEPS.length) * 100)}%
              </span>
            </div>
            <Progress
              className="w-full"
              value={(state.currentStep / STEPS.length) * 100}
            />
          </div>

          {/* Steps Navigation - 2 rows for better layout */}
          <div className="space-y-2 mt-4">
            {/* First row: Domain, Colors, Logo */}
            <div className="grid grid-cols-3 gap-2">
              {STEPS.slice(0, 3).map((step) => (
                <div
                  key={step.key}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    state.currentStep === step.key
                      ? "bg-slate-100 border border-slate-200"
                      : state.currentStep > step.key
                        ? "bg-green-50 border border-green-200"
                        : "bg-gray-50 border border-gray-200"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      state.currentStep === step.key
                        ? "bg-black text-white"
                        : state.currentStep > step.key
                          ? "bg-green-600 text-white"
                          : "bg-gray-300 text-gray-600"
                    }`}
                  >
                    {state.currentStep > step.key ? (
                      <Icon className="text-xs" icon="solar:check-linear" />
                    ) : (
                      step.key
                    )}
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium truncate ${
                        state.currentStep >= step.key
                          ? "text-black"
                          : "text-gray-500"
                      }`}
                    >
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {/* Second row: Typography, Review (centered) */}
            <div className="grid grid-cols-3 gap-2">
              {STEPS.slice(3).map((step) => (
                <div
                  key={step.key}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    state.currentStep === step.key
                      ? "bg-slate-100 border border-slate-200"
                      : state.currentStep > step.key
                        ? "bg-green-50 border border-green-200"
                        : "bg-gray-50 border border-gray-200"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      state.currentStep === step.key
                        ? "bg-black text-white"
                        : state.currentStep > step.key
                          ? "bg-green-600 text-white"
                          : "bg-gray-300 text-gray-600"
                    }`}
                  >
                    {state.currentStep > step.key ? (
                      <Icon className="text-xs" icon="solar:check-linear" />
                    ) : (
                      step.key
                    )}
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium truncate ${
                        state.currentStep >= step.key
                          ? "text-black"
                          : "text-gray-500"
                      }`}
                    >
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
              {/* Empty placeholder for visual balance */}
              <div />
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div
          className="flex-1 overflow-auto p-6"
          style={{ overscrollBehavior: "contain" }}
        >
          {renderCurrentStep()}
        </div>
      </div>

      {/* Right Side - Live Preview */}
      <div className="w-1/2 flex flex-col overflow-hidden">
        <LivePreview />
      </div>
    </div>
  );
}

// Main component with provider
export default function SetupWizardPage() {
  const [trainerSession, setTrainerSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if we just came from a completed setup (prevent redirect loop)
    const urlParams = new URLSearchParams(window.location.search);
    const justCompleted = urlParams.get("completed") === "true";

    // Get trainer session first
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then((res) => res.json())
      .then(async (sessionData) => {
        if (sessionData.session) {
          // Check if onboarding is already completed (but skip if we just completed it)
          if (sessionData.session.onboarding_completed && !justCompleted) {
            console.log(
              "[Setup Wizard] Onboarding already completed, redirecting to dashboard"
            );
            // Use window.location for hard redirect to ensure state is fresh
            window.location.href = "/trainer/dashboard?setup=completed";

            return;
          }

          // Try to get current configuration, but don't fail if it doesn't work
          try {
            const configResponse = await fetch("/api/setup/get-current-config");
            const configData = await configResponse.json();

            setTrainerSession({
              ...sessionData.session,
              config: configData.success ? configData.config : null,
            });
          } catch (error) {
            console.warn(
              "[Setup Wizard] Failed to load config, using defaults:",
              error
            );
            // Still set session even if config fails
            setTrainerSession(sessionData.session);
          }
        } else {
          router.push("/trainer/login");
        }
      })
      .catch(() => {
        router.push("/trainer/login");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-gray-500 font-body">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  if (!trainerSession) {
    return null;
  }

  const config = trainerSession.config;
  // Clean up any legacy .localhost suffix from the current slug
  const rawSlug =
    config?.domain?.current || trainerSession.tenant_host || "temp-slug";
  const currentSlug = rawSlug.replace(/\.localhost$/, "");
  const isConfigured = config?.domain?.isConfigured || false;

  const initialData = {
    domain: {
      current: currentSlug,
      desired: currentSlug,
      isAvailable: isConfigured ? true : null, // If already configured, mark as available
      isChecking: false,
      suggestions: [],
    },
    logo: {
      file: null,
      url: config?.theme?.meta?.logoUrl || null,
      text:
        config?.theme?.meta?.logoText ||
        config?.trainer?.fullName ||
        trainerSession.full_name ||
        "MI MARCA",
      position:
        (config?.theme?.logo?.position as "left" | "center" | "right") ||
        "left",
      size:
        (config?.theme?.logo?.size as "small" | "medium" | "large") || "medium",
    },
    // Initialize colors from existing theme or use defaults
    colors: {
      primary: config?.theme?.colors?.brand || "#0f172a",
      secondary: config?.theme?.colors?.secondary || "#334155",
      text: config?.theme?.colors?.text || {
        h1: "#1f2937",
        h2: "#374151",
        h3: "#4b5563",
        body: "#6b7280",
        muted: "#9ca3af",
      },
      background: config?.theme?.colors?.background || {
        primary: "#ffffff",
        secondary: "#f9fafb",
        accent: "#f3f4f6",
      },
      surface: config?.theme?.colors?.surface || {
        "1": "#ffffff",
        "2": "#f8fafc",
        "3": "#f1f5f9",
      },
      buttons: config?.theme?.colors?.buttons || {
        primary: { bg: "#0f172a", text: "#ffffff", hover: "#1e293b" },
        secondary: { bg: "#f3f4f6", text: "#374151", hover: "#e5e7eb" },
      },
      shadows: config?.theme?.colors?.shadows || {
        light: "rgba(0, 0, 0, 0.05)",
        medium: "rgba(0, 0, 0, 0.1)",
        dark: "rgba(0, 0, 0, 0.25)",
      },
      semantic: config?.theme?.colors?.semantic || {
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
    },
  };

  return (
    <SetupWizardProvider initialData={initialData}>
      <SetupWizardContent />
    </SetupWizardProvider>
  );
}

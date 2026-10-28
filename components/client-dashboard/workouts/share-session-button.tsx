"use client";

// Botón "Compartir" (banner de sesión completada y registro de cada
// ejercicio). Abre la pantalla estilo Strava donde el cliente compone su
// imagen; el entrenador puede desactivarla en Ajustes → Marca.

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { ShareScreen } from "./share-screen";

import { useTenant } from "@/components/tenant-provider";
import { shareCardSettingsFromFeatures } from "@/lib/share-card/settings";

interface ShareSessionButtonProps {
  scheduledDate: string;
  sessionId: string;
  /** Desde un ejercicio: abre en "Un ejercicio" con ese ejercicio. */
  exerciseId?: string | null;
  label?: string;
  variant?: "primary" | "subtle";
}

export function ShareSessionButton({
  scheduledDate,
  sessionId,
  exerciseId = null,
  label = "Compartir",
  variant = "primary",
}: ShareSessionButtonProps) {
  const enabled = shareCardSettingsFromFeatures(useTenant()?.features).enabled;
  const [isOpen, setIsOpen] = useState(false);

  if (!enabled) return null;

  return (
    <>
      <Button
        className={
          variant === "primary"
            ? "h-9 px-3.5 text-sm font-semibold"
            : "h-10 bg-transparent text-sm font-semibold text-foreground"
        }
        color={variant === "primary" ? "primary" : "default"}
        radius="full"
        startContent={<Icon icon="solar:share-linear" width={18} />}
        variant={variant === "primary" ? "solid" : "light"}
        onPress={() => setIsOpen(true)}
      >
        {label}
      </Button>
      <ShareScreen
        initialExerciseId={exerciseId}
        initialScope={exerciseId ? "exercise" : "session"}
        isOpen={isOpen}
        scheduledDate={scheduledDate}
        sessionId={sessionId}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

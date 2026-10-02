// Cierre de sesión (fase 3b): tarjeta de marca con el resumen y "Compartir"
// como acción principal. Mismo lenguaje visual que el check-in de Inicio:
// superficie bg-primary, tile bg-primary-foreground/15 y CTA invertido.

import type { ReactNode } from "react";
import type { SessionSummary } from "./session-summary";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";

import { ShareSessionButton } from "./share-session-button";

// Por encima de modales/popovers (react-aria usa z-index 100000 inline).
const CONFETTI_Z_INDEX = 100060;

async function fireConfetti(): Promise<void> {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { default: confetti } = await import("canvas-confetti");

  void confetti({
    disableForReducedMotion: true,
    zIndex: CONFETTI_Z_INDEX,
    origin: { x: 0.5, y: 1 },
    particleCount: 110,
    spread: 80,
    startVelocity: 48,
  });
}

interface Props {
  completed: number;
  total: number;
  summary: SessionSummary;
  /** true solo al completar durante esta visita: entrada + confeti. */
  celebrate: boolean;
  scheduledDate: string;
  sessionId: string;
  sessionName: string;
  /** "Deshacer" (solo completado manual); null si no aplica. */
  undo: ReactNode;
}

export function SessionSummaryCard({
  completed,
  total,
  summary,
  celebrate,
  scheduledDate,
  sessionId,
  sessionName,
  undo,
}: Props) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (celebrate) void fireConfetti();
  }, [celebrate]);

  const tiles: Array<{ value: string; label: string }> = [];

  if (total > 0) {
    tiles.push({ value: `${completed}/${total}`, label: "Ejercicios" });
  }
  if (summary.sets > 0) {
    tiles.push({ value: String(summary.sets), label: "Series" });
  }
  if (summary.volumeKg > 0) {
    tiles.push({
      value: summary.volumeKg.toLocaleString("es"),
      label: "Volumen (kg)",
    });
  }
  if (summary.durationMinutes !== null) {
    tiles.push({ value: `${summary.durationMinutes} min`, label: "Duración" });
  }

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="rounded-large bg-primary p-5 text-primary-foreground shadow-medium"
      initial={
        celebrate && !reduceMotion ? { opacity: 0, scale: 0.94, y: 8 } : false
      }
      role="status"
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-primary-foreground/15">
          <Icon aria-hidden icon="solar:medal-ribbon-star-bold" width={22} />
        </div>
        <h2 className="min-w-0 font-heading text-xl leading-tight">
          ¡Sesión completada!
        </h2>
      </div>

      {tiles.length > 0 ? (
        <dl
          className={`mt-4 grid gap-2 ${
            tiles.length === 3
              ? "grid-cols-3"
              : tiles.length === 4
                ? "grid-cols-2 sm:grid-cols-4"
                : "grid-cols-2"
          }`}
        >
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="flex min-w-0 flex-col-reverse rounded-medium bg-primary-foreground/10 px-2 py-2.5 text-center"
            >
              <dt className="text-xs text-primary-foreground/80">
                {tile.label}
              </dt>
              <dd className="truncate font-heading text-lg leading-tight">
                {tile.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <ShareSessionButton
        scheduledDate={scheduledDate}
        sessionId={sessionId}
        sessionName={sessionName}
        trigger={(open) => (
          <Button
            className="mt-4 w-full bg-primary-foreground font-semibold text-[hsl(var(--heroui-primary))]"
            startContent={<Icon icon="solar:share-linear" width={18} />}
            onPress={open}
          >
            Compartir
          </Button>
        )}
      />

      {undo ? <div className="mt-2 flex justify-center">{undo}</div> : null}
    </motion.div>
  );
}

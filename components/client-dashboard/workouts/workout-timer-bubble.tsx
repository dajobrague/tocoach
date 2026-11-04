"use client";

// Burbuja flotante de cronómetro + descanso (pedida por Jose Carlos y varios
// usuarios). Vive mientras el cliente está dentro del entreno activo: la
// pantalla de sesión y las de registro de ejercicio que se apilan encima
// (ambas ClientScreen z-[60]). Por debajo de las hojas (ClientSheet z-[70]).
//
// - Cronómetro de sesión: desde la hora de inicio declarada en el servidor
//   (ver lib/training/workout-timer.ts). Pausar/reanudar es local.
// - Descanso: 1:00 / 1:30 / 2:00 / 3:00 y +15 s; al terminar vibra (si el
//   dispositivo puede) y lo anuncia por una región viva.

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  type WorkoutTimerLocal,
  EMPTY_TIMER_LOCAL,
  REST_EXTEND_SECONDS,
  REST_PRESETS_SECONDS,
  clearRest,
  elapsedMs,
  extendRest,
  formatClock,
  parseTimerLocal,
  pauseTimer,
  restPhase,
  resumeTimer,
  sessionStartMs,
  startRest,
  timerStorageKey,
} from "@/lib/training/workout-timer";

interface Props {
  clientId: string;
  scheduledDate: string;
  sessionId: string;
  /** Hora de inicio declarada ("HH:MM") o null si aún no empezó. */
  startTime: string | null;
}

function readLocal(key: string): WorkoutTimerLocal {
  try {
    return parseTimerLocal(window.localStorage.getItem(key));
  } catch {
    return EMPTY_TIMER_LOCAL;
  }
}

function writeLocal(key: string, value: WorkoutTimerLocal) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Modo privado / almacenamiento bloqueado: el estado vive en memoria.
  }
}

export function WorkoutTimerBubble({
  clientId,
  scheduledDate,
  sessionId,
  startTime,
}: Props) {
  const storageKey = timerStorageKey(clientId, scheduledDate, sessionId);
  const [local, setLocal] = useState<WorkoutTimerLocal>(EMPTY_TIMER_LOCAL);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const notifiedRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
    setLocal(readLocal(storageKey));
  }, [storageKey]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);

    return () => window.clearInterval(id);
  }, []);

  const update = useCallback(
    (fn: (prev: WorkoutTimerLocal, now: number) => WorkoutTimerLocal) => {
      const t = Date.now();

      setNow(t);
      setLocal((prev) => {
        const next = fn(prev, t);

        writeLocal(storageKey, next);

        return next;
      });
    },
    [storageKey]
  );

  const startMs = sessionStartMs(scheduledDate, startTime);
  const elapsed = startMs !== null ? elapsedMs(startMs, local, now) : null;
  const paused = local.pausedAt !== null;
  const rest = restPhase(local, now);

  // Fin del descanso: vibración una vez por descanso, y solo si acaba de
  // terminar (al recargar minutos después no vibra a destiempo).
  useEffect(() => {
    if (rest.kind !== "finished" || local.restEndsAt === null) return;
    if (notifiedRef.current === local.restEndsAt) return;
    notifiedRef.current = local.restEndsAt;
    if (now - local.restEndsAt > 5000) return;
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      // Sin soporte de vibración (iOS Safari): queda el aviso visual.
    }
  }, [rest.kind, local.restEndsAt, now]);

  // Esc cierra el panel sin cerrar también la pantalla de sesión (que
  // escucha Esc en window, fase de burbuja).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };

    window.addEventListener("keydown", onKey, true);

    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  if (!mounted) return null;

  const elapsedLabel = elapsed !== null ? formatClock(elapsed) : null;
  const restLabel =
    rest.kind === "running" ? formatClock(rest.remainingMs, true) : null;

  const bubbleAria =
    rest.kind === "finished"
      ? "Descanso terminado. Pulsa para quitar el aviso"
      : rest.kind === "running"
        ? `Descanso: quedan ${restLabel}. ${open ? "Cerrar" : "Abrir"} controles`
        : elapsedLabel !== null
          ? `Entreno: ${elapsedLabel}${paused ? ", en pausa" : ""}. ${open ? "Cerrar" : "Abrir"} controles`
          : `Temporizador de descanso. ${open ? "Cerrar" : "Abrir"} controles`;

  const onBubblePress = () => {
    if (rest.kind === "finished") {
      update((prev) => clearRest(prev));

      return;
    }
    setOpen((v) => !v);
  };

  return createPortal(
    <div className="pointer-events-none fixed right-3 top-[calc(env(safe-area-inset-top)+60px)] z-[65] flex flex-col items-end gap-2">
      <button
        ref={buttonRef}
        aria-controls={open ? panelId : undefined}
        aria-expanded={rest.kind === "finished" ? undefined : open}
        aria-label={bubbleAria}
        className={`pointer-events-auto flex h-11 min-w-11 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-semibold tabular-nums shadow-medium transition-transform active:scale-[0.97] motion-reduce:transform-none ${
          rest.kind === "finished"
            ? "bg-primary text-primary-foreground"
            : "bg-content1 text-foreground ring-1 ring-default-200"
        }`}
        type="button"
        onClick={onBubblePress}
      >
        {rest.kind === "finished" ? (
          <>
            <Icon aria-hidden icon="solar:bell-bing-bold" width={18} />
            Descanso terminado
          </>
        ) : rest.kind === "running" ? (
          <>
            <Icon
              aria-hidden
              className="text-primary"
              icon="solar:hourglass-line-linear"
              width={18}
            />
            <span className="text-primary">{restLabel}</span>
          </>
        ) : elapsedLabel !== null ? (
          <>
            <Icon
              aria-hidden
              className={paused ? "text-default-400" : "text-primary"}
              icon={
                paused ? "solar:pause-circle-linear" : "solar:stopwatch-linear"
              }
              width={18}
            />
            <span className={paused ? "text-default-500" : undefined}>
              {elapsedLabel}
            </span>
          </>
        ) : (
          <>
            <Icon
              aria-hidden
              className="text-primary"
              icon="solar:hourglass-line-linear"
              width={18}
            />
            Descanso
          </>
        )}
      </button>

      {open && rest.kind !== "finished" ? (
        <div
          aria-label="Cronómetro y descanso"
          className="pointer-events-auto w-64 space-y-4 rounded-large bg-content1 p-4 shadow-large ring-1 ring-default-200"
          id={panelId}
          role="group"
        >
          {elapsedLabel !== null ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-default-500">Entreno</p>
                <p className="font-heading text-2xl tabular-nums text-foreground">
                  {elapsedLabel}
                </p>
              </div>
              <Button
                aria-label={
                  paused ? "Reanudar cronómetro" : "Pausar cronómetro"
                }
                radius="full"
                size="sm"
                startContent={
                  <Icon
                    aria-hidden
                    icon={paused ? "solar:play-bold" : "solar:pause-bold"}
                    width={16}
                  />
                }
                variant="flat"
                onPress={() =>
                  update((prev, t) =>
                    prev.pausedAt === null
                      ? pauseTimer(prev, t)
                      : resumeTimer(prev, t)
                  )
                }
              >
                {paused ? "Reanudar" : "Pausar"}
              </Button>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs text-default-500">Descanso</p>
            {rest.kind === "running" ? (
              <div className="flex items-center justify-between gap-2">
                <p className="font-heading text-3xl tabular-nums text-primary">
                  {restLabel}
                </p>
                <div className="flex gap-1.5">
                  <Button
                    aria-label={`Añadir ${REST_EXTEND_SECONDS} segundos`}
                    radius="full"
                    size="sm"
                    variant="flat"
                    onPress={() => update((prev, t) => extendRest(prev, t))}
                  >
                    +{REST_EXTEND_SECONDS} s
                  </Button>
                  <Button
                    radius="full"
                    size="sm"
                    variant="light"
                    onPress={() => update((prev) => clearRest(prev))}
                  >
                    Parar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {REST_PRESETS_SECONDS.map((sec) => (
                  <Button
                    key={sec}
                    aria-label={`Descanso de ${formatClock(sec * 1000)}`}
                    className="min-w-0 px-0 tabular-nums"
                    radius="lg"
                    size="sm"
                    variant="flat"
                    onPress={() => update((prev, t) => startRest(prev, sec, t))}
                  >
                    {formatClock(sec * 1000)}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <span aria-live="assertive" className="sr-only" role="status">
        {rest.kind === "finished" ? "Descanso terminado" : ""}
      </span>
    </div>,
    document.body
  );
}

// Píldora flotante del descanso, anclada sobre el footer del modal.
// Marca sólida (bg-primary + foreground calculado): es la única pieza
// "viva" de la pantalla mientras el cliente recupera entre series.

"use client";

import { Icon } from "@iconify/react";

import { formatCountdown, type RestTimer } from "./hooks/use-rest-timer";

const PILL_BUTTON =
  "min-h-11 rounded-full bg-primary-foreground/15 px-3 text-sm font-medium transition-colors hover:bg-primary-foreground/25";

export function RestTimerPill({ timer }: { timer: RestTimer }) {
  const visible = timer.isRunning || timer.isFinished;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-4">
      {/* Solo se anuncia el final: el conteo segundo a segundo sería ruido. */}
      <p aria-live="polite" className="sr-only">
        {timer.isFinished ? "Descanso terminado. ¡A por la siguiente!" : ""}
      </p>

      {visible ? (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-primary py-1.5 pl-4 pr-1.5 text-primary-foreground shadow-medium">
          {timer.isRunning ? (
            <>
              <Icon aria-hidden icon="solar:clock-circle-bold" width={18} />
              <span className="text-sm">Descanso</span>
              <span
                className="min-w-[3.5rem] text-lg font-semibold tabular-nums font-heading"
                role="timer"
              >
                {formatCountdown(timer.remainingMs)}
              </span>
              <button
                aria-label="Añadir 15 segundos de descanso"
                className={PILL_BUTTON}
                type="button"
                onClick={() => timer.addSeconds(15)}
              >
                +15 s
              </button>
              <button
                className={PILL_BUTTON}
                type="button"
                onClick={timer.stop}
              >
                Saltar
              </button>
            </>
          ) : (
            <p className="flex min-h-11 items-center gap-2 pr-3 text-sm font-semibold">
              <Icon aria-hidden icon="solar:check-circle-bold" width={18} />
              ¡A por la siguiente!
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

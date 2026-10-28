"use client";

import { Icon } from "@iconify/react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { lockBodyScroll } from "@/lib/ui/scroll-lock";

interface ClientScreenProps {
  isOpen: boolean;
  onClose: () => void;
  /** Título centrado en la barra. Omitir con `bar={false}`. */
  title?: string;
  /** Texto del botón de volver (por defecto "Atrás"). */
  backLabel?: string;
  /**
   * `false` para pantallas que pintan su propia cabecera (p. ej. una foto a
   * sangre con el botón de volver flotando encima).
   */
  bar?: boolean;
  /** Barra fija inferior (acciones). Respeta el safe area. */
  footer?: ReactNode;
  /** Esc cierra la pantalla (desactivar si hay visores encima que lo usan). */
  closeOnEscape?: boolean;
  ariaLabel?: string;
  /** El contenido ocupa todo el alto disponible (pantallas sin scroll). */
  fill?: boolean;
  children: ReactNode;
}

const EASE = [0.32, 0.72, 0, 1] as const;

/**
 * Pantalla "push" del portal, estilo iOS: entra desde la derecha a pantalla
 * completa y sale por el mismo camino. Para navegar a un detalle (sesión,
 * ejercicio, receta, chat). Las hojas inferiores siguen siendo ClientSheet.
 *
 * z-[60]: por encima de la barra inferior (z-50); por debajo de los visores
 * de vídeo (z-[9999] / z-[100050]) y de los popovers de HeroUI.
 */
export function ClientScreen({
  isOpen,
  onClose,
  title,
  backLabel = "Atrás",
  bar = true,
  footer,
  closeOnEscape = true,
  ariaLabel,
  fill = false,
  children,
}: ClientScreenProps) {
  const onCloseRef = useRef(onClose);

  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;
    const unlock = lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === "Escape") onCloseRef.current();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, closeOnEscape]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="client-screen"
            animate={{ x: 0 }}
            aria-label={ariaLabel ?? title}
            aria-modal="true"
            className="fixed inset-0 z-[60] flex h-[100dvh] flex-col bg-background shadow-[-10px_0_30px_rgba(0,0,0,0.12)]"
            exit={{ x: "100%" }}
            initial={{ x: "100%" }}
            role="dialog"
            transition={{ duration: 0.46, ease: EASE }}
          >
            {bar ? (
              <div className="z-10 shrink-0 bg-background/80 pt-[env(safe-area-inset-top)] shadow-[0_1px_0_hsl(var(--heroui-default-200))] backdrop-blur-xl backdrop-saturate-150">
                <div className="mx-auto grid h-[52px] max-w-lg grid-cols-[1fr_auto_1fr] items-center px-1">
                  <button
                    className="flex h-11 items-center gap-0.5 justify-self-start rounded-medium pl-1 pr-2.5 text-base font-medium text-primary active:opacity-60"
                    type="button"
                    onClick={onClose}
                  >
                    <Icon
                      className="text-2xl"
                      icon="solar:alt-arrow-left-linear"
                    />
                    {backLabel}
                  </button>
                  <h2 className="max-w-[12rem] truncate text-base font-semibold text-foreground">
                    {title}
                  </h2>
                  <span />
                </div>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className={`mx-auto max-w-lg ${fill ? "h-full" : ""}`}>
                {children}
              </div>
            </div>

            {footer ? (
              <div className="shrink-0 bg-background/90 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-1px_0_hsl(var(--heroui-default-200))] backdrop-blur-xl">
                <div className="mx-auto max-w-lg px-4 pt-3">{footer}</div>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </MotionConfig>,
    document.body
  );
}

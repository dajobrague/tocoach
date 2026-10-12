"use client";

import type { ModalProps } from "@heroui/react";

import { Modal } from "@heroui/react";
import { useRef } from "react";

/**
 * Overlay único del portal de cliente: hoja inferior en móvil (a ras del
 * borde, pulgar-alcanzable, sin márgenes laterales) y diálogo centrado
 * desde `sm`. Es el Modal de HeroUI con placement "auto" (su default:
 * items-end en móvil, centrado en sm+) más las clases de hoja.
 *
 * Úsalo con ModalContent/ModalHeader/ModalBody/ModalFooter como siempre, y
 * pon <ClientSheetGrabber onClose={onClose} /> como primer hijo de
 * ModalContent para el asa que se arrastra hacia abajo para cerrar.
 * Para visores de foto/vídeo a pantalla completa no aplica; para navegar a
 * un detalle usa ClientScreen.
 */
export function ClientSheet({ classNames, ...props }: ModalProps) {
  return (
    <Modal
      placement="auto"
      scrollBehavior="inside"
      {...props}
      classNames={{
        ...classNames,
        // Above ClientScreen (z-[60]): sheets opened from a pushed screen
        // (compartir, agregar ejercicio…) must not render behind it.
        wrapper: `z-[70] ${classNames?.wrapper ?? ""}`,
        backdrop: `z-[70] ${classNames?.backdrop ?? ""}`,
        base: `m-0 max-h-[90dvh] rounded-b-none rounded-t-[24px] pb-[env(safe-area-inset-bottom)] sm:m-auto sm:rounded-b-large sm:rounded-t-large sm:pb-0 ${classNames?.base ?? ""}`,
      }}
    />
  );
}

/**
 * Asa de la hoja: arrastre 1:1 hacia abajo (con resistencia hacia arriba) y
 * cierre por distancia o velocidad al soltar, como las hojas de iOS. Solo en
 * móvil; desde `sm` la hoja es un diálogo y el asa se oculta.
 */
export function ClientSheetGrabber({ onClose }: { onClose: () => void }) {
  const drag = useRef<{
    y0: number;
    last: number;
    t: number;
    v: number;
  } | null>(null);

  const sheetOf = (el: Element) =>
    el.closest<HTMLElement>("section[role='dialog'], [role='dialog']");

  return (
    <div
      aria-hidden
      className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center sm:hidden"
      onPointerCancel={(e) => {
        const sheet = sheetOf(e.currentTarget);

        if (sheet) {
          sheet.style.transition = "";
          sheet.style.transform = "";
        }
        drag.current = null;
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = {
          y0: e.clientY,
          last: e.clientY,
          t: performance.now(),
          v: 0,
        };
        const sheet = sheetOf(e.currentTarget);

        if (sheet) sheet.style.transition = "none";
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        const sheet = sheetOf(e.currentTarget);

        if (!d || !sheet) return;
        const now = performance.now();
        const dy = e.clientY - d.y0;

        d.v = ((e.clientY - d.last) / Math.max(1, now - d.t)) * 1000;
        d.last = e.clientY;
        d.t = now;
        sheet.style.transform = `translateY(${dy < 0 ? -Math.sqrt(-dy) * 2 : dy}px)`;
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        const sheet = sheetOf(e.currentTarget);

        drag.current = null;
        if (!d || !sheet) return;
        const dy = e.clientY - d.y0;

        sheet.style.transition = "transform 360ms cubic-bezier(0.32,0.72,0,1)";
        if (d.v > 600 || dy > sheet.offsetHeight * 0.3) {
          sheet.style.transform = "translateY(105%)";
          window.setTimeout(onClose, 200);
        } else {
          sheet.style.transform = "";
        }
      }}
    >
      <span className="h-[5px] w-9 rounded-full bg-default-300" />
    </div>
  );
}

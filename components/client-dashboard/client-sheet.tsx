"use client";

import type { ModalProps } from "@heroui/react";

import { Modal } from "@heroui/react";

/**
 * Overlay único del portal de cliente: hoja inferior en móvil (a ras del
 * borde, pulgar-alcanzable, sin márgenes laterales) y diálogo centrado
 * desde `sm`. Es el Modal de HeroUI con placement "auto" (su default:
 * items-end en móvil, centrado en sm+) más las clases de hoja.
 *
 * Úsalo con ModalContent/ModalHeader/ModalBody/ModalFooter como siempre.
 * Para visores de foto/vídeo a pantalla completa no aplica.
 */
export function ClientSheet({ classNames, ...props }: ModalProps) {
  return (
    <Modal
      placement="auto"
      scrollBehavior="inside"
      {...props}
      classNames={{
        ...classNames,
        base: `m-0 max-h-[90dvh] rounded-b-none pb-[env(safe-area-inset-bottom)] sm:m-auto sm:rounded-b-large sm:pb-0 ${classNames?.base ?? ""}`,
      }}
    />
  );
}

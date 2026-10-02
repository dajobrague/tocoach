// Cabecera compacta del modal de registro: miniatura (tap → imagen en
// grande), nombre, chip del vídeo del entrenador y cerrar. Sustituye al
// hero de 33vh: en el gimnasio, a una mano, los inputs van primero.

"use client";

import { Button, ModalBody, ModalContent } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { TrainerVideoBanner } from "./trainer-video-banner";

import { ClientSheet } from "@/components/client-dashboard/client-sheet";

interface Props {
  name: string;
  imageUrl: string | null;
  trainerVideoUrl: string | null;
  onClose: () => void;
}

export function ExerciseLogHeader({
  name,
  imageUrl,
  trainerVideoUrl,
  onClose,
}: Props) {
  const [imageOpen, setImageOpen] = useState(false);

  return (
    <div className="flex items-start gap-3 border-b border-default-200 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {imageUrl ? (
        <button
          aria-label="Ver imagen del ejercicio"
          className="h-14 w-14 shrink-0 overflow-hidden rounded-medium bg-default-100"
          type="button"
          onClick={() => setImageOpen(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className="h-full w-full object-cover"
            decoding="async"
            src={imageUrl}
          />
        </button>
      ) : (
        <div
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-medium bg-default-100 text-default-400"
        >
          <Icon icon="solar:dumbbell-linear" width={26} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
        <h2 className="line-clamp-2 text-lg font-heading leading-tight text-foreground">
          {name}
        </h2>
        {trainerVideoUrl ? (
          <TrainerVideoBanner videoUrl={trainerVideoUrl} />
        ) : null}
      </div>

      <Button
        isIconOnly
        aria-label="Cerrar"
        className="-mr-2 shrink-0"
        radius="full"
        variant="light"
        onPress={onClose}
      >
        <Icon icon="solar:close-circle-linear" width={26} />
      </Button>

      {imageUrl ? (
        <ClientSheet isOpen={imageOpen} onOpenChange={setImageOpen}>
          <ModalContent>
            <ModalBody className="p-2 pt-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={name}
                className="max-h-[75dvh] w-full rounded-medium object-contain"
                src={imageUrl}
              />
            </ModalBody>
          </ModalContent>
        </ClientSheet>
      ) : null}
    </div>
  );
}

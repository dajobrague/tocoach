"use client";

// Modal de novedades de varias páginas: sale la primera vez que el
// entrenador entra tras una actualización y no vuelve al cerrarlo.
// ponytail: visto en localStorage (por dispositivo); pasar a la BD si JC
// necesita que no reaparezca al cambiar de dispositivo.

import { Button, Modal, ModalBody, ModalContent } from "@heroui/react";
import { useEffect, useState } from "react";

import { LATEST_RELEASE } from "./releases";

import { IconTile } from "@/components/shared/icon-tile";

const SEEN_KEY = "topcoach:trainer:whats-new-seen";

export function WhatsNewModal() {
  const { id, pages } = LATEST_RELEASE;
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let seen: string | null = null;

    try {
      seen = localStorage.getItem(SEEN_KEY);
    } catch {
      return; // Sin almacenamiento no podemos recordar: mejor no mostrarlo.
    }
    if (seen === id) return;
    const t = window.setTimeout(() => setOpen(true), 700);

    return () => window.clearTimeout(t);
  }, [id]);

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, id);
    } catch {
      // ignore
    }
    setOpen(false);
  };

  const page = pages[index];

  if (!page) return null;
  const last = index === pages.length - 1;

  return (
    <Modal isOpen={open} placement="center" size="md" onClose={close}>
      <ModalContent>
        <ModalBody className="gap-0 px-6 pb-6 pt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Novedades
          </p>
          <div className="mt-4 flex min-h-[176px] flex-col items-start gap-4">
            <IconTile icon={page.icon} />
            <h2 className="text-xl font-semibold leading-tight text-foreground [text-wrap:balance]">
              {page.title}
            </h2>
            <p className="text-sm text-default-600">{page.text}</p>
          </div>
          <div className="mt-6 flex items-center justify-between gap-3">
            <div aria-hidden className="flex gap-1.5">
              {pages.map((p, i) => (
                <span
                  key={p.title}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-5 bg-primary" : "w-1.5 bg-default-300"
                  }`}
                />
              ))}
            </div>
            <span className="sr-only">
              {`Página ${index + 1} de ${pages.length}`}
            </span>
            <div className="flex gap-2">
              {index > 0 ? (
                <Button variant="light" onPress={() => setIndex(index - 1)}>
                  Atrás
                </Button>
              ) : null}
              <Button
                color="primary"
                onPress={() => (last ? close() : setIndex(index + 1))}
              >
                {last ? "Entendido" : "Siguiente"}
              </Button>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

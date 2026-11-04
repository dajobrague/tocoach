"use client";

// Novedades tras una actualización: sale una vez por versión y no vuelve al
// cerrarlo. Este archivo solo decide si toca; el diálogo (con el cuerpo, los
// clips y el sticker) se carga aparte para no pesar en el resto del panel.
// ponytail: visto en localStorage (por dispositivo); pasar a la BD si JC
// necesita que no reaparezca al cambiar de dispositivo.

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { LATEST_RELEASE } from "./releases";

const WhatsNewDialog = dynamic(() => import("./whats-new-dialog"), {
  ssr: false,
});

const SEEN_KEY = "topcoach:trainer:whats-new-seen";

export function WhatsNewModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen: string | null;

    try {
      seen = localStorage.getItem(SEEN_KEY);
    } catch {
      return; // Sin almacenamiento no podemos recordarlo: mejor no mostrarlo.
    }
    if (seen === LATEST_RELEASE.id) return;
    // Un respiro tras cargar: que no salte encima de la página.
    const t = window.setTimeout(() => setOpen(true), 900);

    return () => window.clearTimeout(t);
  }, []);

  if (!open) return null;

  return (
    <WhatsNewDialog
      release={LATEST_RELEASE}
      onClose={() => {
        try {
          localStorage.setItem(SEEN_KEY, LATEST_RELEASE.id);
        } catch {
          // ignore
        }
        setOpen(false);
      }}
    />
  );
}

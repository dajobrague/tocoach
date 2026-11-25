"use client";

// Pantalla de las secciones de plan (entrenamiento, nutrición…) mientras el
// entrenador no ha dado acceso al cliente. Ver clients.portal_locked.

import { Icon } from "@iconify/react";
import Link from "next/link";

export function PortalLockedScreen({ tenantSlug }: { tenantSlug: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <Icon
        aria-hidden
        className="text-default-400"
        icon="solar:hourglass-linear"
        width={40}
      />
      <h1 className="text-[20px] font-semibold text-foreground">
        Tu plan está en preparación
      </h1>
      <p className="max-w-xs text-[15px] leading-snug text-default-500">
        Tu entrenador te dará acceso en cuanto lo tenga listo.
      </p>
      <Link
        className="mt-2 rounded-full bg-default-100 px-5 py-2.5 text-[15px] font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
        href={`/${tenantSlug}/dashboard`}
      >
        Volver a Inicio
      </Link>
    </main>
  );
}

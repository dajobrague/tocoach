"use client";

import type { ReactNode } from "react";

import { ClientHeader } from "./client-header";

interface ClientPageProps {
  /** Título de la pestaña. Omitirlo solo en Inicio (banda de marca). */
  title?: string;
  /** Solo Inicio: contenido que prolonga la banda de marca (ver ClientHeader). */
  heroExtension?: ReactNode;
  children: ReactNode;
  onOpenWeeklyForm?: () => void;
  onOpenDailyForm?: () => void;
}

/**
 * Marco único de cada pestaña del portal: cabecera + columna de contenido.
 * El ancho, el fondo y el hueco para la barra inferior viven aquí para que
 * ninguna página vuelva a elegir los suyos.
 */
export function ClientPage({
  title,
  heroExtension,
  children,
  onOpenWeeklyForm,
  onOpenDailyForm,
}: ClientPageProps) {
  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="mx-auto max-w-lg">
        <ClientHeader
          heroExtension={heroExtension}
          title={title}
          {...(onOpenWeeklyForm ? { onOpenWeeklyForm } : {})}
          {...(onOpenDailyForm ? { onOpenDailyForm } : {})}
        />
        {children}
      </div>
    </div>
  );
}

/** Encabezado de sección: sentence case, fuente de títulos del entrenador. */
export function SectionHeader({
  title,
  action,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-3 flex items-center justify-between gap-3 ${className}`}
    >
      <h2 className="font-heading text-lg text-foreground">{title}</h2>
      {action}
    </div>
  );
}

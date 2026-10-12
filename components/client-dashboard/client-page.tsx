"use client";

import type { ReactNode } from "react";

import { useClientData } from "./client-data-provider";
import { ClientHeader } from "./client-header";

interface ClientPageProps {
  /** Título grande de la pantalla. Omitirlo solo en Inicio: saluda al cliente. */
  title?: string;
  /** Línea pequeña sobre el título (Inicio: la fecha de hoy). */
  subtitle?: string;
  /** Pantallas abiertas desde "Más": Atrás en la barra en lugar del logo. */
  showBack?: boolean;
  /** Contenido justo bajo el título (Inicio: el check-in pendiente). */
  heroExtension?: ReactNode;
  children: ReactNode;
  onOpenWeeklyForm?: () => void;
  onOpenDailyForm?: () => void;
}

/**
 * Marco único de cada pestaña del portal, estilo iOS: barra superior que se
 * compacta al hacer scroll + título grande + columna de contenido. El ancho,
 * el fondo y el hueco para la barra inferior viven aquí para que ninguna
 * página vuelva a elegir los suyos.
 */
export function ClientPage({
  title,
  subtitle,
  showBack = false,
  heroExtension,
  children,
  onOpenWeeklyForm,
  onOpenDailyForm,
}: ClientPageProps) {
  const { firstName } = useClientData();
  const isHome = !title;
  const heading = title ?? (firstName ? `Hola, ${firstName}` : "Hola");
  const small = subtitle ?? (isHome ? todayLabel() : undefined);

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="mx-auto max-w-lg">
        <ClientHeader
          collapsing
          showBack={showBack}
          title={heading}
          {...(onOpenWeeklyForm ? { onOpenWeeklyForm } : {})}
          {...(onOpenDailyForm ? { onOpenDailyForm } : {})}
        />
        <div className="px-4 pb-5 pt-1">
          {small ? (
            <p className="text-[15px] font-medium text-default-500">{small}</p>
          ) : null}
          <h1 className="font-heading text-[34px] leading-[1.05] tracking-[-0.025em] text-foreground [text-wrap:balance]">
            {heading}
          </h1>
        </div>
        {heroExtension ? (
          <div className="px-4 pb-6">{heroExtension}</div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

function todayLabel(): string {
  const label = new Date()
    .toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "short",
    })
    .replace(".", "");

  return label.charAt(0).toUpperCase() + label.slice(1);
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
      <h2 className="font-heading text-[22px] leading-tight tracking-[-0.015em] text-foreground">
        {title}
      </h2>
      {action}
    </div>
  );
}

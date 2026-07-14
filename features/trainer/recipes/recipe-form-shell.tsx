"use client";

import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";

const RECIPES_PATH = "/trainer/dashboard/recipes";

/** Sticky page chrome (back button + breadcrumb + title/meta + actions). */
export function FormShell({
  breadcrumb,
  title,
  meta,
  action,
  onBack,
  children,
}: {
  breadcrumb: string;
  title: string;
  meta?: string[];
  action?: React.ReactNode;
  /**
   * Called when Back is clicked. Return `true` to BLOCK the default navigation
   * (e.g. to show an unsaved-changes dialog); return falsy to let the link
   * navigate. Back is a real <Link> so it works even before JS hydrates.
   */
  onBack?: () => boolean | void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full flex-col bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            aria-label="Volver a recetas"
            className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-medium text-default-600 transition-colors hover:bg-default-100 active:bg-default-200"
            href={RECIPES_PATH}
            onClick={(event) => {
              if (onBack?.() === true) event.preventDefault();
            }}
          >
            <Icon icon="solar:arrow-left-linear" width={20} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-xs text-default-400">
              <span>Recetas</span>
              <Icon icon="solar:alt-arrow-right-linear" width={12} />
              <span className="text-default-500">{breadcrumb}</span>
            </p>
            <h1 className="truncate text-lg font-bold text-gray-900">
              {title}
            </h1>
            {meta !== undefined && (
              <p className="truncate text-xs text-default-500">
                {meta.join(" · ")}
              </p>
            )}
          </div>
          {action}
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">{children}</div>
    </div>
  );
}

/** A titled section card with an icon and optional count badge. */
export function SectionCard({
  icon,
  title,
  count,
  overflowVisible,
  children,
}: {
  icon: string;
  title: string;
  count?: number;
  overflowVisible?: boolean;
  children: React.ReactNode;
}) {
  // Allow a floating dropdown to escape the card bounds when needed.
  const overflow = overflowVisible ? "overflow-visible" : "";

  return (
    <Card className={`border border-gray-200 bg-white shadow-sm ${overflow}`}>
      <CardBody className={`gap-4 p-4 sm:p-5 ${overflow}`}>
        <div className="flex items-center gap-2">
          <Icon className="text-default-500" icon={icon} width={18} />
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {count !== undefined && count > 0 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-default-500 tabular-nums">
              {count}
            </span>
          )}
        </div>
        {children}
      </CardBody>
    </Card>
  );
}

export function ErrorText() {
  return (
    <p className="text-sm text-danger">Algo salió mal. Inténtalo de nuevo.</p>
  );
}

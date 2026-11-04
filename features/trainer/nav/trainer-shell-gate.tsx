"use client";

import { usePathname } from "next/navigation";
import React from "react";

import { TrainerNavShell } from "@/features/trainer/nav/trainer-nav-shell";
import { WhatsNewModal } from "@/features/trainer/whats-new/whats-new-modal";

const SHELL_PATH_PREFIXES = ["/trainer/dashboard", "/trainer/settings"];

export function TrainerShellGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const useShell = SHELL_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!useShell) return children;
  // El asistente de alta no es momento para novedades.
  const showWhatsNew = !pathname.startsWith("/trainer/dashboard/setup");

  return (
    <TrainerNavShell>
      {children}
      {showWhatsNew ? <WhatsNewModal /> : null}
    </TrainerNavShell>
  );
}

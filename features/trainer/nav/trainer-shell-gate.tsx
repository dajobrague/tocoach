"use client";

import { usePathname } from "next/navigation";
import React from "react";

import { TrainerNavShell } from "@/features/trainer/nav/trainer-nav-shell";

const SHELL_PATH_PREFIXES = ["/trainer/dashboard", "/trainer/settings"];

export function TrainerShellGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const useShell = SHELL_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  return useShell ? <TrainerNavShell>{children}</TrainerNavShell> : children;
}

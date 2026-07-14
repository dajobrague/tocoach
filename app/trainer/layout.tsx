"use client";

import { usePathname } from "next/navigation";
import React from "react";

import { TrainerNavShell } from "@/features/trainer/nav/trainer-nav-shell";

const SHELL_PATH_PREFIXES = ["/trainer/dashboard", "/trainer/settings"];

export default function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const useShell = SHELL_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  // HeroUI resolves --heroui-* variables inside hsl(), so the values MUST be
  // HSL channel triples. Writing the slate palette as RGB triples here turned
  // every primary-tinted surface (checkboxes, progress bars, flat chips) into
  // hsl(15 23% 42%) — a brown that exists nowhere in the design system.
  const trainerThemeCss = `
    .trainer-app {
      --heroui-primary-50: 210 40% 98% !important;
      --heroui-primary-100: 210 40% 96% !important;
      --heroui-primary-200: 214 32% 91% !important;
      --heroui-primary-300: 213 27% 84% !important;
      --heroui-primary-400: 215 20% 65% !important;
      --heroui-primary-500: 215 16% 47% !important;
      --heroui-primary-600: 215 19% 35% !important;
      --heroui-primary-700: 215 25% 27% !important;
      --heroui-primary-800: 217 33% 18% !important;
      --heroui-primary-900: 222 47% 11% !important;
      --heroui-primary: 222 47% 11% !important;
      --heroui-primary-foreground: 0 0% 100% !important;
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: trainerThemeCss }} />
      <div className="trainer-app">
        {useShell ? <TrainerNavShell>{children}</TrainerNavShell> : children}
      </div>
    </>
  );
}

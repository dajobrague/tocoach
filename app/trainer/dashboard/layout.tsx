"use client";

import React from "react";

import { TrainerNavShell } from "@/features/trainer/nav/trainer-nav-shell";

export default function TrainerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TrainerNavShell>{children}</TrainerNavShell>;
}

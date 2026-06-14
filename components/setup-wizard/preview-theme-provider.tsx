"use client";

import React from "react";

import { generatePreviewCSS } from "./preview-css";

import { SetupWizardState } from "@/lib/setup-wizard/context";

interface PreviewThemeProviderProps {
  state: SetupWizardState;
  children: React.ReactNode;
}

export function PreviewThemeProvider({
  state,
  children,
}: PreviewThemeProviderProps) {
  const css = React.useMemo(() => generatePreviewCSS(state), [state]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="preview-theme-wrapper">{children}</div>
    </>
  );
}

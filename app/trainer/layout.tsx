import React from "react";

import { TrainerShellGate } from "@/features/trainer/nav/trainer-shell-gate";
import { getTrainerSession } from "@/lib/auth/session";
import { loadTenantMetadataByHost } from "@/lib/tenant/loader";
import {
  renderTrainerThemeCSS,
  TRAINER_FALLBACK_CSS,
} from "@/lib/theme/render-css";

export default async function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let themeCss: string | null = null;

  try {
    const session = await getTrainerSession();

    if (session?.tenant_host) {
      const tenant = await loadTenantMetadataByHost(session.tenant_host);

      if (tenant && tenant.status === "active") {
        themeCss = renderTrainerThemeCSS(tenant);
      }
    }
  } catch {
    themeCss = null; // cae al fallback slate; nunca romper el render por tema
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{ __html: themeCss ?? TRAINER_FALLBACK_CSS }}
      />
      <div className="trainer-app">
        <TrainerShellGate>{children}</TrainerShellGate>
      </div>
    </>
  );
}

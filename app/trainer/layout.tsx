import React from "react";

import { TrainerShellGate } from "@/features/trainer/nav/trainer-shell-gate";
import { getTrainerSession } from "@/lib/auth/session";
import { loadTenantMetadataByHost } from "@/lib/tenant/loader";
import { renderTrainerThemeCSS } from "@/lib/theme/render-css";

// Fallback monocromo (login/register o sesión sin tenant): el bloque slate
// histórico, intacto. HeroUI resuelve --heroui-* dentro de hsl(), así que los
// valores DEBEN ser triples HSL (RGB aquí produjo marrón — no repetir).
const TRAINER_FALLBACK_CSS = `
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

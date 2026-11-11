"use client";

import { ClientAppPreview } from "@/components/setup-wizard/client-app-preview";
import { PRODUCTION_DOMAIN } from "@/config/app";
import { useSetupWizard } from "@/lib/setup-wizard/context";

/** Panel derecho del asistente: la app del cliente con la marca elegida. */
export default function LivePreview() {
  const { state } = useSetupWizard();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <h3 className="font-heading font-semibold text-black">
          Así verán tu app tus clientes
        </h3>
        <p className="font-mono text-xs text-gray-500">
          {PRODUCTION_DOMAIN}/{state.domain?.desired || "tu-slug"}
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ClientAppPreview />
      </div>
    </div>
  );
}

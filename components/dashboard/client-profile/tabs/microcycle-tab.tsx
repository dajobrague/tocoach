"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";

import { MetricsSection } from "./microcycle/metrics-section";

import MicrocycleConfig from "@/components/trainer/microcycle/microcycle-config";

type SubTab = "metrics" | "config";

const SUB_TABS: { key: SubTab; label: string; icon: string }[] = [
  { key: "metrics", label: "Métricas", icon: "solar:chart-2-bold" },
  { key: "config", label: "Configuración", icon: "solar:settings-bold" },
];

interface Props {
  clientId: string;
}

export default function MicrocycleTab({ clientId }: Props) {
  const [active, setActive] = useState<SubTab>("metrics");

  return (
    <div className="flex flex-col gap-4 mt-2">
      <div
        aria-label="Sub-pestañas de Microciclo"
        className="flex rounded-lg bg-default-100 p-1 self-start"
        role="tablist"
      >
        {SUB_TABS.map((t) => {
          const isActive = active === t.key;

          return (
            <button
              key={t.key}
              aria-selected={isActive}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
                isActive
                  ? "bg-content1 text-foreground shadow-sm font-medium"
                  : "text-default-500 hover:text-default-700 font-normal"
              }`}
              role="tab"
              type="button"
              onClick={() => setActive(t.key)}
            >
              <Icon icon={t.icon} width={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {active === "metrics" ? (
        <MetricsSection
          clientId={clientId}
          onSwitchToConfig={() => setActive("config")}
        />
      ) : null}
      {active === "config" ? <MicrocycleConfig clientId={clientId} /> : null}
    </div>
  );
}

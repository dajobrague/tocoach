// Wrapper que agrupa las tres pestañas relacionadas con entrenamiento
// (Plan Semanal, Entrenamientos, Cardio) bajo un solo padre. Usa
// HeroUI <Tabs> nativo. Default abre Plan Semanal.

"use client";

import { Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import CardioTab from "./cardio-tab";
import MicrocycleTab from "./microcycle-tab";
import WorkoutsTab from "./workouts-tab";

type SubTabKey = "microcycle" | "workouts" | "cardio";

const SUB_TABS: { key: SubTabKey; label: string; icon: string }[] = [
  { key: "microcycle", label: "Plan Semanal", icon: "solar:calendar-bold" },
  {
    key: "workouts",
    label: "Entrenamientos",
    icon: "solar:dumbbell-bold",
  },
  { key: "cardio", label: "Cardio", icon: "solar:heart-pulse-bold" },
];

interface Props {
  clientId: string;
  clientName: string;
}

export default function TrainingTabs({ clientId, clientName }: Props) {
  const [active, setActive] = useState<SubTabKey>("microcycle");

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        aria-label="Sub-pestañas de entrenamiento"
        color="primary"
        selectedKey={active}
        variant="underlined"
        onSelectionChange={(key) => setActive(key as SubTabKey)}
      >
        {SUB_TABS.map((t) => (
          <Tab
            key={t.key}
            title={
              <span className="flex items-center gap-1.5">
                <Icon icon={t.icon} width={16} />
                {t.label}
              </span>
            }
          />
        ))}
      </Tabs>

      {active === "microcycle" ? <MicrocycleTab clientId={clientId} /> : null}
      {active === "workouts" ? (
        <WorkoutsTab clientId={clientId} clientName={clientName} />
      ) : null}
      {active === "cardio" ? (
        <CardioTab clientId={clientId} clientName={clientName} />
      ) : null}
    </div>
  );
}

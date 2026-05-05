// Wrapper que agrupa las tres pestañas relacionadas con entrenamiento
// (Plan Semanal, Entrenamientos, Cardio) bajo un solo padre.
// Renderiza un segmented control manual (mismo patrón que el toolbar
// del calendario): container gris claro + pill activa con fondo
// blanco + shadow sutil + peso 500. NO usa color="primary" porque en
// este theme el brand es casi negro y queda agresivo en light mode.

"use client";

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
    <div className="flex flex-col gap-4 mt-2">
      <div
        aria-label="Sub-pestañas de entrenamiento"
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

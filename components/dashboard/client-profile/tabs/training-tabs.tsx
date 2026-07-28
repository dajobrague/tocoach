// Shell del tab Entrenamiento — rediseño (rebanada 1).
// Cuatro superficies objetivo (Seguimiento · Programa · Videos · Progreso);
// esta rebanada trae Seguimiento (nuevo) y Programa (hospeda los builders
// actuales sin tocar, con su propio segmented Fuerza/Cardio/Microciclo).
// Videos y Progreso aparecen en sus propias rebanadas — no se muestran
// pestañas muertas.
//
// Pills nivel 1 = la receta exacta de Tabs de nutrición
// (cycle-builder-content): bandeja gris, cursor blanco, icono+label.
// Nivel 2 = el segmented compacto de la casa (mismo patrón que tenía
// microcycle-tab).

"use client";

import { Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";

import { useUrlEnum } from "../use-url-state";

import CardioTab from "./cardio-tab";
import { MetricsSection } from "./microcycle/metrics-section";
import WorkoutsTab from "./workouts-tab";

import MicrocycleConfig from "@/components/trainer/microcycle/microcycle-config";

const SUB_TAB_KEYS = ["seguimiento", "programa"] as const;
const PROGRAM_KEYS = ["fuerza", "cardio", "config"] as const;

type ProgramKey = (typeof PROGRAM_KEYS)[number];

const PROGRAM_TABS: { key: ProgramKey; label: string; icon: string }[] = [
  { key: "fuerza", label: "Fuerza", icon: "solar:dumbbell-bold" },
  { key: "cardio", label: "Cardio", icon: "solar:heart-pulse-bold" },
  { key: "config", label: "Microciclo", icon: "solar:settings-bold" },
];

interface Props {
  clientId: string;
  clientName: string;
}

export default function TrainingTabs({ clientId, clientName }: Props) {
  const [active, setActive] = useUrlEnum("sub", SUB_TAB_KEYS, "seguimiento");
  const [programTab, setProgramTab] = useUrlEnum("m", PROGRAM_KEYS, "fuerza");

  return (
    <div className="mt-2 flex flex-col gap-4">
      <Tabs
        aria-label="Secciones de entrenamiento"
        classNames={{
          tabList: "rounded-large bg-gray-100 p-1 gap-1",
          cursor: "rounded-medium bg-white shadow-sm",
          tab: "h-9 px-6",
          tabContent:
            "font-medium text-default-500 group-data-[selected=true]:text-gray-900",
        }}
        selectedKey={active}
        variant="light"
        onSelectionChange={(key) =>
          setActive(key as (typeof SUB_TAB_KEYS)[number])
        }
      >
        <Tab
          key="seguimiento"
          title={
            <span className="flex items-center gap-1.5">
              <Icon icon="solar:calendar-linear" width={16} />
              Seguimiento
            </span>
          }
        />
        <Tab
          key="programa"
          title={
            <span className="flex items-center gap-1.5">
              <Icon icon="solar:clipboard-list-linear" width={16} />
              Programa
            </span>
          }
        />
      </Tabs>

      {active === "seguimiento" ? (
        <MetricsSection
          clientId={clientId}
          onSwitchToConfig={() => {
            setActive("programa");
            // setActive limpia ?m (child param); diferimos el set para que
            // el replace de config no se pierda contra esa limpieza.
            setTimeout(() => setProgramTab("config"), 0);
          }}
        />
      ) : null}

      {active === "programa" ? (
        <div className="flex flex-col gap-4">
          <div
            aria-label="Secciones del programa"
            className="flex self-start rounded-lg bg-default-100 p-1"
            role="tablist"
          >
            {PROGRAM_TABS.map((t) => {
              const isActive = programTab === t.key;

              return (
                <button
                  key={t.key}
                  aria-selected={isActive}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
                    isActive
                      ? "bg-content1 font-medium text-foreground shadow-sm"
                      : "font-normal text-default-500 hover:text-default-700"
                  }`}
                  role="tab"
                  type="button"
                  onClick={() => setProgramTab(t.key)}
                >
                  <Icon icon={t.icon} width={16} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {programTab === "fuerza" ? (
            <WorkoutsTab clientId={clientId} clientName={clientName} />
          ) : null}
          {programTab === "cardio" ? (
            <CardioTab clientId={clientId} clientName={clientName} />
          ) : null}
          {programTab === "config" ? (
            <MicrocycleConfig clientId={clientId} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

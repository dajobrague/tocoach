// Shell del tab Entrenamiento — rediseño.
// Dos superficies vivas: Seguimiento (semana/mes + detalle del día) y
// Programa (constructor unificado de fuerza + cardio con los días del
// microciclo integrados — features/trainer/training/programa). Videos y
// Progreso llegan en sus rebanadas; no se muestran pestañas muertas.
//
// Pills = la receta exacta de Tabs de nutrición (cycle-builder-content).

"use client";

import { Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";

import { useUrlEnum } from "../use-url-state";

import { MetricsSection } from "./microcycle/metrics-section";

import { ProgramaSection } from "@/features/trainer/training/programa/programa-section";

const SUB_TAB_KEYS = ["seguimiento", "programa"] as const;

interface Props {
  clientId: string;
  clientName: string;
}

export default function TrainingTabs({ clientId }: Props) {
  const [active, setActive] = useUrlEnum("sub", SUB_TAB_KEYS, "seguimiento");

  return (
    <div className="mt-2 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

        {/* Slot del toolbar de Programa: el selector de programa se monta
            aquí por portal (misma altura que las pills, a la derecha). */}
        <div
          className="flex min-w-0 items-center gap-2"
          id="training-programa-toolbar"
        />
      </div>

      {active === "seguimiento" ? (
        <MetricsSection
          clientId={clientId}
          onSwitchToConfig={() => setActive("programa")}
        />
      ) : null}

      {active === "programa" ? <ProgramaSection clientId={clientId} /> : null}
    </div>
  );
}

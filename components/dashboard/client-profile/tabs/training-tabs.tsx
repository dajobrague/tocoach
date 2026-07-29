// Shell del tab Entrenamiento — rediseño.
// Tres superficies vivas: Seguimiento (semana/mes + detalle del día),
// Programa (constructor unificado de fuerza + cardio con los días del
// microciclo integrados — features/trainer/training/programa) y Videos
// (bandeja de revisión de los videos del cliente). Progreso llega en su
// rebanada; no se muestran pestañas muertas.
//
// Pills = la receta exacta de Tabs de nutrición (cycle-builder-content).

"use client";

import { Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";

import { useUrlEnum } from "../use-url-state";

import { MetricsSection } from "./microcycle/metrics-section";

import { ProgramaSection } from "@/features/trainer/training/programa/programa-section";
import { useVideoFeed } from "@/features/trainer/training/videos/use-videos";
import { VideosSection } from "@/features/trainer/training/videos/videos-section";

const SUB_TAB_KEYS = ["seguimiento", "programa", "videos"] as const;

interface Props {
  clientId: string;
  clientName: string;
}

export default function TrainingTabs({ clientId }: Props) {
  const [active, setActive] = useUrlEnum("sub", SUB_TAB_KEYS, "seguimiento");
  // Mismo cache react-query que la sección: el badge no dispara un fetch extra.
  const { pendingCount, isLoading: videosLoading } = useVideoFeed(clientId);
  const showBadge = !videosLoading && pendingCount > 0;

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
          <Tab
            key="videos"
            title={
              <span className="flex items-center gap-1.5">
                <Icon icon="solar:videocamera-linear" width={16} />
                Videos
                {showBadge ? (
                  <span className="inline-flex min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 py-px text-[10px] font-bold leading-none text-white tabular-nums">
                    {pendingCount}
                  </span>
                ) : null}
              </span>
            }
          />
        </Tabs>

        {/* Slots del toolbar: cada sección monta el suyo por portal (misma
            altura que las pills, a la derecha). Se renderizan condicionalmente
            porque solo hay una sección activa a la vez. */}
        {active === "programa" ? (
          <div
            className="flex min-w-0 items-center gap-2"
            id="training-programa-toolbar"
          />
        ) : null}
        {active === "videos" ? (
          <div
            className="flex min-w-0 items-center gap-2"
            id="training-videos-toolbar"
          />
        ) : null}
      </div>

      {active === "seguimiento" ? (
        <MetricsSection
          clientId={clientId}
          onSwitchToConfig={() => setActive("programa")}
        />
      ) : null}

      {active === "programa" ? <ProgramaSection clientId={clientId} /> : null}

      {active === "videos" ? <VideosSection clientId={clientId} /> : null}
    </div>
  );
}

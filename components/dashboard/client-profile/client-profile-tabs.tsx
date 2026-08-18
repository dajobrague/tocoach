"use client";

import { Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import dynamic from "next/dynamic";
import { useRef } from "react";

import { useUrlEnum } from "./use-url-state";

// Cada tab se carga con next/dynamic: antes los 7 tabs (~12.000 líneas,
// incluida la nutrition-tab de 5.600 y recharts/dnd-kit vía progreso)
// entraban estáticamente al chunk inicial del perfil aunque solo se
// renderiza uno. Con el split, abrir el perfil descarga solo el tab activo.
const tabLoading = () => (
  <div className="flex justify-center py-16">
    <Spinner size="lg" />
  </div>
);

const AccessTab = dynamic(() => import("./tabs/access-tab"), {
  loading: tabLoading,
});
const ChartsTab = dynamic(() => import("./tabs/charts-tab"), {
  loading: tabLoading,
});
const FormsTab = dynamic(() => import("./tabs/forms-tab"), {
  loading: tabLoading,
});
const NeatTab = dynamic(() => import("./tabs/neat-tab"), {
  loading: tabLoading,
});
const NutritionTabSwitch = dynamic(
  () => import("./tabs/nutrition-tab-switch").then((m) => m.NutritionTabSwitch),
  { loading: tabLoading }
);
const SupplementsTab = dynamic(() => import("./tabs/supplements-tab"), {
  loading: tabLoading,
});
const TrainingTabs = dynamic(() => import("./tabs/training-tabs"), {
  loading: tabLoading,
});

const TAB_ITEMS = [
  { key: "training", label: "Entrenamientos", icon: "solar:dumbbell-bold" },
  { key: "charts", label: "Gráficas", icon: "solar:chart-square-bold" },
  { key: "neat", label: "NEAT", icon: "solar:walking-bold" },
  { key: "nutrition", label: "Nutrición", icon: "fluent:food-20-filled" },
  { key: "supplements", label: "Suplementos", icon: "solar:health-bold" },
  { key: "forms", label: "Formularios", icon: "solar:clipboard-list-bold" },
  { key: "access", label: "Acceso", icon: "solar:key-bold" },
] as const;

const TAB_KEYS = [
  "training",
  "charts",
  "neat",
  "nutrition",
  "supplements",
  "forms",
  "access",
] as const;

interface ClientProfileTabsProps {
  clientId: string;
  clientName?: string;
}

export default function ClientProfileTabs({
  clientId,
  clientName,
}: ClientProfileTabsProps) {
  const [selectedTab, setSelectedTab] = useUrlEnum("tab", TAB_KEYS, "training");
  const formsUnsavedRef = useRef(false);

  const handleTabChange = (key: (typeof TAB_KEYS)[number]) => {
    if (selectedTab === "forms" && formsUnsavedRef.current && key !== "forms") {
      if (
        !window.confirm(
          "Tienes cambios sin guardar en la configuración de formularios. ¿Quieres descartarlos?"
        )
      ) {
        return;
      }
      formsUnsavedRef.current = false;
    }
    setSelectedTab(key);
  };

  return (
    <div className="flex flex-col">
      {/* Tabs Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="flex overflow-x-auto scrollbar-hide -mb-px"
            role="tablist"
          >
            {TAB_ITEMS.map((tab) => {
              const isSelected = selectedTab === tab.key;

              return (
                <button
                  key={tab.key}
                  aria-selected={isSelected}
                  className={`relative flex items-center gap-1.5 px-3 h-12 whitespace-nowrap text-sm font-medium transition-colors flex-shrink-0 outline-none border-b-2 ${
                    isSelected
                      ? "text-blue-600 border-blue-600"
                      : "text-gray-500 hover:text-gray-700 border-transparent"
                  }`}
                  role="tab"
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                >
                  <Icon icon={tab.icon} width={18} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-50">
        <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
          {selectedTab === "charts" && <ChartsTab clientId={clientId} />}
          {selectedTab === "training" && (
            <TrainingTabs clientId={clientId} clientName={clientName ?? ""} />
          )}
          {selectedTab === "neat" && <NeatTab clientId={clientId} />}
          {selectedTab === "nutrition" && (
            <NutritionTabSwitch clientId={clientId} />
          )}
          {selectedTab === "supplements" && (
            <SupplementsTab clientId={clientId} />
          )}
          {selectedTab === "forms" && (
            <FormsTab
              clientId={clientId}
              onConfigDirtyChange={(dirty) => {
                formsUnsavedRef.current = dirty;
              }}
            />
          )}
          {selectedTab === "access" && (
            <AccessTab clientId={clientId} clientName={clientName ?? ""} />
          )}
        </div>
      </div>
    </div>
  );
}

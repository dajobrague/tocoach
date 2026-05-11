"use client";

import { Icon } from "@iconify/react";
import { useRef, useState } from "react";

import AccessTab from "./tabs/access-tab";
import ChartsTab from "./tabs/charts-tab";
import FormsTab from "./tabs/forms-tab";
import NeatTab from "./tabs/neat-tab";
import NutritionTab from "./tabs/nutrition-tab";
import SupplementsTab from "./tabs/supplements-tab";
import TrainingTabs from "./tabs/training-tabs";

const TAB_ITEMS = [
  { key: "training", label: "Entrenamientos", icon: "solar:dumbbell-bold" },
  { key: "charts", label: "Gráficas", icon: "solar:chart-square-bold" },
  { key: "neat", label: "NEAT", icon: "solar:walking-bold" },
  { key: "nutrition", label: "Nutrición", icon: "fluent:food-20-filled" },
  { key: "supplements", label: "Suplementos", icon: "solar:health-bold" },
  { key: "forms", label: "Formularios", icon: "solar:clipboard-list-bold" },
  { key: "access", label: "Acceso", icon: "solar:key-bold" },
] as const;

interface ClientProfileTabsProps {
  clientId: string;
  clientName?: string;
}

export default function ClientProfileTabs({
  clientId,
  clientName,
}: ClientProfileTabsProps) {
  const [selectedTab, setSelectedTab] = useState("training");
  const formsUnsavedRef = useRef(false);

  const handleTabChange = (key: string) => {
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
          {selectedTab === "nutrition" && <NutritionTab clientId={clientId} />}
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

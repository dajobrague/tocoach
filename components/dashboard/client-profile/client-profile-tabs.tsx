"use client";

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import { useUrlEnum } from "./use-url-state";

// Cada tab se carga con next/dynamic: antes los 7 tabs (~12.000 líneas,
// incluida la nutrition-tab de 5.600 y recharts/dnd-kit vía progreso)
// entraban estáticamente al chunk inicial del perfil aunque solo se
// renderiza uno. Con el split, abrir el perfil descarga solo el tab activo.
const tabLoading = () => (
  <div className="flex justify-center py-16">
    <Spinner color="primary" size="lg" />
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

type TabKey = (typeof TAB_KEYS)[number];

interface ClientProfileTabsProps {
  clientId: string;
  clientName?: string;
}

export default function ClientProfileTabs({
  clientId,
  clientName,
}: ClientProfileTabsProps) {
  const [selectedTab, setSelectedTab] = useUrlEnum("tab", TAB_KEYS, "training");
  const [pendingTab, setPendingTab] = useState<TabKey | null>(null);
  const formsUnsavedRef = useRef(false);

  const handleTabChange = (key: TabKey) => {
    if (selectedTab === "forms" && formsUnsavedRef.current && key !== "forms") {
      setPendingTab(key);

      return;
    }
    setSelectedTab(key);
  };

  const discardAndGo = () => {
    if (!pendingTab) return;
    formsUnsavedRef.current = false;
    setSelectedTab(pendingTab);
    setPendingTab(null);
  };

  return (
    <div className="flex flex-col">
      {/* Raíl de tabs: comparte superficie con el header (bg-content1), así el
          borde inferior cierra header + tabs como un solo panel. Sticky para
          que cambiar de tab no obligue a volver arriba en tabs largas. */}
      <div className="sticky top-0 z-20 border-b border-divider bg-content1">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
          <div
            className="scrollbar-hide -mb-px flex overflow-x-auto"
            role="tablist"
          >
            {TAB_ITEMS.map((tab) => {
              const isSelected = selectedTab === tab.key;

              return (
                <button
                  key={tab.key}
                  aria-selected={isSelected}
                  className={`relative flex h-12 flex-shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${
                    isSelected
                      ? "border-primary text-primary"
                      : "border-transparent text-default-500 hover:text-foreground"
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
      <div className="bg-background">
        <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
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

      {/* Guard de cambios sin guardar. Un diálogo nativo del navegador dentro
          de un handler de HeroUI congela la página hasta recargar, así que la
          confirmación es un Modal. */}
      <Modal
        isOpen={pendingTab !== null}
        size="sm"
        onOpenChange={(open) => {
          if (!open) setPendingTab(null);
        }}
      >
        <ModalContent>
          <ModalHeader className="font-heading">
            Cambios sin guardar
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              Tienes cambios sin guardar en la configuración de formularios. Si
              cambias de pestaña se perderán.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setPendingTab(null)}>
              Seguir editando
            </Button>
            <Button color="danger" onPress={discardAndGo}>
              Descartar cambios
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

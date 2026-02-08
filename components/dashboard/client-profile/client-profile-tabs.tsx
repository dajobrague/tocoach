"use client";

import { Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

// import CalendarTab from "./tabs/calendar-tab"; // Hidden temporarily
import CardioTab from "./tabs/cardio-tab";
import FormsTab from "./tabs/forms-tab";
// import GalleryTab from "./tabs/gallery-tab"; // Hidden temporarily
import NeatTab from "./tabs/neat-tab";
import NutritionTab from "./tabs/nutrition-tab";
import SupplementsTab from "./tabs/supplements-tab";
import WorkoutsTab from "./tabs/workouts-tab";

interface ClientProfileTabsProps {
  clientId: string;
  clientName?: string;
}

export default function ClientProfileTabs({
  clientId,
  clientName,
}: ClientProfileTabsProps) {
  const [selectedTab, setSelectedTab] = useState("workouts");

  return (
    <div className="flex flex-col">
      {/* Tabs Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <Tabs
            classNames={{
              tabList: "gap-6",
              cursor: "bg-blue-600",
              tab: "h-14",
              tabContent: "group-data-[selected=true]:text-blue-600",
            }}
            selectedKey={selectedTab}
            variant="underlined"
            onSelectionChange={(key) => setSelectedTab(key as string)}
          >
            <Tab
              key="workouts"
              title={
                <div className="flex items-center gap-2">
                  <Icon icon="solar:dumbbell-bold" width={20} />
                  <span className="font-medium">Entrenamientos</span>
                </div>
              }
            />
            <Tab
              key="cardio"
              title={
                <div className="flex items-center gap-2">
                  <Icon icon="solar:heart-pulse-bold" width={20} />
                  <span className="font-medium">Cardio</span>
                </div>
              }
            />
            <Tab
              key="neat"
              title={
                <div className="flex items-center gap-2">
                  <Icon icon="solar:walking-bold" width={20} />
                  <span className="font-medium">NEAT</span>
                </div>
              }
            />
            <Tab
              key="nutrition"
              title={
                <div className="flex items-center gap-2">
                  <Icon icon="fluent:food-20-filled" width={20} />
                  <span className="font-medium">Nutrición</span>
                </div>
              }
            />
            <Tab
              key="supplements"
              title={
                <div className="flex items-center gap-2">
                  <Icon icon="solar:health-bold" width={20} />
                  <span className="font-medium">Suplementos</span>
                </div>
              }
            />
            <Tab
              key="forms"
              title={
                <div className="flex items-center gap-2">
                  <Icon icon="solar:clipboard-list-bold" width={20} />
                  <span className="font-medium">Formularios</span>
                </div>
              }
            />
            {/* Hidden temporarily - will be finished later */}
            {/* <Tab
                            key="gallery"
                            title={
                                <div className="flex items-center gap-2">
                                    <Icon icon="solar:camera-bold" width={20} />
                                    <span className="font-medium">Galería</span>
                                </div>
                            }
                        /> */}
            {/* Hidden temporarily - will be finished later */}
            {/* <Tab
                            key="calendar"
                            title={
                                <div className="flex items-center gap-2">
                                    <Icon icon="solar:calendar-bold" width={20} />
                                    <span className="font-medium">Calendario</span>
                                </div>
                            }
                        /> */}
          </Tabs>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-50">
        <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
          {selectedTab === "workouts" && <WorkoutsTab clientId={clientId} clientName={clientName ?? ""} />}
          {selectedTab === "cardio" && <CardioTab clientId={clientId} clientName={clientName ?? ""} />}
          {selectedTab === "neat" && <NeatTab clientId={clientId} />}
          {selectedTab === "nutrition" && <NutritionTab clientId={clientId} />}
          {selectedTab === "supplements" && (
            <SupplementsTab clientId={clientId} />
          )}
          {selectedTab === "forms" && <FormsTab clientId={clientId} />}
          {/* Hidden temporarily - will be finished later */}
          {/* {selectedTab === "gallery" && <GalleryTab clientId={clientId} />} */}
          {/* {selectedTab === "calendar" && <CalendarTab clientId={clientId} />} */}
        </div>
      </div>
    </div>
  );
}

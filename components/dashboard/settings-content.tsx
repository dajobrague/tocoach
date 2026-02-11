"use client";

import { Card, CardBody, Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

import BrandColorsTab from "./brand-settings/colors-tab";
import BrandDomainTab from "./brand-settings/domain-tab";
import BrandLogoTab from "./brand-settings/logo-tab";
import BrandTypographyTab from "./brand-settings/typography-tab";
import ProfileTab from "./settings/profile-tab";

interface SettingsContentProps {
  onProfilePictureChange?: (url: string) => void;
}

export default function SettingsContent({
  onProfilePictureChange,
}: SettingsContentProps) {
  const [mainSection, setMainSection] = React.useState<"profile" | "brand">(
    "profile"
  );
  const [brandTab, setBrandTab] = React.useState("colors");

  const brandTabs = [
    {
      key: "colors",
      title: "Colores",
      icon: "solar:palette-linear",
      component: <BrandColorsTab />,
    },
    {
      key: "logo",
      title: "Logo y Marca",
      icon: "solar:gallery-linear",
      component: <BrandLogoTab />,
    },
    {
      key: "typography",
      title: "Tipografía",
      icon: "solar:text-field-linear",
      component: <BrandTypographyTab />,
    },
    {
      key: "domain",
      title: "Dominio",
      icon: "solar:link-circle-linear",
      component: <BrandDomainTab />,
    },
  ];

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Configuración
          </h1>
          <p className="text-gray-600">
            Administra tu perfil personal y la configuración de tu marca
          </p>
        </div>

        {/* Main Section Tabs */}
        <div className="flex gap-3">
          <button
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-semibold text-sm transition-all ${
              mainSection === "profile"
                ? "bg-gray-900 text-white shadow-md"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
            onClick={() => setMainSection("profile")}
          >
            <Icon icon="solar:user-circle-bold" width={20} />
            Mi Perfil
          </button>
          <button
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-semibold text-sm transition-all ${
              mainSection === "brand"
                ? "bg-gray-900 text-white shadow-md"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
            onClick={() => setMainSection("brand")}
          >
            <Icon icon="solar:palette-round-bold" width={20} />
            Marca
          </button>
        </div>

        {/* Content */}
        {mainSection === "profile" ? (
          onProfilePictureChange ? (
            <ProfileTab onProfilePictureChange={onProfilePictureChange} />
          ) : (
            <ProfileTab />
          )
        ) : (
          <Card className="border border-gray-200">
            <CardBody className="p-6">
              <Tabs
                aria-label="Configuración de marca"
                classNames={{
                  base: "w-full",
                  tabList: "gap-2 w-full relative rounded-lg bg-gray-100 p-1",
                  cursor: "bg-white shadow-sm",
                  tab: "max-w-fit px-4 h-10",
                  tabContent: "group-data-[selected=true]:text-black",
                }}
                selectedKey={brandTab}
                variant="light"
                onSelectionChange={(key) => setBrandTab(key as string)}
              >
                {brandTabs.map((tab) => (
                  <Tab
                    key={tab.key}
                    title={
                      <div className="flex items-center gap-2">
                        <Icon icon={tab.icon} width={18} />
                        <span className="hidden sm:inline">{tab.title}</span>
                      </div>
                    }
                  >
                    <div className="py-6">{tab.component}</div>
                  </Tab>
                ))}
              </Tabs>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

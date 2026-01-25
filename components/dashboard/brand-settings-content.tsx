"use client";

import { Card, CardBody, Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

import BrandColorsTab from "./brand-settings/colors-tab";
import BrandDesignTab from "./brand-settings/design-tab";
import BrandDomainTab from "./brand-settings/domain-tab";
import BrandLogoTab from "./brand-settings/logo-tab";
import BrandTypographyTab from "./brand-settings/typography-tab";

export default function BrandSettingsContent() {
  const [selectedTab, setSelectedTab] = React.useState("colors");

  const tabs = [
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
      key: "design",
      title: "Diseño",
      icon: "solar:layers-linear",
      component: <BrandDesignTab />,
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
            Configuración de Marca
          </h1>
          <p className="text-gray-600">
            Personaliza los colores, logo, tipografía y otros elementos de tu
            marca
          </p>
        </div>

        {/* Tabs Container */}
        <Card className="border border-gray-200">
          <CardBody className="p-6">
            <Tabs
              aria-label="Configuración de marca"
              classNames={{
                base: "w-full",
                tabList: "gap-2 w-full relative rounded-lg bg-gray-100 p-1",
                cursor: "bg-white shadow-sm",
                tab: "max-w-fit px-4 h-10",
                tabContent: "group-data-[selected=true]:text-blue-600",
              }}
              selectedKey={selectedTab}
              variant="light"
              onSelectionChange={(key) => setSelectedTab(key as string)}
            >
              {tabs.map((tab) => (
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
      </div>
    </div>
  );
}

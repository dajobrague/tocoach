"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

import { DashboardPreview } from "@/components/setup-wizard/dashboard-preview";
import { PRODUCTION_DOMAIN } from "@/config/app";
import { useSetupWizard } from "@/lib/setup-wizard/context";

// Add scrollbar-hide styles
const scrollbarHideStyles = `
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }
    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
`;

export default function LivePreview() {
  const { state } = useSetupWizard();
  const [viewMode, setViewMode] = React.useState<"mobile" | "desktop">(
    "desktop"
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: scrollbarHideStyles }} />
      <div className="flex flex-col h-full overflow-hidden">
        {/* Preview Controls */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white flex-shrink-0">
          <h3 className="font-heading font-semibold text-black">
            Vista Previa en Tiempo Real
          </h3>
          <div className="flex items-center gap-2">
            <Button
              color={viewMode === "mobile" ? "primary" : "default"}
              size="sm"
              startContent={<Icon icon="solar:phone-linear" />}
              variant={viewMode === "mobile" ? "solid" : "bordered"}
              onPress={() => setViewMode("mobile")}
            >
              Móvil
            </Button>
            <Button
              color={viewMode === "desktop" ? "primary" : "default"}
              size="sm"
              startContent={<Icon icon="solar:monitor-linear" />}
              variant={viewMode === "desktop" ? "solid" : "bordered"}
              onPress={() => setViewMode("desktop")}
            >
              Escritorio
            </Button>
          </div>
        </div>

        {/* Preview Content */}
        <div
          className="flex-1 p-4 bg-gray-100 overflow-auto"
          style={{ overscrollBehavior: "contain" }}
        >
          {/* Browser Mockup */}
          <div
            className={`mx-auto transition-all duration-300 ${
              viewMode === "mobile" ? "max-w-sm" : "max-w-4xl"
            }`}
          >
            {/* Browser Chrome */}
            <div className="bg-gray-200 rounded-t-lg p-3 border-b border-gray-300">
              <div className="flex items-center gap-2 mb-2">
                {/* Browser Controls */}
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>

                {/* Address Bar */}
                <div className="flex-1 mx-4">
                  <div className="bg-white rounded-md px-3 py-1.5 text-sm text-gray-700 border border-gray-300 flex items-center gap-2">
                    <Icon
                      className="text-green-600 text-xs"
                      icon="solar:lock-linear"
                    />
                    <span className="font-mono">
                      {PRODUCTION_DOMAIN}/{state.domain?.desired || "tu-slug"}
                    </span>
                  </div>
                </div>

                {/* Browser Actions */}
                <div className="flex gap-1">
                  <div className="w-6 h-6 bg-gray-300 rounded flex items-center justify-center">
                    <Icon
                      className="text-gray-600 text-xs"
                      icon="solar:refresh-linear"
                    />
                  </div>
                  <div className="w-6 h-6 bg-gray-300 rounded flex items-center justify-center">
                    <Icon
                      className="text-gray-600 text-xs"
                      icon="solar:bookmark-linear"
                    />
                  </div>
                </div>
              </div>

              {/* Browser Tab */}
              <div className="flex">
                <div className="bg-white rounded-t-md px-4 py-1 border-l border-t border-r border-gray-300 max-w-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{
                        backgroundColor: state.colors?.primary || "#3b82f6",
                      }}
                    />
                    <span className="text-xs text-gray-700 truncate">
                      {state.logo?.text || "Tu Plataforma"} - Coaching
                    </span>
                  </div>
                </div>
                <div className="bg-gray-100 rounded-t-md px-3 py-1 ml-1 border-l border-t border-r border-gray-300">
                  <span className="text-xs text-gray-500">+</span>
                </div>
              </div>
            </div>

            {/* Real Client Dashboard Preview */}
            <div className="bg-white shadow-lg overflow-hidden h-[600px]">
              <div className="h-full overflow-y-auto scrollbar-hide">
                <DashboardPreview viewMode={viewMode} />
              </div>
            </div>
          </div>
        </div>

        {/* Preview Info */}
        <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: state.colors.primary }}
              />
              <span className="text-gray-600">
                Color primario: {state.colors.primary}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Icon className="text-gray-400" icon="solar:eye-linear" />
              <span className="text-gray-600">Vista: {viewMode}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

"use client";

import { Button, Card, CardBody, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { LogoutButton } from "@/components/client-dashboard/logout-button";

interface MorePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MorePanel({ isOpen, onClose }: MorePanelProps) {
  const { firstName, clientProfilePicture, tenantSlug } = useClientData();
  const pathname = usePathname();
  const slug = pathname.split("/")[1] || "";

  const menuItems = [
    {
      icon: "solar:calendar-bold",
      title: "Calendario",
      description: "Tu historial de entrenamientos",
      href: `/${slug}/calendar`,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600",
    },
    {
      icon: "solar:health-bold",
      title: "Suplementos",
      description: "Tu protocolo de suplementación",
      href: `/${slug}/suplementos`,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
    },
    {
      icon: "solar:user-bold",
      title: "Perfil",
      description: "Ver y editar tu información",
      href: `/${slug}/profile`,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-600",
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        aria-label="Close menu"
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full md:w-96 bg-background z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? "translate-x-0 md:shadow-2xl" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-divider bg-content1">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-primary/60 flex-shrink-0">
              {clientProfilePicture ? (
                <img
                  alt={firstName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  sizes="44px"
                  src={clientProfilePicture}
                />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                  <Icon
                    className="text-primary text-xl"
                    icon="solar:user-bold"
                  />
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold font-heading text-foreground">
                Hola, {firstName}
              </h3>
              <p className="text-xs text-foreground/60 font-body">
                Configuración y opciones
              </p>
            </div>
          </div>
          <Button isIconOnly size="sm" variant="light" onPress={onClose}>
            <Icon className="text-2xl" icon="solar:close-circle-linear" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {/* Herramientas Section */}
          <div>
            <h3 className="text-sm font-heading font-bold text-default-500 uppercase tracking-wider mb-3 px-1">
              Herramientas
            </h3>
            <Card className="border border-default-200">
              <CardBody className="p-0">
                {menuItems.map((item, index) => (
                  <div key={item.href}>
                    <Link href={item.href} onClick={onClose}>
                      <div className="p-4 hover:bg-default-100 transition-colors active:bg-default-200">
                        <div className="flex items-center gap-4">
                          <div
                            className={`flex-shrink-0 w-12 h-12 rounded-xl ${item.iconBg} flex items-center justify-center`}
                          >
                            <Icon
                              className={`${item.iconColor} text-2xl`}
                              icon={item.icon}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-heading font-semibold text-foreground text-base">
                              {item.title}
                            </p>
                            <p className="text-sm text-default-500 font-body">
                              {item.description}
                            </p>
                          </div>
                          <Icon
                            className="text-default-400 text-xl flex-shrink-0"
                            icon="solar:alt-arrow-right-linear"
                          />
                        </div>
                      </div>
                    </Link>
                    {index < menuItems.length - 1 && <Divider />}
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>

          {/* Cuenta Section */}
          <div>
            <h3 className="text-sm font-heading font-bold text-default-500 uppercase tracking-wider mb-3 px-1">
              Cuenta
            </h3>
            <Card className="border border-default-200">
              <CardBody className="p-4">
                <LogoutButton />
              </CardBody>
            </Card>
          </div>

          {/* App Info */}
          <div className="pt-4 pb-2">
            <div className="text-center space-y-1">
              <p className="text-xs text-default-400 font-body font-medium">
                Top Coach
              </p>
              <p className="text-xs text-default-300 font-body">
                Versión 1.0.0
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

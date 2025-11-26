"use client";

import { Card, CardBody, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ClientBottomNav } from "@/components/client-dashboard/bottom-nav";
import { ClientHeader } from "@/components/client-dashboard/client-header";
import { LogoutButton } from "@/components/client-dashboard/logout-button";

interface MoreContentProps {
  clientId: string;
  firstName: string;
  logoUrl?: string;
  trainerName: string;
  clientProfilePicture?: string;
  tenantSlug: string;
}

export function MoreContent({
  clientId,
  firstName,
  logoUrl,
  trainerName,
  clientProfilePicture,
  tenantSlug,
}: MoreContentProps) {
  const pathname = usePathname();

  // Extract slug from pathname (e.g., /ironfit/mas -> ironfit)
  const slug = pathname.split("/")[1] || "";

  const menuItems = [
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
      <div className="min-h-screen bg-background pb-20">
        <ClientHeader
          clientId={clientId}
          clientProfilePicture={clientProfilePicture}
          firstName={firstName}
          logoUrl={logoUrl}
          tagline="Configuración y opciones"
          tenantSlug={tenantSlug}
          trainerName={trainerName}
        />

        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Quick Stats Card */}
          <Card className="border border-default-200 bg-gradient-to-br from-primary/5 to-background">
            <CardBody className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 bg-primary rounded-2xl p-4">
                  <Icon
                    className="text-white text-3xl"
                    icon="solar:settings-bold"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-heading font-bold text-foreground">
                    Configuración
                  </h3>
                  <p className="text-sm text-default-600 font-body">
                    Gestiona tu cuenta y preferencias
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Herramientas Section */}
          <div>
            <h3 className="text-sm font-heading font-bold text-default-500 uppercase tracking-wider mb-3 px-1">
              Herramientas
            </h3>
            <Card className="border border-default-200">
              <CardBody className="p-0">
                {menuItems.map((item, index) => (
                  <div key={item.href}>
                    <Link href={item.href}>
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
      <ClientBottomNav />
    </>
  );
}

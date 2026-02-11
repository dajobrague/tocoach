"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useClientData } from "@/components/client-dashboard/client-data-provider";
import { MorePanel } from "@/components/client-dashboard/more-panel";

export function ClientBottomNav() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { clientProfilePicture } = useClientData();

  // Extract slug from pathname (e.g., /ironfit/dashboard -> ironfit)
  const slug = pathname.split("/")[1] || "";

  const navItems = [
    {
      href: `/${slug}/dashboard`,
      icon: "solar:home-2-bold",
      label: "Inicio",
    },
    {
      href: `/${slug}/ejercicio`,
      icon: "solar:dumbbell-bold",
      label: "Entrenamiento",
    },
    {
      href: `/${slug}/nutricion`,
      icon: "fluent:food-20-filled",
      label: "Nutrición",
    },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-content1 border-t border-divider z-50 safe-area-inset-bottom">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-default-700 hover:text-primary"
                }`}
                href={item.href}
              >
                <Icon
                  className={`text-2xl mb-1 ${isActive ? "text-primary" : ""}`}
                  icon={item.icon}
                />
                <span
                  className={`text-xs font-body ${isActive ? "font-semibold" : ""}`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* Más — opens slide-in panel instead of navigating */}
          <button
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              isMoreOpen
                ? "text-primary"
                : "text-default-700 hover:text-primary"
            }`}
            type="button"
            onClick={() => setIsMoreOpen(true)}
          >
            <div
              className={`w-7 h-7 rounded-full overflow-hidden mb-1 border-2 border-primary/60 transition-all ${
                isMoreOpen ? "border-primary shadow-sm" : ""
              }`}
            >
              {clientProfilePicture ? (
                <img
                  alt="Perfil"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  sizes="28px"
                  src={clientProfilePicture}
                />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                  <Icon
                    className="text-primary text-sm"
                    icon="solar:user-bold"
                  />
                </div>
              )}
            </div>
            <span
              className={`text-xs font-body ${isMoreOpen ? "font-semibold" : ""}`}
            >
              Más
            </span>
          </button>
        </div>
      </nav>

      {/* Slide-in More Panel */}
      <MorePanel isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} />
    </>
  );
}

"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function ClientBottomNav() {
  const pathname = usePathname();

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
      icon: "solar:leaf-bold",
      label: "Nutrición",
    },
    {
      href: `/${slug}/calendar`,
      icon: "solar:calendar-bold",
      label: "Calendario",
    },
    {
      href: `/${slug}/mas`,
      icon: "solar:menu-dots-bold",
      label: "Más",
    },
  ];

  return (
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
      </div>
    </nav>
  );
}

"use client";

import { Icon } from "@iconify/react";
import { Button, Link } from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
import React from "react";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });

      // Redirect to admin login
      window.location.href = "/admin/login";
    } catch (error) {
      console.error("Error logging out:", error);
      setIsLoggingOut(false);
    }
  };

  const navItems = [
    {
      label: "Entrenadores",
      href: "/admin/dashboard/trainers",
      icon: "solar:users-group-two-rounded-bold-duotone",
    },
    {
      label: "Usuarios Admin",
      href: "/admin/dashboard/users",
      icon: "solar:shield-user-bold-duotone",
    },
    {
      label: "Configuración",
      href: "/admin/dashboard/settings",
      icon: "solar:settings-bold-duotone",
      disabled: true,
    },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-black text-white flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl">
              <Icon
                className="text-3xl text-white"
                icon="solar:shield-user-bold"
              />
            </div>
            <div>
              <h1 className="text-lg font-bold font-heading">Admin Panel</h1>
              <p className="text-xs text-white/70">TopCoach</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);

              return (
                <li key={item.href}>
                  <Link
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg
                      font-body transition-all
                      ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      }
                      ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                    href={item.disabled ? "#" : item.href}
                  >
                    <Icon className="text-xl" icon={item.icon} />
                    <span className="font-medium">{item.label}</span>
                    {item.disabled && (
                      <span className="ml-auto text-xs bg-white/20 px-2 py-1 rounded">
                        Pronto
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-white/10">
          <Button
            className="w-full bg-white/10 hover:bg-white/20 text-white font-body"
            disabled={isLoggingOut}
            isLoading={isLoggingOut}
            startContent={<Icon icon="solar:logout-2-bold" />}
            onClick={handleLogout}
          >
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

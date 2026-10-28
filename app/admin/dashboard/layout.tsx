"use client";

import { Icon } from "@iconify/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

import { useAdminData } from "@/lib/admin/use-admin-data";

import "./admin.css";

const NAV_ITEMS = [
  {
    label: "Operaciones",
    href: "/admin/dashboard/ops",
    icon: "solar:chart-square-linear",
    superOnly: true,
  },
  {
    label: "Entrenadores",
    href: "/admin/dashboard/trainers",
    icon: "solar:users-group-two-rounded-linear",
  },
  {
    label: "Administradores",
    href: "/admin/dashboard/users",
    icon: "solar:shield-user-linear",
  },
];

type ThemePref = "system" | "light" | "dark";

const THEME_KEY = "admin-theme";

const THEME_OPTIONS: { key: ThemePref; icon: string; label: string }[] = [
  { key: "system", icon: "solar:monitor-linear", label: "Sistema" },
  { key: "light", icon: "solar:sun-2-linear", label: "Claro" },
  { key: "dark", icon: "solar:moon-linear", label: "Oscuro" },
];

// Runs while the HTML is parsed, so a dark-mode reload doesn't flash white.
const THEME_BOOT = `try{var p=localStorage.getItem("${THEME_KEY}")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.adminTheme=d?"dark":"light"}catch(e){}`;

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);

    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** Applies the admin theme to <html> while mounted; removes it on leave. */
function useAdminTheme() {
  const [pref, setPref] = React.useState<ThemePref>("system");

  React.useLayoutEffect(() => {
    setPref(readPref());
  }, []);

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      root.dataset.adminTheme =
        pref === "dark" || (pref === "system" && media.matches)
          ? "dark"
          : "light";
    };

    apply();
    media.addEventListener("change", apply);

    return () => media.removeEventListener("change", apply);
  }, [pref]);

  React.useEffect(
    () => () => {
      delete document.documentElement.dataset.adminTheme;
    },
    []
  );

  const choose = (next: ThemePref) => {
    const root = document.documentElement;

    root.classList.add("admin-theme-transition");
    window.setTimeout(
      () => root.classList.remove("admin-theme-transition"),
      250
    );
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // private mode: the choice just won't persist
    }
    setPref(next);
  };

  return { pref, choose };
}

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const theme = useAdminTheme();
  // Same cached request the Administradores page uses — tells us our role.
  const { data: admins } = useAdminData<{
    adminUsers: { id: string; role: string }[];
    currentAdminId: string | null;
  }>("/api/admin/users");
  const isSuper =
    admins?.adminUsers.find((a) => a.id === admins.currentAdminId)?.role ===
    "super_admin";

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/admin/login";
    } catch (error) {
      console.error("Error logging out:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div
      className="flex h-screen w-full overflow-hidden bg-white text-slate-900 antialiased"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif",
      }}
    >
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-slate-50/80">
        <div className="flex h-14 items-center gap-2 px-4">
          <span className="flex size-6 items-center justify-center rounded-md bg-slate-900 text-[11px] font-bold text-white">
            T
          </span>
          <span className="text-[13px] font-semibold tracking-[-0.01em]">
            TopCoach
          </span>
          <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Admin
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2">
          <ul className="space-y-0.5">
            {NAV_ITEMS.filter((item) => !item.superOnly || isSuper).map(
              (item) => {
                const isActive = pathname.startsWith(item.href);

                return (
                  <li key={item.href}>
                    <NextLink
                      aria-current={isActive ? "page" : undefined}
                      className={`flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors duration-100 ${
                        isActive
                          ? "admin-nav-active bg-white font-medium text-slate-900 shadow-sm ring-1 ring-slate-900/5"
                          : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
                      }`}
                      href={item.href}
                    >
                      <Icon
                        className={
                          isActive ? "text-slate-900" : "text-slate-400"
                        }
                        icon={item.icon}
                        width={16}
                      />
                      {item.label}
                    </NextLink>
                  </li>
                );
              }
            )}
          </ul>
        </nav>

        <div className="space-y-1 border-t border-slate-200 p-2">
          <div
            aria-label="Tema"
            className="flex rounded-md bg-slate-200/50 p-0.5"
            role="radiogroup"
          >
            {THEME_OPTIONS.map((o) => {
              const active = theme.pref === o.key;

              return (
                <button
                  key={o.key}
                  aria-checked={active}
                  aria-label={o.label}
                  className={`flex h-6 flex-1 items-center justify-center rounded-[5px] transition-colors duration-150 ${
                    active
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                  role="radio"
                  title={o.label}
                  type="button"
                  onClick={() => theme.choose(o.key)}
                >
                  <Icon icon={o.icon} width={14} />
                </button>
              );
            })}
          </div>
          <button
            className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] text-slate-500 transition-colors hover:bg-slate-200/50 hover:text-slate-900 disabled:opacity-50"
            disabled={isLoggingOut}
            type="button"
            onClick={handleLogout}
          >
            <Icon icon="solar:logout-2-linear" width={16} />
            {isLoggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

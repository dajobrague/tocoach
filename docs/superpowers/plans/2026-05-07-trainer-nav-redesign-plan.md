# Trainer Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the trainer dashboard's single horizontal top-nav with an iframe-aware dual-shell nav that groups all four templates under one expandable "Plantillas" item, while preserving every existing URL and breaking nothing.

**Architecture:** A single `TRAINER_NAV` config powers two shells. Detection cascade (`?shell=` URL param → `localStorage` memo → iframe → fallback) selects between top-shell (embedded in GHL) and side-shell (PWA / browser). Two new layout files (`app/trainer/dashboard/layout.tsx`, `app/trainer/settings/layout.tsx`) wrap authenticated pages with `TrainerNavShell`, which owns session fetch, realtime-message badge, notification dropdown, and avatar menu. To enable URL-based active-state derivation, every section gets a real route (some are added: metricas, clients, messaging, exercise-library, templates, help, settings page). The dashboard root becomes a redirect that preserves the existing setup-completion flow and clears the legacy `localStorage.activeSection` value.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript (strict), HeroUI v2, Tailwind v4, Solar icons via `@iconify/react`. No test runner is present in the repo — verification is `npm run type-check`, `npm run lint:check`, and manual smoke tests at phase boundaries.

**Spec:** `docs/superpowers/specs/2026-05-07-trainer-nav-redesign-design.md`

---

## File Structure

**New files:**

- `features/trainer/nav/nav-items.ts` — single source of truth for nav config
- `features/trainer/nav/use-shell-mode.ts` — detection hook (top vs side)
- `features/trainer/nav/use-active-key.ts` — derives active leaf key from current pathname
- `features/trainer/nav/trainer-nav-shell.tsx` — picks shell, owns session/realtime/avatar
- `features/trainer/nav/shells/top-shell.tsx` — horizontal nav for iframe/embedded
- `features/trainer/nav/shells/side-shell.tsx` — sidebar for PWA/browser
- `components/trainer/nav/plantillas-dropdown.tsx` — top-shell "Plantillas ▾" panel
- `app/trainer/dashboard/layout.tsx` — wraps `dashboard/*` with shell
- `app/trainer/settings/layout.tsx` — wraps `settings/*` with shell
- `app/trainer/dashboard/metricas/page.tsx` — renders `MetricasContent`
- `app/trainer/dashboard/clients/page.tsx` — renders `ClientsContent`
- `app/trainer/dashboard/messaging/page.tsx` — renders `MessagingContent`
- `app/trainer/dashboard/exercise-library/page.tsx` — renders `ExerciseLibraryContent`
- `app/trainer/dashboard/templates/page.tsx` — renders `TemplatesContent`
- `app/trainer/dashboard/help/page.tsx` — renders `AyudaContent`
- `app/trainer/settings/page.tsx` — renders `SettingsContent`

**Modified files:**

- `app/trainer/dashboard/page.tsx` — becomes redirector with onboarding/setup logic preserved
- `app/trainer/dashboard/inventory/page.tsx` — strip duplicate nav + session-fetch
- `components/dashboard/settings-content.tsx` — remove two template card-links

**Deleted (Phase C only):**

- `components/dashboard/top-navigation.tsx`
- `components/dashboard/sidebar-items.tsx`

**Untouched (explicitly):**

- `app/trainer/layout.tsx` (theme CSS stays)
- All auth pages: `login`, `register`, `forgot-password`, `reset-password`, `setup-password`
- `lib/auth/*`, `middleware.ts`, `next.config.js`
- `components/dashboard/sidebar.tsx`, `components/dashboard/sidebar-drawer.tsx` (reused as-is by side-shell)
- All API routes, all data layer

---

# Phase A — Additive Scaffolding

These tasks add new files without modifying any existing behavior. Between Phase A and Phase B, every dashboard/settings page renders BOTH the new shell (from layout) AND its existing inline nav (from `dashboard/page.tsx` and `inventory/page.tsx`). This double-nav is intentional and brief — it's removed in Phase B. Each Phase A task is independently safe to merge and revert.

---

## Task 1: Create nav config

**Files:**

- Create: `features/trainer/nav/nav-items.ts`

- [ ] **Step 1: Create the nav config file**

```ts
// features/trainer/nav/nav-items.ts
export type TrainerNavItem = {
  key: string;
  title: string;
  icon: string;
  href?: string;
  items?: TrainerNavItem[];
};

export type TrainerNavSection = {
  key: string;
  title: string;
  items: TrainerNavItem[];
};

export const TRAINER_NAV: TrainerNavSection[] = [
  {
    key: "principal",
    title: "Principal",
    items: [
      {
        key: "metricas",
        title: "Métricas",
        icon: "solar:chart-line-duotone",
        href: "/trainer/dashboard/metricas",
      },
      {
        key: "clients",
        title: "Clientes",
        icon: "solar:users-group-rounded-linear",
        href: "/trainer/dashboard/clients",
      },
      {
        key: "messaging",
        title: "Mensajería",
        icon: "solar:chat-round-dots-linear",
        href: "/trainer/dashboard/messaging",
      },
    ],
  },
  {
    key: "bibliotecas",
    title: "Bibliotecas",
    items: [
      {
        key: "exercise-library",
        title: "Ejercicios",
        icon: "solar:dumbbell-linear",
        href: "/trainer/dashboard/exercise-library",
      },
      {
        key: "inventory",
        title: "Suplementos",
        icon: "solar:box-linear",
        href: "/trainer/dashboard/inventory",
      },
    ],
  },
  {
    key: "plantillas",
    title: "Plantillas",
    items: [
      {
        key: "templates-group",
        title: "Plantillas",
        icon: "solar:folder-with-files-linear",
        items: [
          {
            key: "templates-programs",
            title: "Programas",
            icon: "solar:document-add-linear",
            href: "/trainer/dashboard/templates",
          },
          {
            key: "templates-charts",
            title: "Gráficas",
            icon: "solar:chart-square-linear",
            href: "/trainer/dashboard/charts-template",
          },
          {
            key: "templates-checkin",
            title: "Check-in",
            icon: "solar:calendar-mark-linear",
            href: "/trainer/settings/checkin-defaults",
          },
          {
            key: "templates-habits",
            title: "Hábitos diarios",
            icon: "solar:notebook-linear",
            href: "/trainer/settings/forms/habits",
          },
        ],
      },
    ],
  },
];

/** Flatten leaf items (those with `href`) for active-key matching. */
export function flattenLeaves(
  sections: TrainerNavSection[] = TRAINER_NAV
): TrainerNavItem[] {
  const out: TrainerNavItem[] = [];
  const walk = (item: TrainerNavItem) => {
    if (item.href) out.push(item);
    item.items?.forEach(walk);
  };
  sections.forEach((s) => s.items.forEach(walk));
  return out;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add features/trainer/nav/nav-items.ts
git commit -m "feat(trainer-nav): add TRAINER_NAV config (single source of truth)"
```

---

## Task 2: Shell-mode detection hook

**Files:**

- Create: `features/trainer/nav/use-shell-mode.ts`

- [ ] **Step 1: Create the hook**

```ts
// features/trainer/nav/use-shell-mode.ts
"use client";

import { useEffect, useState } from "react";

export type ShellMode = "top" | "side";

const STORAGE_KEY = "trainer.shellMode";

function detect(): ShellMode {
  if (typeof window === "undefined") return "top";

  const param = new URLSearchParams(window.location.search).get("shell");
  if (param === "top" || param === "side") {
    try {
      window.localStorage.setItem(STORAGE_KEY, param);
    } catch {
      /* private mode or storage disabled; ignore */
    }
    return param;
  }

  try {
    const memo = window.localStorage.getItem(STORAGE_KEY);
    if (memo === "top" || memo === "side") return memo;
  } catch {
    /* ignore */
  }

  let inIframe = true;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }

  if (inIframe) {
    try {
      window.localStorage.setItem(STORAGE_KEY, "top");
    } catch {
      /* ignore */
    }
    return "top";
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, "side");
  } catch {
    /* ignore */
  }
  return "side";
}

/** Returns "top" (embedded in GHL iframe) or "side" (PWA / browser). */
export function useShellMode(): ShellMode {
  const [mode, setMode] = useState<ShellMode>(() => detect());

  useEffect(() => {
    // Re-detect once on mount in case the SSR-time default was wrong.
    const next = detect();
    if (next !== mode) setMode(next);

    // Watch for PWA install mid-session.
    const mql = window.matchMedia("(display-mode: standalone)");
    const onChange = () => setMode(detect());
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    // Safari < 14 fallback
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return mode;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add features/trainer/nav/use-shell-mode.ts
git commit -m "feat(trainer-nav): add useShellMode detection hook"
```

---

## Task 3: Active-key hook

**Files:**

- Create: `features/trainer/nav/use-active-key.ts`

- [ ] **Step 1: Create the hook**

```ts
// features/trainer/nav/use-active-key.ts
"use client";

import { usePathname } from "next/navigation";

import { flattenLeaves, type TrainerNavSection } from "./nav-items";

/**
 * Returns the key of the nav leaf whose `href` is the longest prefix match
 * of the current pathname. Empty string when nothing matches.
 */
export function useActiveKey(sections?: TrainerNavSection[]): string {
  const pathname = usePathname() ?? "";
  const leaves = flattenLeaves(sections);

  let bestKey = "";
  let bestLen = -1;

  for (const item of leaves) {
    const href = item.href ?? "";
    if (
      href &&
      (pathname === href || pathname.startsWith(`${href}/`)) &&
      href.length > bestLen
    ) {
      bestLen = href.length;
      bestKey = item.key;
    }
  }

  return bestKey;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add features/trainer/nav/use-active-key.ts
git commit -m "feat(trainer-nav): add useActiveKey hook (URL-driven active state)"
```

---

## Task 4: Plantillas dropdown component

**Files:**

- Create: `components/trainer/nav/plantillas-dropdown.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/trainer/nav/plantillas-dropdown.tsx
"use client";

import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";

import type { TrainerNavItem } from "@/features/trainer/nav/nav-items";

interface PlantillasDropdownProps {
  items: TrainerNavItem[];
  isActive: boolean;
}

export function PlantillasDropdown({
  items,
  isActive,
}: PlantillasDropdownProps) {
  const router = useRouter();

  return (
    <Dropdown placement="bottom-start">
      <DropdownTrigger>
        <Button
          className={`h-10 px-4 font-medium text-sm transition-colors ${
            isActive
              ? "bg-slate-100 text-black"
              : "text-gray-600 hover:text-black hover:bg-slate-50"
          }`}
          startContent={
            <Icon
              icon="solar:folder-with-files-linear"
              width={20}
              className={isActive ? "text-black" : "text-gray-500"}
            />
          }
          endContent={<Icon icon="solar:alt-arrow-down-linear" width={14} />}
          variant="light"
        >
          Plantillas
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Plantillas"
        classNames={{ base: "w-64" }}
        variant="flat"
        onAction={(key) => {
          const item = items.find((i) => i.key === key);
          if (item?.href) router.push(item.href);
        }}
      >
        {items.map((item) => (
          <DropdownItem
            key={item.key}
            startContent={
              <Icon icon={item.icon} width={20} className="text-gray-500" />
            }
          >
            {item.title}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/trainer/nav/plantillas-dropdown.tsx
git commit -m "feat(trainer-nav): add Plantillas dropdown component"
```

---

## Task 5: Top shell

**Files:**

- Create: `features/trainer/nav/shells/top-shell.tsx`

- [ ] **Step 1: Create the top shell**

```tsx
// features/trainer/nav/shells/top-shell.tsx
"use client";

import {
  Avatar,
  Badge,
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

import { PlantillasDropdown } from "@/components/trainer/nav/plantillas-dropdown";
import { TrainerNotificationsDropdown } from "@/components/trainer/notifications-dropdown";
import {
  TRAINER_NAV,
  type TrainerNavItem,
} from "@/features/trainer/nav/nav-items";

interface TopShellProps {
  activeKey: string;
  trainerId: string;
  trainerName: string;
  trainerImage?: string;
  brandLogo?: string;
  unreadMessages: number;
  onLogout: () => void;
}

const TEMPLATES_GROUP = TRAINER_NAV.find((s) => s.key === "plantillas")
  ?.items[0];

const FLAT_TOP_ITEMS: TrainerNavItem[] = [
  ...(TRAINER_NAV.find((s) => s.key === "principal")?.items ?? []),
  ...(TRAINER_NAV.find((s) => s.key === "bibliotecas")?.items ?? []),
];

export function TopShell({
  activeKey,
  trainerId,
  trainerName,
  trainerImage,
  brandLogo,
  unreadMessages,
  onLogout,
}: TopShellProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [logoError, setLogoError] = React.useState(false);

  React.useEffect(() => setLogoError(false), [brandLogo]);

  const templatesActive = activeKey.startsWith("templates-");
  const templateChildren = TEMPLATES_GROUP?.items ?? [];

  const isItemActive = (key: string) => activeKey === key;

  const handleNavigate = (href: string | undefined) => {
    setMenuOpen(false);
    if (href) router.push(href);
  };

  return (
    <Navbar
      isBordered
      classNames={{
        base: "bg-white border-b border-gray-200",
        wrapper: "px-4 sm:px-6",
        brand: "gap-3",
        content: "gap-2",
        item: "data-[active=true]:text-black",
        menu: "pt-6",
      }}
      isMenuOpen={menuOpen}
      maxWidth="full"
      onMenuOpenChange={setMenuOpen}
    >
      <NavbarBrand>
        {brandLogo && !logoError ? (
          <img
            alt="Logo"
            className="h-9 w-9 rounded-lg object-contain"
            src={brandLogo}
            onError={() => setLogoError(true)}
          />
        ) : (
          <div className="bg-black flex h-9 w-9 items-center justify-center rounded-lg shadow-sm">
            <span className="text-white font-bold text-sm">TC</span>
          </div>
        )}
        <div className="hidden sm:flex flex-col">
          <p className="font-bold text-lg text-gray-900 leading-none">
            TOP COACH
          </p>
          <p className="text-xs text-gray-500 font-medium">Dashboard</p>
        </div>
      </NavbarBrand>

      <NavbarMenuToggle
        className="sm:hidden text-gray-600"
        icon={(open) =>
          open ? (
            <Icon icon="solar:close-circle-linear" width={24} />
          ) : (
            <Icon icon="solar:hamburger-menu-linear" width={24} />
          )
        }
      />

      <NavbarContent className="hidden sm:flex gap-1" justify="center">
        {FLAT_TOP_ITEMS.map((item) => {
          const active = isItemActive(item.key);
          const isMessaging = item.key === "messaging";

          return (
            <NavbarItem key={item.key} isActive={active}>
              <Button
                as={Link}
                href={item.href ?? "#"}
                className={`h-10 px-3 font-medium text-sm relative ${
                  active
                    ? "bg-slate-100 text-black"
                    : "text-gray-600 hover:text-black hover:bg-slate-50"
                }`}
                startContent={
                  <Icon
                    icon={item.icon}
                    width={20}
                    className={active ? "text-black" : "text-gray-500"}
                  />
                }
                variant="light"
              >
                <span>{item.title}</span>
                {isMessaging && unreadMessages > 0 && (
                  <Chip
                    className="ml-1 h-5 min-w-5 px-1"
                    color="primary"
                    size="sm"
                    variant="solid"
                  >
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </Chip>
                )}
              </Button>
            </NavbarItem>
          );
        })}
        <NavbarItem isActive={templatesActive}>
          <PlantillasDropdown
            items={templateChildren}
            isActive={templatesActive}
          />
        </NavbarItem>
      </NavbarContent>

      <NavbarContent justify="end">
        {trainerId && (
          <NavbarItem>
            <TrainerNotificationsDropdown trainerId={trainerId} />
          </NavbarItem>
        )}
        <NavbarItem>
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <div className="flex items-center gap-2 cursor-pointer">
                <Badge
                  color="success"
                  content=""
                  placement="bottom-right"
                  shape="rectangle"
                  showOutline
                  size="sm"
                >
                  <Avatar
                    isBordered
                    as="button"
                    color="primary"
                    name={trainerName}
                    radius="lg"
                    size="sm"
                    src={trainerImage ?? ""}
                  />
                </Badge>
                <div className="hidden lg:flex flex-col items-start">
                  <p className="text-sm font-semibold text-gray-900 leading-none">
                    {trainerName}
                  </p>
                  <p className="text-xs text-gray-500">Entrenador</p>
                </div>
                <Icon
                  className="hidden lg:block text-gray-500"
                  icon="solar:alt-arrow-down-linear"
                  width={16}
                />
              </div>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="User Actions"
              classNames={{ base: "w-64" }}
              variant="flat"
              onAction={(key) => {
                if (key === "settings") router.push("/trainer/settings");
                else if (key === "help") router.push("/trainer/dashboard/help");
                else if (key === "logout") onLogout();
              }}
            >
              <DropdownItem
                key="settings"
                startContent={<Icon icon="solar:settings-linear" width={18} />}
              >
                Configuración
              </DropdownItem>
              <DropdownItem
                key="help"
                startContent={
                  <Icon icon="solar:question-circle-linear" width={18} />
                }
              >
                Ayuda y soporte
              </DropdownItem>
              <DropdownItem
                key="logout"
                className="text-danger"
                color="danger"
                startContent={<Icon icon="solar:logout-2-linear" width={18} />}
              >
                Cerrar sesión
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarItem>
      </NavbarContent>

      <NavbarMenu className="pt-6 gap-2">
        {FLAT_TOP_ITEMS.map((item) => {
          const active = isItemActive(item.key);
          return (
            <NavbarMenuItem key={item.key}>
              <Button
                className={`w-full justify-start h-12 px-4 font-medium ${
                  active ? "bg-slate-100 text-black" : "text-gray-700"
                }`}
                startContent={
                  <Icon
                    icon={item.icon}
                    width={22}
                    className={active ? "text-black" : "text-gray-500"}
                  />
                }
                variant="light"
                onPress={() => handleNavigate(item.href)}
              >
                {item.title}
              </Button>
            </NavbarMenuItem>
          );
        })}
        <NavbarMenuItem>
          <p className="text-xs uppercase tracking-wide text-gray-400 px-4 pt-2">
            Plantillas
          </p>
        </NavbarMenuItem>
        {templateChildren.map((child) => {
          const active = isItemActive(child.key);
          return (
            <NavbarMenuItem key={child.key}>
              <Button
                className={`w-full justify-start h-11 pl-6 pr-4 font-medium text-sm ${
                  active ? "bg-slate-100 text-black" : "text-gray-700"
                }`}
                startContent={
                  <Icon
                    icon={child.icon}
                    width={20}
                    className={active ? "text-black" : "text-gray-500"}
                  />
                }
                variant="light"
                onPress={() => handleNavigate(child.href)}
              >
                {child.title}
              </Button>
            </NavbarMenuItem>
          );
        })}
      </NavbarMenu>
    </Navbar>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint:check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add features/trainer/nav/shells/top-shell.tsx
git commit -m "feat(trainer-nav): add top shell (always-visible labels, Plantillas dropdown)"
```

---

## Task 6: Side shell

**Files:**

- Create: `features/trainer/nav/shells/side-shell.tsx`

- [ ] **Step 1: Create the side shell**

```tsx
// features/trainer/nav/shells/side-shell.tsx
"use client";

import {
  Avatar,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  ScrollShadow,
  useDisclosure,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import React from "react";

import Sidebar, {
  SidebarItemType,
  type SidebarItem,
} from "@/components/dashboard/sidebar";
import SidebarDrawer from "@/components/dashboard/sidebar-drawer";
import { TrainerNotificationsDropdown } from "@/components/trainer/notifications-dropdown";
import { TRAINER_NAV } from "@/features/trainer/nav/nav-items";

interface SideShellProps {
  children: React.ReactNode;
  activeKey: string;
  trainerId: string;
  trainerName: string;
  trainerImage?: string;
  brandLogo?: string;
  unreadMessages: number;
  onLogout: () => void;
}

/** Convert TRAINER_NAV into the SidebarItem[] format expected by `<Sidebar>`. */
function buildSidebarItems(unreadMessages: number): SidebarItem[] {
  const out: SidebarItem[] = [];

  for (const section of TRAINER_NAV) {
    out.push({
      key: `section-${section.key}`,
      title: section.title,
      items: section.items.map((item) => {
        if (item.items && item.items.length > 0) {
          return {
            key: item.key,
            title: item.title,
            icon: item.icon,
            type: SidebarItemType.Nest,
            items: item.items.map((child) => ({
              key: child.key,
              title: child.title,
              icon: child.icon,
              href: child.href,
            })),
          };
        }
        const sidebarItem: SidebarItem = {
          key: item.key,
          title: item.title,
          icon: item.icon,
          href: item.href,
        };
        if (item.key === "messaging" && unreadMessages > 0) {
          sidebarItem.endContent = (
            <Chip
              className="h-5 min-w-5 px-1"
              color="primary"
              size="sm"
              variant="solid"
            >
              {unreadMessages > 99 ? "99+" : unreadMessages}
            </Chip>
          );
        }
        return sidebarItem;
      }),
    });
  }

  return out;
}

export function SideShell({
  children,
  activeKey,
  trainerId,
  trainerName,
  trainerImage,
  brandLogo,
  unreadMessages,
  onLogout,
}: SideShellProps) {
  const router = useRouter();
  const drawer = useDisclosure();
  const [logoError, setLogoError] = React.useState(false);
  React.useEffect(() => setLogoError(false), [brandLogo]);

  const sidebarItems = React.useMemo(
    () => buildSidebarItems(unreadMessages),
    [unreadMessages]
  );

  const onSidebarSelect = (key: string) => {
    drawer.onClose();
    // Find the leaf with this key in the original TRAINER_NAV.
    let href: string | undefined;
    for (const section of TRAINER_NAV) {
      for (const item of section.items) {
        if (item.key === key) {
          href = item.href;
          break;
        }
        for (const child of item.items ?? []) {
          if (child.key === key) {
            href = child.href;
            break;
          }
        }
      }
    }
    if (href) router.push(href);
  };

  const sidebarContent = (
    <ScrollShadow className="h-full max-h-screen flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center gap-3">
        {brandLogo && !logoError ? (
          <img
            alt="Logo"
            className="h-9 w-9 rounded-lg object-contain"
            src={brandLogo}
            onError={() => setLogoError(true)}
          />
        ) : (
          <div className="bg-black flex h-9 w-9 items-center justify-center rounded-lg shadow-sm">
            <span className="text-white font-bold text-sm">TC</span>
          </div>
        )}
        <div className="flex flex-col">
          <p className="font-bold text-base text-gray-900 leading-none">
            TOP COACH
          </p>
          <p className="text-xs text-gray-500 font-medium">Dashboard</p>
        </div>
      </div>

      <Sidebar
        defaultSelectedKey={activeKey || "metricas"}
        items={sidebarItems}
        sectionClasses={{
          heading:
            "text-tiny uppercase tracking-wide text-default-500 px-2 pt-2 pb-1",
        }}
        onSelect={onSidebarSelect}
      />

      <div className="mt-auto">
        <Dropdown placement="top-start">
          <DropdownTrigger>
            <button className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Avatar
                isBordered
                color="primary"
                name={trainerName}
                radius="lg"
                size="sm"
                src={trainerImage ?? ""}
              />
              <div className="flex flex-col items-start min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate w-full text-left">
                  {trainerName}
                </p>
                <p className="text-xs text-gray-500">Entrenador</p>
              </div>
              <Icon
                className="text-gray-500"
                icon="solar:alt-arrow-up-linear"
                width={16}
              />
            </button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="User Actions"
            classNames={{ base: "w-56" }}
            variant="flat"
            onAction={(key) => {
              if (key === "settings") router.push("/trainer/settings");
              else if (key === "help") router.push("/trainer/dashboard/help");
              else if (key === "logout") onLogout();
            }}
          >
            <DropdownItem
              key="settings"
              startContent={<Icon icon="solar:settings-linear" width={18} />}
            >
              Configuración
            </DropdownItem>
            <DropdownItem
              key="help"
              startContent={
                <Icon icon="solar:question-circle-linear" width={18} />
              }
            >
              Ayuda y soporte
            </DropdownItem>
            <DropdownItem
              key="logout"
              className="text-danger"
              color="danger"
              startContent={<Icon icon="solar:logout-2-linear" width={18} />}
            >
              Cerrar sesión
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
    </ScrollShadow>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile drawer */}
      <SidebarDrawer
        isOpen={drawer.isOpen}
        sidebarPlacement="left"
        sidebarWidth={272}
        onOpenChange={drawer.onOpenChange}
      >
        {sidebarContent}
      </SidebarDrawer>

      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-gray-200 bg-white">
        {sidebarContent}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile hamburger + notifications) */}
        <header className="flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-200 bg-white lg:justify-end">
          <button
            aria-label="Abrir menú"
            className="lg:hidden p-2 rounded-md hover:bg-slate-100"
            onClick={drawer.onOpen}
          >
            <Icon icon="solar:hamburger-menu-linear" width={22} />
          </button>
          {trainerId && <TrainerNotificationsDropdown trainerId={trainerId} />}
        </header>

        <main className="flex-1 w-full overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint:check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add features/trainer/nav/shells/side-shell.tsx
git commit -m "feat(trainer-nav): add side shell (sidebar + drawer, reuses Sidebar component)"
```

---

## Task 7: TrainerNavShell wrapper

This component owns: shell selection, session fetch + onboarding redirect, realtime message badge, profile picture + brand logo fetches, and the logout handler. It replaces the duplicated logic currently in `app/trainer/dashboard/page.tsx` and `app/trainer/dashboard/inventory/page.tsx`.

**Files:**

- Create: `features/trainer/nav/trainer-nav-shell.tsx`

- [ ] **Step 1: Create the wrapper**

```tsx
// features/trainer/nav/trainer-nav-shell.tsx
"use client";

import { useRouter } from "next/navigation";
import React from "react";

import { useRealtimeMessages } from "@/lib/hooks/use-realtime-messages";

import { useActiveKey } from "./use-active-key";
import { useShellMode } from "./use-shell-mode";
import { SideShell } from "./shells/side-shell";
import { TopShell } from "./shells/top-shell";

interface TrainerSession {
  trainer_id: string;
  tenant_host: string;
  email: string;
  full_name?: string;
  onboarding_completed?: boolean;
}

interface TrainerNavShellProps {
  children: React.ReactNode;
}

export function TrainerNavShell({ children }: TrainerNavShellProps) {
  const router = useRouter();
  const mode = useShellMode();
  const activeKey = useActiveKey();

  const [session, setSession] = React.useState<TrainerSession | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [trainerImage, setTrainerImage] = React.useState<string | undefined>();
  const [brandLogo, setBrandLogo] = React.useState<string | undefined>();

  // Session fetch
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.session) {
          router.push("/trainer/login");
          return;
        }
        setSession(data.session);
      })
      .catch(() => {
        if (!cancelled) router.push("/trainer/login");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Onboarding redirect: incomplete onboarding → /trainer/dashboard/setup.
  React.useEffect(() => {
    if (!session) return;
    if (session.onboarding_completed) return;
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    if (path.startsWith("/trainer/dashboard/setup")) return;
    router.push("/trainer/dashboard/setup");
  }, [session, router]);

  // Trainer profile picture + brand logo
  React.useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch("/api/trainer/profile")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success && data.trainer?.profile_picture_url) {
          setTrainerImage(data.trainer.profile_picture_url);
        }
      })
      .catch(() => {});
    fetch("/api/brand/config")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.logo_url) setBrandLogo(data.logo_url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Realtime unread-message badge
  const { newMessageCount: unreadMessages, clearNewMessages } =
    useRealtimeMessages({
      clientId: null,
      tenantSlug: session?.tenant_host ?? null,
      userId: session?.trainer_id ?? "",
      userType: "trainer",
    });

  // Clear badge when trainer is on the messaging route
  React.useEffect(() => {
    if (activeKey === "messaging") clearNewMessages();
  }, [activeKey, clearNewMessages]);

  const handleLogout = React.useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Logout error:", e);
    } finally {
      router.push("/trainer/login");
    }
  }, [router]);

  // Loading / unauthenticated states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-default-500 font-body">
            Cargando panel de control...
          </p>
        </div>
      </div>
    );
  }
  if (!session) return null;

  const trainerName = session.full_name || session.email;

  if (mode === "side") {
    return (
      <SideShell
        activeKey={activeKey}
        brandLogo={brandLogo}
        trainerId={session.trainer_id}
        trainerImage={trainerImage}
        trainerName={trainerName}
        unreadMessages={unreadMessages}
        onLogout={handleLogout}
      >
        {children}
      </SideShell>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <TopShell
        activeKey={activeKey}
        brandLogo={brandLogo}
        trainerId={session.trainer_id}
        trainerImage={trainerImage}
        trainerName={trainerName}
        unreadMessages={unreadMessages}
        onLogout={handleLogout}
      />
      <main className="flex-1 w-full overflow-hidden">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint:check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add features/trainer/nav/trainer-nav-shell.tsx
git commit -m "feat(trainer-nav): add TrainerNavShell wrapper (session+realtime+shell pick)"
```

---

## Task 8: Add per-section route pages (so URLs resolve)

The current `dashboardSidebarItems` uses URLs like `/trainer/dashboard/metricas` that **do not exist as pages today** — the dashboard root renders content inline based on `activeSection` state. To make URL-driven active state work in Phase B, we add real route files for each section. Each is a thin wrapper that renders the existing content component. After Phase B, the dashboard root becomes a redirect to `/trainer/dashboard/metricas`.

**Files (all NEW):**

- `app/trainer/dashboard/metricas/page.tsx`
- `app/trainer/dashboard/clients/page.tsx`
- `app/trainer/dashboard/messaging/page.tsx`
- `app/trainer/dashboard/exercise-library/page.tsx`
- `app/trainer/dashboard/templates/page.tsx`
- `app/trainer/dashboard/help/page.tsx`
- `app/trainer/settings/page.tsx`

- [ ] **Step 1: Create `app/trainer/dashboard/metricas/page.tsx`**

```tsx
"use client";

import MetricasContent from "@/components/dashboard/metricas-content";

export default function MetricasPage() {
  return <MetricasContent />;
}
```

- [ ] **Step 2: Create `app/trainer/dashboard/clients/page.tsx`**

This sits alongside the existing `clients/[clientId]/page.tsx`. Next.js routes the bare `/clients` URL to `clients/page.tsx` and `/clients/<id>` to `clients/[clientId]/page.tsx` — no conflict.

```tsx
"use client";

import ClientsContent from "@/components/dashboard/clients-content";

export default function ClientsPage() {
  return <ClientsContent />;
}
```

- [ ] **Step 3: Create `app/trainer/dashboard/messaging/page.tsx`**

```tsx
"use client";

import MessagingContent from "@/components/dashboard/messaging-content";

export default function MessagingPage() {
  return <MessagingContent />;
}
```

- [ ] **Step 4: Create `app/trainer/dashboard/exercise-library/page.tsx`**

```tsx
"use client";

import ExerciseLibraryContent from "@/components/dashboard/exercise-library-content";

export default function ExerciseLibraryPage() {
  return <ExerciseLibraryContent />;
}
```

- [ ] **Step 5: Create `app/trainer/dashboard/templates/page.tsx`**

```tsx
"use client";

import TemplatesContent from "@/components/dashboard/templates-content";

export default function TemplatesPage() {
  return <TemplatesContent />;
}
```

- [ ] **Step 6: Create `app/trainer/dashboard/help/page.tsx`**

`AyudaContent` requires `trainerEmail` and `trainerName` props. Read them from `/api/auth/session`.

```tsx
"use client";

import { useEffect, useState } from "react";

import AyudaContent from "@/components/dashboard/ayuda-content";

interface SessionInfo {
  email: string;
  full_name?: string;
}

export default function HelpPage() {
  const [info, setInfo] = useState<SessionInfo | null>(null);

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.session) {
          setInfo({
            email: data.session.email,
            full_name: data.session.full_name,
          });
        }
      })
      .catch(() => {});
  }, []);

  if (!info) return null;

  return (
    <AyudaContent
      trainerEmail={info.email}
      trainerName={info.full_name || info.email}
    />
  );
}
```

- [ ] **Step 7: Create `app/trainer/settings/page.tsx`**

`SettingsContent` accepts an optional `onProfilePictureChange` callback. The shell already shows the avatar from `/api/trainer/profile`, so we don't need real-time avatar updates here — leave the callback unset.

```tsx
"use client";

import SettingsContent from "@/components/dashboard/settings-content";

export default function SettingsPage() {
  return <SettingsContent />;
}
```

- [ ] **Step 8: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 9: Lint**

Run: `npm run lint:check`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add app/trainer/dashboard/metricas app/trainer/dashboard/clients/page.tsx app/trainer/dashboard/messaging app/trainer/dashboard/exercise-library app/trainer/dashboard/templates/page.tsx app/trainer/dashboard/help app/trainer/settings/page.tsx
git commit -m "feat(trainer): add per-section route pages (metricas, messaging, etc.)"
```

---

## Task 9: Add `app/trainer/dashboard/layout.tsx`

This layout wraps every page under `/trainer/dashboard/*` with `TrainerNavShell`.

**Files:**

- Create: `app/trainer/dashboard/layout.tsx`

- [ ] **Step 1: Create the layout**

```tsx
// app/trainer/dashboard/layout.tsx
"use client";

import React from "react";

import { TrainerNavShell } from "@/features/trainer/nav/trainer-nav-shell";

export default function TrainerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TrainerNavShell>{children}</TrainerNavShell>;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/trainer/dashboard/layout.tsx
git commit -m "feat(trainer): add dashboard layout wrapping pages with TrainerNavShell"
```

---

## Task 10: Add `app/trainer/settings/layout.tsx`

Same shell, scoped to `/trainer/settings/*`.

**Files:**

- Create: `app/trainer/settings/layout.tsx`

- [ ] **Step 1: Create the layout**

```tsx
// app/trainer/settings/layout.tsx
"use client";

import React from "react";

import { TrainerNavShell } from "@/features/trainer/nav/trainer-nav-shell";

export default function TrainerSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TrainerNavShell>{children}</TrainerNavShell>;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/trainer/settings/layout.tsx
git commit -m "feat(trainer): add settings layout wrapping pages with TrainerNavShell"
```

---

## Task 11: Phase A smoke test

This is a manual verification before moving to Phase B. Between A and B, every dashboard/settings page renders DOUBLE NAV — the new shell from the layout AND the existing inline `<TopNavigation>` from `dashboard/page.tsx` and `inventory/page.tsx`. That's expected.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Next.js starts on `http://localhost:3000` (or 3001 if 3000 is taken).

- [ ] **Step 2: Browser tab — `/trainer/dashboard/metricas`**

Visit `http://localhost:3000/trainer/dashboard/metricas`.
Expected:

- Side shell renders (left sidebar visible).
- Métricas content renders to the right.
- Avatar dropdown opens correctly.
- No console errors.

- [ ] **Step 3: Browser tab — `/trainer/dashboard` (old root)**

Expected: page still renders with the OLD top-nav (we haven't converted it to a redirect yet) PLUS the new side shell from layout. Two navs visible. This is intentional and is the cue that Phase A is in place.

- [ ] **Step 4: Iframe simulation — `?shell=top`**

Visit `http://localhost:3000/trainer/dashboard/metricas?shell=top`.
Expected: top shell renders (no left sidebar, horizontal items at top).

- [ ] **Step 5: Plantillas dropdown**

In top shell, click "Plantillas". Expected: dropdown opens, lists 4 items, clicking each navigates to its existing URL (e.g. clicking Programas → `/trainer/dashboard/templates`, which still works because the existing dashboard/page.tsx + new templates page both exist; the new templates page wins for the templates URL because it's a more specific route... actually they conflict — see below).

- [ ] **Step 6: Mobile width — drawer**

Resize browser to ~375px width on a side-shell page. Expected: persistent sidebar disappears; hamburger button appears in the top bar; clicking opens the drawer with the same nav.

- [ ] **Step 7: If everything looks correct, proceed to Phase B**

If anything is broken, the granular Phase A commits make it easy to bisect.

---

# Phase B — Remove Duplicates

This phase removes the duplicated nav from existing pages and converts the dashboard root to a clean redirector. Single nav per page after this phase.

---

## Task 12: Convert `app/trainer/dashboard/page.tsx` to a redirector

The current file (394 lines) owns: session fetch, setup-completion handling, `activeSection` state, content switch-case, realtime hook, `TopNavigation` render. We replace it with a small client redirector that:

1. Reads `localStorage.activeSection` once and routes to the corresponding sub-page if set.
2. Otherwise redirects to `/trainer/dashboard/metricas`.
3. Preserves the `?setup=completed` query handling that exists in the current code (clears the flag, lands on metricas).

The `setup` redirect for incomplete onboarding now lives in `TrainerNavShell` (Task 7) and runs on every authenticated page, so we don't need it here.

**Files:**

- Modify: `app/trainer/dashboard/page.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
// app/trainer/dashboard/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const SECTION_TO_PATH: Record<string, string> = {
  metricas: "/trainer/dashboard/metricas",
  clients: "/trainer/dashboard/clients",
  messaging: "/trainer/dashboard/messaging",
  "exercise-library": "/trainer/dashboard/exercise-library",
  inventory: "/trainer/dashboard/inventory",
  templates: "/trainer/dashboard/templates",
  "charts-template": "/trainer/dashboard/charts-template",
  help: "/trainer/dashboard/help",
  ayuda: "/trainer/dashboard/help",
  "brand-settings": "/trainer/settings",
  setup: "/trainer/dashboard/setup",
};

export default function TrainerDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Read query directly off window — avoids the Next.js useSearchParams
    // Suspense boundary requirement for client redirector pages.
    const params = new URLSearchParams(window.location.search);

    // Setup-completion: land on metricas, clear the URL param.
    if (params.get("setup") === "completed") {
      try {
        window.localStorage.removeItem("activeSection");
      } catch {
        /* ignore */
      }
      router.replace("/trainer/dashboard/metricas");
      return;
    }

    // One-time migration: read legacy activeSection, route to it, clear it.
    let target = "/trainer/dashboard/metricas";
    try {
      const stored = window.localStorage.getItem("activeSection");
      if (stored && SECTION_TO_PATH[stored]) {
        target = SECTION_TO_PATH[stored] ?? target;
      }
      window.localStorage.removeItem("activeSection");
    } catch {
      /* ignore */
    }

    router.replace(target);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-default-500 font-body">Cargando...</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint:check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/trainer/dashboard/page.tsx
git commit -m "refactor(trainer-nav): convert dashboard root to redirector + activeSection migration"
```

---

## Task 13: Strip duplicate nav from `inventory/page.tsx`

The new `dashboard/layout.tsx` already provides the shell. The inventory page only needs to render its content.

**Files:**

- Modify: `app/trainer/dashboard/inventory/page.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
// app/trainer/dashboard/inventory/page.tsx
"use client";

import InventoryContent from "@/components/dashboard/inventory-content";

export default function InventoryPage() {
  return <InventoryContent />;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint:check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/trainer/dashboard/inventory/page.tsx
git commit -m "refactor(trainer-nav): inventory page renders content only (nav from layout)"
```

---

## Task 14: Remove template card-links from `settings-content.tsx`

The four templates now live in the main nav under "Plantillas". The two card-links in the settings page would be a duplicate entry point. Remove them.

**Files:**

- Modify: `components/dashboard/settings-content.tsx` (lines 92-142)

- [ ] **Step 1: Open the file**

Read `components/dashboard/settings-content.tsx`. Locate the two `<Card isPressable as={Link}>` blocks at lines ~92-142, the first linking to `/trainer/settings/checkin-defaults` (Plantilla de Check-in) and the second to `/trainer/settings/forms/habits` (Plantilla de Hábitos Diarios).

- [ ] **Step 2: Delete both Card blocks**

Remove the entire JSX block from the opening `<Card` of the Check-in card through the closing `</Card>` of the Hábitos card. The block sits between the `<div className="flex gap-3">…</div>` (Profile / Marca tabs) and the `{mainSection === "profile" ? …}` conditional that renders content.

After removal, that area should look like:

```tsx
        {/* Main Section Tabs */}
        <div className="flex gap-3">
          <button …>Mi Perfil</button>
          <button …>Marca</button>
        </div>

        {/* Content */}
        {mainSection === "profile" ? (
          …
```

- [ ] **Step 3: Remove now-unused imports**

If `Card` and `CardBody` from `@heroui/react` were imported only for the deleted blocks, remove them from the import. If they're still used elsewhere in the file (the Brand tab block uses `Card`/`CardBody` at lines ~152+), leave them.

`Link` from `next/link` is also imported. If unused after removal, remove that import too.

- [ ] **Step 4: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `npm run lint:check`
Expected: PASS (lint will catch any leftover unused imports).

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/settings-content.tsx
git commit -m "refactor(settings): remove template card-links (now in main nav)"
```

---

## Task 15: Phase B smoke test

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: starts cleanly.

- [ ] **Step 2: Browser tab — `/trainer/dashboard`**

Expected: redirects automatically to `/trainer/dashboard/metricas`. Single nav (side shell) visible. No double nav.

- [ ] **Step 3: localStorage migration check**

In browser devtools console:

```js
localStorage.setItem("activeSection", "messaging");
location.href = "/trainer/dashboard";
```

Expected: redirect lands on `/trainer/dashboard/messaging`. `localStorage.activeSection` is gone.

- [ ] **Step 4: All four templates reachable from one place**

Click "Plantillas" group in side shell (or dropdown in top shell). Expected: all four entries visible. Clicking each navigates to the correct existing URL:

- Programas → `/trainer/dashboard/templates`
- Gráficas → `/trainer/dashboard/charts-template`
- Check-in → `/trainer/settings/checkin-defaults`
- Hábitos diarios → `/trainer/settings/forms/habits`

Each page renders inside the new shell with the correct group expanded and the correct child highlighted.

- [ ] **Step 5: Settings page**

Visit `/trainer/settings`. Expected: SettingsContent renders inside the shell. The two template card-links are gone. Profile + Marca tabs work as before.

- [ ] **Step 6: Inventory**

Visit `/trainer/dashboard/inventory`. Expected: single nav, InventoryContent renders. No duplicated session-fetch loading state.

- [ ] **Step 7: Iframe mode**

Visit `/trainer/dashboard/metricas?shell=top`. Expected: top shell renders, all items work. Plantillas dropdown opens and navigates correctly.

- [ ] **Step 8: Avatar menu**

Click avatar → Configuración → expect navigate to `/trainer/settings`.
Click avatar → Ayuda y soporte → expect navigate to `/trainer/dashboard/help`.
Click avatar → Cerrar sesión → expect logout + redirect to `/trainer/login`.

- [ ] **Step 9: Onboarding redirect**

If you have a trainer account with `onboarding_completed = false`, visit `/trainer/dashboard/metricas`. Expected: shell loads, then redirects to `/trainer/dashboard/setup`.

- [ ] **Step 10: Auth pages still nav-free**

Visit `/trainer/login` → expect login page with NO nav shell.
Visit `/trainer/register` → same.

If all 10 checks pass, Phase B is verified. Commit nothing yet (we haven't changed code in this task) and proceed to Phase C.

---

# Phase C — Cleanup

Delete the now-unreferenced legacy files. Each deletion is verified by grep first.

---

## Task 16: Delete `components/dashboard/top-navigation.tsx`

**Files:**

- Delete: `components/dashboard/top-navigation.tsx`

- [ ] **Step 1: Verify no imports remain**

Run: `grep -rn "components/dashboard/top-navigation\|from \"@/components/dashboard/top-navigation\"" --include="*.ts" --include="*.tsx" /Users/davidbracho/top_coach`
Expected: zero matches.

If any matches surface, STOP and update those callers to use the new shell instead.

- [ ] **Step 2: Delete the file**

```bash
git rm components/dashboard/top-navigation.tsx
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 4: Lint**

Run: `npm run lint:check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(trainer-nav): delete legacy TopNavigation component"
```

---

## Task 17: Delete `components/dashboard/sidebar-items.tsx`

**Files:**

- Delete: `components/dashboard/sidebar-items.tsx`

- [ ] **Step 1: Verify no imports remain**

Run: `grep -rn "components/dashboard/sidebar-items\|from \"@/components/dashboard/sidebar-items\"" --include="*.ts" --include="*.tsx" /Users/davidbracho/top_coach`
Expected: zero matches.

If any matches surface, update those callers to use `TRAINER_NAV` from `features/trainer/nav/nav-items.ts`.

- [ ] **Step 2: Delete the file**

```bash
git rm components/dashboard/sidebar-items.tsx
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 4: Lint**

Run: `npm run lint:check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(trainer-nav): delete legacy dashboardSidebarItems config"
```

---

## Task 18: Final verification

- [ ] **Step 1: Full type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 2: Full lint**

Run: `npm run lint:check`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds. (`next.config.js` ignores type+lint errors during build, so type-check + lint:check above are the real gate. Build still runs the standalone copy step.)

- [ ] **Step 4: Final manual smoke test**

Repeat the matrix from Task 15 once more after Phase C. Specifically confirm:

- Every page in §13 of the spec ("Untouched" list) still renders with the new shell.
- No console errors mentioning the deleted files.
- Iframe + standalone mode both render correctly.

- [ ] **Step 5: Tag the work as complete**

(No commit needed — the previous Phase C commits already represent the final state.)

---

# Acceptance Checklist

Tick each before declaring done:

- [ ] All four templates visible under one expandable "Plantillas" item in both shells.
- [ ] Two template card-links no longer appear on `/trainer/settings`.
- [ ] Iframe context (or `?shell=top`) renders top shell.
- [ ] Standalone (PWA, browser) renders side shell.
- [ ] `?shell=top` and `?shell=side` URL params override detection.
- [ ] All existing trainer URLs continue to work without redirects (the four template URLs unchanged; `/trainer/dashboard` redirects to `/trainer/dashboard/metricas`, which is new behavior — but the URL itself is preserved as a valid entry point).
- [ ] `npm run type-check` and `npm run lint:check` pass.
- [ ] No change in behavior for: auth flows, onboarding, messaging realtime badge, notification dropdown, avatar dropdown menu, theme CSS.
- [ ] Auth pages (`/trainer/login`, `/trainer/register`, etc.) do NOT show the nav shell.
- [ ] Manual smoke matrix passes end-to-end.

---

# Rollback

Each phase is committed as a sequence of small commits. To roll back:

- **From Phase C:** `git revert <Task 16 commit> <Task 17 commit>` — restores the legacy files. Phase A and B remain in place.
- **From Phase B:** revert Tasks 12, 13, 14 — restores the inline navs and template card-links. Phase A scaffolding stays (harmless: layout files render the new shell, but old pages override with their own nav, producing the brief double-nav state).
- **From Phase A:** revert Tasks 8, 9, 10 — removes the layout wrappers; pages return to their original behavior. The `features/trainer/nav/` and added route pages can stay — they don't render unless the layout uses them.

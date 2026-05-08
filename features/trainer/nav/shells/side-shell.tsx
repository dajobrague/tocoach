"use client";

import {
  Avatar,
  Chip,
  Drawer,
  DrawerBody,
  DrawerContent,
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

import Sidebar, { type SidebarItem } from "@/components/dashboard/sidebar";
import { TrainerNotificationsDropdown } from "@/components/trainer/notifications-dropdown";
import { TRAINER_NAV } from "@/features/trainer/nav/nav-items";

interface SideShellProps {
  children: React.ReactNode;
  activeKey: string;
  trainerId: string;
  trainerName: string;
  trainerImage: string | undefined;
  brandLogo: string | undefined;
  unreadMessages: number;
  onLogout: () => void;
}

/**
 * Convert TRAINER_NAV into the SidebarItem[] format expected by `<Sidebar>`.
 * In the side shell, grouped items (e.g. Plantillas) are flattened directly
 * into the section so every child is visible without an accordion click.
 */
function buildSidebarItems(unreadMessages: number): SidebarItem[] {
  const out: SidebarItem[] = [];

  for (const section of TRAINER_NAV) {
    const sectionItems: SidebarItem[] = [];

    for (const item of section.items) {
      if (item.items && item.items.length > 0) {
        for (const child of item.items) {
          const leaf: SidebarItem = {
            key: child.key,
            title: child.title,
            icon: child.icon,
          };

          if (child.href) leaf.href = child.href;
          sectionItems.push(leaf);
        }
        continue;
      }

      const sidebarItem: SidebarItem = {
        key: item.key,
        title: item.title,
        icon: item.icon,
      };

      if (item.href) sidebarItem.href = item.href;
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

      sectionItems.push(sidebarItem);
    }

    out.push({
      key: `section-${section.key}`,
      title: section.title,
      items: sectionItems,
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

      {/*
        Sidebar's onSelect prop type collides with Listbox's DOM onSelect
        event in the HeroUI types (intersection of two incompatible
        signatures). Runtime is correct — Sidebar destructures the prop and
        calls it with a string key. We cast to satisfy the type-checker.
      */}
      <Sidebar
        defaultSelectedKey={activeKey || "metricas"}
        items={sidebarItems}
        sectionClasses={{
          heading:
            "text-tiny uppercase tracking-wide text-default-500 px-2 pt-2 pb-1",
        }}
        onSelect={onSidebarSelect as never}
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
    // Lock the layout to viewport height. The sidebar and top header stay
    // fixed; only the <main> content scrolls.
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile drawer (only renders when open) */}
      <Drawer
        classNames={{
          base: "max-w-[272px]",
        }}
        isOpen={drawer.isOpen}
        placement="left"
        onOpenChange={drawer.onOpenChange}
      >
        <DrawerContent>
          <DrawerBody className="p-0">{sidebarContent}</DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Desktop persistent sidebar — does not scroll with page content */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-gray-200 bg-white h-screen">
        {sidebarContent}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-200 bg-white shrink-0 lg:justify-end">
          <button
            aria-label="Abrir menú"
            className="lg:hidden p-2 rounded-md hover:bg-slate-100"
            onClick={drawer.onOpen}
          >
            <Icon icon="solar:hamburger-menu-linear" width={22} />
          </button>
          {trainerId && <TrainerNotificationsDropdown trainerId={trainerId} />}
        </header>

        <main className="flex-1 w-full overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

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
  trainerImage: string | undefined;
  brandLogo: string | undefined;
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
                className={`h-10 px-3 font-medium text-sm relative ${
                  active
                    ? "bg-slate-100 text-black"
                    : "text-gray-600 hover:text-black hover:bg-slate-50"
                }`}
                href={item.href ?? "#"}
                startContent={
                  <Icon
                    className={active ? "text-black" : "text-gray-500"}
                    icon={item.icon}
                    width={20}
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
            isActive={templatesActive}
            items={templateChildren}
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
                  isOneChar
                  showOutline
                  color="success"
                  content=""
                  placement="bottom-right"
                  shape="rectangle"
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
                    className={active ? "text-black" : "text-gray-500"}
                    icon={item.icon}
                    width={22}
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
                    className={active ? "text-black" : "text-gray-500"}
                    icon={child.icon}
                    width={20}
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

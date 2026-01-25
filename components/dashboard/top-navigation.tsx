"use client";

import {
  Avatar,
  Badge,
  Button,
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
import React from "react";

import { type SidebarItem } from "./sidebar";

export interface TopNavigationProps {
  trainerName?: string;
  trainerEmail?: string;
  onLogout?: () => void;
  items: SidebarItem[];
  activeSection: string;
  onSelect: (key: string) => void;
  onHelpClick?: () => void;
}

export default function TopNavigation({
  trainerName,
  trainerEmail,
  onLogout,
  items,
  activeSection,
  onSelect,
  onHelpClick,
}: TopNavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const handleItemClick = (key: string) => {
    onSelect(key);
    setIsMenuOpen(false);
  };

  return (
    <Navbar
      isBordered
      classNames={{
        base: "bg-white border-b border-gray-200",
        wrapper: "px-4 sm:px-6",
        brand: "gap-3",
        content: "gap-4",
        item: "data-[active=true]:text-blue-600",
        menu: "pt-6",
      }}
      isMenuOpen={isMenuOpen}
      maxWidth="full"
      onMenuOpenChange={setIsMenuOpen}
    >
      {/* Logo/Brand */}
      <NavbarBrand>
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 flex h-9 w-9 items-center justify-center rounded-lg shadow-sm">
          <span className="text-white font-bold text-sm">TC</span>
        </div>
        <div className="hidden sm:flex flex-col">
          <p className="font-bold text-lg text-gray-900 leading-none">
            TOP COACH
          </p>
          <p className="text-xs text-gray-500 font-medium">Dashboard</p>
        </div>
      </NavbarBrand>

      {/* Mobile menu toggle */}
      <NavbarMenuToggle
        className="sm:hidden text-gray-600"
        icon={(isOpen) =>
          isOpen ? (
            <Icon icon="solar:close-circle-linear" width={24} />
          ) : (
            <Icon icon="solar:hamburger-menu-linear" width={24} />
          )
        }
      />

      {/* Desktop Navigation */}
      <NavbarContent className="hidden sm:flex gap-1" justify="center">
        {items.map((item) => (
          <NavbarItem
            key={item.key}
            className="relative group"
            isActive={activeSection === item.key}
          >
            <Button
              className={`
                                h-9 font-medium transition-all duration-300 ease-in-out relative overflow-hidden
                                ${
                                  activeSection === item.key
                                    ? "bg-blue-50 text-blue-600 px-4"
                                    : "text-gray-600 hover:text-blue-600 hover:bg-gray-50 px-3 group-hover:px-4"
                                }
                            `}
              startContent={
                <Icon
                  className={`
                    transition-all duration-300 ease-in-out flex-shrink-0
                    ${
                      activeSection === item.key
                        ? "text-blue-600"
                        : "text-gray-500 group-hover:text-blue-600"
                    }
                  `}
                  icon={item.icon || ""}
                  width={20}
                />
              }
              variant="light"
              onPress={() => handleItemClick(item.key)}
            >
              <span
                className={
                  activeSection === item.key
                    ? "text-sm whitespace-nowrap ml-2"
                    : "text-sm whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden max-w-0 opacity-0 group-hover:max-w-[200px] group-hover:opacity-100 group-hover:ml-2"
                }
              >
                {item.title}
              </span>
              {item.endContent && (
                <span className="absolute -top-1 -right-1">
                  {item.endContent}
                </span>
              )}
            </Button>
          </NavbarItem>
        ))}
      </NavbarContent>

      {/* User Menu */}
      <NavbarContent justify="end">
        {/* User Dropdown */}
        <NavbarItem>
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <div className="flex items-center gap-2 cursor-pointer">
                <Badge
                  color="success"
                  content=""
                  placement="bottom-right"
                  shape="rectangle"
                  showOutline={true}
                  size="sm"
                >
                  <Avatar
                    isBordered
                    as="button"
                    color="primary"
                    name={trainerName || ""}
                    radius="lg"
                    size="sm"
                  />
                </Badge>
                <div className="hidden lg:flex flex-col items-start">
                  <p className="text-sm font-semibold text-gray-900 leading-none">
                    {trainerName || "Usuario"}
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
              classNames={{
                base: "w-64",
              }}
              variant="flat"
              onAction={(key) => {
                if (key === "settings") {
                  onSelect("brand-settings");
                }
              }}
            >
              <DropdownItem
                key="profile"
                className="h-14 gap-2"
                textValue="Profile info"
              >
                <div className="flex items-center gap-2">
                  <Avatar
                    isBordered
                    color="primary"
                    name={trainerName || ""}
                    radius="lg"
                    size="sm"
                  />
                  <div>
                    <p className="font-semibold text-sm">{trainerName}</p>
                    <p className="text-xs text-gray-500">{trainerEmail}</p>
                  </div>
                </div>
              </DropdownItem>
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
                onPress={onHelpClick || (() => {})}
              >
                Ayuda y soporte
              </DropdownItem>
              <DropdownItem
                key="logout"
                className="text-danger"
                color="danger"
                startContent={<Icon icon="solar:logout-2-linear" width={18} />}
                onPress={onLogout || (() => {})}
              >
                Cerrar sesión
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarItem>
      </NavbarContent>

      {/* Mobile Menu */}
      <NavbarMenu className="pt-6 gap-2">
        {items.map((item) => (
          <NavbarMenuItem key={item.key}>
            <Button
              className={`
                                w-full justify-start h-12 px-4 font-medium
                                ${
                                  activeSection === item.key
                                    ? "bg-blue-50 text-blue-600"
                                    : "text-gray-700"
                                }
                            `}
              endContent={item.endContent}
              startContent={
                <Icon
                  className={
                    activeSection === item.key
                      ? "text-blue-600"
                      : "text-gray-500"
                  }
                  icon={item.icon || ""}
                  width={22}
                />
              }
              variant="light"
              onPress={() => handleItemClick(item.key)}
            >
              {item.title}
            </Button>
          </NavbarMenuItem>
        ))}
      </NavbarMenu>
    </Navbar>
  );
}

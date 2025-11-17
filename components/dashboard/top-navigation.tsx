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
    NavbarMenuToggle
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
}

export default function TopNavigation({
    trainerName,
    trainerEmail,
    onLogout,
    items,
    activeSection,
    onSelect
}: TopNavigationProps) {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);

    const handleItemClick = (key: string) => {
        onSelect(key);
        setIsMenuOpen(false);
    };

    return (
        <Navbar
            isBordered
            isMenuOpen={isMenuOpen}
            onMenuOpenChange={setIsMenuOpen}
            maxWidth="full"
            classNames={{
                base: "bg-white border-b border-gray-200",
                wrapper: "px-4 sm:px-6",
                brand: "gap-3",
                content: "gap-4",
                item: "data-[active=true]:text-blue-600",
                menu: "pt-6"
            }}
        >
            {/* Logo/Brand */}
            <NavbarBrand>
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 flex h-9 w-9 items-center justify-center rounded-lg shadow-sm">
                    <span className="text-white font-bold text-sm">TC</span>
                </div>
                <div className="hidden sm:flex flex-col">
                    <p className="font-bold text-lg text-gray-900 leading-none">TOP COACH</p>
                    <p className="text-xs text-gray-500 font-medium">Dashboard</p>
                </div>
            </NavbarBrand>

            {/* Mobile menu toggle */}
            <NavbarMenuToggle
                className="sm:hidden text-gray-600"
                icon={(isOpen) =>
                    isOpen ?
                        <Icon icon="solar:close-circle-linear" width={24} /> :
                        <Icon icon="solar:hamburger-menu-linear" width={24} />
                }
            />

            {/* Desktop Navigation */}
            <NavbarContent className="hidden sm:flex gap-1" justify="center">
                {items.map((item) => (
                    <NavbarItem
                        key={item.key}
                        isActive={activeSection === item.key}
                        className="relative"
                    >
                        <Button
                            className={`
                                h-10 px-4 font-medium transition-all relative
                                ${activeSection === item.key
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                                }
                            `}
                            startContent={
                                <Icon
                                    icon={item.icon || ''}
                                    width={20}
                                    className={activeSection === item.key ? 'text-blue-600' : 'text-gray-500'}
                                />
                            }
                            variant="light"
                            onPress={() => handleItemClick(item.key)}
                        >
                            <span className="hidden md:inline">{item.title}</span>
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
                {/* Notifications */}
                <NavbarItem className="hidden sm:flex">
                    <Dropdown placement="bottom-end">
                        <DropdownTrigger>
                            <Button
                                isIconOnly
                                variant="light"
                                className="text-gray-600 hover:text-blue-600"
                            >
                                <Badge content="3" color="primary" size="sm">
                                    <Icon icon="solar:bell-linear" width={22} />
                                </Badge>
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu
                            aria-label="Notifications"
                            variant="flat"
                            classNames={{
                                base: "w-80"
                            }}
                        >
                            <DropdownItem
                                key="header"
                                className="h-12 gap-2"
                                textValue="Notifications header"
                                isReadOnly
                            >
                                <div className="flex items-center justify-between w-full">
                                    <p className="font-semibold text-gray-900">Notificaciones</p>
                                    <Chip size="sm" color="primary" variant="flat">3 nuevas</Chip>
                                </div>
                            </DropdownItem>
                            <DropdownItem
                                key="notification1"
                                className="h-auto py-3"
                                startContent={
                                    <div className="bg-blue-50 p-2 rounded-lg flex-shrink-0">
                                        <Icon icon="solar:user-plus-bold" className="text-blue-600 text-lg" />
                                    </div>
                                }
                            >
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm font-semibold text-gray-900">Nuevo cliente registrado</p>
                                    <p className="text-xs text-gray-500">Juan Pérez se ha unido a tu plataforma</p>
                                    <p className="text-xs text-gray-400 mt-1">Hace 5 minutos</p>
                                </div>
                            </DropdownItem>
                            <DropdownItem
                                key="notification2"
                                className="h-auto py-3"
                                startContent={
                                    <div className="bg-green-50 p-2 rounded-lg flex-shrink-0">
                                        <Icon icon="solar:check-circle-bold" className="text-green-600 text-lg" />
                                    </div>
                                }
                            >
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm font-semibold text-gray-900">Sesión completada</p>
                                    <p className="text-xs text-gray-500">María García completó su entrenamiento</p>
                                    <p className="text-xs text-gray-400 mt-1">Hace 1 hora</p>
                                </div>
                            </DropdownItem>
                            <DropdownItem
                                key="notification3"
                                className="h-auto py-3"
                                startContent={
                                    <div className="bg-purple-50 p-2 rounded-lg flex-shrink-0">
                                        <Icon icon="solar:calendar-mark-bold" className="text-purple-600 text-lg" />
                                    </div>
                                }
                            >
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm font-semibold text-gray-900">Próxima sesión</p>
                                    <p className="text-xs text-gray-500">Tienes una sesión con Carlos López en 2 horas</p>
                                    <p className="text-xs text-gray-400 mt-1">Hace 2 horas</p>
                                </div>
                            </DropdownItem>
                            <DropdownItem
                                key="view-all"
                                className="h-10"
                                textValue="Ver todas"
                            >
                                <div className="flex items-center justify-center w-full">
                                    <p className="text-sm font-medium text-blue-600">Ver todas las notificaciones</p>
                                </div>
                            </DropdownItem>
                        </DropdownMenu>
                    </Dropdown>
                </NavbarItem>

                {/* User Dropdown */}
                <NavbarItem>
                    <Dropdown placement="bottom-end">
                        <DropdownTrigger>
                            <div className="flex items-center gap-2 cursor-pointer">
                                <Badge
                                    content=""
                                    color="success"
                                    shape="rectangle"
                                    placement="bottom-right"
                                    size="sm"
                                    showOutline={true}
                                >
                                    <Avatar
                                        as="button"
                                        size="sm"
                                        name={trainerName || ''}
                                        isBordered
                                        color="primary"
                                        radius="lg"
                                    />
                                </Badge>
                                <div className="hidden lg:flex flex-col items-start">
                                    <p className="text-sm font-semibold text-gray-900 leading-none">
                                        {trainerName || 'Usuario'}
                                    </p>
                                    <p className="text-xs text-gray-500">Entrenador</p>
                                </div>
                                <Icon
                                    icon="solar:alt-arrow-down-linear"
                                    width={16}
                                    className="hidden lg:block text-gray-500"
                                />
                            </div>
                        </DropdownTrigger>
                        <DropdownMenu
                            aria-label="User Actions"
                            variant="flat"
                            classNames={{
                                base: "w-64"
                            }}
                        >
                            <DropdownItem
                                key="profile"
                                className="h-14 gap-2"
                                textValue="Profile info"
                            >
                                <div className="flex items-center gap-2">
                                    <Avatar
                                        size="sm"
                                        name={trainerName || ''}
                                        isBordered
                                        color="primary"
                                        radius="lg"
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
                                startContent={<Icon icon="solar:question-circle-linear" width={18} />}
                            >
                                Ayuda y soporte
                            </DropdownItem>
                            <DropdownItem
                                key="logout"
                                color="danger"
                                className="text-danger"
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
                                ${activeSection === item.key
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'text-gray-700'
                                }
                            `}
                            startContent={
                                <Icon
                                    icon={item.icon || ''}
                                    width={22}
                                    className={activeSection === item.key ? 'text-blue-600' : 'text-gray-500'}
                                />
                            }
                            endContent={item.endContent}
                            variant="light"
                            onPress={() => handleItemClick(item.key)}
                        >
                            {item.title}
                        </Button>
                    </NavbarMenuItem>
                ))}

                {/* Mobile notifications */}
                <NavbarMenuItem>
                    <div className="w-full">
                        <Button
                            className="w-full justify-start h-12 px-4 font-medium text-gray-700"
                            startContent={<Icon icon="solar:bell-linear" width={22} className="text-gray-500" />}
                            endContent={
                                <Chip size="sm" color="primary" variant="flat">3 nuevas</Chip>
                            }
                            variant="light"
                        >
                            Notificaciones
                        </Button>
                    </div>
                </NavbarMenuItem>
            </NavbarMenu>
        </Navbar>
    );
}


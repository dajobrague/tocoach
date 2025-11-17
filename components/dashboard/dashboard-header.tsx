"use client";

import { Avatar, Button, cn, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

export interface DashboardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    onMenuOpen?: () => void;
    trainerName?: string;
    trainerEmail?: string;
    onLogout?: () => void;
}

const DashboardHeader = React.forwardRef<HTMLInputElement, DashboardHeaderProps>(
    ({ onMenuOpen, trainerName, trainerEmail, onLogout, className, ...props }, ref) => {
        return (
            <header
                className={cn("flex w-full items-center justify-between px-4 py-3 sm:px-6 border-b border-divider", className)}
                {...props}
                ref={ref}
            >
                {/* Mobile menu button */}
                {onMenuOpen && (
                <Button
                    isIconOnly
                    className="text-default-500 flex sm:hidden"
                    size="sm"
                    variant="light"
                    onPress={onMenuOpen}
                >
                    <Icon height={24} icon="solar:hamburger-menu-outline" width={24} />
                </Button>
                )}

                {/* Page title */}
                <div className="flex items-center gap-3">
                    <h1 className="text-large font-heading font-bold">Panel de Control</h1>
                </div>

                {/* User menu */}
                <div className="flex items-center gap-3">
                    <Dropdown placement="bottom-end">
                        <DropdownTrigger>
                            <Avatar
                                as="button"
                                className="transition-transform"
                                size="sm"
                                name={trainerName || ''}
                            />
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Profile Actions" variant="flat">
                            <DropdownItem key="profile" className="h-14 gap-2">
                                <p className="font-semibold">Conectado como</p>
                                <p className="font-semibold">{trainerEmail}</p>
                            </DropdownItem>
                            <DropdownItem key="settings">
                                Configuración
                            </DropdownItem>
                            <DropdownItem key="help_and_feedback">
                                Ayuda y comentarios
                            </DropdownItem>
                            <DropdownItem key="logout" color="danger" onPress={onLogout || (() => {})}>
                                Cerrar sesión
                            </DropdownItem>
                        </DropdownMenu>
                    </Dropdown>
                </div>
            </header>
        );
    },
);

DashboardHeader.displayName = "DashboardHeader";

export default DashboardHeader;

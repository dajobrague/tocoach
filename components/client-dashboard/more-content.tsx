"use client";

import { ClientBottomNav } from '@/components/client-dashboard/bottom-nav';
import { LogoutButton } from '@/components/client-dashboard/logout-button';
import { Card, CardBody } from '@heroui/react';
import { Icon } from '@iconify/react';
import Link from 'next/link';

export function MoreContent() {
    return (
        <>
            <div className="min-h-screen bg-background pb-20">
                <div className="max-w-lg mx-auto p-4">
                    {/* Header */}
                    <div className="pt-4 pb-6">
                        <h1 className="text-2xl font-heading font-bold text-foreground mb-2">
                            Más
                        </h1>
                        <p className="text-default-500 font-body text-sm">
                            Configuración y opciones
                        </p>
                    </div>

                    {/* Menu Options */}
                    <div className="space-y-3">
                        {/* Profile Link */}
                        <Link href="/profile">
                            <Card isPressable className="hover:scale-[1.02] transition-transform">
                                <CardBody className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                                                <Icon
                                                    icon="solar:user-bold"
                                                    className="text-primary text-xl"
                                                />
                                            </div>
                                            <div>
                                                <p className="font-semibold font-heading text-foreground">
                                                    Perfil
                                                </p>
                                                <p className="text-xs text-default-500 font-body">
                                                    Ver y editar tu información
                                                </p>
                                            </div>
                                        </div>
                                        <Icon
                                            icon="solar:alt-arrow-right-linear"
                                            className="text-default-400 text-xl"
                                        />
                                    </div>
                                </CardBody>
                            </Card>
                        </Link>

                        {/* Logout Section */}
                        <Card>
                            <CardBody className="p-4">
                                <LogoutButton />
                            </CardBody>
                        </Card>
                    </div>

                    {/* App Info */}
                    <div className="mt-8 text-center">
                        <p className="text-xs text-default-400 font-body">
                            Top Coach
                        </p>
                        <p className="text-xs text-default-300 font-body mt-1">
                            Versión 1.0.0
                        </p>
                    </div>
                </div>
            </div>
            <ClientBottomNav />
        </>
    );
}


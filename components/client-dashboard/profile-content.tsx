"use client";

import { ClientBottomNav } from '@/components/client-dashboard/bottom-nav';
import { LogoutButton } from '@/components/client-dashboard/logout-button';
import { Card, CardBody, CardHeader } from '@heroui/react';
import { Icon } from '@iconify/react';

interface ProfileContentProps {
    clientProfile: any;
    logoUrl?: string;
    trainerName: string;
}

export function ProfileContent({ clientProfile, logoUrl, trainerName }: ProfileContentProps) {
    return (
        <>
            <div className="min-h-screen bg-background p-4 pb-20">
                <div className="max-w-lg mx-auto space-y-6">
                    {/* Logo Header */}
                    {logoUrl && (
                        <div className="pt-6 flex justify-center">
                            <img
                                src={logoUrl}
                                alt={trainerName}
                                className="h-12 w-auto"
                            />
                        </div>
                    )}

                    {/* Header */}
                    <div className={`${logoUrl ? 'pt-4' : 'pt-8'} pb-4`}>
                        <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
                            Perfil
                        </h1>
                        <p className="text-default-500 font-body">
                            Administra tu cuenta
                        </p>
                    </div>

                    {/* Profile Info */}
                    <Card>
                        <CardHeader className="flex gap-3">
                            <div className="bg-primary rounded-full p-3">
                                <Icon icon="solar:user-bold" className="text-white text-2xl" />
                            </div>
                            <div className="flex flex-col">
                                <p className="text-md font-heading font-semibold">
                                    {clientProfile ? `${clientProfile.name} ${clientProfile.last_name || ''}`.trim() : 'Client'}
                                </p>
                                <p className="text-small text-default-500 font-body">{clientProfile?.email}</p>
                            </div>
                        </CardHeader>
                        <CardBody className="space-y-4">
                            {clientProfile?.phone && (
                                <div className="flex items-center gap-3">
                                    <Icon icon="solar:phone-bold" className="text-default-400 text-xl" />
                                    <div>
                                        <p className="text-xs text-default-500 font-body">Teléfono</p>
                                        <p className="text-sm font-body">{clientProfile.phone}</p>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <Icon icon="solar:calendar-bold" className="text-default-400 text-xl" />
                                <div>
                                    <p className="text-xs text-default-500 font-body">Miembro Desde</p>
                                    <p className="text-sm font-body">
                                        {new Date(clientProfile?.sign_up_date).toLocaleDateString('es-ES')}
                                    </p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader>
                            <h3 className="font-heading font-semibold">Acciones Rápidas</h3>
                        </CardHeader>
                        <CardBody className="space-y-2">
                            <LogoutButton />
                        </CardBody>
                    </Card>
                </div>
            </div>
            <ClientBottomNav />
        </>
    );
}


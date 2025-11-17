"use client";

import { ClientBottomNav } from '@/components/client-dashboard/bottom-nav';
import { Card, CardBody } from '@heroui/react';
import { Icon } from '@iconify/react';

interface ProgramsContentProps {
    logoUrl?: string;
    trainerName: string;
}

export function ProgramsContent({ logoUrl, trainerName }: ProgramsContentProps) {
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
                            Programas
                        </h1>
                        <p className="text-default-500 font-body">
                            Tus programas de entrenamiento
                        </p>
                    </div>

                    {/* Empty State */}
                    <Card>
                        <CardBody className="py-12">
                            <div className="text-center">
                                <Icon icon="solar:dumbbell-line-duotone" className="text-default-300 text-6xl mx-auto mb-4" />
                                <h3 className="text-lg font-heading font-semibold mb-2">Sin Programas Aún</h3>
                                <p className="text-default-500 font-body text-sm">
                                    Tu entrenador te asignará programas pronto
                                </p>
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </div>
            <ClientBottomNav />
        </>
    );
}


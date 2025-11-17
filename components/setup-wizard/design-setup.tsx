"use client";

import { useSetupWizard } from '@/lib/setup-wizard/context';
import { Button, Divider } from '@heroui/react';
import { Icon } from '@iconify/react';

import ColorSetup from './color-setup';
import LogoSetup from './logo-setup';
import TypographySetup from './typography-setup';

export default function DesignSetup() {
    const { state, actions } = useSetupWizard();

    return (
        <div className="flex flex-col gap-8 w-full">
            {/* Colors Section */}
            <div>
                <ColorSetup />
            </div>

            {/* Elegant Divider */}
            <div className="flex items-center justify-center py-4">
                <div className="flex items-center gap-4">
                    <Divider className="w-16 bg-gradient-to-r from-transparent to-gray-300" />
                    <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: state.colors?.primary || '#3b82f6' }}
                    ></div>
                    <Divider className="w-16 bg-gradient-to-l from-transparent to-gray-300" />
                </div>
            </div>

            {/* Logo Section */}
            <div>
                <LogoSetup />
            </div>

            {/* Elegant Divider */}
            <div className="flex items-center justify-center py-4">
                <div className="flex items-center gap-4">
                    <Divider className="w-16 bg-gradient-to-r from-transparent to-gray-300" />
                    <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: state.colors?.primary || '#3b82f6' }}
                    ></div>
                    <Divider className="w-16 bg-gradient-to-l from-transparent to-gray-300" />
                </div>
            </div>

            {/* Typography Section */}
            <div>
                <TypographySetup />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between pt-6 border-t border-gray-200">
                <Button
                    variant="bordered"
                    className="border-gray-300"
                    startContent={<Icon icon="solar:arrow-left-linear" />}
                    onPress={actions.prevStep}
                >
                    Anterior
                </Button>

                <Button
                    color="primary"
                    endContent={<Icon icon="solar:arrow-right-linear" />}
                    onPress={actions.nextStep}
                    size="lg"
                >
                    Siguiente: Revisar
                </Button>
            </div>
        </div>
    );
}

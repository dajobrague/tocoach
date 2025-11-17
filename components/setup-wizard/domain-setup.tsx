"use client";

import { useSetupWizard } from '@/lib/setup-wizard/context';
import { Button, Card, CardBody, Chip, Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';

export default function DomainSetup() {
    const { state, actions } = useSetupWizard();
    // Extract just the subdomain part (remove .localhost)
    const currentSubdomain = state.domain.desired.replace('.localhost', '');
    const [inputValue, setInputValue] = useState(currentSubdomain);
    const [lastCheckedValue, setLastCheckedValue] = useState('');

    // Debounced domain checking - only check when input changes and stops
    useEffect(() => {
        if (!inputValue || inputValue.length < 3) return;

        const fullDomain = `${inputValue}.localhost`;

        // Don't check if it's the same as what we last checked
        if (fullDomain === lastCheckedValue || fullDomain === state.domain.current) return;

        const timeoutId = setTimeout(() => {
            setLastCheckedValue(fullDomain);
            actions.checkDomainAvailability(fullDomain);
        }, 800); // Increased delay to reduce API calls

        return () => clearTimeout(timeoutId);
    }, [inputValue, actions, state.domain.current, lastCheckedValue]);

    const handleDomainChange = (value: string) => {
        // Only allow valid characters for subdomain
        const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
        setInputValue(sanitized);
        actions.setDomain(`${sanitized}.localhost`);
    };

    const handleSuggestionClick = (suggestion: string) => {
        const subdomain = suggestion.replace('.localhost', '');
        setInputValue(subdomain);
        actions.setDomain(suggestion);
        setLastCheckedValue(suggestion);
        actions.checkDomainAvailability(suggestion);
    };

    const getInputStatus = () => {
        if (state.domain.isChecking) return 'default';
        if (state.domain.isAvailable === true) return 'success';
        if (state.domain.isAvailable === false) return 'danger';
        return 'default';
    };

    const getStatusMessage = () => {
        if (state.domain.isChecking) return 'Verificando disponibilidad...';
        if (state.domain.isAvailable === true) {
            return state.domain.desired === state.domain.current
                ? '✅ Este es tu dominio actual'
                : '✅ Dominio disponible';
        }
        if (state.domain.isAvailable === false) return '❌ Dominio no disponible';
        return 'Introduce tu dominio deseado';
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-heading font-bold text-black mb-2">
                    Personaliza tu dominio
                </h2>
                <p className="text-gray-600 font-body">
                    Elige el dominio donde tus clientes accederán a tu plataforma de coaching
                </p>
            </div>

            {/* Current Domain Info */}
            {state.domain.current && (
                <Card className="bg-blue-50 border border-blue-200">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-3">
                            <Icon icon="solar:info-circle-linear" className="text-blue-600 text-xl" />
                            <div>
                                <p className="text-small font-medium text-blue-800">Dominio actual (temporal)</p>
                                <p className="text-small text-blue-600 font-mono">{state.domain.current}</p>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* Domain Input */}
            <div className="space-y-3">
                <Input
                    label="Tu subdominio"
                    placeholder="mi-coaching"
                    value={inputValue}
                    onValueChange={handleDomainChange}
                    variant="bordered"
                    className="font-body w-full"
                    color={getInputStatus()}
                    description={getStatusMessage()}
                    startContent={
                        <div className="text-default-400 text-sm">
                            https://
                        </div>
                    }
                    endContent={
                        <div className="flex items-center gap-1">
                            <span className="text-default-400 text-sm font-medium">.localhost</span>
                            <div className="w-px h-4 bg-gray-300 mx-1"></div>
                            {state.domain.isChecking ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            ) : state.domain.isAvailable === true ? (
                                <Icon icon="solar:check-circle-bold" className="text-success text-xl" />
                            ) : state.domain.isAvailable === false ? (
                                <Icon icon="solar:close-circle-bold" className="text-danger text-xl" />
                            ) : null}
                        </div>
                    }
                />

                {/* Domain Rules */}
                <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-black mb-2">Reglas para el dominio:</h4>
                    <ul className="text-xs text-gray-600 space-y-1">
                        <li>• Solo letras, números y guiones</li>
                        <li>• Mínimo 3 caracteres, máximo 30</li>
                        <li>• Debe terminar en .localhost (para desarrollo)</li>
                        <li>• No puede empezar o terminar con guión</li>
                    </ul>
                </div>
            </div>

            {/* Suggestions */}
            {state.domain.suggestions.length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold text-black mb-3">Sugerencias disponibles:</h4>
                    <div className="flex flex-wrap gap-2">
                        {state.domain.suggestions.map((suggestion, index) => (
                            <Chip
                                key={index}
                                className="cursor-pointer hover:bg-blue-100"
                                color="primary"
                                variant="bordered"
                                onClick={() => handleSuggestionClick(suggestion)}
                            >
                                {suggestion}
                            </Chip>
                        ))}
                    </div>
                </div>
            )}

            {/* Error Display */}
            {state.errors.domain && (
                <Card className="bg-red-50 border border-red-200">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-3">
                            <Icon icon="solar:danger-circle-linear" className="text-red-600 text-xl" />
                            <p className="text-small text-red-800">{state.errors.domain}</p>
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between pt-4">
                <Button
                    variant="bordered"
                    className="border-gray-300"
                    startContent={<Icon icon="solar:arrow-left-linear" />}
                    onPress={() => window.history.back()}
                >
                    Volver al Dashboard
                </Button>

                <Button
                    color="primary"
                    endContent={<Icon icon="solar:arrow-right-linear" />}
                    isDisabled={!state.domain.isAvailable || state.domain.isChecking}
                    isLoading={state.isLoading}
                    onPress={async () => {
                        try {
                            // Only save if domain has changed
                            if (state.domain.desired !== state.domain.current) {
                                await actions.saveDomain(state.domain.desired);
                            }
                            actions.nextStep();
                        } catch (error) {
                            // Error is handled in the context, just show it to user
                            console.error('Failed to save domain:', error);
                        }
                    }}
                >
                    {state.isLoading ? 'Guardando...' : 'Siguiente: Colores'}
                </Button>
            </div>
        </div>
    );
}

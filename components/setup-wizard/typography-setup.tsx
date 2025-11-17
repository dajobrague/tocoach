"use client";

import { useSetupWizard } from '@/lib/setup-wizard/context';
import { Button, Card, CardBody, Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useState } from 'react';

// Popular Google Fonts for coaching platforms
const FONT_OPTIONS = [
    {
        family: 'Poppins',
        category: 'Sans-serif',
        description: 'Moderno y amigable',
        weights: [300, 400, 500, 600, 700],
        preview: 'Transforma tu cuerpo con Poppins',
    },
    {
        family: 'Inter',
        category: 'Sans-serif',
        description: 'Legible y profesional',
        weights: [300, 400, 500, 600, 700],
        preview: 'Transforma tu cuerpo con Inter',
    },
    {
        family: 'Roboto',
        category: 'Sans-serif',
        description: 'Clásico y versátil',
        weights: [300, 400, 500, 700],
        preview: 'Transforma tu cuerpo con Roboto',
    },
    {
        family: 'Open Sans',
        category: 'Sans-serif',
        description: 'Neutral y legible',
        weights: [300, 400, 600, 700],
        preview: 'Transforma tu cuerpo con Open Sans',
    },
    {
        family: 'Montserrat',
        category: 'Sans-serif',
        description: 'Elegante y moderno',
        weights: [300, 400, 500, 600, 700],
        preview: 'Transforma tu cuerpo con Montserrat',
    },
    {
        family: 'Lato',
        category: 'Sans-serif',
        description: 'Cálido y humano',
        weights: [300, 400, 700],
        preview: 'Transforma tu cuerpo con Lato',
    },
    {
        family: 'Playfair Display',
        category: 'Serif',
        description: 'Elegante y sofisticado',
        weights: [400, 500, 600, 700],
        preview: 'Transforma tu cuerpo con Playfair',
    },
    {
        family: 'Merriweather',
        category: 'Serif',
        description: 'Tradicional y confiable',
        weights: [300, 400, 700],
        preview: 'Transforma tu cuerpo con Merriweather',
    },
];

// Predefined font pairings that work well together
const FONT_PAIRINGS = [
    {
        name: 'Moderno y Limpio',
        heading: { family: 'Poppins', weights: [400, 600, 700] },
        body: { family: 'Inter', weights: [300, 400, 500] },
    },
    {
        name: 'Profesional',
        heading: { family: 'Montserrat', weights: [400, 600, 700] },
        body: { family: 'Open Sans', weights: [300, 400, 600] },
    },
    {
        name: 'Elegante',
        heading: { family: 'Playfair Display', weights: [400, 600, 700] },
        body: { family: 'Lato', weights: [300, 400, 700] },
    },
    {
        name: 'Clásico',
        heading: { family: 'Merriweather', weights: [400, 700] },
        body: { family: 'Open Sans', weights: [300, 400, 600] },
    },
];

export default function TypographySetup() {
    const { state, actions } = useSetupWizard();
    const [customFontUrl, setCustomFontUrl] = useState('');
    const [customFontError, setCustomFontError] = useState('');
    const [isLoadingFont, setIsLoadingFont] = useState(false);
    const [customFontTarget, setCustomFontTarget] = useState<'heading' | 'body'>('heading');

    const handleFontPairingSelect = (pairing: typeof FONT_PAIRINGS[0]) => {
        actions.setHeadingFont(pairing.heading.family, pairing.heading.weights);
        actions.setBodyFont(pairing.body.family, pairing.body.weights);
    };

    // Parse Google Fonts URL to extract font family and weights
    const parseGoogleFontsUrl = (url: string): { family: string; weights: number[] } | null => {
        try {
            // Example: https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap
            // or: https://fonts.googleapis.com/css?family=Roboto:400,700

            const familyMatch = url.match(/family=([^:&]+)/);
            if (!familyMatch || !familyMatch[1]) return null;

            const fontFamily = decodeURIComponent(familyMatch[1]).replace(/\+/g, ' ');

            // Extract weights
            const weightsMatch = url.match(/wght@([\d;]+)|:(\d+(?:,\d+)*)/);
            let weights: number[] = [400]; // Default weight

            if (weightsMatch) {
                const weightsStr = weightsMatch[1] || weightsMatch[2];
                if (weightsStr) {
                    weights = weightsStr.split(/[;,]/).map(w => parseInt(w)).filter(w => !isNaN(w));
                }
            }

            return { family: fontFamily, weights };
        } catch (error) {
            return null;
        }
    };

    // Load custom Google Font
    const handleLoadCustomFont = async () => {
        setCustomFontError('');

        if (!customFontUrl.trim()) {
            setCustomFontError('Por favor ingresa una URL de Google Fonts');
            return;
        }

        // Validate URL format
        if (!customFontUrl.includes('fonts.googleapis.com')) {
            setCustomFontError('Por favor ingresa una URL válida de Google Fonts');
            return;
        }

        setIsLoadingFont(true);

        try {
            const parsed = parseGoogleFontsUrl(customFontUrl);

            if (!parsed) {
                setCustomFontError('No se pudo parsear la URL. Verifica el formato');
                setIsLoadingFont(false);
                return;
            }

            // Load the font by adding a link tag to the document
            const existingLink = document.querySelector(`link[href="${customFontUrl}"]`);
            if (!existingLink) {
                const link = document.createElement('link');
                link.href = customFontUrl;
                link.rel = 'stylesheet';
                document.head.appendChild(link);

                // Wait for font to load
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            // Apply to the selected font type (heading or body)
            if (customFontTarget === 'heading') {
                actions.setHeadingFont(parsed.family, parsed.weights);
            } else {
                actions.setBodyFont(parsed.family, parsed.weights);
            }

            setCustomFontUrl('');
            setIsLoadingFont(false);

        } catch (error) {
            setCustomFontError('Error al cargar la fuente. Intenta nuevamente');
            setIsLoadingFont(false);
        }
    };

    const FontPreviewCard = ({
        font,
        isSelected,
        onClick,
        type
    }: {
        font: typeof FONT_OPTIONS[0];
        isSelected: boolean;
        onClick: () => void;
        type: 'heading' | 'body';
    }) => (
        <Card
            isPressable
            className={`border transition-all ${isSelected
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
                }`}
            onPress={onClick}
        >
            <CardBody className="p-4">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h5 className="font-semibold text-black">{font.family}</h5>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {font.category}
                        </span>
                    </div>

                    <p
                        className={`${type === 'heading' ? 'text-xl font-semibold' : 'text-sm'}`}
                        style={{ fontFamily: font.family }}
                    >
                        {font.preview}
                    </p>

                    <p className="text-xs text-gray-600">{font.description}</p>

                    {isSelected && (
                        <div className="flex items-center gap-2 text-blue-600">
                            <Icon icon="solar:check-circle-bold" className="text-sm" />
                            <span className="text-xs font-medium">Seleccionado</span>
                        </div>
                    )}
                </div>
            </CardBody>
        </Card>
    );

    return (
        <div className="space-y-6">
            <div>
                <h4 className="text-md font-semibold text-black mb-4 flex items-center gap-2">
                    <Icon icon="solar:text-field-linear" className="text-blue-600" />
                    Tipografía
                </h4>
            </div>

            {/* Font Pairings */}
            <div>
                <h5 className="text-sm font-medium text-black mb-3">Combinaciones recomendadas</h5>
                <div className="grid grid-cols-2 gap-3">
                    {FONT_PAIRINGS.map((pairing, index) => (
                        <Card
                            key={index}
                            isPressable
                            className="border border-gray-200 hover:border-blue-300 transition-colors"
                            onPress={() => handleFontPairingSelect(pairing)}
                        >
                            <CardBody className="p-4">
                                <div className="space-y-2">
                                    <h6 className="font-semibold text-black text-sm">{pairing.name}</h6>
                                    <div className="space-y-1">
                                        <p
                                            className="text-sm font-semibold"
                                            style={{ fontFamily: pairing.heading.family }}
                                        >
                                            {pairing.heading.family}
                                        </p>
                                        <p
                                            className="text-xs text-gray-600"
                                            style={{ fontFamily: pairing.body.family }}
                                        >
                                            {pairing.body.family}
                                        </p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Custom Google Font */}
            <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
                <CardBody className="p-6">
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-50">
                                <Icon icon="solar:link-circle-linear" className="text-2xl text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <h5 className="text-sm font-semibold text-black mb-1">Agregar fuente personalizada</h5>
                                <p className="text-xs text-gray-600 mb-3">
                                    Pega la URL de Google Fonts para usar cualquier fuente de su catálogo
                                </p>

                                {/* Font Type Selection */}
                                <div className="flex gap-2 mb-3">
                                    <Button
                                        size="sm"
                                        variant={customFontTarget === 'heading' ? 'solid' : 'bordered'}
                                        color={customFontTarget === 'heading' ? 'primary' : 'default'}
                                        onPress={() => setCustomFontTarget('heading')}
                                        startContent={<Icon icon="solar:text-bold-linear" />}
                                    >
                                        Para Títulos
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={customFontTarget === 'body' ? 'solid' : 'bordered'}
                                        color={customFontTarget === 'body' ? 'primary' : 'default'}
                                        onPress={() => setCustomFontTarget('body')}
                                        startContent={<Icon icon="solar:text-linear" />}
                                    >
                                        Para Texto
                                    </Button>
                                </div>

                                <div className="flex gap-2">
                                    <Input
                                        value={customFontUrl}
                                        onValueChange={setCustomFontUrl}
                                        placeholder="https://fonts.googleapis.com/css2?family=..."
                                        variant="bordered"
                                        className="flex-1"
                                        size="sm"
                                        isInvalid={!!customFontError}
                                        errorMessage={customFontError}
                                        startContent={<Icon icon="solar:link-linear" className="text-gray-400" />}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleLoadCustomFont();
                                            }
                                        }}
                                    />
                                    <Button
                                        color="primary"
                                        size="md"
                                        onPress={handleLoadCustomFont}
                                        isLoading={isLoadingFont}
                                        isDisabled={!customFontUrl.trim()}
                                        startContent={!isLoadingFont && <Icon icon="solar:download-linear" />}
                                    >
                                        Cargar
                                    </Button>
                                </div>

                                <div className="mt-3 space-y-1">
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <Icon icon="solar:info-circle-linear" className="text-blue-500" />
                                        Visita <a href="https://fonts.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Fonts</a> para buscar fuentes
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Ejemplo: <code className="bg-gray-200 px-1 rounded text-xs">https://fonts.googleapis.com/css2?family=Roboto:wght@400;700</code>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Heading Font Selection */}
            <div>
                <h5 className="text-sm font-medium text-black mb-3">Fuente para títulos</h5>
                <div className="grid md:grid-cols-2 gap-4">
                    {FONT_OPTIONS.map((font) => (
                        <FontPreviewCard
                            key={`heading-${font.family}`}
                            font={font}
                            isSelected={state.fonts?.heading?.family === font.family}
                            onClick={() => actions.setHeadingFont(font.family, font.weights)}
                            type="heading"
                        />
                    ))}
                </div>
            </div>

            {/* Body Font Selection */}
            <div>
                <h5 className="text-sm font-medium text-black mb-3">Fuente para texto</h5>
                <div className="grid md:grid-cols-2 gap-4">
                    {FONT_OPTIONS.map((font) => (
                        <FontPreviewCard
                            key={`body-${font.family}`}
                            font={font}
                            isSelected={state.fonts?.body?.family === font.family}
                            onClick={() => actions.setBodyFont(font.family, font.weights)}
                            type="body"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

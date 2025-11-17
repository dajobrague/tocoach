"use client";

import { useSetupWizard } from '@/lib/setup-wizard/context';
import { Button, Card, CardBody, Divider, Input, Spacer, Textarea } from '@heroui/react';
import { Icon } from '@iconify/react';
import React from 'react';

// Add scrollbar-hide styles
const scrollbarHideStyles = `
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }
    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
`;

export default function LivePreview() {
    const { state } = useSetupWizard();
    const [viewMode, setViewMode] = React.useState<'mobile' | 'desktop'>('desktop');
    const [hoveredButton, setHoveredButton] = React.useState<string | null>(null);

    // Generate CSS variables from current state with safe fallbacks
    const cssVariables = {
        '--color-primary': state.colors?.primary || '#3b82f6',
        '--color-secondary': state.colors?.secondary || '#6366f1',
        '--color-text-h1': state.colors?.text?.h1 || '#1f2937',
        '--color-text-h2': state.colors?.text?.h2 || '#374151',
        '--color-text-h3': state.colors?.text?.h3 || '#4b5563',
        '--color-text-body': state.colors?.text?.body || '#6b7280',
        '--color-text-muted': state.colors?.text?.muted || '#9ca3af',
        '--color-bg-primary': state.colors?.background?.primary || '#ffffff',
        '--color-bg-secondary': state.colors?.background?.secondary || '#f9fafb',
        '--color-bg-accent': state.colors?.background?.accent || '#f3f4f6',
        '--color-surface-1': state.colors?.surface?.["1"] || '#ffffff',
        '--color-surface-2': state.colors?.surface?.["2"] || '#f8fafc',
        '--color-surface-3': state.colors?.surface?.["3"] || '#f1f5f9',
        '--color-btn-primary-bg': state.colors?.buttons?.primary?.bg || '#3b82f6',
        '--color-btn-primary-text': state.colors?.buttons?.primary?.text || '#ffffff',
        '--color-btn-primary-hover': state.colors?.buttons?.primary?.hover || '#2563eb',
        '--color-btn-secondary-bg': state.colors?.buttons?.secondary?.bg || '#f3f4f6',
        '--color-btn-secondary-text': state.colors?.buttons?.secondary?.text || '#374151',
        '--color-btn-secondary-hover': state.colors?.buttons?.secondary?.hover || '#e5e7eb',
        '--shadow-light': `0 1px 3px ${state.colors?.shadows?.light || 'rgba(0, 0, 0, 0.05)'}`,
        '--shadow-medium': `0 4px 6px ${state.colors?.shadows?.medium || 'rgba(0, 0, 0, 0.1)'}`,
        '--shadow-dark': `0 10px 25px ${state.colors?.shadows?.dark || 'rgba(0, 0, 0, 0.25)'}`,
        '--font-heading': state.fonts?.heading?.family || 'Poppins',
        '--font-body': state.fonts?.body?.family || 'Inter',
    } as React.CSSProperties;

    const logoComponent = () => {
        const getSizeClass = () => {
            if (viewMode === 'mobile') {
                return state.logo.size === 'small' ? 'h-5' : state.logo.size === 'large' ? 'h-8' : 'h-6';
            }
            return state.logo.size === 'small' ? 'h-6' : state.logo.size === 'large' ? 'h-10' : 'h-8';
        };

        const getTextSizeClass = () => {
            if (viewMode === 'mobile') {
                return state.logo.size === 'small' ? 'text-base' : state.logo.size === 'large' ? 'text-xl' : 'text-lg';
            }
            return state.logo.size === 'small' ? 'text-lg' : state.logo.size === 'large' ? 'text-2xl' : 'text-xl';
        };

        if (state.logo?.url) {
            return (
                <img
                    src={state.logo.url}
                    alt={state.logo.text || 'Logo'}
                    className={getSizeClass()}
                />
            );
        }

        if (state.logo?.text) {
            return (
                <span
                    className={`font-bold ${getTextSizeClass()}`}
                    style={{
                        fontFamily: state.fonts?.heading?.family || 'Poppins',
                        color: state.colors?.primary || '#3b82f6'
                    }}
                >
                    {state.logo.text}
                </span>
            );
        }

        return (
            <span
                className={`font-bold ${viewMode === 'mobile' ? 'text-lg' : 'text-xl'}`}
                style={{
                    fontFamily: state.fonts?.heading?.family || 'Poppins',
                    color: state.colors?.primary || '#3b82f6'
                }}
            >
                TU MARCA
            </span>
        );
    };

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: scrollbarHideStyles }} />
            <div className="flex flex-col h-full overflow-hidden">
                {/* Preview Controls */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white flex-shrink-0">
                    <h3 className="font-heading font-semibold text-black">Vista Previa en Tiempo Real</h3>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant={viewMode === 'mobile' ? 'solid' : 'bordered'}
                            color={viewMode === 'mobile' ? 'primary' : 'default'}
                            startContent={<Icon icon="solar:phone-linear" />}
                            onPress={() => setViewMode('mobile')}
                        >
                            Móvil
                        </Button>
                        <Button
                            size="sm"
                            variant={viewMode === 'desktop' ? 'solid' : 'bordered'}
                            color={viewMode === 'desktop' ? 'primary' : 'default'}
                            startContent={<Icon icon="solar:monitor-linear" />}
                            onPress={() => setViewMode('desktop')}
                        >
                            Escritorio
                        </Button>
                    </div>
                </div>

                {/* Preview Content */}
                <div className="flex-1 p-4 bg-gray-100 overflow-auto" style={{ overscrollBehavior: 'contain' }}>
                    {/* Browser Mockup */}
                    <div className={`mx-auto transition-all duration-300 ${viewMode === 'mobile' ? 'max-w-sm' : 'max-w-4xl'
                        }`}>
                        {/* Browser Chrome */}
                        <div className="bg-gray-200 rounded-t-lg p-3 border-b border-gray-300">
                            <div className="flex items-center gap-2 mb-2">
                                {/* Browser Controls */}
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                                </div>

                                {/* Address Bar */}
                                <div className="flex-1 mx-4">
                                    <div className="bg-white rounded-md px-3 py-1.5 text-sm text-gray-700 border border-gray-300 flex items-center gap-2">
                                        <Icon icon="solar:lock-linear" className="text-green-600 text-xs" />
                                        <span className="font-mono">
                                            {state.domain?.desired || 'tu-dominio.localhost'}
                                        </span>
                                    </div>
                                </div>

                                {/* Browser Actions */}
                                <div className="flex gap-1">
                                    <div className="w-6 h-6 bg-gray-300 rounded flex items-center justify-center">
                                        <Icon icon="solar:refresh-linear" className="text-gray-600 text-xs" />
                                    </div>
                                    <div className="w-6 h-6 bg-gray-300 rounded flex items-center justify-center">
                                        <Icon icon="solar:bookmark-linear" className="text-gray-600 text-xs" />
                                    </div>
                                </div>
                            </div>

                            {/* Browser Tab */}
                            <div className="flex">
                                <div className="bg-white rounded-t-md px-4 py-1 border-l border-t border-r border-gray-300 max-w-xs">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-sm flex-shrink-0"
                                            style={{ backgroundColor: state.colors?.primary || '#3b82f6' }}
                                        ></div>
                                        <span className="text-xs text-gray-700 truncate">
                                            {state.logo?.text || 'Tu Plataforma'} - Coaching
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-gray-100 rounded-t-md px-3 py-1 ml-1 border-l border-t border-r border-gray-300">
                                    <span className="text-xs text-gray-500">+</span>
                                </div>
                            </div>
                        </div>

                        {/* Website Content */}
                        <div
                            className="bg-white shadow-lg overflow-hidden"
                            style={cssVariables}
                        >
                            {/* Header */}
                            <header
                                className={`${viewMode === 'mobile' ? 'px-4 py-4' : 'px-6 py-6'}`}
                                style={{ backgroundColor: state.colors?.background?.primary || '#ffffff' }}
                            >
                                <div className={`flex items-center ${state.logo?.position === 'center' ? 'justify-center' : state.logo?.position === 'right' ? 'justify-end' : 'justify-between'}`}>
                                    {logoComponent()}
                                    {viewMode === 'mobile' && state.logo?.position !== 'center' && (
                                        <button className="p-2">
                                            <Icon icon="solar:hamburger-menu-linear" className="text-2xl" style={{ color: state.colors?.primary }} />
                                        </button>
                                    )}
                                </div>
                                <Spacer y={viewMode === 'mobile' ? 1 : 2} />
                                <Divider className="bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                            </header>

                            {/* Hero Section */}
                            <section
                                className={`${viewMode === 'mobile' ? 'px-4 py-8' : 'px-6 py-12'} text-center`}
                                style={{ backgroundColor: state.colors?.background?.primary || '#ffffff' }}
                            >
                                <h1
                                    className={`${viewMode === 'mobile' ? 'text-2xl' : 'text-4xl'} font-bold mb-3`}
                                    style={{
                                        fontFamily: state.fonts?.heading?.family || 'Poppins',
                                        color: state.colors?.text?.h1 || '#1f2937'
                                    }}
                                >
                                    Transforma tu cuerpo
                                </h1>
                                <p
                                    className={`${viewMode === 'mobile' ? 'text-base mb-6' : 'text-lg mb-8'}`}
                                    style={{
                                        fontFamily: state.fonts?.body?.family || 'Inter',
                                        color: state.colors?.text?.body || '#6b7280'
                                    }}
                                >
                                    Entrenamientos personalizados diseñados específicamente para ti
                                </p>
                                <div className={`flex ${viewMode === 'mobile' ? 'flex-col' : 'flex-row'} gap-3 ${viewMode === 'mobile' ? 'px-2' : 'justify-center'}`}>
                                    <button
                                        className={`font-semibold rounded-xl border-0 cursor-pointer transition-all ${viewMode === 'mobile' ? 'w-full py-3.5 px-6' : 'px-8 py-3'
                                            }`}
                                        style={{
                                            backgroundColor: hoveredButton === 'hero-primary'
                                                ? (state.colors?.buttons?.primary?.hover || '#2563eb')
                                                : (state.colors?.buttons?.primary?.bg || '#3b82f6'),
                                            color: state.colors?.buttons?.primary?.text || '#ffffff',
                                            fontFamily: state.fonts?.body?.family || 'Inter',
                                            boxShadow: `var(--shadow-medium)`,
                                            fontSize: viewMode === 'mobile' ? '1rem' : '1.125rem'
                                        }}
                                        onMouseEnter={() => setHoveredButton('hero-primary')}
                                        onMouseLeave={() => setHoveredButton(null)}
                                    >
                                        Empezar ahora
                                    </button>
                                    <button
                                        className={`font-semibold rounded-xl border-0 cursor-pointer transition-all ${viewMode === 'mobile' ? 'w-full py-3.5 px-6' : 'px-8 py-3'
                                            }`}
                                        style={{
                                            backgroundColor: hoveredButton === 'hero-secondary'
                                                ? (state.colors?.buttons?.secondary?.hover || '#e5e7eb')
                                                : (state.colors?.buttons?.secondary?.bg || '#f3f4f6'),
                                            color: state.colors?.buttons?.secondary?.text || '#374151',
                                            fontFamily: state.fonts?.body?.family || 'Inter',
                                            boxShadow: `var(--shadow-light)`,
                                            fontSize: viewMode === 'mobile' ? '1rem' : '1.125rem'
                                        }}
                                        onMouseEnter={() => setHoveredButton('hero-secondary')}
                                        onMouseLeave={() => setHoveredButton(null)}
                                    >
                                        Más información
                                    </button>
                                </div>
                            </section>

                            {/* Features Section */}
                            <section
                                className={`${viewMode === 'mobile' ? 'py-8' : 'px-6 py-12'}`}
                                style={{ backgroundColor: state.colors.background.secondary }}
                            >
                                <h2
                                    className={`${viewMode === 'mobile' ? 'text-xl px-4' : 'text-2xl'} font-bold text-center mb-6`}
                                    style={{
                                        fontFamily: state.fonts?.heading?.family || 'Poppins',
                                        color: state.colors?.text?.h2 || '#374151'
                                    }}
                                >
                                    ¿Por qué elegir nuestro coaching?
                                </h2>

                                {/* Mobile Horizontal Carousel */}
                                {viewMode === 'mobile' ? (
                                    <div className="relative">
                                        <div
                                            className="flex gap-3 overflow-x-auto px-4 pb-4 snap-x snap-mandatory scrollbar-hide"
                                            style={{
                                                scrollbarWidth: 'none',
                                                msOverflowStyle: 'none'
                                            }}
                                        >
                                            {[
                                                { icon: 'solar:user-heart-linear', title: 'Personalizado', desc: 'Planes adaptados a ti' },
                                                { icon: 'solar:chart-2-linear', title: 'Seguimiento', desc: 'Progreso en tiempo real' },
                                                { icon: 'solar:medal-star-linear', title: 'Resultados', desc: 'Garantía de éxito' },
                                            ].map((feature, index) => (
                                                <Card
                                                    key={index}
                                                    className="border border-gray-200 snap-center flex-shrink-0"
                                                    style={{
                                                        backgroundColor: state.colors.background.primary,
                                                        boxShadow: `var(--shadow-light)`,
                                                        width: '280px'
                                                    }}
                                                >
                                                    <CardBody className="p-5 text-center">
                                                        <div
                                                            className="w-12 h-12 rounded-lg mx-auto mb-3 flex items-center justify-center"
                                                            style={{ backgroundColor: state.colors.background.accent }}
                                                        >
                                                            <Icon
                                                                icon={feature.icon}
                                                                className="text-2xl"
                                                                style={{ color: state.colors.primary }}
                                                            />
                                                        </div>
                                                        <h3
                                                            className="font-semibold mb-2 text-base"
                                                            style={{
                                                                fontFamily: state.fonts?.heading?.family || 'Poppins',
                                                                color: state.colors?.text?.h3 || '#4b5563'
                                                            }}
                                                        >
                                                            {feature.title}
                                                        </h3>
                                                        <p
                                                            className="text-sm"
                                                            style={{
                                                                fontFamily: state.fonts?.body?.family || 'Inter',
                                                                color: state.colors?.text?.body || '#6b7280'
                                                            }}
                                                        >
                                                            {feature.desc}
                                                        </p>
                                                    </CardBody>
                                                </Card>
                                            ))}
                                        </div>
                                        {/* Scroll Indicators */}
                                        <div className="flex justify-center gap-2 mt-3">
                                            {[0, 1, 2].map((dot) => (
                                                <div
                                                    key={dot}
                                                    className="w-2 h-2 rounded-full"
                                                    style={{
                                                        backgroundColor: state.colors.primary,
                                                        opacity: 0.3
                                                    }}
                                                ></div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    /* Desktop Grid */
                                    <div className="grid gap-4 grid-cols-3">
                                        {[
                                            { icon: 'solar:user-heart-linear', title: 'Personalizado', desc: 'Planes adaptados a ti' },
                                            { icon: 'solar:chart-2-linear', title: 'Seguimiento', desc: 'Progreso en tiempo real' },
                                            { icon: 'solar:medal-star-linear', title: 'Resultados', desc: 'Garantía de éxito' },
                                        ].map((feature, index) => (
                                            <Card
                                                key={index}
                                                className="border border-gray-200"
                                                style={{
                                                    backgroundColor: state.colors.background.primary,
                                                    boxShadow: `var(--shadow-light)`
                                                }}
                                            >
                                                <CardBody className="p-6 text-center">
                                                    <div
                                                        className="w-12 h-12 rounded-lg mx-auto mb-3 flex items-center justify-center"
                                                        style={{ backgroundColor: state.colors.background.accent }}
                                                    >
                                                        <Icon
                                                            icon={feature.icon}
                                                            className="text-2xl"
                                                            style={{ color: state.colors.primary }}
                                                        />
                                                    </div>
                                                    <h3
                                                        className="font-semibold mb-1 text-lg"
                                                        style={{
                                                            fontFamily: state.fonts?.heading?.family || 'Poppins',
                                                            color: state.colors?.text?.h3 || '#4b5563'
                                                        }}
                                                    >
                                                        {feature.title}
                                                    </h3>
                                                    <p
                                                        className="text-sm"
                                                        style={{
                                                            fontFamily: state.fonts?.body?.family || 'Inter',
                                                            color: state.colors?.text?.body || '#6b7280'
                                                        }}
                                                    >
                                                        {feature.desc}
                                                    </p>
                                                </CardBody>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </section>

                            {/* Contact Form Section */}
                            <section
                                className={`${viewMode === 'mobile' ? 'px-4 py-8' : 'px-6 py-12'}`}
                                style={{ backgroundColor: state.colors?.background?.accent || '#f3f4f6' }}
                            >
                                <div className="max-w-md mx-auto">
                                    <h2
                                        className={`${viewMode === 'mobile' ? 'text-xl' : 'text-2xl'} font-bold text-center mb-6`}
                                        style={{
                                            fontFamily: state.fonts?.heading?.family || 'Poppins',
                                            color: state.colors?.text?.h2 || '#374151'
                                        }}
                                    >
                                        Contacta conmigo
                                    </h2>
                                    <Card
                                        className={viewMode === 'mobile' ? 'p-4' : 'p-6'}
                                        style={{
                                            backgroundColor: state.colors.background.primary,
                                            boxShadow: `var(--shadow-medium)`
                                        }}
                                    >
                                        <CardBody className="space-y-3 p-0">
                                            <Input
                                                label="Nombre"
                                                placeholder="Tu nombre completo"
                                                variant="bordered"
                                                style={{ fontFamily: state.fonts?.body?.family || 'Inter' }}
                                            />
                                            <Input
                                                label="Email"
                                                placeholder="tu@email.com"
                                                type="email"
                                                variant="bordered"
                                                style={{ fontFamily: state.fonts?.body?.family || 'Inter' }}
                                            />
                                            <Textarea
                                                label="Mensaje"
                                                placeholder="Cuéntame sobre tus objetivos..."
                                                variant="bordered"
                                                style={{ fontFamily: state.fonts?.body?.family || 'Inter' }}
                                            />
                                            <button
                                                className={`w-full font-semibold rounded-xl border-0 cursor-pointer transition-all ${viewMode === 'mobile' ? 'py-3.5' : 'py-3'
                                                    }`}
                                                style={{
                                                    backgroundColor: hoveredButton === 'form-submit'
                                                        ? (state.colors?.buttons?.primary?.hover || '#2563eb')
                                                        : (state.colors?.buttons?.primary?.bg || '#3b82f6'),
                                                    color: state.colors?.buttons?.primary?.text || '#ffffff',
                                                    fontFamily: state.fonts?.body?.family || 'Inter',
                                                    boxShadow: `var(--shadow-medium)`,
                                                    fontSize: viewMode === 'mobile' ? '1rem' : '1.125rem'
                                                }}
                                                onMouseEnter={() => setHoveredButton('form-submit')}
                                                onMouseLeave={() => setHoveredButton(null)}
                                            >
                                                Enviar mensaje
                                            </button>
                                        </CardBody>
                                    </Card>
                                </div>
                            </section>

                            {/* Footer */}
                            <footer
                                className={`${viewMode === 'mobile' ? 'px-4 py-6' : 'px-6 py-8'} text-center`}
                                style={{ backgroundColor: state.colors?.background?.secondary || '#f9fafb' }}
                            >
                                <p
                                    className={viewMode === 'mobile' ? 'text-xs' : 'text-sm'}
                                    style={{
                                        fontFamily: state.fonts?.body?.family || 'Inter',
                                        color: state.colors?.text?.muted || '#9ca3af'
                                    }}
                                >
                                    © 2024 {state.logo?.text || 'Tu Marca'}. Todos los derechos reservados.
                                </p>
                            </footer>
                        </div>
                    </div>
                </div>

                {/* Preview Info */}
                <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: state.colors.primary }}
                            ></div>
                            <span className="text-gray-600">Color primario: {state.colors.primary}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Icon icon="solar:eye-linear" className="text-gray-400" />
                            <span className="text-gray-600">Vista: {viewMode}</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

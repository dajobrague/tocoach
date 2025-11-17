"use client";

import { useRouter } from "next/navigation";
import React from "react";

// Force recompile v2

import AnalyticsContent from "@/components/dashboard/analytics-content";
import ClientsContent from "@/components/dashboard/clients-content";
import MessagingContent from "@/components/dashboard/messaging-content";
import dashboardSidebarItems from "@/components/dashboard/sidebar-items";
import TopNavigation from "@/components/dashboard/top-navigation";

interface TrainerSession {
    trainer_id: string;
    tenant_host: string;
    email: string;
    full_name?: string;
    onboarding_completed?: boolean;
}

export default function TrainerDashboard() {
    const router = useRouter();
    const [session, setSession] = React.useState<TrainerSession | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [activeSection, setActiveSection] = React.useState(() => {
        // Try to get saved section from localStorage
        if (typeof window !== 'undefined') {
            return localStorage.getItem('activeSection') || 'analytics';
        }
        return 'analytics';
    });

    React.useEffect(() => {
        console.log('[TrainerDashboard] Component mounted, checking session...');

        // Check session on client side - MUST include credentials to send cookies
        fetch('/api/auth/session', { credentials: 'same-origin' })
            .then(res => {
                console.log('[TrainerDashboard] Session API response:', res.status);
                return res.json();
            })
            .then(data => {
                console.log('[TrainerDashboard] Session data:', data);
                console.log('[TrainerDashboard] data.session value:', data.session);
                console.log('[TrainerDashboard] data.session type:', typeof data.session);
                console.log('[TrainerDashboard] Has session?', !!data.session);
                if (data.session) {
                    console.log('[TrainerDashboard] Session found, setting state');
                    setSession(data.session);
                } else {
                    console.log('[TrainerDashboard] No session, redirecting to /trainer/login');
                    router.push('/trainer/login');
                }
            })
            .catch((error) => {
                console.error('[TrainerDashboard] Session check error:', error);
                router.push('/trainer/login');
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [router]);

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/trainer/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const handleSectionChange = (key: string) => {
        setActiveSection(key);
        // Save to localStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem('activeSection', key);
        }
    };

    // Restore active section on mount
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('activeSection');
            if (saved) {
                setActiveSection(saved);
            }
        }
    }, []);

    // Handle navigation for setup section
    React.useEffect(() => {
        if (activeSection === 'setup' && !isLoading && session) {
            // Only navigate if onboarding is not completed
            if (!session.onboarding_completed) {
                router.push('/trainer/dashboard/setup');
            } else {
                // If onboarding is completed but setup is selected, reset to analytics
                console.log('[Dashboard] Onboarding completed, resetting activeSection to analytics');
                setActiveSection('analytics');
                if (typeof window !== 'undefined') {
                    localStorage.setItem('activeSection', 'analytics');
                }
            }
        }
    }, [activeSection, isLoading, session, router]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-default-500 font-body">Cargando panel de control...</p>
                </div>
            </div>
        );
    }

    if (!session) {
        return null; // Will redirect to login
    }

    // Filter sidebar items based on onboarding status
    const filteredSidebarItems = dashboardSidebarItems.filter(item => {
        // Hide setup/onboarding if already completed
        if (item.key === 'setup' && session.onboarding_completed) {
            return false;
        }
        return true;
    });

    const renderContent = () => {
        switch (activeSection) {
            case "analytics":
                return <AnalyticsContent />;
            case "setup":
                // Navigation handled by useEffect
                return (
                    <div className="flex items-center justify-center h-96">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                            <p className="text-default-500 font-body">Redirigiendo a configuración...</p>
                        </div>
                    </div>
                );
            case "clients":
                return <ClientsContent />;
            case "messaging":
                return <MessagingContent />;
            default:
                return <AnalyticsContent />;
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            {/* Top Navigation */}
            <TopNavigation
                trainerName={session.full_name || session.email}
                trainerEmail={session.email}
                onLogout={handleLogout}
                items={filteredSidebarItems}
                activeSection={activeSection}
                onSelect={handleSectionChange}
            />

            {/* Main Content */}
            <main className="flex-1 w-full overflow-hidden">
                {renderContent()}
            </main>
        </div>
    );
}
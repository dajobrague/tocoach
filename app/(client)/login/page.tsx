import { ClientLoginForm } from '@/components/client-login-form';
import { getClientSession } from '@/lib/auth/client-session';
import { loadTenantContext } from '@/lib/tenant/loader';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function ClientLoginPage() {
    // Check if already logged in
    const session = await getClientSession();
    if (session) {
        redirect('/dashboard');
    }

    // Get tenant from subdomain
    const headersList = await headers();
    const tenantHost = headersList.get("x-tenant-host") || "";

    if (!tenantHost) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4 font-heading">Invalid Domain</h1>
                    <p className="font-body text-default-600">Please access this page through your trainer&apos;s domain.</p>
                </div>
            </div>
        );
    }

    // Load tenant for branding
    const tenantContext = await loadTenantContext(tenantHost);

    if (!tenantContext || tenantContext.status !== 'active') {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4 font-heading">Site Unavailable</h1>
                    <p className="font-body text-default-600">This training site is currently unavailable.</p>
                </div>
            </div>
        );
    }

    const trainerName = tenantContext.theme_json?.meta?.name || 'TopCoach';
    const logoUrl = tenantContext.logo_url || '';

    return (
        <div className="flex h-full w-full items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-md">
                {/* Branded Header */}
                <div className="flex flex-col items-center pb-8">
                    {logoUrl && (
                        <img
                            src={logoUrl}
                            alt={trainerName}
                            className="h-16 w-auto mb-4"
                        />
                    )}
                    <h1 className="text-3xl font-heading font-bold mb-4">{trainerName}</h1>
                    <h2 className="text-xl font-medium font-heading mb-2">Portal de Clientes</h2>
                    <p className="text-default-500 font-body text-center">
                        Inicia sesión para acceder a tus programas de entrenamiento
                    </p>
                </div>

                <ClientLoginForm tenantHost={tenantHost} />
            </div>
        </div>
    );
}


import { ProgramsContent } from '@/components/client-dashboard/programs-content';
import { getClientSession } from '@/lib/auth/client-session';
import { loadTenantContext } from '@/lib/tenant/loader';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function ProgramsPage() {
    const session = await getClientSession();

    if (!session) {
        redirect('/login');
    }

    // Load tenant context for branding
    const headersList = await headers();
    const tenantHost = headersList.get("x-tenant-host") || "";
    const tenantContext = await loadTenantContext(tenantHost);

    const logoUrl = tenantContext?.logo_url || '';
    const trainerName = tenantContext?.theme_json?.meta?.name || 'Your Trainer';

    return <ProgramsContent logoUrl={logoUrl} trainerName={trainerName} />;
}


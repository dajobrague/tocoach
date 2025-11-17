import { DashboardContent } from '@/components/client-dashboard/dashboard-content';
import { getClientSession } from '@/lib/auth/client-session';
import { loadTenantContext } from '@/lib/tenant/loader';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function ClientDashboardPage() {
    // Check client session
    const session = await getClientSession();

    if (!session) {
        redirect('/login');
    }

    // Load tenant context for branding
    const headersList = await headers();
    const tenantHost = headersList.get("x-tenant-host") || "";
    const tenantContext = await loadTenantContext(tenantHost);

    // Load client profile
    const { data: clientProfile } = await supabase
        .from('clients')
        .select('id, email, name, last_name, phone, profile_picture_url, sign_up_date')
        .eq('id', session.client_id)
        .single();

    const fullName = clientProfile ? `${clientProfile.name} ${clientProfile.last_name || ''}`.trim() : (session.full_name || 'Client');
    const firstName = clientProfile?.name || fullName.split(' ')[0];
    const logoUrl = tenantContext?.logo_url || '';
    const trainerName = tenantContext?.theme_json?.meta?.name || 'Your Trainer';
    const clientProfilePicture = clientProfile?.profile_picture_url || '';

    return (
        <DashboardContent
            firstName={firstName}
            logoUrl={logoUrl}
            trainerName={trainerName}
            clientProfilePicture={clientProfilePicture}
        />
    );
}


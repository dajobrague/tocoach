import { ProfileContent } from '@/components/client-dashboard/profile-content';
import { getClientSession } from '@/lib/auth/client-session';
import { loadTenantContext } from '@/lib/tenant/loader';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function ProfilePage() {
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
        .select('*')
        .eq('id', session.client_id)
        .single();

    const logoUrl = tenantContext?.logo_url || '';
    const trainerName = tenantContext?.theme_json?.meta?.name || 'Your Trainer';

    return <ProfileContent clientProfile={clientProfile} logoUrl={logoUrl} trainerName={trainerName} />;
}


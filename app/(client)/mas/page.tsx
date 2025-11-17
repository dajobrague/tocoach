import { MoreContent } from '@/components/client-dashboard/more-content';
import { getClientSession } from '@/lib/auth/client-session';
import { redirect } from 'next/navigation';

export default async function MasPage() {
    // Check client session
    const session = await getClientSession();

    if (!session) {
        redirect('/login');
    }

    return <MoreContent />;
}


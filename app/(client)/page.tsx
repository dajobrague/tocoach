import { getClientSession } from '@/lib/auth/client-session';
import { redirect } from 'next/navigation';

export default async function ClientRootPage() {
    // Check client session
    const session = await getClientSession();

    if (session) {
        // Authenticated - redirect to dashboard
        redirect('/dashboard');
    } else {
        // Not authenticated - redirect to login
        redirect('/login');
    }
}


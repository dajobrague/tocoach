// Get current trainer session API - v2
import { getTrainerSession } from '@/lib/auth/session';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
    console.log('=================================================');
    console.log('[Session API v3] ROUTE HANDLER CALLED');
    console.log('=================================================');
    try {
        const cookies = request.cookies.getAll();
        console.log('[Session API v3] Cookies received:', 
            cookies.map(c => ({ name: c.name, hasValue: !!c.value, valueLength: c.value?.length }))
        );
        
        console.log('[Session API v3] About to call getTrainerSession()');
        const session = await getTrainerSession();
        console.log('[Session API v3] getTrainerSession() returned:', session ? 'SESSION FOUND' : 'NULL');

        if (!session) {
            console.log('[Session API] No session found, returning null');
            const response = NextResponse.json(
                { session: null },
                { status: 200 }
            );
            // Prevent caching
            response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
            response.headers.set('Pragma', 'no-cache');
            response.headers.set('Expires', '0');
            return response;
        }

        console.log('[Session API] Session found:', { trainerId: session.trainer_id, email: session.email });

        // Fetch onboarding status from tenants table
        const { data: tenant, error } = await supabase
            .from('tenants')
            .select('onboarding_completed')
            .eq('trainer_id', session.trainer_id)
            .maybeSingle();

        if (error) {
            console.warn('[Session] Failed to fetch onboarding status:', error);
        }

        // Add onboarding_completed to session
        const enrichedSession = {
            ...session,
            onboarding_completed: tenant?.onboarding_completed ?? false
        };

        console.log('[Session API] Returning enriched session');
        const response = NextResponse.json(
            { session: enrichedSession },
            { status: 200 }
        );
        // Prevent caching
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        return response;

    } catch (error) {
        console.error('[Session] Error getting session:', error);
        return NextResponse.json(
            { session: null, error: 'Error al obtener la sesión' },
            { status: 500 }
        );
    }
}

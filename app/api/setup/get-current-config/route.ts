// Get current trainer configuration API
import { getTrainerSession } from '@/lib/auth/session';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
    try {
        // Check authentication
        const session = await getTrainerSession();
        if (!session) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        // Get tenant configuration directly using trainer_id (which is the auth user id)
        const { data: tenantDataArray, error: tenantError } = await supabase
            .from('tenants')
            .select('host, theme_json, status')
            .eq('trainer_id', session.trainer_id);

        const tenantData = tenantDataArray && tenantDataArray.length > 0 ? tenantDataArray[0] : null;

        // Try to get trainer data if it exists (optional)
        const { data: trainerDataArray } = await supabase
            .from('trainers')
            .select('tenant_host, full_name, email')
            .eq('id', session.trainer_id);

        const trainerData = trainerDataArray && trainerDataArray.length > 0 ? trainerDataArray[0] : null;

        // Use tenant data first, then session data, then trainer data as fallback
        const currentDomain = tenantData?.host || session.tenant_host || trainerData?.tenant_host || 'temp-domain.localhost';
        const themeJson = tenantData?.theme_json || null;

        return NextResponse.json({
            success: true,
            config: {
                trainer: {
                    id: session.trainer_id,
                    email: session.email || trainerData?.email,
                    fullName: session.full_name || trainerData?.full_name,
                },
                domain: {
                    current: currentDomain,
                    isConfigured: !!tenantData?.host, // true if domain is properly configured
                },
                theme: themeJson,
                status: tenantData?.status || 'inactive'
            }
        });

    } catch (error) {
        console.error('[Get Config] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

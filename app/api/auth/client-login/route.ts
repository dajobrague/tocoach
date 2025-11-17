// Client login API (plain text password authentication)
import { setClientSessionCookie, updateClientLastLogin } from '@/lib/auth/client-session';
import { createSupabaseClient } from '@/lib/clients/supabase-api';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    const supabase = createSupabaseClient();
    try {
        const body = await request.json();
        const { clientId, password, tenantHost } = body;

        // Validate required fields
        if (!clientId || !password || !tenantHost) {
            return NextResponse.json(
                { error: 'Client ID, password, and tenant are required' },
                { status: 400 }
            );
        }

        // Get client from database
        const { data: client, error: clientError } = await supabase
            .from('clients')
            .select('id, email, name, last_name, password, status, tenant')
            .eq('id', clientId)
            .single();

        if (clientError || !client) {
            console.error('[Client Login] Client not found:', clientError);
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Check if password is set
        if (!client.password || client.password.trim() === '') {
            return NextResponse.json(
                { error: 'Password not set. Please set up your password first.' },
                { status: 400 }
            );
        }

        // Verify password (plain text comparison)
        if (client.password !== password) {
            console.warn('[Client Login] Invalid password for:', client.email);
            return NextResponse.json(
                { error: 'Invalid password' },
                { status: 401 }
            );
        }

        // Check if client account is active
        if (client.status !== 'Activo' && client.status !== 'Onboarding Completado') {
            return NextResponse.json(
                { error: 'Your account is inactive. Please contact your trainer.' },
                { status: 403 }
            );
        }

        // Update last login timestamp (non-blocking)
        updateClientLastLogin(client.id).catch(console.warn);

        // Create session and set cookie
        const fullName = `${client.name} ${client.last_name || ''}`.trim();
        const response = NextResponse.json(
            {
                success: true,
                client: {
                    id: client.id,
                    email: client.email,
                    fullName: fullName,
                    tenantHost: tenantHost
                }
            },
            { status: 200 }
        );

        await setClientSessionCookie(
            response,
            client.id,
            tenantHost,
            client.email,
            fullName
        );

        console.log(`[Client Login] Successfully authenticated client: ${client.email} for tenant: ${tenantHost}`);

        return response;

    } catch (error) {
        console.error('[Client Login] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}


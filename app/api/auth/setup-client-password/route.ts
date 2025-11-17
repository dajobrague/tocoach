// Set up password for client (first time)
import { setClientSessionCookie, updateClientLastLogin } from '@/lib/auth/client-session';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Password validation
function validatePassword(password: string): { valid: boolean; error?: string } {
    if (password.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one capital letter' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one number' };
    }
    return { valid: true };
}

export async function POST(request: NextRequest) {
    try {
        const { clientId, password, confirmPassword, tenantHost } = await request.json();

        if (!clientId || !password || !confirmPassword || !tenantHost) {
            return NextResponse.json(
                { error: 'All fields are required' },
                { status: 400 }
            );
        }

        // Validate passwords match
        if (password !== confirmPassword) {
            return NextResponse.json(
                { error: 'Passwords do not match' },
                { status: 400 }
            );
        }

        // Validate password requirements
        const validation = validatePassword(password);
        if (!validation.valid) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            );
        }

        // Get client to verify they exist and don't already have a password
        const { data: client, error: fetchError } = await supabase
            .from('clients')
            .select('id, email, name, last_name, password, status, tenant')
            .eq('id', clientId)
            .single();

        if (fetchError || !client) {
            return NextResponse.json(
                { error: 'Client not found' },
                { status: 404 }
            );
        }

        // Check if password already set
        if (client.password && client.password.trim() !== '') {
            return NextResponse.json(
                { error: 'Password already set for this account' },
                { status: 400 }
            );
        }

        // Update password in database (plain text as per requirements)
        const { error: updateError } = await supabase
            .from('clients')
            .update({ password: password })
            .eq('id', clientId);

        if (updateError) {
            console.error('[Setup Password] Database update error:', updateError);
            return NextResponse.json(
                { error: 'Failed to set password' },
                { status: 500 }
            );
        }

        // Update last login timestamp (non-blocking)
        updateClientLastLogin(clientId).catch(console.warn);

        // Create session and set cookie
        const response = NextResponse.json(
            {
                success: true,
                message: 'Password set successfully',
                client: {
                    id: client.id,
                    email: client.email,
                    fullName: `${client.name} ${client.last_name || ''}`.trim(),
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
            `${client.name} ${client.last_name || ''}`.trim()
        );

        console.log(`[Setup Password] Password set for client: ${client.email}`);

        return response;

    } catch (error) {
        console.error('[Setup Password] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}


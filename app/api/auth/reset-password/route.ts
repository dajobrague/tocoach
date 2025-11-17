import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const { email, tenantHost } = await request.json();

        if (!email || !tenantHost) {
            return NextResponse.json(
                { error: 'Email and tenant are required' },
                { status: 400 }
            );
        }

        // Verify client exists for this tenant (don't reveal if user exists)
        const { data: client } = await supabase
            .from('client_profiles')
            .select('id, email')
            .eq('email', email.toLowerCase().trim())
            .eq('tenant_host', tenantHost)
            .single();

        // Always return success to prevent email enumeration
        if (!client) {
            console.log(`[Password Reset] No client found for ${email} on ${tenantHost}`);
            return NextResponse.json({ success: true }, { status: 200 });
        }

        // Send password reset email via Supabase
        // The reset link will redirect to: https://{tenantHost}/reset-password?token=...
        const resetUrl = `https://${tenantHost}/reset-password`;

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: resetUrl,
        });

        if (error) {
            console.error('[Password Reset] Supabase error:', error);
            // Still return success to prevent enumeration
        }

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error) {
        console.error('[Password Reset] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}


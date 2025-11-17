// Trainer login API
import { setSessionCookie, updateTrainerLastLogin } from '@/lib/auth/session';
import { createSupabaseClient } from '@/lib/clients/supabase-api';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    const supabase = createSupabaseClient();
    try {
        const body = await request.json();
        const { email, password } = body;

        // Validate required fields
        if (!email || !password) {
            return NextResponse.json(
                { error: 'El correo electrónico y la contraseña son obligatorios' },
                { status: 400 }
            );
        }

        // Authenticate with Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email.toLowerCase().trim(),
            password
        });

        if (authError || !authData.user) {
            console.warn('[Login] Authentication failed:', authError?.message);
            return NextResponse.json(
                { error: 'Correo electrónico o contraseña incorrectos' },
                { status: 401 }
            );
        }

        // Get trainer data
        const { data: trainerData, error: trainerError } = await supabase
            .from('trainers')
            .select('id, tenant_host, email, full_name, status')
            .eq('id', authData.user.id)
            .single();

        if (trainerError || !trainerData) {
            console.error('[Login] Trainer not found:', trainerError);
            return NextResponse.json(
                { error: 'Cuenta de entrenador no encontrada' },
                { status: 404 }
            );
        }

        // Check if trainer account is active
        if (trainerData.status !== 'active') {
            return NextResponse.json(
                { error: 'La cuenta está inactiva. Por favor, contacta con soporte.' },
                { status: 403 }
            );
        }

        // Update last login timestamp (non-blocking)
        updateTrainerLastLogin(authData.user.id).catch(console.warn);

        // Create session and set cookie
        const response = NextResponse.json(
            {
                success: true,
                trainer: {
                    id: trainerData.id,
                    email: trainerData.email,
                    fullName: trainerData.full_name,
                    tenantHost: trainerData.tenant_host
                }
            },
            { status: 200 }
        );

        // Trainers log in on main domain (localhost/topcoach.app), not their client subdomain
        // Pass empty string for tenant_host since they're not on a tenant subdomain
        // Their owned subdomain is stored in the trainers table separately
        await setSessionCookie(
            response,
            trainerData.id,
            "", // Empty for main domain - trainers are not on a tenant subdomain
            trainerData.email,
            trainerData.full_name || undefined
        );

        console.log(`[Login] Successfully authenticated trainer: ${trainerData.email}`);

        return response;

    } catch (error) {
        console.error('[Login] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

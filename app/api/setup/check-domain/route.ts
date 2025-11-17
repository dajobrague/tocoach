// Domain availability checking API
import { getTrainerSession } from '@/lib/auth/session';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function validateDomainFormat(domain: string): boolean {
    // For localhost development, allow .localhost domains
    // In production, this would validate real domains
    const pattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]\.localhost$/;
    return pattern.test(domain.toLowerCase().trim());
}

function generateDomainSuggestions(baseDomain: string): string[] {
    const baseName = baseDomain.replace('.localhost', '').toLowerCase();
    const sanitized = baseName.replace(/[^a-z0-9]/g, '').substring(0, 15);

    return [
        `${sanitized}-coach.localhost`,
        `${sanitized}-fitness.localhost`,
        `coach-${sanitized}.localhost`,
        `${sanitized}-training.localhost`,
        `${sanitized}123.localhost`,
    ].filter(suggestion => suggestion !== baseDomain);
}

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = await getTrainerSession();
        if (!session) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { domain } = body;

        if (!domain || typeof domain !== 'string') {
            return NextResponse.json(
                { error: 'Dominio requerido' },
                { status: 400 }
            );
        }

        const normalizedDomain = domain.toLowerCase().trim();

        // Validate domain format
        if (!validateDomainFormat(normalizedDomain)) {
            return NextResponse.json({
                isAvailable: false,
                error: 'Formato de dominio no válido. Usa: nombre.localhost',
                suggestions: generateDomainSuggestions(normalizedDomain),
            });
        }

        // Check if domain is already taken
        const { data: existingTenant } = await supabase
            .from('tenants')
            .select('host, trainer_id')
            .eq('host', normalizedDomain)
            .single();

        // If domain exists and belongs to current trainer, it's available for them
        if (existingTenant && existingTenant.trainer_id === session.trainer_id) {
            return NextResponse.json({
                isAvailable: true,
                message: 'Este es tu dominio actual',
                suggestions: [],
            });
        }

        // If domain exists and belongs to someone else, it's not available
        if (existingTenant) {
            return NextResponse.json({
                isAvailable: false,
                error: 'Este dominio ya está en uso',
                suggestions: generateDomainSuggestions(normalizedDomain),
            });
        }

        // Check if domain is in trainers table
        const { data: existingTrainer } = await supabase
            .from('trainers')
            .select('tenant_host, id')
            .eq('tenant_host', normalizedDomain)
            .single();

        if (existingTrainer && existingTrainer.id !== session.trainer_id) {
            return NextResponse.json({
                isAvailable: false,
                error: 'Este dominio ya está en uso',
                suggestions: generateDomainSuggestions(normalizedDomain),
            });
        }

        // Domain is available
        return NextResponse.json({
            isAvailable: true,
            message: 'Dominio disponible',
            suggestions: [],
        });

    } catch (error) {
        console.error('[Domain Check] Error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

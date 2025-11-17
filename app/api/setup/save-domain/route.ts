// Save domain configuration API
import { getTrainerSession } from '@/lib/auth/session';
import { createSupabaseClient } from '@/lib/clients/supabase-api';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    const supabase = createSupabaseClient();
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

        // Update trainer's tenant_host
        const { error: trainerError } = await supabase
            .from('trainers')
            .update({
                tenant_host: normalizedDomain,
                updated_at: new Date().toISOString()
            })
            .eq('id', session.trainer_id);

        if (trainerError) {
            console.error('[Save Domain] Trainer update error:', trainerError);
            return NextResponse.json(
                { error: 'Error al actualizar el perfil del entrenador' },
                { status: 500 }
            );
        }

        // First, find existing tenant for this trainer
        const { data: existingTenant, error: findError } = await supabase
            .from('tenants')
            .select('host, theme_json')
            .eq('trainer_id', session.trainer_id)
            .single();

        let tenantError;

        if (existingTenant) {
            // Update existing tenant record
            const updateData = {
                host: normalizedDomain,
                slug: normalizedDomain.split('.')[0],
                status: 'active' as const,
            };

            const { error } = await supabase
                .from('tenants')
                .update(updateData)
                .eq('trainer_id', session.trainer_id);

            tenantError = error;
            console.log(`[Save Domain] Updated existing tenant from ${existingTenant.host} to ${normalizedDomain}`);
        } else {
            // Create new tenant record
            const { error } = await supabase
                .from('tenants')
                .insert({
                    host: normalizedDomain,
                    slug: normalizedDomain.split('.')[0],
                    theme_slug: 'default',
                    trainer_id: session.trainer_id,
                    status: 'active',
                    theme_json: {
                        meta: {
                            name: session.full_name || 'Mi Plataforma',
                            description: `${session.full_name || 'Mi Plataforma'} - Plataforma de Coaching`
                        },
                        colors: {
                            brand: "#3b82f6",
                            surface: {
                                "1": "#ffffff",
                                "2": "#f8fafc"
                            }
                        },
                        fonts: {
                            heading: "Poppins",
                            body: "Poppins"
                        },
                        shadow: {
                            sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
                            md: "0 2px 4px -1px rgb(0 0 0 / 0.1)"
                        }
                    }
                });

            tenantError = error;
            console.log(`[Save Domain] Created new tenant record: ${normalizedDomain}`);
        }

        if (tenantError) {
            console.error('[Save Domain] Tenant operation error:', tenantError);
            return NextResponse.json(
                { error: 'Error al actualizar el registro del tenant' },
                { status: 500 }
            );
        }

        console.log(`[Save Domain] Successfully updated domain for trainer ${session.trainer_id}: ${normalizedDomain}`);

        return NextResponse.json({
            success: true,
            domain: normalizedDomain,
            message: 'Dominio guardado correctamente'
        });

    } catch (error) {
        console.error('[Save Domain] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
